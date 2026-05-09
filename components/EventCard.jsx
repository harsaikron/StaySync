const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SEV_COLOR = { low: '#888', medium: '#f97316', critical: '#ef4444' };

export default function EventCard({ event }) {
  const date = new Date(event.created_at * 1000).toLocaleString();
  const color = SEV_COLOR[event.severity] || '#888';
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4 flex gap-3">
      {event.photo_path && (
        <img src={`${BASE}/${event.photo_path}`} alt="event"
          className="w-16 h-16 object-cover rounded-lg shrink-0"
          onError={e => e.target.style.display = 'none'} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full"
            style={{ background: `${color}20`, color }}>
            {event.type}
          </span>
          <span className="text-sm text-[#666]">{date}</span>
        </div>
        <p className="text-base text-white leading-snug line-clamp-2">{event.guidance}</p>
        {event.reasoning && (
          <p className="text-sm text-[#666] mt-1 line-clamp-1">{event.reasoning}</p>
        )}
      </div>
    </div>
  );
}
