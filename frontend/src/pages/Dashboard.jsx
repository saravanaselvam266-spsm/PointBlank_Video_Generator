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
import { EmptyState } from '../components/ui/EmptyState';

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
    <div className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-white via-[#FAFAFA] to-[#E6F3F7]/40 p-6 sm:p-8 rounded-2xl border border-[#E5E7EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E6F3F7] text-[#005570]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#007799] animate-pulse"></span>
            <span>PointBlank AI Video Generator</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2937] tracking-tight">
            {getGreeting()}, {user?.full_name || 'there'}
          </h2>
          <p className="text-sm text-[#6B7280] max-w-2xl">
            {currentDoctor
              ? `Active workspace: ${currentDoctor.doctor_name} (${currentDoctor.specialization})`
              : 'Create doctor avatars, saved voices, and AI videos with professional rendering.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/app/create-video')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm shadow-md shadow-[#005570]/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Video</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Total Doctors</p>
            <p className="text-2xl font-extrabold text-[#1F2937]">{isLoading ? '—' : summary?.total_doctors ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E6F3F7] text-[#005570] flex items-center justify-center border border-[#007799]/20">
            <Stethoscope className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Total Videos</p>
            <p className="text-2xl font-extrabold text-[#1F2937]">{isLoading ? '—' : summary?.total_videos ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#E6F3F7] text-[#005570] flex items-center justify-center border border-[#007799]/20">
            <Video className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Processing</p>
            <p className="text-2xl font-extrabold text-[#1F2937]">{isLoading ? '—' : summary?.processing_videos ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-extrabold text-[#1F2937]">{isLoading ? '—' : summary?.completed_videos ?? 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#1F2937] tracking-tight">Quick Actions</h3>
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
              <p className="text-xs text-cyan-100/80">Launch the 7-step video workflow</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/app/doctors')}
            className="p-4 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#007799] transition-all text-left space-y-2 group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <Stethoscope className="w-5 h-5 text-[#005570]" />
              <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#1F2937]">Doctor Profiles</p>
              <p className="text-xs text-[#6B7280]">Manage physicians & credentials</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/app/avatars')}
            className="p-4 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#007799] transition-all text-left space-y-2 group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <UserRound className="w-5 h-5 text-[#005570]" />
              <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#1F2937]">Avatar Library</p>
              <p className="text-xs text-[#6B7280]">Manage doctor avatars & styles</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/app/voices')}
            className="p-4 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#007799] transition-all text-left space-y-2 group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <AudioLines className="w-5 h-5 text-[#005570]" />
              <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#1F2937]">Doctor Voices</p>
              <p className="text-xs text-[#6B7280]">Manage saved AI voices</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Videos Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[#F5F7F8] flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#1F2937]">Recent Videos</h3>
            <p className="text-xs text-[#6B7280]">Live status for the videos you've generated</p>
          </div>
          <button
            onClick={() => navigate('/app/videos')}
            className="text-xs font-bold text-[#007799] hover:underline shrink-0"
          >
            View All
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-[#6B7280] flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#005570]" />
            <p className="text-xs font-medium">Loading recent videos…</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-rose-600 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            <p className="text-xs font-medium">{errorMsg}</p>
          </div>
        ) : !summary?.recent_videos || summary.recent_videos.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No videos created yet"
            description="Create your first AI healthcare video to see it here."
            className="border-0 rounded-none"
            action={
              <button
                onClick={() => navigate('/app/create-video')}
                className="px-5 py-2.5 rounded-xl bg-[#005570] text-white text-sm font-bold hover:bg-[#004055] transition-colors"
              >
                Create Your First Video
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F7F8] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-3 px-4">Video</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Avatar / Voice</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F7F8] text-xs">
                {summary.recent_videos.map((vid) => (
                  <tr key={vid.id} className="hover:bg-[#F5F7F8]/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-[#007799]">
                      {vid.video_id}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#1F2937]">
                      {vid.doctor_name || 'Doctor'}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[#374151]">
                      <div>{vid.scenario_name || 'Custom Avatar'}</div>
                      <div className="text-[10px] text-[#9CA3AF]">{vid.voice_name || 'AI Voice'}</div>
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
                    <td className="py-3 px-4 text-[#6B7280]">
                      {new Date(vid.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate(`/app/videos/${vid.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[#F5F7F8] hover:bg-[#E6F3F7] hover:text-[#005570] text-[#374151] text-xs font-semibold transition-colors"
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
