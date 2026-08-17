import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { videoApi } from '../api/client';
import { ArrowLeft, Play, Download, QrCode, CheckCircle2, Loader2, AlertCircle, Share2, Copy } from 'lucide-react';

export const VideoDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [video, setVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchVideoDetails = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // First get record, then fetch status to update MP4 download / QR
      const res = await videoApi.get(id);
      setVideo(res.data);

      if (res.data.status !== 'COMPLETED' && res.data.status !== 'FAILED') {
        const statusRes = await videoApi.getStatus(id);
        setVideo(statusRes.data);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch video details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideoDetails();
  }, [id]);

  const handleCopyPublicUrl = () => {
    if (!video) return;
    const publicUrl = `http://localhost:5250/watch/${video.id}`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 select-none font-sans max-w-5xl mx-auto">
      <button
        onClick={() => navigate('/app/videos')}
        className="flex items-center space-x-2 text-xs font-bold text-[#005570] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Video Library</span>
      </button>

      {isLoading ? (
        <div className="p-16 text-center text-slate-500 flex flex-col items-center space-y-3 pb-card">
          <Loader2 className="w-8 h-8 animate-spin text-[#005570]" />
          <p className="text-xs font-medium">Fetching video status and metadata...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center text-rose-600 flex flex-col items-center space-y-2 pb-card">
          <AlertCircle className="w-6 h-6" />
          <p className="text-xs font-medium">{errorMsg}</p>
        </div>
      ) : !video ? (
        <div className="p-12 text-center pb-card text-slate-500">Video record not found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Video Player / Status Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="pb-card overflow-hidden">
              <div className="p-4 bg-[#005570] text-white flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-cyan-200">{video.video_id}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    video.status === 'COMPLETED'
                      ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30'
                      : video.status === 'FAILED'
                      ? 'bg-rose-400/20 text-rose-200 border border-rose-300/30'
                      : 'bg-amber-400/20 text-amber-200 border border-amber-300/30 animate-pulse'
                  }`}
                >
                  {video.status}
                </span>
              </div>

              <div className="aspect-video bg-black flex items-center justify-center relative">
                {video.status === 'COMPLETED' && (video.storage_key || video.video_url) ? (
                  <video
                    src={video.storage_key ? `http://localhost:8000/${video.storage_key}` : video.video_url}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : video.status === 'FAILED' ? (
                  <div className="p-6 text-center text-rose-400 space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto" />
                    <p className="text-xs font-semibold">Video Rendering Failed</p>
                    <p className="text-[11px] text-slate-400">{video.error_message}</p>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-300 space-y-3">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-cyan-400" />
                    <p className="text-xs font-semibold">Processing Video...</p>
                    <p className="text-[11px] text-slate-400">
                      Reference ID: <span className="font-mono">{video.heygen_video_id}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Script Box */}
            <div className="pb-card p-6 space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Generated Medical Script</h4>
              <p className="text-xs text-slate-800 leading-relaxed font-sans bg-slate-50 p-4 rounded-xl border border-slate-200">
                "{video.script}"
              </p>
            </div>
          </div>

          {/* Details & Share Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Metadata Card */}
            <div className="pb-card p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                Video Specifications
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">PointBlank ID</span>
                  <span className="font-mono font-bold text-[#007799]">{video.video_id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Reference ID</span>
                  <span className="font-mono text-slate-700">{video.heygen_video_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Doctor Profile</span>
                  <span className="font-bold text-slate-900">{video.doctor_name || 'Dr. Vance'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Avatar Type</span>
                  <span className="uppercase text-[11px] font-semibold text-slate-700">{video.avatar_type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Created Date</span>
                  <span className="text-slate-700">{new Date(video.created_at).toLocaleString()}</span>
                </div>
                {video.storage_key && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Permanent Storage</span>
                    <span className="font-mono text-[10px] text-emerald-700 font-bold">Stored Locally ✓</span>
                  </div>
                )}
              </div>
            </div>

            {/* Public Watch Share Card */}
            <div className="pb-card p-6 space-y-4 bg-gradient-to-br from-white to-slate-50">
              <div className="flex items-center space-x-2 text-[#005570]">
                <QrCode className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">Public Patient Share</h3>
              </div>

              <p className="text-xs text-slate-500">
                Patient-facing watch link served via PointBlank permanent storage without exposing API keys.
              </p>

              <button
                onClick={handleCopyPublicUrl}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-[#007799] text-[#005570] hover:bg-[#E6F3F7] font-bold text-xs transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>{copied ? 'Public URL Copied! ✓' : 'Copy Public Watch URL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
