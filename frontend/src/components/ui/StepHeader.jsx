import React from 'react';

export const StepHeader = ({ step, total = 7, icon: Icon, title, description, align = 'center' }) => (
  <div className={`space-y-3 mb-2 pb-reveal ${align === 'center' ? 'text-center' : 'text-left'}`}>
    {Icon && (
      <div
        className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-signal-soft text-signal border border-signal/15 ${
          align === 'center' ? 'mx-auto' : ''
        }`}
      >
        <Icon className="w-7 h-7" strokeWidth={1.75} />
      </div>
    )}
    <div className="space-y-1.5">
      {step && (
        <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.18em]">
          Step {step} / {total}
        </span>
      )}
      <h2 className="text-[1.75rem] sm:text-3xl font-medium text-ink tracking-tight">{title}</h2>
      {description && (
        <p className={`text-sm text-ink-soft leading-relaxed font-sans ${align === 'center' ? 'max-w-lg mx-auto' : 'max-w-lg'}`}>
          {description}
        </p>
      )}
    </div>
  </div>
);
