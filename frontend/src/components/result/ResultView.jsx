import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { videoApi } from '../../api/client';
import { Download, QrCode, Share2, Copy, Check, ExternalLink, RefreshCw, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { SlateTag } from '../ui/SlateTag';

const SpinningLoader = (props) => <Loader2 {...props} className={`${props.className || ''} animate-spin`} />;

export const ResultView = () => {
  const { activeVideo, setActiveVideo, currentDoctor, resetStudio } = useApp();
  const [shareData, setShareData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loadingShare, setLoadingShare] = useState(false);
  const [storageActionLoading, setStorageActionLoading] = useState(false);
  const [storageActionError, setStorageActionError] = useState(null);

  useEffect(() => {
    if (activeVideo?.id && activeVideo.status === 'COMPLETED') {
      fetchShareInfo();
    }
  }, [activeVideo?.id, activeVideo?.status]);

  const fetchShareInfo = async () => {
    if (!activeVideo) return;
    setLoadingShare(true);
    try {
      const shareRes = await videoApi.getShareInfo(activeVideo.id).catch(() => null);
      if (shareRes?.data) {
        setShareData(shareRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingShare(false);
    }
  };

  if (!activeVideo || activeVideo.status !== 'COMPLETED') {
    return null;
  }

  // The backend already prefers the Azure-mirrored copy over the provider's
  // raw CDN URL once storage_status is "uploaded" — video_url here is
  // whichever one is currently playable, resolved server-side.
  const permanentPlaybackUrl = activeVideo.video_url;

  const publicWatchUrl = shareData?.public_url || null;

  const handleCopyLink = () => {
    if (!publicWatchUrl) return;
    navigator.clipboard.writeText(publicWatchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadVideo = async () => {
    setStorageActionError(null);
    setStorageActionLoading(true);
    try {
      // Backend returns a short-lived signed download URL — the browser downloads
      // directly from storage, this app's backend never proxies the file bytes.
      const res = await videoApi.getDownloadUrl(activeVideo.id);
      const downloadUrl = res.data.download_url;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `PointBlank_Doctor_Video_${activeVideo.id}.mp4`;
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
      const res = await videoApi.retryStorage(activeVideo.id);
      setActiveVideo(res.data);
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
    a.download = `PointBlank_QR_Code_${activeVideo.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const storageStatus = activeVideo.storage_status || 'pending';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-reveal">
      <div className="text-center space-y-3">
        {storageStatus === 'uploaded' ? (
          <Badge variant="success" icon={ShieldCheck}>Video ready — securely stored</Badge>
        ) : storageStatus === 'failed' ? (
          <Badge variant="danger" icon={AlertTriangle}>Video generated, but storage failed</Badge>
        ) : (
          <Badge variant="warning" icon={SpinningLoader}>Saving your video…</Badge>
        )}
        <h2 className="font-display text-3xl text-ink tracking-tight">Video ready</h2>
        <p className="text-ink-soft text-sm max-w-lg mx-auto">
          Play, download, and share your doctor's video with a link or QR code.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Player Column — the video is the hero */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-surface border border-line overflow-hidden shadow-panel">
            <div className="aspect-video bg-ink relative flex items-center justify-center">
              {permanentPlaybackUrl ? (
                <video
                  src={permanentPlaybackUrl}
                  controls
                  autoPlay
                  poster={activeVideo.thumbnail_url}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-white/50 text-sm">Loading video…</div>
              )}
            </div>

            <div className="p-6 flex flex-wrap items-center justify-between gap-4 border-t border-line">
              <div className="min-w-0">
                <h3 className="font-display text-lg text-ink truncate">
                  {currentDoctor?.doctor_name || 'Doctor Video'}
                </h3>
                <p className="text-xs text-ink-muted truncate">{currentDoctor?.specialization}</p>
                <SlateTag className="mt-2">{activeVideo.video_id || activeVideo.id}</SlateTag>
              </div>

              {storageStatus === 'uploaded' ? (
                <button
                  onClick={handleDownloadVideo}
                  disabled={storageActionLoading}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-sm transition-all shadow-cta disabled:opacity-60"
                >
                  {storageActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{storageActionLoading ? 'Preparing download…' : 'Download video'}</span>
                </button>
              ) : storageStatus === 'failed' ? (
                <button
                  onClick={handleRetryStorage}
                  disabled={storageActionLoading}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-error hover:brightness-95 text-white font-semibold text-sm transition-all"
                >
                  {storageActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{storageActionLoading ? 'Retrying…' : 'Retry saving video'}</span>
                </button>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-sunken text-ink-muted font-semibold text-sm cursor-not-allowed"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving video…</span>
                </button>
              )}
            </div>

            {storageActionError && (
              <div className="mx-6 mb-5 px-4 py-2.5 rounded-xl bg-error-soft border border-error/25 text-error text-xs">
                {storageActionError}
              </div>
            )}
          </div>

          {/* Script Overview Card */}
          <div className="p-6 rounded-3xl bg-surface border border-line">
            <h4 className="font-semibold text-ink text-sm mb-2">Video script</h4>
            <p className="text-xs text-ink-soft bg-surface-sunken p-4 rounded-2xl border border-line leading-relaxed italic">
              "{activeVideo.script}"
            </p>
          </div>
        </div>

        {/* Sharing & QR Code Column */}
        <div className="space-y-6">
          {/* QR Code Card */}
          <div className="p-6 rounded-3xl bg-surface border border-line text-center space-y-4">
            <span className="text-xs font-semibold text-ink flex items-center justify-center gap-2">
              <QrCode className="w-4 h-4 text-signal" />
              <span>QR code</span>
            </span>

            {shareData?.qr_image ? (
              <div className="p-4 bg-surface rounded-2xl inline-block border border-line mx-auto">
                <img src={shareData.qr_image} alt="Scan to watch this video" className="w-44 h-44 object-contain" />
              </div>
            ) : (
              <div className="w-44 h-44 bg-surface-sunken border border-line rounded-2xl mx-auto flex items-center justify-center text-xs text-ink-muted">
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

          {/* Public Watch Link Card */}
          <div className="p-6 rounded-3xl bg-surface border border-line space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Share2 className="w-4 h-4 text-signal" />
              <span>Shareable link</span>
            </div>

            <div className="p-3 rounded-xl bg-signal-soft border border-signal/15 text-xs font-mono text-signal truncate">
              {publicWatchUrl || (loadingShare ? 'Generating share link…' : 'Not available yet')}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                disabled={!publicWatchUrl}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-sunken hover:brightness-95 text-ink-soft font-medium text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy link'}</span>
              </button>

              <a
                href={publicWatchUrl || undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!publicWatchUrl}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-signal-soft text-signal font-medium text-xs transition-all ${
                  publicWatchUrl ? 'hover:brightness-95' : 'opacity-50 pointer-events-none'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open page</span>
              </a>
            </div>
          </div>

          {/* New Video Action */}
          <button
            onClick={resetStudio}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-surface hover:bg-surface-sunken text-ink-soft font-semibold text-sm transition-all border border-line"
          >
            <RefreshCw className="w-4 h-4 text-signal" />
            <span>Create another video</span>
          </button>
        </div>
      </div>
    </div>
  );
};
