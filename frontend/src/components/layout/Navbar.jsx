import React from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, Bell, Menu } from 'lucide-react';
import { UserMenu } from './UserMenu';

const PAGE_TITLES = [
  { match: '/app/dashboard', title: 'Dashboard' },
  { match: '/app/doctors', title: 'Doctors' },
  { match: '/app/create-avatar', title: 'Create Avatar' },
  { match: '/app/ai-library', title: 'AI Library' },
  { match: '/app/create-video', title: 'Create Video' },
  { match: '/app/videos', title: 'Video Library' },
  { match: '/app/settings', title: 'Account Settings' },
];

const getPageTitle = (pathname) => PAGE_TITLES.find((p) => pathname.includes(p.match))?.title || 'PointBlank';

export const Navbar = ({ onOpenMobileMenu }) => {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <header className="h-16 bg-surface/95 backdrop-blur-sm border-b border-line px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20 select-none">
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-ink-soft hover:bg-surface-sunken"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="font-display text-xl text-ink tracking-tight leading-tight">
          {title}
        </h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        <a
          href="https://www.pointblank.co.in/"
          target="_blank"
          rel="noreferrer"
          className="p-2 text-ink-muted hover:text-signal hover:bg-surface-sunken rounded-lg transition-colors hidden sm:flex items-center gap-1.5"
          title="PointBlank Support"
        >
          <HelpCircle className="w-4 h-4" strokeWidth={1.75} />
          <span className="text-xs font-medium">Help</span>
        </a>

        <button
          className="p-2 text-ink-muted hover:text-signal hover:bg-surface-sunken rounded-lg transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" strokeWidth={1.75} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full ring-2 ring-surface" />
        </button>

        <div className="h-6 w-px bg-line hidden sm:block" />

        <UserMenu />
      </div>
    </header>
  );
};
