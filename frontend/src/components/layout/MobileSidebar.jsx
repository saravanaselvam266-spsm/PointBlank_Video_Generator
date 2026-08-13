import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, LayoutDashboard, Stethoscope, UserRound, AudioLines, Video, Library, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const MobileSidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();

  if (!isOpen) return null;

  const mainNavItems = [
    { name: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { name: 'Doctors', path: '/app/doctors', icon: Stethoscope },
    { name: 'Avatars', path: '/app/avatars', icon: UserRound },
    { name: 'Voices', path: '/app/voices', icon: AudioLines },
    { name: 'Create Video', path: '/app/create-video', icon: Video },
    { name: 'My Videos', path: '/app/videos', icon: Library },
    { name: 'Settings', path: '/app/settings/profile', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose}></div>

      {/* Drawer */}
      <div className="relative flex-1 max-w-xs w-full bg-white flex flex-col h-full z-50">
        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#005570] text-white flex items-center justify-center font-black text-sm">
              PB
            </div>
            <span className="font-extrabold text-lg text-slate-900">POINTBLANK</span>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#E6F3F7] text-[#005570] font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="w-4 h-4 text-[#005570]" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-900">{user?.full_name}</p>
            <p className="text-[11px] font-mono text-[#007799]">{user?.user_id}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
