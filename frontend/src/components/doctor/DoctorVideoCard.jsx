import React from 'react';
import { Video, Play, Trash2 } from 'lucide-react';
import { MediaThumbnail } from '../ui/MediaThumbnail';
import { MediaStatus } from '../ui/MediaStatus';
import { SlateTag } from '../ui/SlateTag';

/**
 * One generated video's card — shared by the Doctor Profile page and the
 * Video Library discovery page. `onDelete` is optional; when provided, a
 * delete button appears without interfering with the card's own click target
 * (the whole card is a button-like control, so delete is a nested real
 * <button> on a div[role=button] wrapper rather than button-inside-button).
 */
export const DoctorVideoCard = ({ video: v, onClick, onDelete, style }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={() => onClick?.(v)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(v);
      }
    }}
    className="text-left rounded-2xl border border-line bg-surface overflow-hidden shadow-panel hover:border-accent/50 transition-all group pb-reveal cursor-pointer focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2"
    style={style}
  >
    <div className="relative">
      <MediaThumbnail src={v.thumbnail_url} alt={v.video_id} icon={Video} aspect="video" className="rounded-none border-0" />

      <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/25 transition-colors flex items-center justify-center">
        <div className="w-11 h-11 rounded-full bg-surface/90 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all">
          <Play className="w-4.5 h-4.5 text-signal ml-0.5" />
        </div>
      </div>

      <div className="absolute top-2.5 right-2.5">
        <MediaStatus kind="video" status={v.status} />
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(v);
          }}
          className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-ink/40 text-white/90 opacity-0 group-hover:opacity-100 hover:bg-error hover:text-white transition-all"
          title="Delete video"
          aria-label="Delete video"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>

    <div className="p-4 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm text-ink truncate">{v.doctor_name || v.scenario_name || 'Doctor video'}</p>
        <SlateTag>{v.video_id}</SlateTag>
      </div>
      <p className="text-xs text-ink-muted">{new Date(v.created_at).toLocaleString()}</p>
    </div>
  </div>
);
