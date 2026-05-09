require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Snapshot: latest JPEG for a camera
app.get('/stream-snapshot/:cameraId', (req, res) => {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  try {
    const files = fs.readdirSync(uploadDir)
      .filter(f => f.startsWith(req.params.cameraId) && f.endsWith('.jpg'))
      .sort()
      .reverse();
    if (!files.length) return res.status(404).json({ error: 'No snapshot' });
    res.sendFile(path.resolve(uploadDir, files[0]));
  } catch {
    res.status(404).json({ error: 'No snapshot' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

app.use('/cameras', require('./routes/cameras'));
app.use('/patients', require('./routes/patients'));
app.use('/upload', require('./routes/upload'));
app.use('/feedback', require('./routes/feedback'));
app.use('/', require('./routes/stream'));
app.use('/', require('./routes/alerts'));
app.use('/', require('./routes/reports'));

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`StaySync backend on port ${PORT}`));
}

module.exports = app;
