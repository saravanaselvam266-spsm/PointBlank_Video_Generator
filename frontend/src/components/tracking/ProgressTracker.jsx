import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { videoApi } from '../../api/client';
import confetti from 'canvas-confetti';
import { Loader2, CheckCircle2, AlertCircle, Film, ShieldCheck } from 'lucide-react';

export const ProgressTracker = ({ onCompleted }) => {
  const { activeVideo, setActiveVideo, setIsGenerating } = useApp();
  const [error, setError] = useState(null);
  const [uiStatusLabel, setUiStatusLabel] = useState('Preparing Video Job...');

  useEffect(() => {
    if (!activeVideo?.id) return;

    let isMounted = true;
    let timerId = null;

    const pollStatus = async () => {
      try {
        const res = await videoApi.getStatus(activeVideo.id);
        const updatedVid = res.data;

        if (!isMounted) return;

        setActiveVideo(updatedVid);

        if (updatedVid.status === 'PENDING') {
          setUiStatusLabel('Queued for processing...');
        } else if (updatedVid.status === 'PROCESSING') {
          setUiStatusLabel('Rendering AI Avatar & Lip-Sync Audio...');
        } else if (updatedVid.status === 'COMPLETED') {
          setUiStatusLabel('Finalizing Video & Saving to Permanent PointBlank Storage...');
          setIsGenerating(false);
          
          // Trigger Confetti Celebration
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });

          if (onCompleted) onCompleted(updatedVid);
          return;
        } else if (updatedVid.status === 'FAILED') {
          setUiStatusLabel('Video Generation Failed');
          setError(updatedVid.error_message || 'Video generation encountered an error.');
          setIsGenerating(false);
          return;
        }

        timerId = setTimeout(pollStatus, 3000);
      } catch (err) {
        console.error('Polling error:', err);
        if (isMounted) {
          setError(err.message || 'Status tracking request failed');
          timerId = setTimeout(pollStatus, 5000);
        }
      }
    };

    pollStatus();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [activeVideo?.id]);

  if (!activeVideo) return null;

  return (
    <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-white border border-slate-200 text-center shadow-lg">
      
      {activeVideo.status === 'COMPLETED' ? (
        <div className="py-6">
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 border border-emerald-200 mx-auto flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Video Generation Complete!</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Your video has been generated and permanently stored in PointBlank.
          </p>
        </div>
      ) : activeVideo.status === 'FAILED' ? (
        <div className="py-6">
          <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-500 border border-rose-200 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Generation Failed</h3>
          <p className="text-xs text-rose-700 bg-rose-50 p-4 rounded-2xl border border-rose-200 max-w-md mx-auto mb-6">
            {error || activeVideo.error_message || 'The video could not be generated. Please try again.'}
          </p>
        </div>
      ) : (
        <div className="py-12">
          <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-[#007799]/20 border-t-[#005570] animate-spin" />
            <Film className="w-10 h-10 text-[#005570]" />
          </div>

          <h3 className="text-2xl font-bold text-slate-900 mb-2">{uiStatusLabel}</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            We're checking on your video's progress. Current status:{' '}
            <span className="font-mono text-[#005570] font-bold">{activeVideo.status}</span>
          </p>

          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-[#E6F3F7] text-xs text-slate-600 border border-[#007799]/20">
            <ShieldCheck className="w-4 h-4 text-[#005570]" />
            <span>Reference ID: <strong className="font-mono text-slate-800">{activeVideo.heygen_video_id}</strong></span>
          </div>
        </div>
      )}

    </div>
  );
};
