import React from 'react';
import { UserRound, Trash2 } from 'lucide-react';
import { MediaThumbnail } from '../ui/MediaThumbnail';
import { MediaStatus } from '../ui/MediaStatus';
import { SlateTag } from '../ui/SlateTag';

/**
 * One doctor avatar's card — shared by the Doctor Profile page and the
 * Avatar Library discovery page so the two never drift out of sync.
 */
export const DoctorAvatarCard = ({ scenario: sc, onUse, onDelete, onRetry, style }) => {
  const isUnavailable = sc.provider_status === 'unavailable';

  return (
    <div
      className={`bg-surface rounded-2xl border overflow-hidden shadow-panel transition-all flex flex-col justify-between pb-reveal ${
        isUnavailable ? 'border-error/25' : 'border-line hover:border-accent/50'
      }`}
      style={style}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SlateTag>{sc.avatar_scenario_id}</SlateTag>
          <MediaStatus kind="avatar" status={isUnavailable ? 'unavailable' : sc.creation_status} />
        </div>

        <MediaThumbnail src={sc.thumbnail_url || sc.photo_url} alt={sc.name} icon={UserRound} aspect="portrait" />

        <div>
          <h4 className="font-semibold text-ink text-sm truncate">{sc.name}</h4>
          <p className="text-xs text-ink-muted truncate">Doctor: {sc.doctor_name || 'Assigned doctor'}</p>
          <p className="text-[10px] text-ink-muted/80 capitalize mt-0.5">Frame: {sc.aspect_ratio} · {sc.background_type}</p>
          {isUnavailable && (
            <p className="text-[11px] text-error font-medium mt-1.5">Avatar unavailable for new videos</p>
          )}
        </div>
      </div>

      <div className="p-3 bg-surface-sunken/60 border-t border-line flex items-center justify-between">
        {onDelete && (
          <button
            onClick={() => onDelete(sc)}
            className="p-1.5 rounded-lg text-ink-muted hover:text-error hover:bg-error-soft transition-colors"
            title="Delete Scenario"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {isUnavailable ? (
          <button
            onClick={() => onRetry?.(sc)}
            className="px-3 py-1.5 rounded-lg bg-error-soft hover:brightness-95 text-error text-xs font-semibold"
          >
            Create another →
          </button>
        ) : (
          <button
            onClick={() => onUse?.(sc)}
            className="px-3 py-1.5 rounded-lg bg-signal hover:bg-signal-strong text-white text-xs font-semibold"
          >
            Use avatar →
          </button>
        )}
      </div>
    </div>
  );
};
