import React from 'react';
import { Play, Pause, Trash2, RefreshCw } from 'lucide-react';
import { MediaStatus } from '../ui/MediaStatus';
import { SlateTag } from '../ui/SlateTag';

/**
 * One doctor voice's card — shared by the Doctor Profile page and the Voice
 * Library discovery page. Playback state (which voice is playing) is owned
 * by the parent so only one audio element ever plays at a time across a page.
 */
export const DoctorVoiceCard = ({ voice: v, isPlaying, onTogglePlay, onDelete, onRetry, isRetrying, onUse, style }) => {
  const previewUrl = v.source_preview_url || v.preview_url;
  const isFailed = v.clone_status === 'failed';

  return (
    <div
      className="p-4 bg-surface rounded-2xl border border-line shadow-panel flex flex-col justify-between hover:border-accent/50 transition-all pb-reveal"
      style={style}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SlateTag>{v.voice_id}</SlateTag>
          <span className="text-[10px] font-semibold text-ink-muted capitalize">{v.language || 'English'}</span>
        </div>

        <div>
          <h4 className="font-semibold text-ink text-sm truncate">{v.name}</h4>
          <p className="text-xs text-ink-muted truncate">Doctor: {v.doctor_name || 'Assigned doctor'}</p>
          <span className="inline-flex mt-1.5">
            <MediaStatus kind="voice" status={v.clone_status} />
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
        {previewUrl ? (
          <button
            type="button"
            onClick={() => onTogglePlay?.(previewUrl, v.id)}
            className={`p-2 rounded-xl transition-all ${
              isPlaying ? 'bg-signal text-white' : 'bg-surface-sunken text-signal hover:bg-signal-soft'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        ) : <div />}

        <div className="flex items-center gap-2">
          {isFailed && onRetry && (
            <button
              onClick={() => onRetry(v)}
              disabled={isRetrying}
              className="p-2 rounded-xl text-signal hover:bg-signal-soft transition-colors disabled:opacity-60"
              title="Retry Cloning"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(v)}
              className="p-2 rounded-xl text-ink-muted hover:text-error hover:bg-error-soft transition-colors"
              title="Delete Voice"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {onUse && (
            <button
              onClick={() => onUse(v)}
              className="px-3 py-1.5 rounded-lg bg-signal hover:bg-signal-strong text-white text-xs font-semibold"
            >
              Use in studio →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
