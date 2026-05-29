'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Wortmarke } from '@/components/brand/wortmarke';
import { cn } from '@/lib/utils';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  InboxIcon,
  UserGroupIcon,
  TimeScheduleIcon,
  Calendar02Icon,
  Building03Icon,
  WrenchIcon,
  Delete02Icon,
  Menu02Icon,
} from '@hugeicons/core-free-icons';

type NavItem = {
  href: string;
  label: string;
  icon: IconSvgElement;
};

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Inbox', icon: InboxIcon },
  { href: '/dashboard/kunden', label: 'Kunden', icon: UserGroupIcon },
  // Termine = Liste konkreter Termin-Slots (Zeit-fokussiert) → Calendar+Uhr
  { href: '/dashboard/termine', label: 'Termine', icon: TimeScheduleIcon },
  // Kalender = Wochen-/Monatsansicht (Grid-fokussiert) → Calendar+Days
  { href: '/dashboard/kalender', label: 'Kalender', icon: Calendar02Icon },
  { href: '/dashboard/profil', label: 'Betriebsprofil', icon: Building03Icon },
];

const utilityNavItems: NavItem[] = [
  { href: '/dashboard/diagnose', label: 'Diagnose', icon: WrenchIcon },
  { href: '/dashboard/papierkorb', label: 'Papierkorb', icon: Delete02Icon },
];

export default function DashboardShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function isItemActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed inset-y-0 left-0 z-40 transform transition-transform md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-20 flex items-center px-6 border-b border-sidebar-border">
          <Link href="/dashboard" aria-label="Auftragswerk Startseite">
            <Wortmarke size="sm" withTagline />
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {mainNavItems.map((item) => {
            const isActive = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-md text-sm transition-colors min-h-11 md:min-h-0',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'hover:bg-sidebar-accent text-sidebar-foreground'
                )}
              >
                <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Utility-Bereich – getrennt vom Hauptmenü */}
        <div className="px-4 pb-2 space-y-1">
          {utilityNavItems.map((item) => {
            const isActive = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-md text-sm transition-colors min-h-11 md:min-h-0',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <p className="text-xs text-muted-foreground truncate" title={userEmail}>
            {userEmail}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile-Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Mobile Header – Hamburger min 44x44 (Apple-Touch-Standard) */}
        <header className="md:hidden h-14 sticky top-0 z-20 border-b flex items-center justify-between px-2 bg-background">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menü öffnen"
            className="inline-flex items-center justify-center h-11 w-11 rounded-md text-foreground hover:bg-accent active:bg-accent/70 transition-colors"
          >
            <HugeiconsIcon icon={Menu02Icon} size={22} strokeWidth={1.5} />
          </button>
          <Wortmarke size="sm" />
          <div className="w-11" />
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
