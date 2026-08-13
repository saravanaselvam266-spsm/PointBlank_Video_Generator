import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, HelpCircle, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
        className="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#007799]/30"
      >
        <div className="w-8 h-8 rounded-full bg-[#005570] text-white flex items-center justify-center font-bold text-xs shadow-xs">
          {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'PB'}
        </div>
        <div className="hidden md:block text-left text-xs">
          <p className="font-semibold text-slate-800 leading-tight">
            {user?.full_name || 'PointBlank User'}
          </p>
          <p className="text-[10px] font-mono text-[#007799] font-medium">
            {user?.user_id || 'PB-USR-000001'}
          </p>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">{user?.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            <div className="mt-2 flex items-center space-x-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E6F3F7] text-[#005570]">
                <ShieldCheck className="w-3 h-3 mr-1" />
                {user?.role || 'User'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
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
              className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>My Profile</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/app/settings/profile');
              }}
              className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Account Settings</span>
            </button>

            <a
              href="https://www.pointblank.co.in/"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>PointBlank Support</span>
            </a>
          </div>

          <div className="pt-1 border-t border-slate-100">
            <button
              onClick={logout}
              className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
