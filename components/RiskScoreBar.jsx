export default function RiskScoreBar({ score = 0 }) {
  const colour = score < 33 ? '#22c55e' : score < 66 ? '#f97316' : '#ef4444';
  const label  = score < 33 ? 'Low' : score < 66 ? 'Medium' : 'High';
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-[#888] uppercase tracking-wide font-semibold">Risk Score Today</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: colour }}>{label}</span>
          <span className="text-2xl font-bold" style={{ color: colour }}>{score}</span>
        </div>
      </div>
      <div className="h-2.5 bg-[#222] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: `linear-gradient(90deg, #22c55e, ${colour})` }} />
      </div>
    </div>
  );
}
