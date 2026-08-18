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
import { Stepper } from '../components/ui/Stepper';

const STEPS = [
  { key: 'doctor', label: 'Doctor', description: 'Who this video is for' },
  { key: 'avatar', label: 'Avatar', description: 'Their on-screen identity' },
  { key: 'voice', label: 'Voice', description: 'How they will sound' },
  { key: 'script', label: 'Script', description: 'What they will say' },
  { key: 'settings', label: 'Settings', description: 'Format & captions' },
  { key: 'preview', label: 'Preview', description: 'Review the take' },
  { key: 'render', label: 'Render', description: 'Watch it come together' },
];

const InnerStudioContent = () => {
  const { activeStep, setActiveStep, isGenerating, activeVideo, script } = useApp();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
      <div className="lg:sticky lg:top-24 lg:pt-2">
        <Stepper
          steps={STEPS}
          currentIndex={activeStep - 1}
          onStepClick={(index) => setActiveStep(index + 1)}
        />
      </div>

      <div className="pb-card p-6 sm:p-8 min-w-0 w-full">
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
              backLabel="Back to voice"
              onNext={() => setActiveStep(5)}
              nextLabel="Continue to settings"
              nextDisabled={!script.trim()}
            />
          </div>
        )}

        {/* Step 5: Video Settings */}
        {activeStep === 5 && (
          <div className="max-w-3xl mx-auto">
            <VideoSettings />
            <WizardFooter
              onBack={() => setActiveStep(4)}
              backLabel="Back to script"
              onNext={() => setActiveStep(6)}
              nextLabel="Continue to preview"
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
    <div className="space-y-7 font-sans">
      <div className="pb-reveal">
        <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.16em]">Create · Video</span>
        <h1 className="font-display text-3xl text-ink tracking-tight">Create a video</h1>
        <p className="text-sm text-ink-soft mt-1 max-w-xl">
          Bring a doctor, avatar, voice, and script together into a finished take.
        </p>
      </div>

      <InnerStudioContent />
    </div>
  );
};
