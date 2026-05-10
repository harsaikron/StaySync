'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';

const tabs = [
  { href: '/dashboard', icon: 'home',     label: 'Home' },
  { href: '/cameras',   icon: 'camera',   label: 'Cameras' },
  { href: '/patients',  icon: 'users',    label: 'Patients' },
  { href: '/settings',  icon: 'settings', label: 'Settings' },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-[#222] flex z-50">
      {tabs.map(({ href, icon, label }) => {
        const active = path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors
              ${active ? 'text-blue-500' : 'text-[#555]'}`}>
            <Icon name={icon} size={22} strokeWidth={active ? 2 : 1.5} />
            <span className="text-[11px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
