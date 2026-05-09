'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { get } from '@/lib/api';
import { useTTS } from '@/providers/TTSProvider';
import { SSEProvider, useSSE } from '@/providers/SSEProvider';
import { speakText, cancelSpeech } from '@/lib/tts';

// Words the patient can say and what they trigger
const VOICE_COMMANDS = {
  yes:    ['yes', 'yeah', 'yep', 'okay', 'ok', 'sure', 'please'],
  no:     ['no', 'nope', 'stop', 'quiet', 'enough'],
  help:   ['help', 'help me', 'i need help', 'assist'],
  repeat: ['repeat', 'again', 'say again', 'what', 'pardon', 'sorry'],
};

function matchCommand(transcript) {
  const t = transcript.toLowerCase().trim();
  for (const [cmd, words] of Object.entries(VOICE_COMMANDS)) {
    if (words.some(w => t.includes(w))) return cmd;
  }
  return null;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function PatientContent({ patientName }) {
  const { latestEvents } = useSSE();
  const { speak, repeat, lastMessage, autoSpeak, setAutoSpeak } = useTTS();

  const [micState, setMicState] = useState('idle'); // idle | requesting | listening | heard | denied
  const [transcript, setTranscript] = useState('');
  const [responseMsg, setResponseMsg] = useState('');
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);

  // ── Speech Recognition setup ──────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicState('denied');
      return;
    }

    if (listeningRef.current) return;

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => { listeningRef.current = true; setMicState('listening'); };

    rec.onresult = (e) => {
      const heard = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setTranscript(heard);

      if (e.results[0].isFinal) {
        const cmd = matchCommand(heard);
        handleVoiceCommand(cmd, heard);
      }
    };

    rec.onerror = (e) => {
      listeningRef.current = false;
      if (e.error === 'not-allowed' || e.error === 'denied') {
        setMicState('denied');
      } else {
        setMicState('idle');
      }
    };

    rec.onend = () => { listeningRef.current = false; setMicState('heard'); };

    rec.start();
  }, [lastMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    listeningRef.current = false;
    setMicState('idle');
    setTranscript('');
  }, []);

  const requestMic = useCallback(async () => {
    setMicState('requesting');
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicState('idle');
      startListening();
    } catch {
      setMicState('denied');
    }
  }, [startListening]);

  const handleVoiceCommand = (cmd, raw) => {
    setMicState('heard');
    if (cmd === 'yes' || cmd === 'repeat') {
      const msg = lastMessage || "I'm right here with you. Everything is okay.";
      setResponseMsg('Got it — repeating guidance.');
      setTimeout(() => { speakText(msg); setResponseMsg(''); }, 600);
    } else if (cmd === 'no') {
      cancelSpeech();
      const msg = "That's okay — I'll be right here whenever you need me.";
      setResponseMsg(msg);
      setTimeout(() => { speakText(msg); setResponseMsg(''); }, 300);
    } else if (cmd === 'help') {
      const msg = lastMessage
        ? `Let me say that again slowly. ${lastMessage}`
        : "I'm here to help you. Just say 'repeat' and I'll tell you what to do next.";
      setResponseMsg('Getting help...');
      setTimeout(() => { speakText(msg, { rate: 0.7 }); setResponseMsg(''); }, 300);
    } else {
      setResponseMsg(`I heard: "${raw}" — I didn't quite understand. Try saying Yes, No, Repeat, or Help.`);
      setTimeout(() => setResponseMsg(''), 4000);
    }
    setTimeout(() => setMicState('idle'), 2000);
  };

  // Auto-speak on new guidance
  useEffect(() => {
    const events = Object.values(latestEvents);
    if (!events.length) return;
    const latest = events[events.length - 1];
    if (autoSpeak && latest?.guidance) speak(latest.guidance);
  }, [latestEvents]);

  const micLabel = {
    idle: '🎤 Tap to speak',
    requesting: '⏳ Getting mic...',
    listening: '🔴 Listening...',
    heard: '✓ Got it',
    denied: '🚫 Mic blocked',
  }[micState];

  const micColor = {
    idle: 'bg-[#21262d] border-[#30363d] text-[#8b949e]',
    requesting: 'bg-[#21262d] border-[#30363d] text-[#8b949e]',
    listening: 'bg-[#3a1a1a] border-[#f85149] text-[#f85149] animate-pulse',
    heard: 'bg-[#1a3a2a] border-[#238636] text-[#3fb950]',
    denied: 'bg-[#21262d] border-[#30363d] text-[#8b949e]',
  }[micState];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-between p-6 pb-10 text-center">

      {/* Header */}
      <div className="w-full flex justify-end">
        <button onClick={() => setAutoSpeak(v => !v)}
          className={`text-xs px-3 py-1 rounded-full border ${autoSpeak
            ? 'border-[#238636] text-[#3fb950]' : 'border-[#30363d] text-[#8b949e]'}`}>
          🔊 Auto {autoSpeak ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Avatar + greeting */}
      <div className="flex flex-col items-center mt-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7]
          flex items-center justify-center text-5xl mb-4 shadow-lg">
          👤
        </div>
        <h1 className="text-3xl font-bold mb-1">Good {getTimeOfDay()}</h1>
        <p className="text-[#8b949e] text-lg">{patientName || 'there'} 👋</p>
      </div>

      {/* Guidance card */}
      <div className="w-full max-w-sm my-6">
        {lastMessage ? (
          <div className="bg-[#1a3a2a] border border-[#238636] rounded-3xl p-6 shadow-lg">
            <div className="text-[#3fb950] text-xs font-bold uppercase tracking-widest mb-3">
              💬 Guidance
            </div>
            <p className="text-[#e6edf3] text-2xl leading-relaxed font-medium">{lastMessage}</p>
          </div>
        ) : (
          <div className="bg-[#161b22] border border-[#30363d] rounded-3xl p-6 text-[#8b949e]">
            <div className="text-3xl mb-2">🤍</div>
            <p className="text-lg">I'm watching over you</p>
            <p className="text-xs mt-1">I'll speak up when I have something to share</p>
          </div>
        )}

        {/* Response message */}
        {responseMsg && (
          <div className="mt-3 bg-[#1f2937] rounded-2xl px-4 py-3 text-sm text-[#e6edf3]">
            {responseMsg}
          </div>
        )}

        {/* Transcript */}
        {transcript && micState === 'listening' && (
          <div className="mt-3 text-sm text-[#8b949e] italic">"{transcript}"</div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-sm space-y-3">

        {/* Mic button */}
        {micState === 'denied' ? (
          <div className="bg-[#3a1a1a] border border-[#f85149] rounded-2xl p-4 text-sm text-[#f85149]">
            Microphone access was blocked. Please allow mic in your browser settings and reload.
          </div>
        ) : (
          <button
            onClick={micState === 'listening' ? stopListening : requestMic}
            className={`w-full py-5 rounded-3xl border-2 text-lg font-bold transition-all ${micColor}`}>
            {micLabel}
          </button>
        )}

        {micState !== 'denied' && (
          <div className="grid grid-cols-3 gap-2 text-xs text-[#8b949e] text-center">
            <div className="bg-[#161b22] rounded-xl p-2">Say <b className="text-white">Yes</b><br/>to confirm</div>
            <div className="bg-[#161b22] rounded-xl p-2">Say <b className="text-white">Repeat</b><br/>to hear again</div>
            <div className="bg-[#161b22] rounded-xl p-2">Say <b className="text-white">Help</b><br/>for assistance</div>
          </div>
        )}

        {/* Repeat + Stop buttons */}
        <div className="flex gap-3">
          <button onClick={repeat}
            className="flex-1 bg-[#1f6feb] text-white text-base font-bold py-4 rounded-2xl">
            🔊 Repeat
          </button>
          <button onClick={cancelSpeech}
            className="flex-1 border border-[#30363d] text-[#8b949e] text-base font-bold py-4 rounded-2xl">
            ■ Stop
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientPage() {
  const [cameras, setCameras] = useState([]);
  const [patientName, setPatientName] = useState('');

  useEffect(() => {
    get('/cameras').then(setCameras).catch(() => {});
    get('/patients').then(patients => {
      if (patients[0]) setPatientName(patients[0].name.split(' ')[0]);
    }).catch(() => {});
  }, []);

  return (
    <SSEProvider cameraIds={cameras.map(c => c.id)}>
      <PatientContent patientName={patientName} />
    </SSEProvider>
  );
}
