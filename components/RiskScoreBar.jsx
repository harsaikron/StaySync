export default function RiskScoreBar({ score = 0 }) {
  const colour = score < 33 ? '#3fb950' : score < 66 ? '#f78536' : '#f85149';
  return (
    <div className="bg-[#21262d] rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-[#8b949e] uppercase tracking-wide">Today's Risk Score</span>
        <span className="font-bold text-lg" style={{ color: colour }}>{score}</span>
      </div>
      <div className="h-2 bg-[#30363d] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: `linear-gradient(90deg, #3fb950, ${colour})` }} />
      </div>
    </div>
  );
}
