'use client';
import { useEffect, useState, useCallback } from 'react';
import { get } from '@/lib/api';
import { useTTS } from '@/providers/TTSProvider';
import { SSEProvider, useSSE } from '@/providers/SSEProvider';
import AlertBanner from '@/components/AlertBanner';
import CameraGrid from '@/components/CameraGrid';
import RiskScoreBar from '@/components/RiskScoreBar';
import Icon from '@/components/Icon';

function DashboardContent({ cameras, onRefreshCameras }) {
  const { latestEvents, activeAlerts, setActiveAlerts } = useSSE();
  const { speak, autoSpeak, setAutoSpeak } = useTTS();
  const [performance, setPerformance] = useState(null);

  useEffect(() => {
    get('/patients').then(patients => {
      if (patients[0]) get(`/patients/${patients[0].id}/performance`).then(setPerformance);
    }).catch(() => {});
  }, []);

  const dismissAlert = (id) => setActiveAlerts(prev => prev.filter(a => a.id !== id));

  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-white">StaySync</h1>
        <button onClick={() => setAutoSpeak(v => !v)}
          className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors
            ${autoSpeak ? 'border-blue-600 text-blue-400' : 'border-[#333] text-[#666]'}`}>
          <Icon name="volume" size={15} />
          {autoSpeak ? 'Voice On' : 'Voice Off'}
        </button>
      </div>

      <AlertBanner alerts={activeAlerts} onDismiss={dismissAlert} />

      {performance && <div className="mb-4"><RiskScoreBar score={performance.fallRisk} /></div>}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-[#666] uppercase tracking-widest">Live Cameras</h2>
        <button onClick={onRefreshCameras}
          className="flex items-center gap-1.5 text-sm text-blue-400 border border-[#333] px-3 py-1.5 rounded-lg">
          <Icon name="refresh" size={14} />
          Refresh
        </button>
      </div>
      <CameraGrid cameras={cameras} onRefresh={onRefreshCameras} />

      {Object.keys(latestEvents).length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-bold text-[#666] uppercase tracking-widest mb-3">Latest Guidance</h2>
          {Object.entries(latestEvents).map(([camId, event]) => (
            <div key={camId} className="bg-[#111] border border-[#222] rounded-xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="camera" size={14} className="text-[#666]" />
                <span className="text-sm text-[#666]">Camera {camId}</span>
              </div>
              <p className="text-base text-white leading-relaxed">{event.guidance}</p>
              <button onClick={() => speak(event.guidance)}
                className="mt-3 flex items-center gap-1.5 text-sm text-blue-400">
                <Icon name="volume" size={14} /> Speak
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [cameras, setCameras] = useState([]);
  const loadCameras = useCallback(() => {
    get('/cameras').then(setCameras).catch(() => {});
  }, []);

  useEffect(() => {
    loadCameras();
    const interval = setInterval(loadCameras, 10000);
    return () => clearInterval(interval);
  }, [loadCameras]);

  return (
    <SSEProvider cameraIds={cameras.map(c => c.id)}>
      <DashboardContent cameras={cameras} onRefreshCameras={loadCameras} />
    </SSEProvider>
  );
}
