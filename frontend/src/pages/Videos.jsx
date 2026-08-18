import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { videoApi } from '../api/client';
import { Video, Search, AlertCircle, Plus, RefreshCw } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { DoctorVideoCard } from '../components/doctor/DoctorVideoCard';

const STATUS_FILTERS = ['ALL', 'COMPLETED', 'PROCESSING', 'FAILED'];

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

  const handleDeleteVideo = async (video) => {
    if (!window.confirm(`Delete video ${video.video_id}? This removes it from your library.`)) return;
    try {
      await videoApi.delete(video.id);
      setVideos((prev) => prev.filter((v) => v.id !== video.id));
    } catch (err) {
      alert(err.message || 'Failed to delete video');
    }
  };

  const filteredVideos = videos.filter((v) => {
    const matchesSearch =
      v.video_id.toLowerCase().includes(search.toLowerCase()) ||
      (v.doctor_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.script || '').toLowerCase().includes(search.toLowerCase());

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && v.status === statusFilter;
  });

  return (
    <div className="space-y-7 select-none font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-line pb-reveal">
        <div className="space-y-1.5">
          <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.16em]">Content · Videos</span>
          <h1 className="font-display text-3xl text-ink tracking-tight">Video Library</h1>
          <p className="text-sm text-ink-soft max-w-xl">
            Every video you've generated, with live rendering status and secure sharing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchVideos}
            className="p-2.5 rounded-xl border border-line text-ink-soft hover:bg-surface-sunken transition-colors"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/app/create-video')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs shadow-cta transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create video</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-reveal" style={{ '--pb-i': 1 }}>
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, doctor, or script…"
            className="w-full pl-10 pr-4 py-2 text-xs bg-surface border border-line rounded-xl focus:outline-hidden focus:border-accent transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                statusFilter === st ? 'bg-surface text-signal shadow-panel' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {st.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface overflow-hidden animate-pulse">
              <div className="aspect-video bg-surface-sunken" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-2/3 bg-surface-sunken rounded" />
                <div className="h-2.5 w-1/2 bg-surface-sunken rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center text-error flex flex-col items-center gap-2 pb-card">
          <AlertCircle className="w-6 h-6" />
          <p className="text-xs font-medium">{errorMsg}</p>
        </div>
      ) : filteredVideos.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No videos yet"
          description="Create your first doctor video."
          action={
            <button
              onClick={() => navigate('/app/create-video')}
              className="px-5 py-2.5 rounded-xl bg-signal text-white text-sm font-semibold shadow-cta"
            >
              Create video →
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((v, i) => (
            <DoctorVideoCard
              key={v.id}
              video={v}
              onClick={() => navigate(`/app/videos/${v.id}`)}
              onDelete={handleDeleteVideo}
              style={{ '--pb-i': Math.min(i, 8) }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
