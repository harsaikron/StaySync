const { PROMPTS } = require('../services/gemma');

test('confusion prompt includes time and routine', () => {
  const prompt = PROMPTS.confusion('08:00 AM', 'breakfast');
  expect(prompt).toContain('08:00 AM');
  expect(prompt).toContain('breakfast');
  expect(prompt).toContain('"type": "confusion|wandering|normal"');
});

test('fall prompt requests fall detection JSON', () => {
  const prompt = PROMPTS.fall();
  expect(prompt).toContain('"detected"');
  expect(prompt).toContain('"severity"');
});

test('all prompt types are defined', () => {
  const types = ['confusion', 'fall', 'face', 'routine', 'medicine'];
  for (const t of types) {
    expect(typeof PROMPTS[t]).toBe('function');
  }
});
