CREATE DATABASE IF NOT EXISTS cafeflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafeflow;

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  category ENUM('Coffee','Non-Coffee','Food','Dessert') NOT NULL DEFAULT 'Coffee',
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(1000) NOT NULL DEFAULT '',
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(24) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  table_number VARCHAR(20) NOT NULL DEFAULT 'Takeaway',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  subtotal DECIMAL(10,2) NOT NULL,
  status ENUM('Pending','Preparing','Ready','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_created (created_at),
  INDEX idx_orders_status (status)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  menu_item_id INT UNSIGNED NULL,
  item_name VARCHAR(120) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

INSERT INTO menu_items (name, description, category, price, image_url, is_available)
SELECT * FROM (
  SELECT 'Velvet Latte' name, 'Double espresso, silky steamed milk, subtle caramel finish.' description, 'Coffee' category, 32000.00 price, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=85' image_url, 1 is_available
) AS seed WHERE NOT EXISTS (SELECT 1 FROM menu_items LIMIT 1);

INSERT INTO menu_items (name, description, category, price, image_url) SELECT 'Brown Sugar Cold Brew','Slow-steeped coffee, brown sugar syrup and a clean finish.','Coffee',35000,'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=85' WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name='Brown Sugar Cold Brew');
INSERT INTO menu_items (name, description, category, price, image_url) SELECT 'Matcha Cloud','Ceremonial-style matcha with a soft creamy layer.','Non-Coffee',34000,'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=900&q=85' WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name='Matcha Cloud');
INSERT INTO menu_items (name, description, category, price, image_url) SELECT 'Butter Croissant','Golden, flaky pastry baked fresh every morning.','Food',26000,'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=85' WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name='Butter Croissant');
INSERT INTO menu_items (name, description, category, price, image_url) SELECT 'Midnight Tiramisu','Espresso-soaked layers with mascarpone cream and cocoa.','Dessert',38000,'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=85' WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name='Midnight Tiramisu');
