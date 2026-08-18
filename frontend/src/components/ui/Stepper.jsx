import React from 'react';
import { Check } from 'lucide-react';

/**
 * Shared production-rail stepper — used by both the Create Video and Create
 * Avatar wizards so the app has ONE stepper implementation instead of three.
 * Deliberately not circles-with-numbers: a continuous rail (timecode-ruler
 * language, echoing .pb-rule elsewhere) with small ticks communicates
 * progress along a single continuous take rather than isolated stages.
 *
 * steps: [{ key, label, description? }]
 * currentIndex: 0-based index of the active step
 * onStepClick(index): optional — only called for indices <= currentIndex (no skipping ahead)
 */
export const Stepper = ({ steps, currentIndex, onStepClick }) => {
  return (
    <>
      {/* Desktop: vertical rail */}
      <nav aria-label="Progress" className="hidden lg:block">
        <ol className="relative">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-line" aria-hidden="true" />
          {steps.map((step, index) => {
            const isDone = index < currentIndex;
            const isCurrent = index === currentIndex;
            const clickable = typeof onStepClick === 'function' && index <= currentIndex;
            return (
              <li key={step.key} className="relative pb-8 last:pb-0">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onStepClick(index)}
                  className={`group flex items-start gap-4 w-full text-left ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span
                    className={`relative z-10 mt-0.5 flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-colors duration-300 ${
                      isCurrent
                        ? 'bg-signal border-signal text-white shadow-cta'
                        : isDone
                        ? 'bg-signal-soft border-signal/30 text-signal'
                        : 'bg-surface border-line text-ink-muted'
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" strokeWidth={2.5} /> : (
                      <span className="font-mono text-[11px] font-medium">{index + 1}</span>
                    )}
                  </span>
                  <span className="pt-1 min-w-0">
                    <span
                      className={`block text-sm font-semibold transition-colors ${
                        isCurrent ? 'text-ink' : isDone ? 'text-ink-soft' : 'text-ink-muted'
                      } ${clickable && !isCurrent ? 'group-hover:text-signal' : ''}`}
                    >
                      {step.label}
                    </span>
                    {step.description && (
                      <span className={`block text-xs mt-0.5 leading-snug ${isCurrent ? 'text-ink-soft' : 'text-ink-muted/70'}`}>
                        {step.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile/tablet: compact horizontal progress + current label */}
      <div className="lg:hidden space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.14em]">
            Step {currentIndex + 1} / {steps.length}
          </span>
          <span className="text-xs font-semibold text-ink">{steps[currentIndex]?.label}</span>
        </div>
        <div className="h-1 rounded-full bg-line overflow-hidden">
          <div
            className="h-full bg-signal rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
};
