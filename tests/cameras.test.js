process.env.UPLOAD_DIR = 'uploads-test';
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/cameras', require('../routes/cameras'));
});

afterAll(() => {
  const dbPath = path.join(__dirname, '..', 'staysync.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

test('POST /cameras/register creates a camera', async () => {
  const res = await request(app)
    .post('/cameras/register')
    .send({ id: 'cam-test-1', name: 'Living Room', location: 'living_room' });
  expect(res.status).toBe(201);
  expect(res.body.id).toBe('cam-test-1');
});

test('GET /cameras returns registered cameras', async () => {
  const res = await request(app).get('/cameras');
  expect(res.status).toBe(200);
  expect(res.body).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'cam-test-1', name: 'Living Room' })
  ]));
});

test('DELETE /cameras/:id removes a camera', async () => {
  const res = await request(app).delete('/cameras/cam-test-1');
  expect(res.status).toBe(200);
});
