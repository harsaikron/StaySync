'use client';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { useTTS } from '@/providers/TTSProvider';
import { SSEProvider, useSSE } from '@/providers/SSEProvider';

function PatientContent({ patientName }) {
  const { latestEvents } = useSSE();
  const { speak, repeat, lastMessage, autoSpeak, setAutoSpeak } = useTTS();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#a371f7]
        flex items-center justify-center text-4xl mb-4">
        👤
      </div>

      <h1 className="text-3xl font-bold mb-1">Good {getTimeOfDay()}</h1>
      <p className="text-[#8b949e] text-lg mb-8">{patientName || 'Welcome'}</p>

      {lastMessage ? (
        <div className="bg-[#1a3a2a] border border-[#238636] rounded-2xl p-6 w-full max-w-sm mb-8">
          <div className="text-[#3fb950] text-xs font-bold uppercase tracking-wide mb-2">
            GUIDANCE
          </div>
          <p className="text-[#e6edf3] text-xl leading-relaxed">{lastMessage}</p>
        </div>
      ) : (
        <div className="bg-[#21262d] rounded-2xl p-6 w-full max-w-sm mb-8 text-[#8b949e]">
          Waiting for guidance...
        </div>
      )}

      <button onClick={repeat}
        className="w-full max-w-sm bg-[#1f6feb] text-white text-lg font-bold py-4 rounded-2xl mb-4">
        🔊 Repeat
      </button>

      <button onClick={() => setAutoSpeak(v => !v)}
        className={`text-sm px-4 py-2 rounded-full border ${autoSpeak
          ? 'border-[#238636] text-[#3fb950]' : 'border-[#30363d] text-[#8b949e]'}`}>
        Auto-speak is {autoSpeak ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
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
