import React from 'react';

const VARIANTS = {
  brand: 'bg-signal-soft text-signal border-signal/20',
  success: 'bg-success-soft text-success border-success/25',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger: 'bg-error-soft text-error border-error/25',
  neutral: 'bg-surface-sunken text-ink-muted border-line',
};

export const Badge = ({ variant = 'neutral', icon: Icon, children, pulse = false, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap font-sans ${VARIANTS[variant]} ${className}`}
  >
    {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${pulse ? 'animate-spin' : ''}`} />}
    <span>{children}</span>
  </span>
);
