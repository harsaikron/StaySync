const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e4b';

const PROMPTS = {
  confusion: (time, routine) => `You are a dementia care AI assistant. Analyse this image of a patient.
Detect if the person appears confused (blank stare, disorientation), is wandering without purpose, or is in an unexpected location given the time ${time} and routine: ${routine}.
Return ONLY valid JSON with no markdown: {"detected": true|false, "type": "confusion|wandering|normal", "severity": "low|medium|critical", "guidance": "short spoken sentence for patient", "reasoning": "one sentence"}`,

  fall: () => `Analyse this image for fall or unsafe posture. Is the person on the floor, fallen, or in a dangerous position?
Return ONLY valid JSON with no markdown: {"detected": true|false, "severity": "low|medium|critical", "guidance": "short spoken sentence for patient", "reasoning": "one sentence"}`,

  face: () => `Are there multiple people visible in this image? Is the patient calm or distressed?
Return ONLY valid JSON with no markdown: {"multiple_people": true|false, "patient_state": "calm|distressed|neutral", "guidance": "short spoken sentence", "reasoning": "one sentence"}`,

  routine: (time, routineJson) => `Current time is ${time}. The patient schedule is: ${routineJson}.
Based on this image, is the patient doing the correct activity?
Return ONLY valid JSON with no markdown: {"on_schedule": true|false, "current_activity": "string", "expected_activity": "string", "guidance": "short spoken sentence", "reasoning": "one sentence"}`,

  medicine: (time, action, scheduledTime) => `The time is ${time}. The patient is due to ${action} at ${scheduledTime}.
Look at this image and determine if the patient has already done this.
Return ONLY valid JSON with no markdown: {"completed": true|false, "guidance": "short spoken sentence", "reasoning": "one sentence"}`
};

async function analyseImage(base64Image, promptType, context = {}) {
  const promptFn = PROMPTS[promptType];
  if (!promptFn) throw new Error(`Unknown prompt type: ${promptType}`);

  const prompt = promptFn(
    context.time || new Date().toLocaleTimeString(),
    context.routine || '{}',
    context.action,
    context.scheduledTime
  );

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      images: [base64Image],
      stream: false,
      format: 'json'
    })
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

  const data = await response.json();
  return JSON.parse(data.response);
}

async function generateSummary(eventLogText, period) {
  const prompt = `You are a dementia care analyst. Here is a ${period} log of patient events:\n${eventLogText}\n
Write a concise ${period} summary for the caregiver. Include: overall trend (improving/stable/declining), peak confusion times, recommendations.
Return ONLY valid JSON with no markdown: {"summary": "2-3 sentence narrative", "trend": "improving|stable|declining", "suggestions": ["suggestion1", "suggestion2", "suggestion3"], "score": 0-100}`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: 'json' })
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.response);
}

module.exports = { analyseImage, generateSummary, PROMPTS };
