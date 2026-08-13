import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Stethoscope,
  UserRound,
  AudioLines,
  Video,
  Library,
  Settings,
  LogOut,
  ChevronRight,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const { currentDoctor } = useApp();
  const navigate = useNavigate();

  const mainNavItems = [
    { name: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { name: 'Doctors', path: '/app/doctors', icon: Stethoscope },
    { name: 'Avatar Library', path: '/app/avatars', icon: UserRound },
    { name: 'Voice Library', path: '/app/voices', icon: AudioLines },
    { name: 'Create Avatar', path: '/app/create-avatar', icon: Sparkles, isPrimary: true },
    { name: 'Create Video', path: '/app/create-video', icon: Video, isPrimary: true },
    { name: 'My Videos', path: '/app/videos', icon: Library },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-[#005570] flex items-center justify-center text-white font-black tracking-wider text-sm shadow-sm">
            PB
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900 font-sans">
            POINTBLANK
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#007799] pl-10">
          AI VIDEO STUDIO
        </span>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Workspace
        </div>
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#E6F3F7] text-[#005570] font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                } ${item.isPrimary ? 'border border-[#007799]/20 bg-gradient-to-r from-teal-50/50 to-cyan-50/30' : ''}`
              }
            >
              <div className="flex items-center space-x-3">
                <Icon className="w-4 h-4 text-[#005570]" />
                <span>{item.name}</span>
              </div>
              {item.isPrimary && (
                <span className="text-[10px] bg-[#005570] text-white px-2 py-0.5 rounded-full font-bold">
                  STUDIO
                </span>
              )}
            </NavLink>
          );
        })}

        <div className="pt-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Preferences
        </div>
        <NavLink
          to="/app/settings/profile"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-[#E6F3F7] text-[#005570] font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`
          }
        >
          <Settings className="w-4 h-4 text-[#005570]" />
          <span>Account Settings</span>
        </NavLink>
      </div>

      {/* Active Doctor Context & User Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
        {currentDoctor && (
          <div className="p-2.5 rounded-xl bg-[#E6F3F7] border border-[#007799]/20 flex items-center space-x-2.5">
            <UserCheck className="w-4 h-4 text-[#005570] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-[#005570] uppercase tracking-wider">Active Doctor</p>
              <p className="text-xs font-bold text-slate-900 truncate">{currentDoctor.doctor_name}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate">{currentDoctor.doctor_id}</p>
            </div>
          </div>
        )}

        <div
          onClick={() => navigate('/app/settings/profile')}
          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#005570] text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-sm">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'PB'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.full_name || 'PointBlank User'}
              </p>
              <p className="text-[10px] font-mono text-[#007799] font-medium truncate">
                {user?.user_id || 'PB-USR-000001'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50/60 hover:bg-rose-100 hover:text-rose-700 transition-colors border border-rose-100"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
