'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import { useParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '@/components/StatCard';
import AISummary from '@/components/AISummary';
import AISuggestions from '@/components/AISuggestions';
import Icon from '@/components/Icon';

export default function PerformancePage() {
  const { id } = useParams();
  const [perf, setPerf] = useState(null);
  const [days, setDays] = useState(7);
  const [generating, setGenerating] = useState(false);

  const load = () => get(`/patients/${id}/performance?days=${days}`).then(setPerf).catch(() => {});
  useEffect(() => { load(); }, [id, days]);

  const generateReport = async () => {
    setGenerating(true);
    try {
      await post(`/reports/generate/${id}?period=daily`);
      await load();
    } finally {
      setGenerating(false);
    }
  };

  if (!perf) return <div className="p-4 text-[#666]">Loading...</div>;

  const hourData = perf.confusionByHour.map((count, hour) => ({
    hour: `${hour}:00`, count
  })).filter(d => d.count > 0);

  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon name="chart" size={22} className="text-white" />
          <h1 className="text-2xl font-bold text-white">Performance</h1>
        </div>
        <div className="flex gap-2">
          {[7, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-sm px-4 py-1.5 rounded-full border font-semibold transition-colors ${days === d
                ? 'border-blue-600 text-blue-400 bg-blue-950' : 'border-[#333] text-[#666]'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard value={perf.confusionEpisodes} label="Confusion Episodes" colour="#f97316" />
        <StatCard value={perf.falls} label="Falls" colour="#ef4444" />
        <StatCard
          value={perf.medicineAdherence !== null ? perf.medicineAdherence : '—'}
          suffix={perf.medicineAdherence !== null ? '%' : ''}
          label="Medicine Adherence"
          colour="#22c55e" />
        <StatCard value={perf.fallRisk} label="Risk Score"
          colour={perf.fallRisk < 33 ? '#22c55e' : perf.fallRisk < 66 ? '#f97316' : '#ef4444'} />
      </div>

      {hourData.length > 0 && (
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 mb-5">
          <div className="text-sm text-[#666] uppercase tracking-widest font-bold mb-3">Confusion by Hour</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={hourData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#666' }} />
              <YAxis tick={{ fontSize: 11, fill: '#666' }} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12, color: '#fff' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {hourData.map((_, i) => <Cell key={i} fill="#f97316" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mb-4"><AISummary report={perf.latestReport} /></div>
      {perf.latestReport?.suggestions && (
        <div className="mb-4"><AISuggestions suggestions={perf.latestReport.suggestions} /></div>
      )}

      <button onClick={generateReport} disabled={generating}
        className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
        <Icon name="bot" size={18} />
        {generating ? 'Generating...' : 'Generate AI Report Now'}
      </button>
    </div>
  );
}
