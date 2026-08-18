import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../../api/client';
import { Stethoscope, Download, ShieldCheck, AlertCircle, Loader2, Calendar } from 'lucide-react';

export const PublicWatchPage = ({ token: propToken }) => {
  const params = useParams();
  const token = propToken || params.token;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) {
      fetchPublicVideo();
    }
  }, [token]);

  const fetchPublicVideo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await publicApi.getPublicVideo(token);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Public video link is invalid or expired');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!data?.video_url) return;
    const a = document.createElement('a');
    a.href = data.video_url;
    a.download = `PointBlank_Doctor_Video.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-atmosphere text-ink flex flex-col items-center justify-center p-6 font-sans">
        <Loader2 className="w-10 h-10 text-signal animate-spin mb-4" />
        <p className="text-ink-muted text-sm font-medium">Loading your video…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen pb-atmosphere text-ink flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-error-soft text-error flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="font-display text-2xl mb-2 text-ink">This link isn't available</h2>
        <p className="text-ink-muted text-sm max-w-md mx-auto mb-6">{error || 'This shared video link could not be loaded.'}</p>
        <a href="https://www.pointblank.co.in/" className="px-6 py-3 rounded-xl bg-signal text-white text-xs font-semibold hover:bg-signal-strong transition-all">
          Visit PointBlank
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-atmosphere text-ink font-sans">
      {/* Top Header */}
      <header className="border-b border-line bg-surface/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-signal text-white flex items-center justify-center font-mono font-semibold text-sm">
              PB
            </div>
            <div>
              <h1 className="font-display text-lg text-ink tracking-tight">PointBlank</h1>
              <p className="text-[10px] font-semibold text-accent uppercase tracking-wider">Doctor video share</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-signal bg-signal-soft border border-signal/15 px-3 py-1 rounded-full font-semibold">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Secure share</span>
          </div>
        </div>
      </header>

      {/* Main Public Watch Player */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Doctor Header Banner */}
        <div className="p-6 rounded-2xl bg-surface border border-line flex items-center gap-4 shadow-panel">
          <div className="w-14 h-14 rounded-2xl bg-signal text-white font-semibold text-xl flex items-center justify-center">
            {data.doctor_name.charAt(0)}
          </div>
          <div>
            <h2 className="font-display text-xl text-ink">{data.doctor_name}</h2>
            <p className="text-xs text-ink-muted flex items-center gap-1.5 mt-0.5 font-medium">
              <Stethoscope className="w-3.5 h-3.5 text-accent" />
              <span>{data.specialization}</span>
            </p>
          </div>
        </div>

        {/* Video Player — the hero of this page */}
        <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-panel">
          <div className="aspect-video bg-ink relative flex items-center justify-center">
            <video
              src={data.video_url}
              controls
              autoPlay
              poster={data.thumbnail_url}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="p-6 flex items-center justify-between border-t border-line">
            <div className="flex items-center gap-2 text-xs text-ink-muted font-medium">
              <Calendar className="w-4 h-4 text-accent" />
              <span>Published {new Date(data.created_at).toLocaleDateString()}</span>
            </div>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs shadow-cta transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download video</span>
            </button>
          </div>
        </div>

        {/* Script Content */}
        <div className="p-6 rounded-2xl bg-surface border border-line text-left space-y-2 shadow-panel">
          <h3 className="font-semibold text-ink text-sm">Doctor message transcript</h3>
          <p className="text-xs text-ink-soft bg-surface-sunken p-4 rounded-xl border border-line leading-relaxed italic">
            "{data.script}"
          </p>
        </div>
      </main>
    </div>
  );
};
