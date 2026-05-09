const express = require('express');
const { getDb } = require('../db/index');

const router = express.Router();

router.get('/', (req, res) => {
  const { patientId, severity, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM alerts WHERE dismissed = 0';
  const params = [];
  if (patientId) { query += ' AND patient_id = ?'; params.push(patientId); }
  if (severity) { query += ' AND severity = ?'; params.push(severity); }
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));
  res.json(getDb().prepare(query).all(...params));
});

router.post('/:id/dismiss', (req, res) => {
  getDb().prepare('UPDATE alerts SET dismissed = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
