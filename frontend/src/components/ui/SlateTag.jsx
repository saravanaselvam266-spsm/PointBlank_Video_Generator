import React from 'react';

/**
 * PointBlank's signature identifier chip — every PB-XXX-000000 code in the
 * product (doctor, avatar, voice, video) is real, independently-sequenced
 * production metadata, styled consistently as a film/broadcast slate tag
 * rather than a generic mono badge.
 */
export const SlateTag = ({ children, className = '' }) => (
  <span className={`pb-slate-tag ${className}`}>{children}</span>
);
