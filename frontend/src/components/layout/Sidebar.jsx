import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Stethoscope,
  Bot,
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
import { SlateTag } from '../ui/SlateTag';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [{ name: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Content',
    items: [
      { name: 'Doctors', path: '/app/doctors', icon: Stethoscope },
      { name: 'AI Library', path: '/app/ai-library', icon: Bot },
      { name: 'Video Library', path: '/app/videos', icon: Library },
    ],
  },
  {
    label: 'Create',
    items: [
      { name: 'Create Avatar', path: '/app/create-avatar', icon: Sparkles },
      { name: 'Create Video', path: '/app/create-video', icon: Video, isPrimary: true },
    ],
  },
];

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const { currentDoctor } = useApp();
  const navigate = useNavigate();

  return (
    <aside className="w-64 bg-surface border-r border-line flex flex-col h-screen sticky top-0 z-30 select-none">
      {/* Brand */}
      <div className="p-6 border-b border-line flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-signal flex items-center justify-center text-white font-mono font-semibold text-sm">
            PB
          </div>
          <span className="font-display text-xl tracking-tight text-ink">
            PointBlank
          </span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent pl-[42px] -mt-1">
          Doctor Video Studio
        </span>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-5 px-3.5 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.14em] px-3 mb-1.5">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-signal-soft text-signal font-semibold'
                          : item.isPrimary
                          ? 'text-signal bg-signal/5 hover:bg-signal/10'
                          : 'text-ink-soft hover:bg-surface-sunken hover:text-ink'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isActive || item.isPrimary ? 'text-signal' : 'text-ink-muted group-hover:text-ink-soft'}`} strokeWidth={1.75} />
                          <span>{item.name}</span>
                        </div>
                        {item.isPrimary && !isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Settings + doctor context + user footer */}
      <div className="p-3.5 border-t border-line space-y-3">
        <NavLink
          to="/app/settings/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-signal-soft text-signal font-semibold' : 'text-ink-soft hover:bg-surface-sunken hover:text-ink'
            }`
          }
        >
          <Settings className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
          <span>Account Settings</span>
        </NavLink>

        {currentDoctor && (
          <div className="p-2.5 rounded-xl bg-surface-sunken border border-line flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 text-signal shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold text-ink-muted uppercase tracking-[0.12em]">Active doctor</p>
              <p className="text-xs font-semibold text-ink truncate">{currentDoctor.doctor_name}</p>
              <SlateTag className="mt-1">{currentDoctor.doctor_id}</SlateTag>
            </div>
          </div>
        )}

        <div
          onClick={() => navigate('/app/settings/profile')}
          className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-sunken cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-signal text-white flex items-center justify-center font-semibold text-xs shrink-0">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'PB'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink truncate">
                {user?.full_name || 'PointBlank User'}
              </p>
              <p className="font-mono text-[10px] text-accent font-medium truncate">
                {user?.user_id || 'PB-USR-000001'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-error bg-error-soft hover:brightness-95 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};
