'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useTTS } from '@/providers/TTSProvider';
import { speakText, cancelSpeech, isSpeaking } from '@/lib/tts';
import { post } from '@/lib/api';
import Icon from '@/components/Icon';

const VOICE_COMMANDS = {
  repeat: ['repeat', 'again', 'say again', 'what', 'pardon'],
  stop:   ['stop', 'quiet', 'silence', 'enough'],
  help:   ['help', 'help me', 'i need help'],
};

function matchCommand(t) {
  const lower = t.toLowerCase();
  for (const [cmd, words] of Object.entries(VOICE_COMMANDS)) {
    if (words.some(w => lower.includes(w))) return cmd;
  }
  return null;
}

// Animated waveform bars
function Waveform({ active }) {
  const bars = [3, 5, 8, 6, 10, 7, 4, 9, 5, 7, 3, 6, 8, 4, 6];
  return (
    <div className="flex items-center justify-center gap-0.5 h-10" aria-hidden>
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all"
          style={{
            height: active ? `${h * 3}px` : '4px',
            background: active ? '#2563eb' : '#333',
            animationName: active ? 'wave' : 'none',
            animationDuration: `${0.4 + (i % 5) * 0.1}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationDelay: `${i * 0.05}s`,
            transition: 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

export default function FloatingAI() {
  const pathname = usePathname();
  const { lastMessage, repeat } = useTTS();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const recRef = useRef(null);
  const speakTimerRef = useRef(null);

  // ALL hooks must come before any conditional return
  const trackSpeaking = useCallback(() => {
    setSpeaking(isSpeaking());
    speakTimerRef.current = setTimeout(trackSpeaking, 200);
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-assistant', handler);
    return () => window.removeEventListener('open-ai-assistant', handler);
  }, []);

  useEffect(() => {
    if (open) {
      speakTimerRef.current = setTimeout(trackSpeaking, 200);
    } else {
      clearTimeout(speakTimerRef.current);
      setSpeaking(false);
    }
    return () => clearTimeout(speakTimerRef.current);
  }, [open, trackSpeaking]);

  // Guard AFTER all hooks — React requires hook count to be identical every render
  if (pathname?.startsWith('/settings')) return null;

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser'); return; }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    recRef.current = rec;

    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      const heard = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setTranscript(heard);
      if (e.results[0].isFinal) handleVoiceInput(heard);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const stopListening = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const handleVoiceInput = (text) => {
    const cmd = matchCommand(text);
    if (cmd === 'repeat') { repeat(); return; }
    if (cmd === 'stop') { cancelSpeech(); setAiReply(''); return; }
    if (cmd === 'help') {
      const helpMsg = "I've heard you — help is being summoned. Please stay where you are and stay calm. Press the emergency button on screen to alert your caregiver right away.";
      setAiReply(helpMsg);
      setTimeout(() => speakText(helpMsg), 100);
      return;
    }
    askAI(text);
  };

  const askAI = async (question) => {
    if (!question.trim()) return;
    setLoading(true);
    setAiReply('');
    setTextInput('');
    try {
      // Use the feedback/analyze style — ask Gemma as a care companion
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context: lastMessage }),
      });
      const data = await res.json();
      const reply = data.answer || data.guidance || "I'm here with you. How can I help?";
      setAiReply(reply);
      // Speak after a short pause so user interaction is clear
      setTimeout(() => speakText(reply), 100);
    } catch {
      const fallback = "I heard you — I'm here with you. If you need help, please say 'help'.";
      setAiReply(fallback);
      setTimeout(() => speakText(fallback), 100);
    }
    setLoading(false);
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim()) askAI(textInput);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[72px] right-4 z-40 w-14 h-14 bg-blue-600 rounded-full shadow-lg
          flex items-center justify-center text-white hover:bg-blue-500 active:scale-95 transition-all"
        aria-label="Open AI assistant"
      >
        {speaking
          ? <span className="flex gap-0.5 items-end h-5">{[3,5,7,5,3].map((h,i) => (
              <span key={i} className="w-1 bg-white rounded-full animate-pulse" style={{ height: `${h*3}px`, animationDelay: `${i*0.1}s` }} />
            ))}</span>
          : <Icon name="bot" size={26} />
        }
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
      )}

      {/* Bottom sheet — full height */}
      <div
        className={`fixed inset-0 z-50 border-t border-[var(--border,#222)]
          rounded-t-3xl transition-transform duration-300 ease-out flex flex-col`}
        style={{
          background: 'var(--surface,#111)',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {/* Close strip */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b" style={{ borderColor: 'var(--border,#222)' }}>
          <div className="flex items-center gap-2">
            <Icon name="bot" size={20} className="text-blue-400" />
            <span className="text-base font-bold" style={{ color: 'var(--text,#fff)' }}>AI Assistant</span>
          </div>
          <button
            onClick={() => { setOpen(false); cancelSpeech(); }}
            className="p-2 flex items-center justify-center hover:opacity-70 transition-opacity"
            aria-label="Close AI assistant">
            <Icon name="x" size={22} color="var(--text,#fff)" />
          </button>
        </div>

        <div className="px-5 pb-8 pt-4 space-y-5 flex-1 overflow-y-auto">

          {/* Waveform */}
          <div className="bg-[var(--surface-deep,#0a0a0a)] rounded-2xl py-4 px-4 border border-[var(--border,#222)]">
            <Waveform active={listening || speaking} />
            <div className="text-center mt-2 text-sm" style={{ color: 'var(--text-muted,#888)' }}>
              {listening ? 'Listening...' : speaking ? 'Speaking...' : loading ? 'Thinking...' : 'Tap the mic to speak'}
            </div>
            {transcript && (
              <div className="mt-2 text-sm text-center italic" style={{ color: 'var(--text-muted,#888)' }}>
                "{transcript}"
              </div>
            )}
          </div>

          {/* Last guidance / AI reply */}
          {(aiReply || lastMessage) && (
            <div className="rounded-2xl p-4" style={{ background: '#1e3a8a', border: '1px solid #1d4ed8' }}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#93c5fd' }}>
                {aiReply ? 'AI Reply' : 'Last Guidance'}
              </div>
              <p className="text-base leading-relaxed" style={{ color: '#ffffff' }}>{aiReply || lastMessage}</p>
            </div>
          )}

          {/* Mic button */}
          <button
            onPointerDown={startListening}
            onPointerUp={stopListening}
            onPointerLeave={stopListening}
            className={`w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-3 transition-colors
              ${listening
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-500'}`}
          >
            <Icon name="mic" size={20} />
            {listening ? 'Release to send' : 'Hold to speak'}
          </button>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={repeat}
              className="py-3 rounded-xl border border-[var(--border,#222)] text-sm font-medium flex items-center justify-center gap-2"
              style={{ color: 'var(--text,#fff)' }}>
              <Icon name="volume" size={16} className="text-blue-400" />
              Repeat last
            </button>
            <button onClick={cancelSpeech}
              className="py-3 rounded-xl border border-[var(--border,#222)] text-sm font-medium flex items-center justify-center gap-2"
              style={{ color: 'var(--text,#fff)' }}>
              <Icon name="stop" size={16} className="text-red-400" />
              Stop speaking
            </button>
          </div>

          {/* Text input */}
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Type a question..."
              className="flex-1 bg-[var(--surface-deep,#0a0a0a)] border border-[var(--border,#222)] rounded-xl px-4 py-3 text-base outline-none focus:border-blue-600"
              style={{ color: 'var(--text,#fff)' }}
            />
            <button type="submit" disabled={!textInput.trim() || loading}
              className="bg-blue-600 text-white px-4 rounded-xl disabled:opacity-40 flex items-center">
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </>
  );
}
