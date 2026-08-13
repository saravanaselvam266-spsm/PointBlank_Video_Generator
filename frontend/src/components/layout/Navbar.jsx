import React from 'react';
import { useLocation } from 'react-router-dom';
import { Search, HelpCircle, Bell, Menu } from 'lucide-react';
import { UserMenu } from './UserMenu';

export const Navbar = ({ onOpenMobileMenu }) => {
  const location = useLocation();

  const getPageTitle = (pathname) => {
    if (pathname.includes('/app/dashboard')) return 'Dashboard';
    if (pathname.includes('/app/doctors')) return 'Doctor Profiles';
    if (pathname.includes('/app/avatars')) return 'Avatar Library';
    if (pathname.includes('/app/voices')) return 'Voice Library';
    if (pathname.includes('/app/create-video')) return 'AI Video Studio';
    if (pathname.includes('/app/videos')) return 'My Video Library';
    if (pathname.includes('/app/settings')) return 'Account Settings';
    return 'PointBlank AI Video Generator';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20 select-none shadow-xs">
      <div className="flex items-center space-x-4">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>PointBlank Enterprise</span>
            <span>/</span>
            <span className="text-[#007799] font-medium">{getPageTitle(location.pathname)}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
            {getPageTitle(location.pathname)}
          </h1>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Search Input */}
        <div className="hidden md:flex items-center relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search doctors, videos..."
            className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-48 lg:w-64 focus:outline-hidden focus:border-[#007799] focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        <a
          href="https://www.pointblank.co.in/"
          target="_blank"
          rel="noreferrer"
          className="p-2 text-slate-500 hover:text-[#005570] hover:bg-slate-100 rounded-lg transition-colors hidden sm:flex items-center space-x-1"
          title="PointBlank Support"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="text-xs font-medium">Help</span>
        </a>

        <button
          className="p-2 text-slate-500 hover:text-[#005570] hover:bg-slate-100 rounded-lg transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#007799] rounded-full ring-2 ring-white"></span>
        </button>

        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

        <UserMenu />
      </div>
    </header>
  );
};
