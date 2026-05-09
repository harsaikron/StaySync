import Icon from '@/components/Icon';

export default function AISuggestions({ suggestions = [] }) {
  if (!suggestions.length) return null;
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="lightbulb" size={16} color="#f97316" />
        <span className="text-sm font-bold text-orange-400 uppercase tracking-wide">AI Suggestions</span>
      </div>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="text-base text-[#ccc] flex gap-3">
            <span className="text-orange-400 mt-0.5 shrink-0">
              <Icon name="chevron-right" size={16} />
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
