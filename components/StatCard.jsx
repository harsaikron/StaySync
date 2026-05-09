export default function StatCard({ value, label, colour = '#e6edf3', suffix = '' }) {
  return (
    <div className="bg-[#21262d] rounded-lg p-4 text-center">
      <div className="text-2xl font-bold" style={{ color: colour }}>
        {value ?? '—'}{suffix}
      </div>
      <div className="text-xs text-[#8b949e] mt-1 leading-tight">{label}</div>
    </div>
  );
}
