import './globals.css';
import { TTSProvider } from '@/providers/TTSProvider';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: 'StaySync',
  description: 'Dementia care companion',
  manifest: '/manifest.json',
  themeColor: '#1f6feb'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-[#e6edf3] pb-20">
        <TTSProvider>
          {children}
          <BottomNav />
        </TTSProvider>
      </body>
    </html>
  );
}
