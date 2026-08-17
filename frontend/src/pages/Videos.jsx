import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { videoApi } from '../api/client';
import { Video, Search, Loader2, CheckCircle2, Play, AlertCircle, Plus, RefreshCw } from 'lucide-react';

export const Videos = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchVideos = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await videoApi.list();
      setVideos(res.data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch video records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const filteredVideos = videos.filter((v) => {
    const matchesSearch =
      v.video_id.toLowerCase().includes(search.toLowerCase()) ||
      (v.doctor_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.script || '').toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && v.status === statusFilter;
  });

  return (
    <div className="space-y-6 select-none font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Video Library</h2>
          <p className="text-xs text-slate-500">
            Real-time status tracking, permanent MP4 storage, and public sharing QR codes.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchVideos}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/app/create-video')}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-xs shadow-md shadow-[#005570]/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Video</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PB-VID-000001, doctor, script..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#007799]"
          />
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
          {['ALL', 'COMPLETED', 'PROCESSING', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-white text-[#005570] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table / List */}
      <div className="pb-card overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#005570]" />
            <p className="text-xs font-medium">Loading video records from PostgreSQL...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-rose-600 flex flex-col items-center space-y-2">
            <AlertCircle className="w-6 h-6" />
            <p className="text-xs font-medium">{errorMsg}</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center space-y-3">
            <Video className="w-8 h-8 text-slate-400" />
            <p className="text-sm font-bold text-slate-800">No videos found</p>
            <p className="text-xs text-slate-500">Generate your first healthcare video to see status tracking.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">PointBlank ID</th>
                  <th className="py-3.5 px-4">Reference ID</th>
                  <th className="py-3.5 px-4">Doctor</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVideos.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#007799]">
                      {v.video_id}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {v.heygen_video_id ? `${v.heygen_video_id.slice(0, 12)}...` : 'Pending'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {v.doctor_name || 'Dr. Vance'}
                    </td>
                    <td className="py-3.5 px-4">
                      {v.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completed
                        </span>
                      ) : v.status === 'FAILED' ? (
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
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(v.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => navigate(`/app/videos/${v.id}`)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#E6F3F7] text-[#005570] hover:bg-[#005570] hover:text-white font-semibold text-xs transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        <span>Details</span>
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
