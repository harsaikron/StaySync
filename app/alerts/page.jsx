'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import EventCard from '@/components/EventCard';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);

  const load = () => get('/alerts?limit=50').then(setAlerts).catch(() => {});
  useEffect(() => { load(); }, []);

  const dismiss = async (id) => {
    await post(`/alerts/${id}/dismiss`);
    load();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <h1 className="text-xl font-bold mb-4">🚨 Alerts</h1>

      {alerts.length === 0 ? (
        <div className="text-center py-16 text-[#8b949e]">
          <div className="text-4xl mb-3">✅</div>
          <p>No active alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <div key={a.id} className="relative">
              <EventCard event={{ ...a, type: 'alert', photo_path: a.photo_path }} />
              <button onClick={() => dismiss(a.id)}
                className="absolute top-3 right-3 text-xs text-[#8b949e] border border-[#30363d] px-2 py-1 rounded">
                ✓ Done
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
