import React from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

export const WizardFooter = ({
  onBack,
  backLabel = 'Back',
  onNext,
  nextLabel = 'Continue',
  nextDisabled = false,
  loading = false,
  className = '',
}) => (
  <div className={`flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-6 mt-2 border-t border-line ${className}`}>
    {onBack ? (
      <button
        type="button"
        onClick={onBack}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border border-line text-ink-soft font-semibold text-sm hover:bg-surface-sunken hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{backLabel}</span>
      </button>
    ) : (
      <span className="hidden sm:block" />
    )}

    <button
      type="button"
      onClick={onNext}
      disabled={nextDisabled || loading}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-sm shadow-cta transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      <span>{nextLabel}</span>
      {!loading && <ArrowRight className="w-4 h-4" />}
    </button>
  </div>
);
