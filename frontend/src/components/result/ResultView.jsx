import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { videoApi } from '../../api/client';
import { Download, QrCode, Share2, Copy, Check, ExternalLink, RefreshCw, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/Badge';

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
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        {storageStatus === 'uploaded' ? (
          <Badge variant="success" icon={ShieldCheck}>Video ready — securely stored</Badge>
        ) : storageStatus === 'failed' ? (
          <Badge variant="danger" icon={AlertTriangle}>Video generated, but storage failed</Badge>
        ) : (
          <Badge variant="warning" icon={SpinningLoader}>Saving your video…</Badge>
        )}
        <h2 className="text-3xl font-extrabold text-[#1F2937] tracking-tight">Video Ready</h2>
        <p className="text-[#6B7280] text-sm max-w-lg mx-auto">
          Play, download, and share your doctor's AI video with a link or QR code.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Player Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-white border border-[#E5E7EB] overflow-hidden shadow-sm">
            <div className="aspect-video bg-[#0F172A] relative flex items-center justify-center">
              {permanentPlaybackUrl ? (
                <video
                  src={permanentPlaybackUrl}
                  controls
                  autoPlay
                  poster={activeVideo.thumbnail_url}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-slate-300 text-sm">Loading video…</div>
              )}
            </div>

            <div className="p-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#F5F7F8]">
              <div className="min-w-0">
                <h3 className="font-bold text-[#1F2937] text-lg truncate">
                  {currentDoctor?.doctor_name || 'Doctor Video'}
                </h3>
                <p className="text-xs text-[#6B7280] truncate">{currentDoctor?.specialization}</p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded bg-[#E6F3F7] text-[10px] font-mono text-[#005570] border border-[#007799]/20">
                  Video ID: {activeVideo.video_id || activeVideo.id}
                </span>
              </div>

              {storageStatus === 'uploaded' ? (
                <button
                  onClick={handleDownloadVideo}
                  disabled={storageActionLoading}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm transition-all shadow-md shadow-[#005570]/20 disabled:opacity-60"
                >
                  {storageActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{storageActionLoading ? 'Preparing download…' : 'Download Video'}</span>
                </button>
              ) : storageStatus === 'failed' ? (
                <button
                  onClick={handleRetryStorage}
                  disabled={storageActionLoading}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-all shadow-md shadow-rose-600/20 disabled:opacity-60"
                >
                  {storageActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{storageActionLoading ? 'Retrying…' : 'Retry Saving Video'}</span>
                </button>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F5F7F8] text-[#9CA3AF] font-bold text-sm cursor-not-allowed"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving video…</span>
                </button>
              )}
            </div>

            {storageActionError && (
              <div className="mx-6 mb-5 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {storageActionError}
              </div>
            )}
          </div>

          {/* Script Overview Card */}
          <div className="p-6 rounded-3xl bg-white border border-[#E5E7EB]">
            <h4 className="font-bold text-[#1F2937] text-sm mb-2">Video script</h4>
            <p className="text-xs text-[#374151] bg-[#F5F7F8] p-4 rounded-2xl border border-[#E5E7EB] leading-relaxed italic">
              "{activeVideo.script}"
            </p>
          </div>
        </div>

        {/* Sharing & QR Code Column */}
        <div className="space-y-6">
          {/* QR Code Card */}
          <div className="p-6 rounded-3xl bg-white border border-[#E5E7EB] text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1F2937] flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#005570]" />
                <span>QR code</span>
              </span>
            </div>

            {shareData?.qr_image ? (
              <div className="p-4 bg-white rounded-2xl inline-block border border-[#F5F7F8] mx-auto">
                <img src={shareData.qr_image} alt="Scan to watch this video" className="w-44 h-44 object-contain" />
              </div>
            ) : (
              <div className="w-44 h-44 bg-[#F5F7F8] border border-[#E5E7EB] rounded-2xl mx-auto flex items-center justify-center text-xs text-[#9CA3AF]">
                {loadingShare ? 'Generating…' : 'Not available yet'}
              </div>
            )}

            <button
              onClick={handleDownloadQR}
              disabled={!shareData?.qr_image}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5F7F8] hover:bg-[#EEF1F2] text-[#374151] font-medium text-xs transition-all border border-[#E5E7EB] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-[#005570]" />
              <span>Download QR code</span>
            </button>
          </div>

          {/* Public Watch Link Card */}
          <div className="p-6 rounded-3xl bg-white border border-[#E5E7EB] space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1F2937]">
              <Share2 className="w-4 h-4 text-[#005570]" />
              <span>Shareable link</span>
            </div>

            <div className="p-3 rounded-xl bg-[#E6F3F7] border border-[#007799]/20 text-xs font-mono text-[#005570] truncate">
              {publicWatchUrl || (loadingShare ? 'Generating share link…' : 'Not available yet')}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                disabled={!publicWatchUrl}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#F5F7F8] hover:bg-[#EEF1F2] text-[#374151] font-medium text-xs transition-all border border-[#E5E7EB] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy link'}</span>
              </button>

              <a
                href={publicWatchUrl || undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!publicWatchUrl}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#E6F3F7] text-[#005570] font-medium text-xs transition-all border border-[#007799]/20 ${
                  publicWatchUrl ? 'hover:bg-[#D0E8EF]' : 'opacity-50 pointer-events-none'
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
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-[#F5F7F8] text-[#374151] font-bold text-sm transition-all border border-[#E5E7EB]"
          >
            <RefreshCw className="w-4 h-4 text-[#005570]" />
            <span>Create Another Video</span>
          </button>
        </div>
      </div>
    </div>
  );
};
