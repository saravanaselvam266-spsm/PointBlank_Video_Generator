import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/client';
import { User, ShieldCheck, KeyRound, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

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
    <div className="space-y-8 select-none font-sans max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Account Settings</h2>
        <p className="text-xs text-slate-500">
          Manage your PointBlank enterprise user profile, role, and security credentials.
        </p>
      </div>

      {/* User Card Overview */}
      <div className="pb-card p-6 flex flex-col sm:flex-row items-center justify-between gap-6 bg-gradient-to-r from-white to-slate-50">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-[#005570] text-white flex items-center justify-center font-extrabold text-xl shadow-md border-2 border-white">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'PB'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-slate-900">{user?.full_name}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E6F3F7] text-[#005570]">
                <ShieldCheck className="w-3 h-3 mr-1" />
                {user?.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            <p className="text-xs font-mono font-bold text-[#007799] mt-1">
              PointBlank User ID: {user?.user_id}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs border border-rose-200 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Forms Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Info Form */}
        <div className="pb-card p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <User className="w-5 h-5 text-[#005570]" />
            <h3 className="text-sm font-bold text-slate-900">Edit Personal Profile</h3>
          </div>

          {profileMsg.text && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                profileMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {profileMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PointBlank User ID (Immutable)
              </label>
              <input
                type="text"
                disabled
                value={user?.user_id || 'PB-USR-000001'}
                className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#007799] outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Corporate Email Address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="w-full py-2.5 px-4 rounded-xl bg-[#005570] text-white font-bold text-xs hover:bg-[#004055] transition-colors"
            >
              {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="pb-card p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <KeyRound className="w-5 h-5 text-[#005570]" />
            <h3 className="text-sm font-bold text-slate-900">Security & Password</h3>
          </div>

          {pwMsg.text && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                pwMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {pwMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{pwMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#007799] outline-hidden font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#007799] outline-hidden font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPw}
              className="w-full py-2.5 px-4 rounded-xl border border-[#007799] text-[#005570] hover:bg-[#E6F3F7] font-bold text-xs transition-colors"
            >
              {isChangingPw ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
