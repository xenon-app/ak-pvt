// server/server.ts
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, initDb } from './db';

const app = express();
app.use(express.json());
app.use(cors());

const SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

interface User {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'kitchen' | 'billing';
  restaurant_id: number;
}

initDb();

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username) as User | undefined;

  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, restaurantId: user.restaurant_id },
    SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token, role: user.role, restaurantId: user.restaurant_id });
});

app.listen(3000, () => console.log('Server running on port 3000'));
