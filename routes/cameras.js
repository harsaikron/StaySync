const express = require('express');
const { getDb } = require('../db/index');

const router = express.Router();

router.get('/', (req, res) => {
  const cameras = getDb().prepare('SELECT * FROM cameras ORDER BY created_at DESC').all();
  const now = Math.floor(Date.now() / 1000);
  res.json(cameras.map(c => ({
    ...c,
    online: c.last_seen && (now - c.last_seen) < 15
  })));
});

router.post('/register', (req, res) => {
  const { id, name, location } = req.body;
  if (!id || !name || !location) return res.status(400).json({ error: 'id, name, location required' });
  getDb().prepare(
    'INSERT OR REPLACE INTO cameras (id, name, location) VALUES (?, ?, ?)'
  ).run(id, name, location);
  res.status(201).json({ id, name, location });
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM cameras WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
