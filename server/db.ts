// server/db.ts
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

export const db = new Database('restaurant.db');

export function initDb() {
  // run all CREATE TABLE statements (same as your current code)
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lat REAL,
      lng REAL,
      radius_meters INTEGER DEFAULT 100
    );
  `);

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

  // add the rest of your table creation here

  seedData();
}

function seedData() {
  const result = db.prepare('SELECT count(*) as count FROM restaurants').get() as { count: number };
  if (result.count > 0) return;

  const info = db.prepare('INSERT INTO restaurants (name, lat, lng) VALUES (?, ?, ?)').run(
    'Adarsh PVT.',
    26.563491406057995,
    85.53364655327498
  );

  const restaurantId = info.lastInsertRowid;
  const password = bcrypt.hashSync('password', 10);

  db.prepare(
    'INSERT INTO users (restaurant_id, username, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(restaurantId, 'admin', password, 'admin');

  db.prepare(
    'INSERT INTO users (restaurant_id, username, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(restaurantId, 'kitchen', password, 'kitchen');

  db.prepare(
    'INSERT INTO users (restaurant_id, username, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(restaurantId, 'billing', password, 'billing');

  // add the rest of your seed data
}
