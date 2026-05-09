const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e4b';

const PROMPTS = {
  confusion: (time, routine) => `You are a warm, caring AI companion for a dementia patient. Analyse this image.
Detect if the person appears confused, disoriented, has a blank stare, or is wandering without purpose. The time is ${time} and their routine is: ${routine}.
Write the guidance as if you are gently speaking directly to them — use their first name if you know it, be reassuring and calm, like a kind friend. Keep it under 2 sentences.
Examples: "It looks like you might be feeling a little lost right now — that's okay. Let me help you find your way back to your chair."
Return ONLY valid JSON with no markdown: {"detected": true|false, "type": "confusion|wandering|normal", "severity": "low|medium|critical", "guidance": "warm spoken sentence directly to patient", "reasoning": "one sentence"}`,

  fall: () => `You are a caring AI companion watching over a dementia patient. Analyse this image carefully.
Check if the person has fallen, is on the floor, or is in a dangerous position. If they have fallen, speak to them gently and calmly — do not panic them.
Examples: "I can see you've had a little tumble — please stay still and I'll get help for you right away." or "You look like you're having trouble getting up — I'm here with you, help is coming."
Return ONLY valid JSON with no markdown: {"detected": true|false, "severity": "low|medium|critical", "guidance": "warm spoken sentence directly to patient", "reasoning": "one sentence"}`,

  face: () => `You are a caring AI companion for a dementia patient. Analyse this image.
Check if there are multiple people present and how the patient appears to feel — calm, distressed, or neutral.
If a stranger is present, gently check in with the patient. If they look upset, comfort them.
Examples: "I see you have a visitor — I hope you're having a lovely time." or "You look a little worried — I'm right here with you, you're safe."
Return ONLY valid JSON with no markdown: {"multiple_people": true|false, "patient_state": "calm|distressed|neutral", "guidance": "warm spoken sentence directly to patient", "reasoning": "one sentence"}`,

  routine: (time, routineJson) => `You are a gentle AI companion for a dementia patient. The time is ${time} and their daily schedule is: ${routineJson}.
Look at this image and check if they are doing the right activity. If they have forgotten or gone off-schedule, remind them warmly and simply.
Examples: "Good morning! It's nearly breakfast time — shall we head to the kitchen together?" or "It looks like it might be time for your afternoon rest — your bed is all comfy and ready for you."
Return ONLY valid JSON with no markdown: {"on_schedule": true|false, "current_activity": "string", "expected_activity": "string", "guidance": "warm spoken sentence directly to patient", "reasoning": "one sentence"}`,

  medicine: (time, action, scheduledTime) => `You are a caring AI companion for a dementia patient. It is ${time} and they are due to ${action} at ${scheduledTime}.
Look at this image. Have they already done this? If not, remind them gently and supportively — never alarming.
Examples: "It's time for your morning tablets! They're right there on the table with your glass of water — you've got this." or "Just a gentle reminder — your medication is waiting for you when you're ready."
Return ONLY valid JSON with no markdown: {"completed": true|false, "guidance": "warm spoken sentence directly to patient", "reasoning": "one sentence"}`
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

async function analyzeFeedback(feedbackItems) {
  const feedbackText = feedbackItems.map((f, i) =>
    `[${i + 1}] Category: ${f.category} | User: ${f.user_type}\nFeedback: ${f.message}`
  ).join('\n\n');

  const prompt = `You are an AI software architect for StaySync, a dementia care monitoring app. Caregivers and patients have submitted the following feedback tickets:\n\n${feedbackText}\n\nAnalyse all feedback and identify patterns. Generate concrete improvement proposals for the app.\n\nFor each improvement, suggest specific implementation details.\nReturn ONLY valid JSON with no markdown:\n{"improvements": [{"title": "short title", "description": "what to build and why", "code_suggestion": "key function or component to add/change (pseudocode ok)", "priority": "high|medium|low", "area": "camera|alerts|patients|navigation|performance|ai-detection"}], "summary": "2-3 sentences on overall feedback themes", "top_insight": "single most important finding"}`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: 'json' })
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.response);
}

module.exports = { analyseImage, generateSummary, analyzeFeedback, PROMPTS };
