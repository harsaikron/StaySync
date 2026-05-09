'use client';
import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import { useParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '@/components/StatCard';
import AISummary from '@/components/AISummary';
import AISuggestions from '@/components/AISuggestions';

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

  if (!perf) return <div className="p-4 text-[#8b949e]">Loading...</div>;

  const hourData = perf.confusionByHour.map((count, hour) => ({
    hour: `${hour}:00`, count
  })).filter(d => d.count > 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">📊 Performance</h1>
        <div className="flex gap-2">
          {[7, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs px-3 py-1 rounded-full border ${days === d
                ? 'border-[#1f6feb] text-[#58a6ff]' : 'border-[#30363d] text-[#8b949e]'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard value={perf.confusionEpisodes} label="Confusion Episodes" colour="#f78536" />
        <StatCard value={perf.falls} label="Falls" colour="#f85149" />
        <StatCard
          value={perf.medicineAdherence !== null ? perf.medicineAdherence : '—'}
          suffix={perf.medicineAdherence !== null ? '%' : ''}
          label="Medicine Adherence"
          colour="#3fb950" />
        <StatCard value={perf.fallRisk} label="Risk Score" colour={perf.fallRisk < 33 ? '#3fb950' : perf.fallRisk < 66 ? '#f78536' : '#f85149'} />
      </div>

      {hourData.length > 0 && (
        <div className="bg-[#21262d] rounded-lg p-4 mb-4">
          <div className="text-xs text-[#8b949e] uppercase font-bold mb-3">Confusion by Hour of Day</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={hourData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#8b949e' }} />
              <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {hourData.map((_, i) => <Cell key={i} fill="#f78536" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mb-4">
        <AISummary report={perf.latestReport} />
      </div>

      {perf.latestReport?.suggestions && (
        <div className="mb-4">
          <AISuggestions suggestions={perf.latestReport.suggestions} />
        </div>
      )}

      <button onClick={generateReport} disabled={generating}
        className="w-full border border-[#6e40c9] text-[#a371f7] py-3 rounded-lg text-sm font-medium disabled:opacity-50">
        {generating ? '🤖 Generating...' : '🤖 Generate AI Report Now'}
      </button>
    </div>
  );
}
