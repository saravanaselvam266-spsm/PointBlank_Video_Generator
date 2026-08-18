import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { videoApi } from '../../api/client';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
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
            origin: { y: 0.6 },
            colors: ['#0D3A52', '#1B5A78', '#1E7A52']
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
      <div className="max-w-2xl mx-auto text-center py-6 pb-reveal">
        <div className="w-20 h-20 rounded-full bg-error-soft text-error mx-auto flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10" strokeWidth={1.5} />
        </div>
        <h3 className="font-display text-2xl text-ink mb-2">Video generation failed</h3>
        <p className="text-sm text-error bg-error-soft p-4 rounded-2xl max-w-md mx-auto">
          {error || activeVideo.error_message || 'The video could not be generated. Please go back and try again.'}
        </p>
      </div>
    );
  }

  const stageIndex = stageIndexForStatus(activeVideo.status);
  const isDone = activeVideo.status === 'COMPLETED';

  return (
    <div className="max-w-2xl mx-auto py-6 pb-reveal">
      <div className="text-center mb-8">
        <h3 className="font-display text-2xl text-ink mb-2">
          {isDone ? 'Your video is ready' : 'Generating your video'}
        </h3>
        <p className="text-sm text-ink-soft max-w-md mx-auto">
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
            <motion.div
              key={stage.key}
              initial={false}
              animate={{
                borderColor: isCurrent ? 'var(--color-accent)' : 'var(--color-line)',
                backgroundColor: isCurrent ? 'var(--color-signal-soft)' : 'var(--color-surface)',
              }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-4 p-4 rounded-2xl border"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${
                  isComplete
                    ? 'bg-success-soft text-success'
                    : isCurrent
                    ? 'bg-signal text-white'
                    : 'bg-surface-sunken text-ink-muted'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isCurrent ? 'text-signal' : isComplete ? 'text-ink' : 'text-ink-muted'}`}>
                  {stage.label}
                </p>
                <p className={`text-xs ${isCurrent ? 'text-signal/80' : 'text-ink-muted'}`}>{stage.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {!isDone && (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-muted">
          <Film className="w-3.5 h-3.5" />
          <span>You'll be able to preview, download, and share as soon as it's ready.</span>
        </div>
      )}
    </div>
  );
};
