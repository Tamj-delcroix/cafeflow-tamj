require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = String(process.env.SESSION_SECRET || '');
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const MAX_PRICE = 99999999.99;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('cafeflow-invalid-login-timing-only', 12);
const ORDER_STATUSES = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
const ALLOWED_TRANSITIONS = {
  Pending: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Cancelled'],
  Ready: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: []
};

if (SESSION_SECRET.length < 32 || /replace|change-this|development-only/i.test(SESSION_SECRET)) {
  console.error('Startup blocked: set SESSION_SECRET in .env to a unique random value of at least 32 characters.');
  process.exit(1);
}
if (!ADMIN_EMAIL || !/^\S+@\S+\.\S+$/.test(ADMIN_EMAIL) || ADMIN_PASSWORD.length < 12 || /change-this|replace-with|your-password/i.test(ADMIN_PASSWORD)) {
  console.error('Startup blocked: set a valid ADMIN_EMAIL and a unique ADMIN_PASSWORD (at least 12 characters) in .env.');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cafeflow',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  charset: 'utf8mb4'
});

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'https:', 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '50kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Cross-origin request blocked.' });
      } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
    }
  }
  next();
});
app.use(session({
  name: 'cafeflow.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.use('/api/admin', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isAdmin = (req, res, next) => req.session.admin ? next() : res.status(401).json({ error: 'Please sign in as an admin.' });
const str = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const validImageUrl = value => {
  const url = str(value, 1000);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch { return null; }
};

// Small in-memory limiter is intended for local/demo use; use a shared store in production.
const rateBuckets = new Map();
function rateLimit({ windowMs, max, keyPrefix, message }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    let entry = rateBuckets.get(key);
    if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
    entry.count += 1;
    rateBuckets.set(key, entry);
    if (rateBuckets.size > 5000) {
      for (const [bucketKey, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'login', message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
const orderLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, keyPrefix: 'orders', message: 'Too many orders from this connection. Please wait a few minutes.' });

async function ensureAdmin() {
  const [rows] = await pool.execute('SELECT id FROM admins WHERE email = ? LIMIT 1', [ADMIN_EMAIL]);
  if (!rows.length) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await pool.execute('INSERT INTO admins (name,email,password_hash) VALUES (?,?,?)', [str(process.env.ADMIN_NAME || 'CafeFlow Admin', 100), ADMIN_EMAIL, hash]);
    console.log(`Initial admin created for ${ADMIN_EMAIL}. Credentials are stored as a bcrypt hash.`);
  }
}

app.get('/api/health', asyncRoute(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

app.get('/api/menu', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute("SELECT id,name,description,category,price,image_url,is_available FROM menu_items WHERE is_available=1 ORDER BY FIELD(category,'Coffee','Non-Coffee','Food','Dessert'), name");
  res.set('Cache-Control', 'no-store');
  res.json(rows);
}));

app.post('/api/orders', orderLimiter, asyncRoute(async (req, res) => {
  const customer = str(req.body.customerName, 120);
  const table = str(req.body.tableNumber || 'Takeaway', 20) || 'Takeaway';
  const notes = str(req.body.notes, 500);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!customer) return res.status(400).json({ error: 'Enter your name.' });
  if (!items.length || items.length > 30) return res.status(400).json({ error: 'Your cart is empty or too large.' });

  const quantities = new Map();
  for (const item of items) {
    const id = Number(item?.id);
    const quantity = Number(item?.quantity);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ error: 'One of the cart items is invalid.' });
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }
  if ([...quantities.values()].some(quantity => quantity > 20)) return res.status(400).json({ error: 'Maximum 20 of each item.' });

  const ids = [...quantities.keys()];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [menu] = await connection.query(
      `SELECT id,name,price FROM menu_items WHERE is_available=1 AND id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids
    );
    if (menu.length !== ids.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'A menu item is unavailable. Please refresh your cart.' });
    }
    const lines = menu.map(item => ({ ...item, quantity: quantities.get(item.id), lineTotal: Math.round(Number(item.price) * 100) * quantities.get(item.id) / 100 }));
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    if (!Number.isFinite(subtotal) || subtotal <= 0 || subtotal > MAX_PRICE) {
      await connection.rollback();
      return res.status(400).json({ error: 'The order total is outside the allowed range.' });
    }
    const orderCode = `CF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const [result] = await connection.execute(
      'INSERT INTO orders (order_code,customer_name,table_number,notes,subtotal) VALUES (?,?,?,?,?)',
      [orderCode, customer, table, notes, subtotal.toFixed(2)]
    );
    for (const line of lines) {
      await connection.execute(
        'INSERT INTO order_items (order_id,menu_item_id,item_name,unit_price,quantity,line_total) VALUES (?,?,?,?,?,?)',
        [result.insertId, line.id, line.name, Number(line.price).toFixed(2), line.quantity, line.lineTotal.toFixed(2)]
      );
    }
    await connection.commit();
    res.status(201).json({ message: 'Order received!', orderCode, subtotal });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}));

app.post('/api/admin/login', loginLimiter, asyncRoute(async (req, res) => {
  const email = str(req.body.email, 190).toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password || password.length > 200) return res.status(400).json({ error: 'Enter a valid email and password.' });
  const [rows] = await pool.execute('SELECT id,name,email,password_hash FROM admins WHERE email=? LIMIT 1', [email]);
  const valid = await bcrypt.compare(password, rows.length ? rows[0].password_hash : DUMMY_PASSWORD_HASH);
  if (!rows.length || !valid) return res.status(401).json({ error: 'Email or password is incorrect.' });
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.admin = { id: rows[0].id, name: rows[0].name, email: rows[0].email };
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  res.json({ admin: req.session.admin });
}));
app.get('/api/admin/me', (req, res) => res.json({ admin: req.session.admin || null }));
app.post('/api/admin/logout', (req, res, next) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('cafeflow.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({ ok: true });
  });
});

