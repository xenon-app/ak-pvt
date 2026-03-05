// server.ts
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

const app = express();
app.use(express.json());
app.use(cors());

const SECRET = 'your_jwt_secret'; // replace with env variable in production

// --- DATABASE SETUP ---
export const db = new Database('restaurant.db');

// --- TYPES ---
interface User {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'kitchen' | 'billing';
  restaurant_id: number;
}

// --- INIT DB FUNCTION ---
export function initDb() {
  // Restaurants
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lat REAL,
      lng REAL,
      radius_meters INTEGER DEFAULT 100
    );
  `);

  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'kitchen', 'billing')),
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'available' CHECK(status IN ('available', 'occupied')),
      current_session_token TEXT,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      name TEXT NOT NULL,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Menu Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      is_available BOOLEAN DEFAULT 1,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );
  `);

  // Orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      table_id INTEGER,
      customer_nickname TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'completed', 'paid')),
      total_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id),
      FOREIGN KEY(table_id) REFERENCES tables(id)
    );
  `);

  // Order Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      menu_item_id INTEGER,
      quantity INTEGER NOT NULL,
      price_at_time REAL NOT NULL,
      name_at_time TEXT NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
    );
  `);

  // Discounts
  db.exec(`
    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      code TEXT NOT NULL,
      percentage INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Update restaurant name if exists
  db.prepare("UPDATE restaurants SET name = 'Adarsh PVT.' WHERE id = 1").run();

  // Seed data
  seedData();
}

// --- SEED DATA ---
function seedData() {
  const result = db.prepare('SELECT count(*) as count FROM restaurants').get() as { count: number };
  if (result.count > 0) return;

  console.log('Seeding database...');
  const info = db.prepare('INSERT INTO restaurants (name, lat, lng) VALUES (?, ?, ?)').run(
    'Adarsh PVT.',
    26.563491406057995,
    85.53364655327498
  );
  const restaurantId = info.lastInsertRowid;

  const password = bcrypt.hashSync('password', 10);
  const insertUser = db.prepare('INSERT INTO users (restaurant_id, username, password_hash, role) VALUES (?, ?, ?, ?)');
  insertUser.run(restaurantId, 'admin', password, 'admin');
  insertUser.run(restaurantId, 'kitchen', password, 'kitchen');
  insertUser.run(restaurantId, 'billing', password, 'billing');

  const insertTable = db.prepare('INSERT INTO tables (restaurant_id, name) VALUES (?, ?)');
  ['Jaguar', 'Monkey', 'Tiger'].forEach(name => insertTable.run(restaurantId, name));

  const insertCategory = db.prepare('INSERT INTO categories (restaurant_id, name) VALUES (?, ?)');
  const insertItem = db.prepare('INSERT INTO menu_items (category_id, name, price, description) VALUES (?, ?, ?, ?)');

  // Food
  const foodCat = insertCategory.run(restaurantId, 'Food Items').lastInsertRowid;
  const foodItems = [
    { name: 'Pav Bhaji', price: 120 }, { name: 'Butter Pav Bhaji', price: 140 }, { name: 'Masala Dosa', price: 110 }
    // ... add rest
  ];
  foodItems.forEach(i => insertItem.run(foodCat, i.name, i.price, 'Delicious ' + i.name));
}

initDb();

// --- LOGIN ROUTE ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username) as User | undefined;

  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Invalid username or password' });

  const token = jwt.sign({ id: user.id, role: user.role, restaurantId: user.restaurant_id }, SECRET, { expiresIn: '1h' });

  return res.json({ token, role: user.role, restaurantId: user.restaurant_id });
});

// --- START SERVER ---
app.listen(3000, () => console.log('Server running on port 3000'));
