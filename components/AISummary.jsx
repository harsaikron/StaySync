import Icon from '@/components/Icon';

export default function AISummary({ report }) {
  if (!report) return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4 text-[#666] text-base">
      No AI summary yet — check back after the first daily report runs at 11 pm.
    </div>
  );
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="bot" size={16} color="#60a5fa" />
        <span className="text-sm font-bold text-blue-400 uppercase tracking-wide">
          AI {report.period === 'weekly' ? 'Weekly' : 'Daily'} Summary
        </span>
      </div>
      <p className="text-base text-white leading-relaxed mb-3">{report.summary}</p>
      {report.suggestions?.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Icon name="lightbulb" size={14} color="#f97316" />
            <span className="text-sm font-bold text-orange-400">Suggestions</span>
          </div>
          <ul className="text-sm text-[#aaa] space-y-1.5">
            {report.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2">
                <Icon name="chevron-right" size={14} className="shrink-0 mt-0.5 text-orange-400" />
                {s}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
