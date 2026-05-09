const express = require('express');
const fs = require('fs');
const path = require('path');
const { upload } = require('../middleware/upload');
const { getDb } = require('../db/index');
const { analyseImage } = require('../services/gemma');
const { broadcast } = require('../services/sse');

const router = express.Router();

const ALL_TYPES = ['confusion', 'fall', 'face', 'routine'];

router.post('/:cameraId', upload.single('photo'), async (req, res) => {
  const { cameraId } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

  // Update camera last_seen
  getDb().prepare('UPDATE cameras SET last_seen = ? WHERE id = ?')
    .run(Math.floor(Date.now() / 1000), cameraId);

  const photoPath = req.file.path;
  const base64 = fs.readFileSync(photoPath, 'base64');

  // Find patient assigned to this camera
  const patients = getDb().prepare('SELECT * FROM patients').all();
  const patient = patients.find(p => {
    const ids = JSON.parse(p.camera_ids || '[]');
    return ids.includes(cameraId);
  });

  const context = {
    time: new Date().toLocaleTimeString(),
    routine: patient ? patient.routine : '{}'
  };

  const results = [];

  for (const type of ALL_TYPES) {
    try {
      const result = await analyseImage(base64, type, context);
      result.promptType = type;

      const severity = result.severity || (result.detected === false ? 'low' : 'medium');
      const guidance = result.guidance || '';
      const reasoning = result.reasoning || '';

      const event = getDb().prepare(`INSERT INTO events
        (camera_id, patient_id, type, severity, guidance, reasoning, photo_path, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(cameraId, patient?.id || null, type, severity, guidance, reasoning, photoPath, JSON.stringify(result));

      // Create alert for medium/critical detections
      const isAlert = (result.detected === true && severity !== 'low') ||
                      (result.patient_state === 'distressed') ||
                      (result.on_schedule === false);

      if (isAlert) {
        getDb().prepare(`INSERT INTO alerts (event_id, patient_id, camera_id, severity, guidance, photo_path)
          VALUES (?, ?, ?, ?, ?, ?)`
        ).run(event.lastInsertRowid, patient?.id || null, cameraId, severity, guidance, photoPath);
      }

      broadcast(cameraId, { type: 'analysis', promptType: type, severity, guidance, reasoning, photoPath });
      results.push(result);
    } catch (err) {
      console.error(`Gemma analysis failed for type=${type}:`, err.message);
    }
  }

  res.json({ ok: true, cameraId, results });
});

module.exports = router;
