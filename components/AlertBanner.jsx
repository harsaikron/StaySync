'use client';
import Icon from '@/components/Icon';

export default function AlertBanner({ alerts, onDismiss }) {
  if (!alerts?.length) return null;
  const top = alerts[0];
  return (
    <div className="bg-red-950 border border-red-700 rounded-xl p-4 mb-4 flex items-start gap-3">
      <Icon name="bell" size={20} color="#ef4444" />
      <div className="flex-1">
        <div className="text-red-400 text-sm font-bold uppercase tracking-wide">
          {top.severity === 'critical' ? 'Critical Alert' : 'Alert'} — Camera {top.cameraId}
        </div>
        <div className="text-white text-base mt-1">{top.guidance}</div>
      </div>
      <button onClick={() => onDismiss(top.id)}
        className="text-[#888] text-sm px-3 py-1.5 border border-[#333] rounded-lg flex items-center gap-1 shrink-0">
        <Icon name="check" size={14} />
        Done
      </button>
    </div>
  );
}
