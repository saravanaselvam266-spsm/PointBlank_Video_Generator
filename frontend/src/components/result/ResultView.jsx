import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { publicApi, videoApi } from '../../api/client';
import { Download, QrCode, Share2, Copy, Check, ExternalLink, RefreshCw, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';

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
      const videoStatusRes = await publicApi.getPublicVideo(activeVideo.id).catch(() => null);
      if (videoStatusRes?.data) {
        setShareData(videoStatusRes.data);
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

  const permanentPlaybackUrl = activeVideo.storage_key
    ? `http://localhost:8000/${activeVideo.storage_key}`
    : activeVideo.video_url;

  const publicWatchUrl = shareData?.public_url || `http://localhost:5250/watch/${activeVideo.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicWatchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadVideo = async () => {
    setStorageActionError(null);
    setStorageActionLoading(true);
    try {
      // Backend returns a short-lived Azure SAS URL — the browser downloads
      // directly from Azure, the FastAPI backend never proxies the file bytes.
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
    <div className="max-w-5xl mx-auto p-6 text-left">
      <div className="text-center mb-8">
        {storageStatus === 'uploaded' ? (
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold mb-3">
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            <span>Final Video Ready — Stored in Azure Blob Storage</span>
          </div>
        ) : storageStatus === 'failed' ? (
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold mb-3">
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            <span>Video generated, but storage failed</span>
          </div>
        ) : (
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold mb-3">
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            <span>Storing video...</span>
          </div>
        )}
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">AI Video Rendered Successfully</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto">
          Play, download, and share your doctor AI video via Azure Blob Storage and QR code.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Main Player Column */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-lg">
            <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
              {permanentPlaybackUrl ? (
                <video
                  src={permanentPlaybackUrl}
                  controls
                  autoPlay
                  poster={activeVideo.thumbnail_url}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-slate-500 text-sm">Video Stream Loading...</div>
              )}
            </div>

            <div className="p-6 flex flex-wrap items-center justify-between gap-4 bg-white border-t border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  {currentDoctor?.doctor_name || 'Doctor Video'}
                </h3>
                <p className="text-xs text-slate-500">{currentDoctor?.specialization}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="px-2 py-0.5 rounded bg-[#E6F3F7] text-[10px] font-mono text-[#005570] border border-[#007799]/20">
                    PB-VID: {activeVideo.id}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-50 text-[10px] font-mono text-slate-500 border border-slate-200">
                    Reference ID: {activeVideo.heygen_video_id}
                  </span>
                </div>
              </div>

              {storageStatus === 'uploaded' ? (
                <button
                  onClick={handleDownloadVideo}
                  disabled={storageActionLoading}
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm transition-all shadow-lg shadow-[#005570]/20 disabled:opacity-60"
                >
                  {storageActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{storageActionLoading ? 'Preparing Download...' : 'Download MP4'}</span>
                </button>
              ) : storageStatus === 'failed' ? (
                <button
                  onClick={handleRetryStorage}
                  disabled={storageActionLoading}
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-all shadow-lg shadow-rose-600/20 disabled:opacity-60"
                >
                  {storageActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{storageActionLoading ? 'Retrying...' : 'Retry Storage'}</span>
                </button>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-slate-200 text-slate-500 font-bold text-sm cursor-not-allowed"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Storing video...</span>
                </button>
              )}
            </div>

            {storageActionError && (
              <div className="mx-6 mb-4 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {storageActionError}
              </div>
            )}
          </div>

          {/* Script Overview Card */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm mb-2">Generated Video Script</h4>
            <p className="text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200 leading-relaxed italic">
              "{activeVideo.script}"
            </p>
          </div>

        </div>

        {/* Sharing & QR Code Column */}
        <div className="space-y-6">
          
          {/* QR Code Card */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                <QrCode className="w-4 h-4 text-[#005570]" />
                <span>Doctor QR Code</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">PNG Format</span>
            </div>

            {shareData?.qr_image ? (
              <div className="p-4 bg-white rounded-2xl inline-block shadow-md border border-slate-100 mx-auto">
                <img src={shareData.qr_image} alt="Public Video QR Code" className="w-44 h-44 object-contain" />
              </div>
            ) : (
              <div className="w-44 h-44 bg-slate-50 border border-slate-200 rounded-2xl mx-auto flex items-center justify-center text-xs text-slate-400">
                Generating QR...
              </div>
            )}

            <button
              onClick={handleDownloadQR}
              disabled={!shareData?.qr_image}
              className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-all border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-[#005570]" />
              <span>Download QR Code Image</span>
            </button>
          </div>

          {/* Public Watch Link Card */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
              <Share2 className="w-4 h-4 text-[#005570]" />
              <span>PointBlank Public URL</span>
            </div>

            <div className="p-3 rounded-xl bg-[#E6F3F7] border border-[#007799]/20 text-xs font-mono text-[#005570] truncate">
              {publicWatchUrl}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-all border border-slate-200"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy URL'}</span>
              </button>

              <a
                href={publicWatchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl bg-[#E6F3F7] hover:bg-[#D0E8EF] text-[#005570] font-medium text-xs transition-all border border-[#007799]/20"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Page</span>
              </a>
            </div>
          </div>

          {/* New Video Action */}
          <button
            onClick={resetStudio}
            className="w-full inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all border border-slate-200 shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-[#005570]" />
            <span>Create New Doctor Video</span>
          </button>

        </div>

      </div>
    </div>
  );
};
