let currentUtterance = null;

// Pick the warmest available voice — prefers natural-sounding female voices
function pickVoice() {
  if (typeof window === 'undefined') return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferred = [
    'Samantha', 'Karen', 'Moira', 'Fiona',         // macOS
    'Google UK English Female',                      // Chrome
    'Microsoft Zira', 'Microsoft Jenny',             // Windows
  ];

  for (const name of preferred) {
    const v = voices.find(v => v.name.includes(name));
    if (v) return v;
  }
  // Fallback: first English female, then first English, then first available
  return (
    voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
    voices.find(v => v.lang.startsWith('en')) ||
    voices[0]
  );
}

export function speakText(text, { rate = 0.82, pitch = 1.05, lang = 'en-US' } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = lang;

  // Voices load async — try immediately, retry after load event
  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);

  // Chrome bug: voices may not be loaded yet on first call
  if (!voice) {
    window.speechSynthesis.onvoiceschanged = () => {
      const v = pickVoice();
      if (v && currentUtterance) currentUtterance.voice = v;
    };
  }
}

export function cancelSpeech() {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}

export function isSpeaking() {
  return typeof window !== 'undefined' && !!window.speechSynthesis?.speaking;
}