app.get('/api/admin/stats', isAdmin, asyncRoute(async (req, res) => {
  const [[orders]] = await pool.query("SELECT COUNT(*) total, COALESCE(SUM(status <> 'Cancelled'),0) active, COALESCE(SUM(status IN ('Pending','Preparing')),0) in_progress, COALESCE(SUM(CASE WHEN status='Completed' THEN subtotal ELSE 0 END),0) revenue FROM orders");
  const [[menu]] = await pool.query('SELECT COUNT(*) total FROM menu_items');
  res.set('Cache-Control', 'no-store');
  res.json({ ...orders, menuItems: menu.total });
}));
app.get('/api/admin/menu', isAdmin, asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM menu_items ORDER BY created_at DESC');
  res.set('Cache-Control', 'no-store');
  res.json(rows);
}));
function validateMenuBody(body) {
  const name = str(body.name, 120);
  const description = str(body.description, 500);
  const category = str(body.category, 30);
  const price = Number(body.price);
  const imageUrl = validImageUrl(body.imageUrl || '');
  if (!name || !['Coffee', 'Non-Coffee', 'Food', 'Dessert'].includes(category) || !Number.isFinite(price) || price <= 0 || price > MAX_PRICE || imageUrl === null) return null;
  return { name, description, category, price: price.toFixed(2), imageUrl, isAvailable: body.isAvailable === true || body.isAvailable === 1 || body.isAvailable === '1' };
}
app.post('/api/admin/menu', isAdmin, asyncRoute(async (req, res) => {
  const item = validateMenuBody(req.body);
  if (!item) return res.status(400).json({ error: 'Check the name, category, positive price, and HTTPS image URL.' });
  const [result] = await pool.execute('INSERT INTO menu_items (name,description,category,price,image_url,is_available) VALUES (?,?,?,?,?,?)', [item.name, item.description, item.category, item.price, item.imageUrl, item.isAvailable ? 1 : 0]);
  res.status(201).json({ id: result.insertId, message: 'Menu item created.' });
}));
app.put('/api/admin/menu/:id', isAdmin, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const item = validateMenuBody(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !item) return res.status(400).json({ error: 'Check the item ID, name, category, positive price, and HTTPS image URL.' });
  const [result] = await pool.execute('UPDATE menu_items SET name=?,description=?,category=?,price=?,image_url=?,is_available=? WHERE id=?', [item.name, item.description, item.category, item.price, item.imageUrl, item.isAvailable ? 1 : 0, id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Menu item not found.' });
  res.json({ message: 'Menu item updated.' });
}));
app.delete('/api/admin/menu/:id', isAdmin, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid menu item.' });
  const [result] = await pool.execute('DELETE FROM menu_items WHERE id=?', [id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Menu item not found.' });
  res.json({ message: 'Menu item deleted.' });
}));
app.get('/api/admin/orders', isAdmin, asyncRoute(async (req, res) => {
  const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100');
  if (!orders.length) return res.json([]);
  const ids = orders.map(order => order.id);
  const [items] = await pool.query(`SELECT order_id,item_name,unit_price,quantity,line_total FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids);
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.order_id)) grouped.set(item.order_id, []);
    grouped.get(item.order_id).push(item);
  }
  res.set('Cache-Control', 'no-store');
  res.json(orders.map(order => ({ ...order, items: grouped.get(order.id) || [] })));
}));
app.patch('/api/admin/orders/:id/status', isAdmin, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const nextStatus = str(req.body.status, 20);
  if (!Number.isSafeInteger(id) || id < 1 || !ORDER_STATUSES.includes(nextStatus)) return res.status(400).json({ error: 'Invalid order ID or status.' });
  const [rows] = await pool.execute('SELECT status FROM orders WHERE id=? LIMIT 1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Order not found.' });
  const currentStatus = rows[0].status;
  if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(nextStatus)) return res.status(409).json({ error: `Cannot change an order from ${currentStatus} to ${nextStatus}.` });
  const [updated] = await pool.execute('UPDATE orders SET status=? WHERE id=? AND status=?', [nextStatus, id, currentStatus]);
  if (!updated.affectedRows) return res.status(409).json({ error: 'This order changed just now. Refresh the queue and try again.' });
  res.json({ message: 'Order status updated.' });
}));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong. Check the server terminal and database connection.' });
});

(async () => {
  try {
    await pool.query('SELECT 1');
    await ensureAdmin();
    app.listen(PORT, () => console.log(`CafeFlow running at http://localhost:${PORT}`));
  } catch (error) {
    console.error('Could not connect to MySQL. Import db/schema.sql and check your .env file.\n', error.message);
    process.exit(1);
  }
})();
