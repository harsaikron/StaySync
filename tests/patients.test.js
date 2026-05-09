process.env.UPLOAD_DIR = 'uploads-test';
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/patients', require('../routes/patients'));
});

afterAll(() => {
  const dbPath = path.join(__dirname, '..', 'staysync.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

const patient = {
  id: 'pat-1',
  name: 'John Doe',
  age: 74,
  conditions: ["Alzheimer's"],
  medications: ['Donepezil 10mg'],
  emergency_contacts: [{ name: 'Jane Doe', phone: '555-0100' }],
  routine: { wake: '07:00', breakfast: '08:00', medicine: '08:15', lunch: '12:00', dinner: '18:00', sleep: '21:00' },
  camera_ids: []
};

test('POST /patients creates a patient', async () => {
  const res = await request(app).post('/patients').send(patient);
  expect(res.status).toBe(201);
  expect(res.body.name).toBe('John Doe');
});

test('GET /patients/:id returns patient', async () => {
  const res = await request(app).get('/patients/pat-1');
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('John Doe');
  expect(res.body.conditions).toEqual(["Alzheimer's"]);
});

test('PUT /patients/:id updates patient', async () => {
  const res = await request(app).put('/patients/pat-1').send({ age: 75 });
  expect(res.status).toBe(200);
  const get = await request(app).get('/patients/pat-1');
  expect(get.body.age).toBe(75);
});
