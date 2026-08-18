import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { videoApi } from '../api/client';
import { ArrowLeft, Download, QrCode, Loader2, AlertCircle, Share2, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { SlateTag } from '../components/ui/SlateTag';
import { Badge } from '../components/ui/Badge';

export const VideoDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [video, setVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const [shareData, setShareData] = useState(null);
  const [loadingShare, setLoadingShare] = useState(false);
  const [storageActionLoading, setStorageActionLoading] = useState(false);
  const [storageActionError, setStorageActionError] = useState(null);

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

  useEffect(() => {
    if (video?.status === 'COMPLETED') {
      fetchShareInfo();
    }
  }, [video?.status]);

  const fetchShareInfo = async () => {
    setLoadingShare(true);
    try {
      // Real public_token + QR PNG, get-or-created server-side — never build
      // the public watch URL manually on the frontend.
      const shareRes = await videoApi.getShareInfo(id).catch(() => null);
      if (shareRes?.data) {
        setShareData(shareRes.data);
      }
    } finally {
      setLoadingShare(false);
    }
  };

  const handleCopyPublicUrl = () => {
    if (!shareData?.public_url) return;
    navigator.clipboard.writeText(shareData.public_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadVideo = async () => {
    setStorageActionError(null);
    setStorageActionLoading(true);
    try {
      // Backend returns a short-lived signed Azure download URL — the browser
      // downloads directly from Azure to the user's Downloads/Desktop folder;
      // this app's backend never proxies the MP4 bytes.
      const res = await videoApi.getDownloadUrl(id);
      const downloadUrl = res.data.download_url;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `PointBlank_Doctor_Video_${video.video_id || id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setStorageActionError(err.message || 'Unable to download the video right now.');
    } finally {
      setStorageActionLoading(false);
    }
  };

  const handleRetryStorage = async () => {
    setStorageActionError(null);
    setStorageActionLoading(true);
    try {
      const res = await videoApi.retryStorage(id);
      setVideo(res.data);
    } catch (err) {
      setStorageActionError(err.message || 'Storage retry failed. Please try again.');
    } finally {
      setStorageActionLoading(false);
    }
  };

  const handleDownloadQR = () => {
    if (!shareData?.qr_image) return;
    const a = document.createElement('a');
    a.href = shareData.qr_image;
    a.download = `PointBlank_QR_Code_${video.video_id || id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 select-none font-sans max-w-6xl mx-auto">
      <button
        onClick={() => navigate('/app/videos')}
        className="flex items-center gap-2 text-xs font-semibold text-signal hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Video Library</span>
      </button>

      {isLoading ? (
        <div className="p-16 text-center text-ink-muted flex flex-col items-center gap-3 pb-card">
          <Loader2 className="w-8 h-8 animate-spin text-signal" />
          <p className="text-xs font-medium">Fetching video status and metadata…</p>
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center text-error flex flex-col items-center gap-2 pb-card">
          <AlertCircle className="w-6 h-6" />
          <p className="text-xs font-medium">{errorMsg}</p>
        </div>
      ) : !video ? (
        <div className="p-12 text-center pb-card text-ink-muted">Video record not found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-reveal">
          {/* Video is the hero of this page */}
          <div className="lg:col-span-8 space-y-6">
            <div className="pb-card overflow-hidden">
              <div className="p-4 bg-ink text-white flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-white/70">{video.video_id}</span>
                <Badge
                  variant={video.status === 'COMPLETED' ? 'success' : video.status === 'FAILED' ? 'danger' : 'warning'}
                  className="!bg-white/10 !border-white/20 !text-white"
                >
                  {video.status}
                </Badge>
              </div>

              <div className="aspect-video bg-ink flex items-center justify-center relative">
                {video.status === 'COMPLETED' && video.video_url ? (
                  // video_url is always resolved server-side to the Azure-mirrored
                  // playback SAS URL when available — the browser streams directly
                  // from Azure, this app's backend never proxies the file bytes.
                  <video
                    src={video.video_url}
                    poster={video.thumbnail_url}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : video.status === 'FAILED' ? (
                  <div className="p-6 text-center text-white/70 space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto text-error" />
                    <p className="text-xs font-semibold text-white">Video rendering failed</p>
                    <p className="text-[11px] text-white/50">{video.error_message}</p>
                  </div>
                ) : (
                  <div className="p-8 text-center text-white/70 space-y-3">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-accent" />
                    <p className="text-xs font-semibold text-white">Processing video…</p>
                    <p className="text-[11px] text-white/50">
                      Reference: <span className="font-mono">{video.heygen_video_id}</span>
                    </p>
                  </div>
                )}
              </div>

              {video.status === 'COMPLETED' && (
                <div className="p-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{video.doctor_name || 'Doctor Video'}</p>
                    <p className="text-[11px] text-ink-muted">{new Date(video.created_at).toLocaleString()}</p>
                  </div>

                  {video.storage_status === 'uploaded' ? (
                    <button
                      onClick={handleDownloadVideo}
                      disabled={storageActionLoading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs transition-all shadow-cta disabled:opacity-60"
                    >
                      {storageActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>{storageActionLoading ? 'Preparing download…' : 'Download video'}</span>
                    </button>
                  ) : video.storage_status === 'failed' ? (
                    <button
                      onClick={handleRetryStorage}
                      disabled={storageActionLoading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-error hover:brightness-95 text-white font-semibold text-xs transition-all"
                    >
                      {storageActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span>{storageActionLoading ? 'Retrying…' : 'Retry saving video'}</span>
                    </button>
                  ) : (
                    <button disabled className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-sunken text-ink-muted font-semibold text-xs cursor-not-allowed">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving video…</span>
                    </button>
                  )}
                </div>
              )}

              {storageActionError && (
                <div className="mx-4 mb-4 px-4 py-2.5 rounded-xl bg-error-soft border border-error/25 text-error text-xs">
                  {storageActionError}
                </div>
              )}
            </div>

            {/* Script */}
            <div className="pb-card p-6 space-y-2">
              <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Generated script</h4>
              <p className="text-sm text-ink-soft leading-relaxed bg-surface-sunken p-4 rounded-xl border border-line italic">
                "{video.script}"
              </p>
            </div>
          </div>

          {/* Details & Share */}
          <div className="lg:col-span-4 space-y-5">
            <div className="pb-card p-6 space-y-3.5">
              <h3 className="font-display text-base text-ink border-b border-line pb-3">
                Video specifications
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-line">
                  <span className="text-ink-muted">PointBlank ID</span>
                  <SlateTag>{video.video_id}</SlateTag>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Doctor</span>
                  <span className="font-semibold text-ink">{video.doctor_name || 'Dr. Vance'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Avatar type</span>
                  <span className="uppercase text-[11px] font-semibold text-ink-soft">{video.avatar_type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-muted">Created</span>
                  <span className="text-ink-soft">{new Date(video.created_at).toLocaleString()}</span>
                </div>
                {video.storage_status && (
                  <div className="flex justify-between py-1">
                    <span className="text-ink-muted">Storage</span>
                    <span className={`text-[11px] font-semibold ${video.storage_status === 'uploaded' ? 'text-success' : video.storage_status === 'failed' ? 'text-error' : 'text-warning'}`}>
                      {video.storage_status === 'uploaded' ? 'Secured ✓' : video.storage_status === 'failed' ? 'Storage failed' : 'Saving…'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* QR Code */}
            {video.status === 'COMPLETED' && (
              <div className="pb-card p-6 space-y-4 text-center">
                <span className="text-xs font-semibold text-ink flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4 text-signal" />
                  <span>QR code</span>
                </span>

                {shareData?.qr_image ? (
                  <div className="p-4 bg-surface rounded-2xl inline-block border border-line mx-auto">
                    <img src={shareData.qr_image} alt="Scan to watch this video" className="w-40 h-40 object-contain" />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-surface-sunken border border-line rounded-2xl mx-auto flex items-center justify-center text-xs text-ink-muted">
                    {loadingShare ? 'Generating…' : 'Not available yet'}
                  </div>
                )}

                <button
                  onClick={handleDownloadQR}
                  disabled={!shareData?.qr_image}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-sunken hover:brightness-95 text-ink-soft font-medium text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5 text-signal" />
                  <span>Download QR code</span>
                </button>
              </div>
            )}

            {/* Shareable link */}
            {video.status === 'COMPLETED' && (
              <div className="pb-card p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <Share2 className="w-4 h-4 text-signal" />
                  <span>Shareable link</span>
                </div>

                <div className="p-3 rounded-xl bg-signal-soft border border-signal/15 text-xs font-mono text-signal truncate">
                  {shareData?.public_url || (loadingShare ? 'Generating share link…' : 'Not available yet')}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCopyPublicUrl}
                    disabled={!shareData?.public_url}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-sunken hover:brightness-95 text-ink-soft font-medium text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy link'}</span>
                  </button>

                  <a
                    href={shareData?.public_url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!shareData?.public_url}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-signal-soft text-signal font-medium text-xs transition-all ${
                      shareData?.public_url ? 'hover:brightness-95' : 'opacity-50 pointer-events-none'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open page</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
