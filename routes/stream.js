const express = require('express');
const { addClient, removeClient } = require('../services/sse');

const router = express.Router();

router.get('/:cameraId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  res.write('data: {"type":"connected"}\n\n');

  addClient(req.params.cameraId, res);

  req.on('close', () => removeClient(req.params.cameraId, res));
});

module.exports = router;
