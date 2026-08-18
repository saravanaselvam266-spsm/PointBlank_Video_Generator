import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

const TONES = {
  error: { wrap: 'bg-error-soft border-error/25 text-error', Icon: AlertCircle },
  success: { wrap: 'bg-success-soft border-success/25 text-success', Icon: CheckCircle2 },
  info: { wrap: 'bg-signal-soft border-signal/20 text-signal', Icon: Info },
};

/** Shared inline message banner — replaces the alert-box pattern re-implemented independently in Login, CreateAvatar, ProfileSettings, and every studio step. */
export const AlertBanner = ({ tone = 'error', children, className = '' }) => {
  const { wrap, Icon } = TONES[tone];
  return (
    <div className={`p-4 rounded-xl border text-sm flex items-start gap-3 pb-reveal-in font-sans ${wrap} ${className}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={1.75} />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
};
