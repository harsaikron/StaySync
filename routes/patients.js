const express = require('express');
const { getDb } = require('../db/index');
const { randomUUID } = require('crypto');

const router = express.Router();

const parse = (patient) => ({
  ...patient,
  conditions: JSON.parse(patient.conditions || '[]'),
  medications: JSON.parse(patient.medications || '[]'),
  emergency_contacts: JSON.parse(patient.emergency_contacts || '[]'),
  routine: JSON.parse(patient.routine || '{}'),
  camera_ids: JSON.parse(patient.camera_ids || '[]'),
  notes: JSON.parse(patient.notes || '[]')
});

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
  res.json(rows.map(parse));
});

router.post('/', (req, res) => {
  const { id, name, age, photo, conditions, medications, emergency_contacts, routine, camera_ids } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const patientId = id || randomUUID();
  getDb().prepare(`INSERT OR REPLACE INTO patients
    (id, name, age, photo, conditions, medications, emergency_contacts, routine, camera_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(patientId, name, age || null, photo || null,
    JSON.stringify(conditions || []),
    JSON.stringify(medications || []),
    JSON.stringify(emergency_contacts || []),
    JSON.stringify(routine || {}),
    JSON.stringify(camera_ids || [])
  );
  res.status(201).json(parse(getDb().prepare('SELECT * FROM patients WHERE id = ?').get(patientId)));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(parse(row));
});

router.put('/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const merged = { ...parse(existing), ...req.body };
  getDb().prepare(`UPDATE patients SET name=?, age=?, photo=?, conditions=?, medications=?,
    emergency_contacts=?, routine=?, camera_ids=?, notes=? WHERE id=?`
  ).run(merged.name, merged.age, merged.photo,
    JSON.stringify(merged.conditions),
    JSON.stringify(merged.medications),
    JSON.stringify(merged.emergency_contacts),
    JSON.stringify(merged.routine),
    JSON.stringify(merged.camera_ids),
    JSON.stringify(merged.notes),
    req.params.id
  );
  res.json(parse(getDb().prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id)));
});

module.exports = router;
