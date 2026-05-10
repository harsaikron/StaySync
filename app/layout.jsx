import './globals.css';
import { TTSProvider } from '@/providers/TTSProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import BottomNav from '@/components/BottomNav';
import FloatingAI from '@/components/FloatingAI';
import ScheduleReminder from '@/components/ScheduleReminder';

export const metadata = {
  title: 'StaySync',
  description: 'Dementia care companion',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('staysync-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}` }} />
      </head>
      <body className="pb-20">
        <ThemeProvider>
          <TTSProvider>
            {children}
            <ScheduleReminder />
            <FloatingAI />
            <BottomNav />
          </TTSProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
