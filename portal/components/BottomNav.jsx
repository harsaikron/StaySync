'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard', icon: '/home.svg', label: 'Home' },
  { href: '/cameras', icon: '/camera.svg', label: 'Cameras' },
  { href: '/patients', icon: '/patients.svg', label: 'Patients' },
  { href: '/alerts', icon: '/alerts.svg', label: 'Alerts' },
  { href: '/feedback', icon: '/feedback.svg', label: 'AI' },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-[#21262d] flex">
      {tabs.map(({ href, icon, label }) => {
        const active = path.startsWith(href);
        return (
          <Link key={href} href={href} className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 ${active ? 'text-[#1f6feb]' : 'text-[#8b949e]'}`}>
            <img
              src={icon}
              alt={label}
              className="w-6 h-6"
              style={{ filter: active
                ? 'invert(40%) sepia(90%) saturate(500%) hue-rotate(190deg) brightness(110%)'
                : 'invert(60%) sepia(0%) saturate(0%) brightness(80%)' }}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
