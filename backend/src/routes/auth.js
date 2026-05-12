const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const SALT_ROUNDS = 12;

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'nazwa użytkownika i hasło są wymagane' });
  }
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: 'nazwa użytkownika musi być między 3 a 50 znakami' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'hasło musi mieć co najmniej 6 znaków' });
  }
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    );
    const token = jwt.sign({ userId: rows[0].id, username: rows[0].username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: rows[0].username });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Nazwa użytkownika jest już zajęta' });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'nazwa użytkownika i hasło są wymagane' });
  }
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
    }
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
    }
    const token = jwt.sign({ userId: rows[0].id, username: rows[0].username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: rows[0].username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
