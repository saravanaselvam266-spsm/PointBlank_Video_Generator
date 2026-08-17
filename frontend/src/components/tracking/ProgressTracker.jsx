import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { videoApi } from '../../api/client';
import confetti from 'canvas-confetti';
import { Loader2, CheckCircle2, AlertCircle, Film, Clock, Sparkles } from 'lucide-react';

const STAGES = [
  { key: 'PENDING', label: 'Queued', description: 'Your request is in line for processing.', icon: Clock },
  { key: 'PROCESSING', label: 'Generating video', description: 'Rendering the avatar, voice, and script together.', icon: Sparkles },
  { key: 'COMPLETED', label: 'Video ready', description: 'Your video has been generated and saved.', icon: CheckCircle2 },
];

const stageIndexForStatus = (status) => {
  if (status === 'COMPLETED') return 2;
  if (status === 'PROCESSING') return 1;
  return 0; // PENDING or unknown non-terminal status
};

export const ProgressTracker = ({ onCompleted }) => {
  const { activeVideo, setActiveVideo, setIsGenerating } = useApp();
  const [error, setError] = useState(null);

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

        if (updatedVid.status === 'COMPLETED') {
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

  if (activeVideo.status === 'FAILED') {
    return (
      <div className="max-w-2xl mx-auto text-center py-6">
        <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-500 border border-rose-200 mx-auto flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h3 className="text-2xl font-extrabold text-[#1F2937] mb-2">Video generation failed</h3>
        <p className="text-sm text-rose-700 bg-rose-50 p-4 rounded-2xl border border-rose-200 max-w-md mx-auto">
          {error || activeVideo.error_message || 'The video could not be generated. Please go back and try again.'}
        </p>
      </div>
    );
  }

  const stageIndex = stageIndexForStatus(activeVideo.status);
  const isDone = activeVideo.status === 'COMPLETED';

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-extrabold text-[#1F2937] mb-2">
          {isDone ? 'Your video is ready' : 'Generating your video'}
        </h3>
        <p className="text-sm text-[#6B7280] max-w-md mx-auto">
          {isDone
            ? 'Your video has been generated and permanently stored.'
            : "This usually takes a few minutes. Feel free to keep this tab open — we'll update automatically."}
        </p>
      </div>

      <div className="space-y-3">
        {STAGES.map((stage, idx) => {
          const isComplete = idx < stageIndex || isDone;
          const isCurrent = idx === stageIndex && !isDone;
          const Icon = stage.icon;
          return (
            <div
              key={stage.key}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                isCurrent
                  ? 'border-[#007799] bg-[#E6F3F7]'
                  : isComplete
                  ? 'border-[#E5E7EB] bg-white'
                  : 'border-[#E5E7EB] bg-[#F5F7F8]'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isComplete
                    ? 'bg-emerald-100 text-emerald-700'
                    : isCurrent
                    ? 'bg-[#005570] text-white'
                    : 'bg-white text-[#9CA3AF] border border-[#E5E7EB]'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${isCurrent ? 'text-[#005570]' : isComplete ? 'text-[#1F2937]' : 'text-[#9CA3AF]'}`}>
                  {stage.label}
                </p>
                <p className={`text-xs ${isCurrent ? 'text-[#005570]/80' : 'text-[#6B7280]'}`}>{stage.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!isDone && (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#9CA3AF]">
          <Film className="w-3.5 h-3.5" />
          <span>You'll be able to preview, download, and share as soon as it's ready.</span>
        </div>
      )}
    </div>
  );
};
