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
  Play,
  ArrowUpRight,
  Bot,
  AudioLines,
  AlertCircle,
  ImageOff,
  Library
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { SlateTag } from '../components/ui/SlateTag';

const PulseRow = ({ icon: Icon, label, value, tone = 'neutral', spin = false }) => {
  const toneClasses = {
    neutral: 'bg-surface-sunken text-ink-muted',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
  }[tone];
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneClasses}`}>
          <Icon className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`} strokeWidth={1.75} />
        </div>
        <span className="text-sm text-ink-soft">{label}</span>
      </div>
      <span className="font-display text-xl text-ink">{value ?? '—'}</span>
    </div>
  );
};

const QuickLink = ({ icon: Icon, label, description, to, navigate }) => (
  <button
    onClick={() => navigate(to)}
    className="group flex-1 min-w-[220px] p-4 rounded-2xl bg-surface border border-line hover:border-accent/50 hover:bg-signal-soft/40 transition-all text-left flex items-center gap-3"
  >
    <div className="w-10 h-10 rounded-xl bg-signal-soft text-signal flex items-center justify-center shrink-0">
      <Icon className="w-5 h-5" strokeWidth={1.75} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-sm text-ink">{label}</p>
      <p className="text-xs text-ink-muted truncate">{description}</p>
    </div>
    <ArrowUpRight className="w-4 h-4 text-ink-muted group-hover:text-signal group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
  </button>
);

const videoStatusVariant = (status) => (status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'danger' : 'warning');

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

  const firstName = (user?.full_name || 'there').split(' ')[0];

  return (
    <div className="space-y-10 font-sans">
      {/* Hero: welcome + primary action + workspace pulse */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-8 pb-card p-8 sm:p-10 flex flex-col justify-between gap-8 pb-reveal">
          <div className="space-y-4">
            {user?.user_id && <SlateTag>{user.user_id}</SlateTag>}
            <h1 className="font-display text-4xl sm:text-[2.75rem] text-ink tracking-tight leading-[1.08]">
              {getGreeting()}, {firstName}.
            </h1>
            <p className="text-ink-soft text-[15px] max-w-xl leading-relaxed">
              {currentDoctor
                ? `Your active workspace is ${currentDoctor.doctor_name} — ${currentDoctor.specialization}.`
                : 'Bring a doctor, avatar, voice, and script together into a finished video.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <button
              onClick={() => navigate('/app/create-video')}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-signal hover:bg-signal-strong text-white font-semibold text-sm shadow-cta transition-all hover:-translate-y-0.5"
            >
              <Video className="w-4.5 h-4.5" strokeWidth={1.75} />
              <span>Create a video</span>
            </button>
            <div className="pb-rule flex-1 min-w-[40px] hidden sm:block" />
          </div>
        </div>

        <div className="xl:col-span-4 pb-card p-6 pb-reveal" style={{ '--pb-i': 1 }}>
          <h3 className="font-display text-lg text-ink mb-1">Workspace pulse</h3>
          <p className="text-xs text-ink-muted mb-1">What's happening right now</p>
          <div>
            <PulseRow icon={CheckCircle2} label="Completed videos" value={isLoading ? null : summary?.completed_videos} tone="success" />
            <PulseRow icon={Loader2} label="Rendering now" value={isLoading ? null : summary?.processing_videos} tone="warning" spin={!isLoading && summary?.processing_videos > 0} />
            <PulseRow icon={Stethoscope} label="Doctors" value={isLoading ? null : summary?.total_doctors} />
            <PulseRow icon={AudioLines} label="Voices ready" value={isLoading ? null : summary?.total_voices} />
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="flex flex-wrap gap-3 pb-reveal" style={{ '--pb-i': 2 }}>
        <QuickLink navigate={navigate} icon={Stethoscope} label="Doctors" description="Manage physician profiles" to="/app/doctors" />
        <QuickLink navigate={navigate} icon={Bot} label="AI Library" description="Reusable AI avatars & voices" to="/app/ai-library" />
        <QuickLink navigate={navigate} icon={Library} label="Video Library" description="Every generated video" to="/app/videos" />
      </section>

      {/* Recent activity — media workspace list */}
      <section className="pb-card overflow-hidden pb-reveal" style={{ '--pb-i': 3 }}>
        <div className="p-5 border-b border-line flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-ink">Recent videos</h3>
            <p className="text-xs text-ink-muted">Live status for what you've generated</p>
          </div>
          <button
            onClick={() => navigate('/app/videos')}
            className="text-xs font-semibold text-signal hover:underline shrink-0"
          >
            View all
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-ink-muted flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-signal" />
            <p className="text-xs font-medium">Loading recent videos…</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-error flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            <p className="text-xs font-medium">{errorMsg}</p>
          </div>
        ) : !summary?.recent_videos || summary.recent_videos.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No videos yet"
            description="Create your first doctor video to see it here."
            className="border-0 rounded-none"
            action={
              <button
                onClick={() => navigate('/app/create-video')}
                className="px-5 py-2.5 rounded-xl bg-signal text-white text-sm font-semibold hover:bg-signal-strong transition-colors"
              >
                Create your first video
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {summary.recent_videos.slice(0, 6).map((vid) => (
              <li
                key={vid.id}
                onClick={() => navigate(`/app/videos/${vid.id}`)}
                className="flex items-center gap-4 p-4 hover:bg-surface-sunken/60 transition-colors cursor-pointer"
              >
                <div className="w-16 h-10 rounded-lg bg-surface-sunken border border-line overflow-hidden flex items-center justify-center shrink-0">
                  {vid.thumbnail_url ? (
                    <img src={vid.thumbnail_url} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                  ) : null}
                  <ImageOff className="w-3.5 h-3.5 text-ink-muted" style={{ display: vid.thumbnail_url ? 'none' : 'flex' }} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-ink truncate">{vid.doctor_name || 'Doctor'}</p>
                    <SlateTag>{vid.video_id}</SlateTag>
                  </div>
                  <p className="text-xs text-ink-muted truncate">{vid.scenario_name || 'Custom avatar'} · {vid.voice_name || 'AI voice'}</p>
                </div>

                <div className="hidden sm:block text-xs text-ink-muted shrink-0">
                  {new Date(vid.created_at).toLocaleDateString()}
                </div>

                <Badge
                  variant={videoStatusVariant(vid.status)}
                  icon={vid.status === 'COMPLETED' ? CheckCircle2 : vid.status === 'FAILED' ? AlertCircle : Loader2}
                  pulse={vid.status !== 'COMPLETED' && vid.status !== 'FAILED'}
                >
                  {vid.status === 'COMPLETED' ? 'Completed' : vid.status === 'FAILED' ? 'Failed' : 'Processing'}
                </Badge>

                <Play className="w-4 h-4 text-ink-muted shrink-0 hidden sm:block" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
