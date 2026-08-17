import React from 'react';

const VARIANTS = {
  brand: 'bg-[#E6F3F7] text-[#005570] border-[#007799]/25',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-[#F5F7F8] text-[#6B7280] border-[#E5E7EB]',
};

export const Badge = ({ variant = 'neutral', icon: Icon, children, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${VARIANTS[variant]} ${className}`}
  >
    {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
    <span>{children}</span>
  </span>
);
