const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, title, content, created_at, updated_at FROM notes WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { title, content = '' } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'title is required' });
  }
  try {
    const { rows } = await db.query(
      'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
      [req.user.userId, title.trim(), content]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { title, content } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'title is required' });
  }
  try {
    const { rows } = await db.query(
      'UPDATE notes SET title = $1, content = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [title.trim(), content ?? '', req.params.id, req.user.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
