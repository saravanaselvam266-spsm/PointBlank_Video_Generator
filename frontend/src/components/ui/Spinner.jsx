import React from 'react';

/** Shared loading spinner — replaces the hand-rolled border-spin markup duplicated across ProtectedRoute/PublicRoute/pages. */
export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'w-5 h-5 border-2', md: 'w-8 h-8 border-[3px]', lg: 'w-10 h-10 border-4' };
  return (
    <div
      className={`${sizes[size]} border-signal/25 border-t-signal rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
};

export const FullScreenSpinner = ({ label = 'Loading…' }) => (
  <div className="min-h-screen pb-atmosphere flex flex-col items-center justify-center gap-4">
    <Spinner size="lg" />
    <p className="text-sm text-ink-muted font-sans">{label}</p>
  </div>
);
