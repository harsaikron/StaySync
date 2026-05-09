const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SEVERITY_COLOURS = { low: '#8b949e', medium: '#f78536', critical: '#f85149' };

export default function EventCard({ event }) {
  const date = new Date(event.created_at * 1000).toLocaleString();
  const colour = SEVERITY_COLOURS[event.severity] || '#8b949e';
  return (
    <div className="bg-[#21262d] rounded-lg p-3 flex gap-3">
      {event.photo_path && (
        <img src={`${BASE}/${event.photo_path}`} alt="event"
          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
          onError={(e) => e.target.style.display = 'none'} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded"
            style={{ background: `${colour}22`, color: colour }}>
            {event.type}
          </span>
          <span className="text-xs text-[#8b949e]">{date}</span>
        </div>
        <p className="text-sm text-[#e6edf3] line-clamp-2">{event.guidance}</p>
        {event.reasoning && (
          <p className="text-xs text-[#8b949e] mt-1 line-clamp-1">{event.reasoning}</p>
        )}
      </div>
    </div>
  );
}
