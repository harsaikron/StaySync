'use client';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { useParams } from 'next/navigation';
import EventCard from '@/components/EventCard';

export default function TimelinePage() {
  const { id } = useParams();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    get(`/patients/${id}/timeline?filter=${filter}&limit=50`)
      .then(setEvents).catch(() => {});
  }, [id, filter]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <h1 className="text-xl font-bold mb-4">🕐 Timeline</h1>

      <div className="flex gap-2 mb-4">
        {['all', 'alerts'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border capitalize ${filter === f
              ? 'border-[#1f6feb] text-[#58a6ff]' : 'border-[#30363d] text-[#8b949e]'}`}>
            {f === 'all' ? 'All Events' : 'Alerts Only'}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-[#8b949e]">No events yet</div>
      ) : (
        <div className="space-y-3">
          {events.map(e => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
