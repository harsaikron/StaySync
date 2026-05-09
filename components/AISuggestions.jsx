export default function AISuggestions({ suggestions = [] }) {
  if (!suggestions.length) return null;
  return (
    <div className="bg-[#21262d] rounded-lg p-4">
      <div className="text-[#f0883e] text-xs font-bold uppercase tracking-wide mb-2">💡 AI Suggestions</div>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="text-sm text-[#8b949e] flex gap-2">
            <span className="text-[#f0883e]">•</span> {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
