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

// AI ask endpoint for FloatingAI
const { OLLAMA_URL = 'http://localhost:11434', OLLAMA_MODEL = 'gemma4:e4b' } = process.env;
app.post('/ai/ask', async (req, res) => {
  const { question, context } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question required' });

  const prompt = `You are a warm, caring AI companion for a dementia care app called StaySync. A caregiver or patient has asked you a question.\n\nContext (last guidance if any): ${context || 'none'}\n\nQuestion: ${question}\n\nAnswer helpfully and warmly in 1-2 sentences. Be reassuring and clear.`;

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    });
    if (!response.ok) throw new Error(`Ollama ${response.status}`);
    const data = await response.json();
    res.json({ answer: data.response?.trim() || "I'm here with you. How can I help?" });
  } catch {
    res.json({ answer: "I'm here with you. How can I help?" });
  }
});

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
