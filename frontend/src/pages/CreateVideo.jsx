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
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

const StudioStepper = () => {
  const { activeStep, setActiveStep } = useApp();

  const steps = [
    { num: 1, label: 'Doctor' },
    { num: 2, label: 'Avatar Scenario' },
    { num: 3, label: 'Voice' },
    { num: 4, label: 'Script' },
    { num: 5, label: 'Settings' },
    { num: 6, label: 'Preview' },
    { num: 7, label: 'Render' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-8 shadow-xs select-none">
      <div className="flex items-center justify-between overflow-x-auto">
        {steps.map((s, idx) => {
          const isDone = activeStep > s.num;
          const isCurrent = activeStep === s.num;
          return (
            <React.Fragment key={s.num}>
              <div
                onClick={() => {
                  if (isDone) setActiveStep(s.num);
                }}
                className={`flex items-center space-x-2 shrink-0 transition-colors ${
                  isDone ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isCurrent
                    ? 'text-[#005570] font-bold'
                    : isDone
                    ? 'text-emerald-700 font-semibold'
                    : 'text-slate-400 font-medium'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-[#005570] text-white shadow-xs'
                      : isDone
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className="hidden sm:inline text-xs">{s.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 min-w-[12px] h-0.5 mx-2 ${activeStep > idx + 1 ? 'bg-emerald-200' : 'bg-slate-100'}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const InnerStudioContent = () => {
  const { activeStep, setActiveStep, isGenerating, activeVideo } = useApp();

  return (
    <div className="space-y-6">
      <StudioStepper />

      {/* Step 1: Doctor Profile */}
      {activeStep === 1 && <DoctorModal />}

      {/* Step 2: Avatar Scenario Editor */}
      {activeStep === 2 && <AvatarScenarioEditor />}

      {/* Step 3: Voice Selector */}
      {activeStep === 3 && <VoiceSelector />}

      {/* Step 4: Healthcare Script */}
      {activeStep === 4 && (
        <div className="max-w-4xl mx-auto space-y-6">
          <ScriptEditor />
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              onClick={() => setActiveStep(3)}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Voice</span>
            </button>
            <button
              onClick={() => setActiveStep(5)}
              className="px-8 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-xs shadow-md shadow-[#005570]/20 transition-all"
            >
              Proceed to Video Settings →
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Video Settings */}
      {activeStep === 5 && (
        <div className="max-w-4xl mx-auto space-y-6">
          <VideoSettings />
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              onClick={() => setActiveStep(4)}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Script</span>
            </button>
            <button
              onClick={() => setActiveStep(6)}
              className="px-8 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-xs shadow-md shadow-[#005570]/20 transition-all"
            >
              Proceed to Configuration Preview →
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Configuration Preview */}
      {activeStep === 6 && <ConfigPreview />}

      {/* Step 7: Render Tracker & Result */}
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
  );
};

export const CreateVideo = () => {
  return (
    <div className="space-y-6 font-sans select-none">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">PointBlank AI Video Studio</h2>
        <p className="text-xs text-slate-500">
          Create professional doctor AI healthcare videos with full scenario, voice, and script controls.
        </p>
      </div>

      <InnerStudioContent />
    </div>
  );
};
