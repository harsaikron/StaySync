let currentUtterance = null;

export function speakText(text, { rate = 0.9, pitch = 1, lang = 'en-US' } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = lang;
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech() {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}

export function isSpeaking() {
  return typeof window !== 'undefined' && window.speechSynthesis?.speaking;
}
