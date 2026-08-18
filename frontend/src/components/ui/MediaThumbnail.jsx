import React, { useState } from 'react';

/**
 * Shared thumbnail box for avatar/voice/video media grids. Media is always
 * loaded directly from a short-lived Azure SAS URL handed to us by the
 * backend for this render — never a locally-cached or persisted copy — so a
 * broken/expired link degrades to the fallback icon instead of a broken
 * image glyph.
 */
export const MediaThumbnail = ({ src, alt = '', icon: Icon, aspect = 'video', className = '' }) => {
  const [failed, setFailed] = useState(false);
  const aspectClass = aspect === 'portrait' ? 'aspect-3/4' : aspect === 'square' ? 'aspect-square' : 'aspect-video';

  return (
    <div className={`${aspectClass} bg-surface-sunken rounded-xl overflow-hidden relative flex items-center justify-center border border-line ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        Icon && <Icon className="w-8 h-8 text-ink-muted" strokeWidth={1.75} />
      )}
    </div>
  );
};
