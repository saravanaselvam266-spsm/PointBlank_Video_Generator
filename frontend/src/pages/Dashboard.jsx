import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import {
  Stethoscope,
  Video,
  Loader2,
  CheckCircle2,
  Plus,
  Play,
  ArrowUpRight,
  UserRound,
  AudioLines,
  AlertCircle
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const { currentDoctor } = useApp();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchSummary = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await dashboardApi.getSummary();
      setSummary(res.data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8 select-none font-sans text-left">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-white via-slate-50 to-teal-50/30 p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E6F3F7] text-[#005570]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#007799] animate-pulse"></span>
            <span>PointBlank AI Healthcare Video Studio</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {getGreeting()}, {user?.full_name || 'Saravana Perumal'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            {currentDoctor ? `Active Workspace: ${currentDoctor.doctor_name} (${currentDoctor.specialization})` : 'Create doctor avatar scenarios, saved voices, and AI videos with professional rendering.'}
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => navigate('/app/create-video')}
            className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-xs shadow-md shadow-[#005570]/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Open AI Studio</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Doctors</p>
            <p className="text-2xl font-extrabold text-slate-900">{isLoading ? '...' : summary?.total_doctors ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#005570] flex items-center justify-center border border-teal-100">
            <Stethoscope className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Videos Created</p>
            <p className="text-2xl font-extrabold text-slate-900">{isLoading ? '...' : summary?.total_videos ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E6F3F7] text-[#005570] flex items-center justify-center border border-[#007799]/20">
            <Video className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Processing</p>
            <p className="text-2xl font-extrabold text-slate-900">{isLoading ? '...' : summary?.processing_videos ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-extrabold text-slate-900">{isLoading ? '...' : summary?.completed_videos ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/app/create-video')}
            className="p-4 rounded-2xl bg-[#005570] text-white hover:bg-[#004055] transition-all text-left space-y-2 shadow-xs group"
          >
            <div className="flex items-center justify-between">
              <Video className="w-5 h-5 text-cyan-300" />
              <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div>
              <p className="font-bold text-sm">Create New Video</p>
              <p className="text-xs text-cyan-100/80">Launch 7-step studio workflow</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/app/doctors')}
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#007799] transition-all text-left space-y-2 group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <Stethoscope className="w-5 h-5 text-[#005570]" />
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900">Doctor Profiles</p>
              <p className="text-xs text-slate-500">Manage physicians & credentials</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/app/avatars')}
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#007799] transition-all text-left space-y-2 group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <UserRound className="w-5 h-5 text-[#005570]" />
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900">Avatar Scenarios</p>
              <p className="text-xs text-slate-500">Configure backgrounds & framing</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/app/voices')}
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#007799] transition-all text-left space-y-2 group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <AudioLines className="w-5 h-5 text-[#005570]" />
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900">Doctor Voices</p>
              <p className="text-xs text-slate-500">Manage saved synthetic voices</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Videos Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Healthcare Videos</h3>
            <p className="text-xs text-slate-500">Real-time status tracking for your video library</p>
          </div>
          <button
            onClick={() => navigate('/app/videos')}
            className="text-xs font-bold text-[#007799] hover:underline"
          >
            View All Videos
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#005570]" />
            <p className="text-xs font-medium">Fetching PostgreSQL video records...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-rose-600 flex flex-col items-center space-y-2">
            <AlertCircle className="w-6 h-6" />
            <p className="text-xs font-medium">{errorMsg}</p>
          </div>
        ) : !summary?.recent_videos || summary.recent_videos.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No videos created yet</p>
              <p className="text-xs text-slate-500">Create your first AI healthcare video.</p>
            </div>
            <button
              onClick={() => navigate('/app/create-video')}
              className="mt-2 px-4 py-2 rounded-lg bg-[#005570] text-white text-xs font-bold hover:bg-[#004055] transition-colors"
            >
              Create First AI Video
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Video ID</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Scenario / Voice</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {summary.recent_videos.map((vid) => (
                  <tr key={vid.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-[#007799]">
                      {vid.video_id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {vid.doctor_name || 'Doctor'}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-600">
                      <div>{vid.scenario_name || 'Custom Scenario'}</div>
                      <div className="text-[10px] text-slate-400">{vid.voice_name || 'AI Voice'}</div>
                    </td>
                    <td className="py-3 px-4">
                      {vid.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completed
                        </span>
                      ) : vid.status === 'FAILED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Processing
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(vid.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate(`/app/videos/${vid.id}`)}
                        className="inline-flex items-center space-x-1 px-3 py-1 rounded-md bg-slate-100 hover:bg-[#E6F3F7] hover:text-[#005570] text-slate-700 text-xs font-semibold transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
