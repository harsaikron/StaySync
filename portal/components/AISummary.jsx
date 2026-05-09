export default function AISummary({ report }) {
  if (!report) return (
    <div className="bg-[#1a1a2e] border border-[#6e40c9] rounded-lg p-4 text-[#8b949e] text-sm">
      No AI summary yet — check back after the first daily report runs at 11pm.
    </div>
  );
  return (
    <div className="bg-[#1a1a2e] border border-[#6e40c9] rounded-lg p-4">
      <div className="text-[#a371f7] text-xs font-bold uppercase tracking-wide mb-2">
        🤖 AI {report.period === 'weekly' ? 'Weekly' : 'Daily'} Summary
      </div>
      <p className="text-sm text-[#e6edf3] leading-relaxed mb-3">{report.summary}</p>
      {report.suggestions?.length > 0 && (
        <>
          <div className="text-[#f0883e] text-xs font-bold mb-1">💡 Suggestions</div>
          <ul className="text-xs text-[#8b949e] space-y-1">
            {report.suggestions.map((s, i) => <li key={i}>• {s}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
