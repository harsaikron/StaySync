const express = require('express');
const router = express.Router();
const { getDb } = require('../db/index');
const { analyzeFeedback } = require('../services/gemma');

// Submit feedback
router.post('/', (req, res) => {
  const { category, message, user_type = 'caregiver' } = req.body;
  if (!category || !message) return res.status(400).json({ error: 'category and message required' });

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO feedback (category, message, user_type) VALUES (?, ?, ?)'
  ).run(category, message, user_type);

  res.json({ id: result.lastInsertRowid, status: 'received' });
});

// List all feedback
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100').all();
  res.json(rows);
});

// List AI improvements
router.get('/improvements', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM ai_improvements ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows.map(r => ({ ...r, source_feedback_ids: JSON.parse(r.source_feedback_ids || '[]') })));
});

// Run Gemma 4 analysis on all pending feedback
router.post('/analyze', async (req, res) => {
  const db = getDb();
  const pending = db.prepare("SELECT * FROM feedback WHERE status = 'pending' ORDER BY created_at DESC LIMIT 30").all();

  if (!pending.length) return res.json({ message: 'No pending feedback to analyze', improvements: [] });

  let analysis;
  try {
    analysis = await analyzeFeedback(pending);
  } catch (err) {
    return res.status(500).json({ error: `Gemma analysis failed: ${err.message}` });
  }

  const ids = pending.map(f => f.id);

  // Mark feedback as analyzed
  db.prepare(`UPDATE feedback SET status = 'analyzed' WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);

  // Store improvements
  const insertImprovement = db.prepare(
    'INSERT INTO ai_improvements (title, description, code_suggestion, priority, area, source_feedback_ids) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const stored = (analysis.improvements || []).map(imp => {
    const r = insertImprovement.run(
      imp.title, imp.description, imp.code_suggestion || '', imp.priority || 'medium',
      imp.area || 'general', JSON.stringify(ids)
    );
    return { id: r.lastInsertRowid, ...imp };
  });

  res.json({ summary: analysis.summary, top_insight: analysis.top_insight, improvements: stored, analyzed_count: pending.length });
});

// Update improvement status
router.patch('/improvements/:id', (req, res) => {
  const { status } = req.body;
  if (!['proposed', 'in_review', 'implemented', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const db = getDb();
  db.prepare('UPDATE ai_improvements SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
