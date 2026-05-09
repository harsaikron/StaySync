'use client';
import { useEffect, useState, useCallback } from 'react';
import { get } from '@/lib/api';
import { useTTS } from '@/providers/TTSProvider';
import { SSEProvider, useSSE } from '@/providers/SSEProvider';
import AlertBanner from '@/components/AlertBanner';
import CameraGrid from '@/components/CameraGrid';
import RiskScoreBar from '@/components/RiskScoreBar';

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
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">StaySync 🏠</h1>
        <button onClick={() => setAutoSpeak(v => !v)}
          className={`text-xs px-3 py-1 rounded-full border ${autoSpeak
            ? 'border-[#238636] text-[#3fb950]' : 'border-[#30363d] text-[#8b949e]'}`}>
          🔊 Auto-speak {autoSpeak ? 'ON' : 'OFF'}
        </button>
      </div>

      <AlertBanner alerts={activeAlerts} onDismiss={dismissAlert} />

      {performance && <RiskScoreBar score={performance.fallRisk} />}

      <div className="flex items-center justify-between mt-4 mb-2">
        <h2 className="text-sm font-bold text-[#8b949e] uppercase tracking-wide">Live Cameras</h2>
        <button onClick={onRefreshCameras}
          className="text-xs text-[#58a6ff] border border-[#30363d] px-2 py-1 rounded">
          ↺ Refresh All
        </button>
      </div>
      <CameraGrid cameras={cameras} onRefresh={onRefreshCameras} />

      {Object.keys(latestEvents).length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-bold text-[#8b949e] uppercase tracking-wide mb-2">Latest Guidance</h2>
          {Object.entries(latestEvents).map(([camId, event]) => (
            <div key={camId} className="bg-[#21262d] rounded-lg p-3 mb-2">
              <div className="text-xs text-[#8b949e] mb-1">Camera {camId}</div>
              <div className="text-sm text-[#e6edf3]">{event.guidance}</div>
              <button onClick={() => speak(event.guidance)}
                className="mt-2 text-xs text-[#58a6ff]">🔊 Speak</button>
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
    // Auto-refresh camera list every 10s to pick up online/offline changes
    const interval = setInterval(loadCameras, 10000);
    return () => clearInterval(interval);
  }, [loadCameras]);

  const cameraIds = cameras.map(c => c.id);

  return (
    <SSEProvider cameraIds={cameraIds}>
      <DashboardContent cameras={cameras} onRefreshCameras={loadCameras} />
    </SSEProvider>
  );
}
