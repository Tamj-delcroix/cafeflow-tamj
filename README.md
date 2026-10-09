# CafeFlow — Dark Luxury Cafe Ordering

CafeFlow is a responsive full-stack cafe menu and ordering demo built with HTML, CSS, JavaScript, Node.js, Express, and MySQL. It includes a customer menu, cart and checkout flow, plus a password-protected admin dashboard for menu management and order processing.

## Requirements
- Node.js 18 or newer
- MySQL 8+ or MariaDB (XAMPP is fine)
- npm

## 1. Create the database
1. Start MySQL in XAMPP.
2. Open phpMyAdmin at `http://localhost/phpmyadmin`.
3. Import `db/schema.sql`. It creates the `cafeflow` database, tables, and sample menu items.

## 2. Configure the app
Copy `.env.example` to `.env` in the project root. Replace **both** placeholder secrets before starting the server:
- `SESSION_SECRET`: a unique random string at least 32 characters long.
- `ADMIN_PASSWORD`: your own password, at least 12 characters long.

You can generate a session secret in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set your MySQL username/password to match your local XAMPP setup. Never commit `.env` or share real credentials. The server refuses to start while the provided secret/password values are still placeholders.

The initial admin account is created on first startup using `ADMIN_EMAIL` and `ADMIN_PASSWORD`; the password is stored as a bcrypt hash. Changing `ADMIN_PASSWORD` in `.env` later does **not** change an existing account's password.

## 3. Install and run
Open a terminal in this folder:

```bash
npm install
npm start
```

Open:
- Storefront: `http://localhost:3000`
- Admin dashboard: `http://localhost:3000/admin`
- Health check: `http://localhost:3000/api/health`

Sign in using the email/password you configured in `.env`.

## Features
- Menu loaded from MySQL with category filters
- Cart quantity controls and server-side price calculation
- Checkout form and generated order code
- Transactional order + order-item creation
- Admin login with bcrypt password verification and session cookie
- Session ID regeneration on login and logout invalidation
- Rate limits for sign-in (8 attempts per 15 minutes per IP) and order creation (20 per 10 minutes per IP)
- Same-origin checks for state-changing requests
- Content Security Policy and common security headers
- Admin dashboard metrics, order queue, and order status transitions
- Add/edit/delete menu items and toggle availability
- Input validation and parameterized SQL queries
- Responsive dark luxury UI with black, warm gold, and editorial serif typography

## Project structure

```text
cafeflow/
├── db/
│   └── schema.sql
├── public/
│   ├── css/
│   │   ├── style.css
│   │   └── admin.css
│   ├── js/
│   │   ├── app.js
│   │   └── admin.js
│   ├── index.html
│   └── admin.html
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## Before a real public launch
This project is suitable as a local demo/portfolio project after you configure `.env` and verify it against your own MySQL instance. Before public production use, also:
- Replace the default Express MemoryStore with a persistent session store (e.g. a MySQL/Redis-backed store).
- Put it behind HTTPS and set `NODE_ENV=production` only when HTTPS/proxy configuration is correct.
- Move rate limiting to a shared store if deploying multiple server instances.
- Add monitoring, backups, database least-privilege credentials, and a documented admin password-reset process.
- Consider a dedicated CSRF token implementation and operational protections for the exact deployment environment.
- Add payment gateway integration only if online payment is required; this starter marks orders as payable in person.

The `/api/health` endpoint verifies the database connection. It is not a full readiness/security audit.
