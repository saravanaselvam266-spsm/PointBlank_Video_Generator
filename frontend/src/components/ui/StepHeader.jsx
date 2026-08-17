import React from 'react';

export const StepHeader = ({ step, total = 7, icon: Icon, title, description, align = 'center' }) => (
  <div className={`space-y-3 mb-2 ${align === 'center' ? 'text-center' : 'text-left'}`}>
    {Icon && (
      <div
        className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E6F3F7] text-[#005570] border border-[#007799]/20 ${
          align === 'center' ? 'mx-auto' : ''
        }`}
      >
        <Icon className="w-7 h-7" />
      </div>
    )}
    <div className="space-y-1.5">
      {step && (
        <span className="text-[11px] font-bold text-[#007799] uppercase tracking-[0.14em]">
          Step {step} of {total}
        </span>
      )}
      <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2937] tracking-tight">{title}</h2>
      {description && (
        <p className={`text-sm text-[#6B7280] leading-relaxed ${align === 'center' ? 'max-w-lg mx-auto' : 'max-w-lg'}`}>
          {description}
        </p>
      )}
    </div>
  </div>
);
