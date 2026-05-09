'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard', icon: '🏠', label: 'Home' },
  { href: '/cameras', icon: '📷', label: 'Cameras' },
  { href: '/patients', icon: '👤', label: 'Patients' },
  { href: '/alerts', icon: '🚨', label: 'Alerts' }
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-[#21262d] flex">
      {tabs.map(({ href, icon, label }) => {
        const active = path.startsWith(href);
        return (
          <Link key={href} href={href} className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 ${active ? 'text-[#1f6feb]' : 'text-[#8b949e]'}`}>
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
