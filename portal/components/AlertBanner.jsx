'use client';
export default function AlertBanner({ alerts, onDismiss }) {
  if (!alerts?.length) return null;
  const top = alerts[0];
  return (
    <div className="bg-[#3a1a1a] border border-[#f85149] rounded-lg p-3 mb-4 flex items-start gap-3">
      <span className="text-xl">🚨</span>
      <div className="flex-1">
        <div className="text-[#f85149] text-xs font-bold uppercase">
          {top.severity === 'critical' ? 'CRITICAL ALERT' : 'ALERT'} — Camera {top.cameraId}
        </div>
        <div className="text-[#e6edf3] text-sm mt-1">{top.guidance}</div>
      </div>
      <button onClick={() => onDismiss(top.id)}
        className="text-[#8b949e] text-xs px-2 py-1 border border-[#30363d] rounded">
        ✓ Handling
      </button>
    </div>
  );
}
