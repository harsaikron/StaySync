'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import EventCard from '@/components/EventCard';
import Icon from '@/components/Icon';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const load = () => get('/alerts?limit=50').then(setAlerts).catch(() => {});
  useEffect(() => { load(); }, []);

  const dismiss = async (id) => {
    await post(`/alerts/${id}/dismiss`);
    load();
  };

  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      <div className="flex items-center gap-3 mb-5">
        <Icon name="bell" size={22} className="text-white" />
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-20 flex flex-col items-center gap-4 text-[#555]">
          <Icon name="shield" size={48} />
          <p className="text-base">No active alerts — all clear</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <div key={a.id} className="relative">
              <EventCard event={{ ...a, type: 'alert', photo_path: a.photo_path }} />
              <button onClick={() => dismiss(a.id)}
                className="absolute top-4 right-4 flex items-center gap-1.5 text-sm text-[#888] border border-[#333] px-3 py-1.5 rounded-lg">
                <Icon name="check" size={13} />
                Done
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
