export default function StatCard({ value, label, colour = '#fff', suffix = '' }) {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4 text-center">
      <div className="text-3xl font-bold" style={{ color: colour }}>
        {value ?? '—'}{suffix}
      </div>
      <div className="text-sm text-[#888] mt-1 leading-tight">{label}</div>
    </div>
  );
}
