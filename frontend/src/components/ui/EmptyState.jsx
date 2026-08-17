import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, action, tone = 'neutral', className = '' }) => {
  const toneClasses =
    tone === 'warning'
      ? 'bg-amber-50 text-amber-600 border-amber-200'
      : tone === 'danger'
      ? 'bg-rose-50 text-rose-500 border-rose-200'
      : 'bg-[#F5F7F8] text-[#6B7280] border-[#E5E7EB]';

  return (
    <div className={`p-10 sm:p-12 bg-white border border-[#E5E7EB] rounded-3xl text-center space-y-4 ${className}`}>
      {Icon && (
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border ${toneClasses}`}>
          <Icon className="w-7 h-7" />
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-[#1F2937]">{title}</h3>
        {description && <p className="text-sm text-[#6B7280] leading-relaxed max-w-sm mx-auto">{description}</p>}
      </div>
      {action}
    </div>
  );
};
