import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, HelpCircle, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

export const UserMenu = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-surface-sunken transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-signal text-white flex items-center justify-center font-semibold text-xs">
          {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'PB'}
        </div>
        <div className="hidden md:block text-left text-xs">
          <p className="font-semibold text-ink leading-tight">
            {user?.full_name || 'PointBlank User'}
          </p>
          <p className="font-mono text-[10px] text-accent font-medium">
            {user?.user_id || 'PB-USR-000001'}
          </p>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 w-64 bg-surface rounded-xl shadow-panel border border-line py-2 z-50 origin-top-right"
          >
            <div className="px-4 py-3 border-b border-line">
              <p className="text-sm font-semibold text-ink">{user?.full_name}</p>
              <p className="text-xs text-ink-muted truncate">{user?.email}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-signal-soft text-signal">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  {user?.role || 'User'}
                </span>
                <span className="font-mono text-[10px] text-ink-muted">
                  {user?.user_id}
                </span>
              </div>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/app/settings/profile');
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-ink-soft hover:bg-surface-sunken transition-colors"
              >
                <User className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                <span>My profile</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/app/settings/profile');
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-ink-soft hover:bg-surface-sunken transition-colors"
              >
                <Settings className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                <span>Account settings</span>
              </button>

              <a
                href="https://www.pointblank.co.in/"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-ink-soft hover:bg-surface-sunken transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                <span>PointBlank support</span>
              </a>
            </div>

            <div className="pt-1 border-t border-line">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-error hover:bg-error-soft transition-colors"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.75} />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
