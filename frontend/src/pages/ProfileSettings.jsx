import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/client';
import { User, ShieldCheck, KeyRound, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { SlateTag } from '../components/ui/SlateTag';

const InlineMessage = ({ msg }) => {
  if (!msg.text) return null;
  const isSuccess = msg.type === 'success';
  return (
    <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${isSuccess ? 'bg-success-soft text-success' : 'bg-error-soft text-error'}`}>
      {isSuccess ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
};

export const ProfileSettings = () => {
  const { user, logout, refreshUser } = useAuth();

  // Profile Form
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Password Form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileMsg({ type: '', text: '' });
    try {
      await userApi.updateMe({ full_name: fullName });
      await refreshUser();
      setProfileMsg({ type: 'success', text: 'Profile details updated successfully.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;
    setIsChangingPw(true);
    setPwMsg({ type: '', text: '' });
    try {
      await userApi.changePassword({ old_password: oldPassword, new_password: newPassword });
      setOldPassword('');
      setNewPassword('');
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setIsChangingPw(false);
    }
  };

  return (
    <div className="space-y-7 select-none font-sans max-w-4xl mx-auto">
      <div className="pb-6 border-b border-line pb-reveal">
        <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.16em]">Account</span>
        <h1 className="font-display text-3xl text-ink tracking-tight">Account settings</h1>
        <p className="text-sm text-ink-soft mt-1">
          Manage your profile, role, and security credentials.
        </p>
      </div>

      {/* User Card Overview */}
      <div className="pb-card p-6 flex flex-col sm:flex-row items-center justify-between gap-6 pb-reveal" style={{ '--pb-i': 1 }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-signal text-white flex items-center justify-center font-semibold text-xl border-2 border-surface shadow-panel">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'PB'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-ink">{user?.full_name}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-signal-soft text-signal">
                <ShieldCheck className="w-3 h-3 mr-1" />
                {user?.role}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">{user?.email}</p>
            <SlateTag className="mt-1.5">{user?.user_id}</SlateTag>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error-soft text-error hover:brightness-95 font-semibold text-xs transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>

      {/* Forms Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Info Form */}
        <div className="pb-card p-6 space-y-4 pb-reveal" style={{ '--pb-i': 2 }}>
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <User className="w-5 h-5 text-signal" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-ink">Edit personal profile</h3>
          </div>

          <InlineMessage msg={profileMsg} />

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                PointBlank user ID (immutable)
              </label>
              <input
                type="text"
                disabled
                value={user?.user_id || 'PB-USR-000001'}
                className="w-full px-3.5 py-2 text-xs bg-surface-sunken border border-line rounded-xl font-mono text-ink-muted cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                Full name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-surface-sunken border border-line rounded-xl focus:bg-surface focus:border-accent outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                Email address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3.5 py-2 text-xs bg-surface-sunken border border-line rounded-xl text-ink-muted cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="w-full py-2.5 px-4 rounded-xl bg-signal text-white font-semibold text-xs hover:bg-signal-strong transition-colors disabled:opacity-60"
            >
              {isUpdatingProfile ? 'Saving…' : 'Save profile changes'}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="pb-card p-6 space-y-4 pb-reveal" style={{ '--pb-i': 3 }}>
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <KeyRound className="w-5 h-5 text-signal" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-ink">Security & password</h3>
          </div>

          <InlineMessage msg={pwMsg} />

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                Current password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-surface-sunken border border-line rounded-xl focus:bg-surface focus:border-accent outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                New password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-surface-sunken border border-line rounded-xl focus:bg-surface focus:border-accent outline-hidden font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPw}
              className="w-full py-2.5 px-4 rounded-xl border border-signal text-signal hover:bg-signal-soft font-semibold text-xs transition-colors disabled:opacity-60"
            >
              {isChangingPw ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
