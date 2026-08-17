import React from 'react';
import { useApp } from '../context/AppContext';
import { DoctorModal } from '../components/doctor/DoctorModal';
import { AvatarScenarioEditor } from '../components/studio/AvatarScenarioEditor';
import { VoiceSelector } from '../components/studio/VoiceSelector';
import { ScriptEditor } from '../components/studio/ScriptEditor';
import { VideoSettings } from '../components/studio/VideoSettings';
import { ConfigPreview } from '../components/studio/ConfigPreview';
import { ProgressTracker } from '../components/tracking/ProgressTracker';
import { ResultView } from '../components/result/ResultView';
import { WizardFooter } from '../components/ui/WizardFooter';
import { CheckCircle2 } from 'lucide-react';

const STEPS = [
  { num: 1, label: 'Doctor' },
  { num: 2, label: 'Avatar' },
  { num: 3, label: 'Voice' },
  { num: 4, label: 'Script' },
  { num: 5, label: 'Settings' },
  { num: 6, label: 'Preview' },
  { num: 7, label: 'Render' },
];

const StudioStepper = () => {
  const { activeStep, setActiveStep } = useApp();
  const current = STEPS.find((s) => s.num === activeStep);

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 shadow-xs select-none">
      <div className="flex items-center justify-between">
        {STEPS.map((s, idx) => {
          const isDone = activeStep > s.num;
          const isCurrent = activeStep === s.num;
          return (
            <React.Fragment key={s.num}>
              <button
                type="button"
                onClick={() => isDone && setActiveStep(s.num)}
                disabled={!isDone}
                aria-current={isCurrent ? 'step' : undefined}
                className={`group flex flex-col items-center gap-1.5 shrink-0 ${isDone ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-[#005570] text-white shadow-md shadow-[#005570]/30 ring-4 ring-[#E6F3F7]'
                      : isDone
                      ? 'bg-[#E6F3F7] text-[#005570] group-hover:bg-[#d9edf3]'
                      : 'bg-[#F5F7F8] text-[#9CA3AF] border border-[#E5E7EB]'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : String(s.num).padStart(2, '0')}
                </div>
                <span
                  className={`hidden md:block text-[11px] font-semibold tracking-wide ${
                    isCurrent ? 'text-[#005570]' : isDone ? 'text-[#374151]' : 'text-[#9CA3AF]'
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className="flex-1 min-w-[8px] h-[3px] mx-1.5 sm:mx-2 rounded-full bg-[#F5F7F8] overflow-hidden">
                  <div
                    className="h-full bg-[#007799] rounded-full transition-all duration-500"
                    style={{ width: activeStep > idx + 1 ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-[#F5F7F8] flex items-center justify-between md:hidden">
        <span className="text-xs font-bold text-[#1F2937]">{current?.label}</span>
        <span className="text-[11px] font-semibold text-[#6B7280]">Step {activeStep} of {STEPS.length}</span>
      </div>
    </div>
  );
};

const InnerStudioContent = () => {
  const { activeStep, setActiveStep, isGenerating, activeVideo } = useApp();

  return (
    <div className="space-y-6">
      <StudioStepper />

      <div className="bg-white border border-[#E5E7EB] rounded-3xl p-6 sm:p-8 shadow-xs">
        {/* Step 1: Doctor Profile */}
        {activeStep === 1 && <DoctorModal />}

        {/* Step 2: Avatar Selection */}
        {activeStep === 2 && <AvatarScenarioEditor />}

        {/* Step 3: Voice Selection */}
        {activeStep === 3 && <VoiceSelector />}

        {/* Step 4: Script */}
        {activeStep === 4 && (
          <div className="max-w-3xl mx-auto">
            <ScriptEditor />
            <WizardFooter
              onBack={() => setActiveStep(3)}
              backLabel="Back to Voice"
              onNext={() => setActiveStep(5)}
              nextLabel="Continue to Video Settings"
            />
          </div>
        )}

        {/* Step 5: Video Settings */}
        {activeStep === 5 && (
          <div className="max-w-3xl mx-auto">
            <VideoSettings />
            <WizardFooter
              onBack={() => setActiveStep(4)}
              backLabel="Back to Script"
              onNext={() => setActiveStep(6)}
              nextLabel="Continue to Preview"
            />
          </div>
        )}

        {/* Step 6: Preview */}
        {activeStep === 6 && <ConfigPreview />}

        {/* Step 7: Render & Result */}
        {activeStep === 7 && (
          <>
            {isGenerating || activeVideo?.status !== 'COMPLETED' ? (
              <ProgressTracker onCompleted={() => {}} />
            ) : (
              <ResultView />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const CreateVideo = () => {
  return (
    <div className="space-y-6 font-sans">
      <div>
        <span className="text-xs font-bold text-[#007799] uppercase tracking-[0.14em]">PointBlank AI Video Generator</span>
        <h2 className="text-2xl font-extrabold text-[#1F2937] tracking-tight">Create a New Video</h2>
        <p className="text-sm text-[#6B7280] mt-1">
          Guide a doctor profile through avatar, voice, and script selection to generate a polished video.
        </p>
      </div>

      <InnerStudioContent />
    </div>
  );
};
