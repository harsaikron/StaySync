let currentUtterance = null;
let lastSpokenText = '';
let lastSpokenAt = 0;

function pickVoice() {
  if (typeof window === 'undefined') return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferred = [
    'Samantha', 'Karen', 'Moira', 'Fiona',
    'Google UK English Female',
    'Microsoft Zira', 'Microsoft Jenny',
  ];

  for (const name of preferred) {
    const v = voices.find(v => v.name.includes(name));
    if (v) return v;
  }
  return (
    voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
    voices.find(v => v.lang.startsWith('en')) ||
    voices[0]
  );
}

export function speakText(text, { rate = 0.82, pitch = 1.05, lang = 'en-US' } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Debounce: ignore identical text within 3 seconds (prevents Chrome repeat bug)
  const now = Date.now();
  if (text === lastSpokenText && now - lastSpokenAt < 3000) return;
  lastSpokenText = text;
  lastSpokenAt = now;

  window.speechSynthesis.cancel();
  currentUtterance = null;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = lang;

  utterance.onend = () => { currentUtterance = null; };
  utterance.onerror = () => { currentUtterance = null; };

  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } else {
    // Clear any stale handler before setting a new one
    window.speechSynthesis.onvoiceschanged = null;
    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      const v = pickVoice();
      if (v && currentUtterance === utterance) utterance.voice = v;
    };
  }
}

export function cancelSpeech() {
  if (typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();
  currentUtterance = null;
  lastSpokenText = '';
}

export function isSpeaking() {
  return typeof window !== 'undefined' && !!window.speechSynthesis?.speaking;
}
