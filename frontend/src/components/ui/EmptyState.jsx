import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, action, tone = 'neutral', className = '' }) => {
  const toneClasses =
    tone === 'warning'
      ? 'bg-warning-soft text-warning border-warning/25'
      : tone === 'danger'
      ? 'bg-error-soft text-error border-error/25'
      : 'bg-surface-sunken text-ink-muted border-line';

  return (
    <div className={`p-10 sm:p-12 bg-surface border border-line rounded-3xl text-center space-y-4 ${className}`}>
      {Icon && (
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border ${toneClasses}`}>
          <Icon className="w-7 h-7" strokeWidth={1.75} />
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className="text-lg text-ink font-display">{title}</h3>
        {description && <p className="text-sm text-ink-soft leading-relaxed max-w-sm mx-auto">{description}</p>}
      </div>
      {action}
    </div>
  );
};
