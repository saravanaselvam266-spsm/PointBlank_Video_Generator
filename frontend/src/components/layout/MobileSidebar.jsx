import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, LayoutDashboard, Stethoscope, Bot, Video, Library, Settings, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

const NAV_GROUPS = [
  { label: 'Workspace', items: [{ name: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard }] },
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
      { name: 'Create Video', path: '/app/create-video', icon: Video },
    ],
  },
];

export const MobileSidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-xs"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex-1 max-w-xs w-full bg-surface flex flex-col h-full z-50"
          >
            <div className="p-4 flex items-center justify-between border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-signal text-white flex items-center justify-center font-mono font-semibold text-sm">
                  PB
                </div>
                <span className="font-display text-lg text-ink">PointBlank</span>
              </div>
              <button onClick={onClose} className="p-2 text-ink-muted hover:text-ink" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
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
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                              isActive ? 'bg-signal-soft text-signal font-semibold' : 'text-ink-soft hover:bg-surface-sunken'
                            }`
                          }
                        >
                          <Icon className="w-4 h-4 text-signal" strokeWidth={1.75} />
                          <span>{item.name}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
              <NavLink
                to="/app/settings/profile"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-signal-soft text-signal font-semibold' : 'text-ink-soft hover:bg-surface-sunken'
                  }`
                }
              >
                <Settings className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                <span>Account Settings</span>
              </NavLink>
            </div>

            <div className="p-4 border-t border-line bg-surface-sunken">
              <div className="mb-3">
                <p className="text-xs font-semibold text-ink">{user?.full_name}</p>
                <p className="font-mono text-[11px] text-accent">{user?.user_id}</p>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-error bg-error-soft"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
