import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { videoApi } from '../../api/client';
import { User, UserCheck, Volume2, FileText, Sparkles, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';
import { WizardFooter } from '../ui/WizardFooter';
import { AlertBanner } from '../ui/AlertBanner';
import { SlateTag } from '../ui/SlateTag';

const ReviewCard = ({ icon: Icon, label, children, isMissing, missingLabel }) => (
  <div className="p-5 rounded-2xl bg-surface border border-line">
    <span className="text-xs font-semibold text-signal uppercase tracking-wider mb-3 flex items-center gap-2">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </span>
    {isMissing ? (
      <p className="text-xs text-warning font-medium flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        {missingLabel}
      </p>
    ) : (
      children
    )}
  </div>
);

export const ConfigPreview = () => {
  const {
    currentDoctor,
    selectedScenario,
    selectedAvatar,
    selectedVoiceRecord,
    selectedVoice,
    script,
    settings,
    setActiveVideo,
    setIsGenerating,
    setActiveStep
  } = useApp();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.round((wordCount / 150) * 60);

  const handleGenerateVideo = async () => {
    if (!currentDoctor || (!selectedScenario && !selectedAvatar) || (!selectedVoiceRecord && !selectedVoice) || !script.trim()) {
      setError('Please make sure a doctor, avatar, voice, and script are all set before generating.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setIsGenerating(true);

    try {
      const isPhoto = (selectedScenario?.avatar_type === 'photo') || (selectedAvatar?.type === 'photo') || Boolean(selectedAvatar?.talking_photo_id);
      const isAvatarIV = (selectedScenario?.avatar_type === 'avatar_iv') || (selectedAvatar?.engine === 'avatar_iv');

      const payload = {
        doctor_id: currentDoctor.id,
        avatar_scenario_id: selectedScenario?.id || null,
        voice_id: selectedVoiceRecord?.id || null,
        avatar_type: isPhoto ? 'photo' : (isAvatarIV ? 'avatar_iv' : 'public'),
        heygen_avatar_id: !isPhoto ? (selectedScenario?.heygen_avatar_id || selectedAvatar?.avatar_id || selectedAvatar?.id || null) : null,
        heygen_talking_photo_id: isPhoto ? (selectedScenario?.heygen_talking_photo_id || selectedAvatar?.talking_photo_id || null) : null,
        heygen_voice_id: selectedVoiceRecord?.heygen_voice_id || selectedVoice?.voice_id || 'f38a635bee7a4d1f9b0a654a31d050d2',
        script: script,
        settings: {
          ...settings,
          aspect_ratio: selectedScenario?.aspect_ratio || settings.aspect_ratio || '16:9',
          // Photo Avatars render through HeyGen's Avatar IV engine so doctor videos get
          // natural body/hand motion instead of the static-body V2 talking_photo renderer.
          engine: (isPhoto || isAvatarIV) ? 'avatar_iv' : 'v2'
        }
      };

      const res = await videoApi.generate(payload);
      setActiveVideo(res.data);
      setActiveStep(7); // Move to Video Tracking & Result Step
    } catch (err) {
      console.error(err);
      setError(err.message || 'We could not start generating your video. Please try again.');
      setIsGenerating(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <StepHeader
        step={6}
        icon={Sparkles}
        title="Review before generating"
        description="Double-check the doctor, avatar, voice, and script below. You can still go back and change anything."
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left Column: Doctor & Avatar */}
        <div className="space-y-5">
          <ReviewCard icon={User} label="Doctor" isMissing={!currentDoctor} missingLabel="No doctor selected">
            {currentDoctor && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-signal text-white flex items-center justify-center font-semibold text-lg shrink-0">
                  {currentDoctor.doctor_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-ink text-base truncate">{currentDoctor.doctor_name}</h4>
                  <p className="text-xs text-ink-muted truncate">{currentDoctor.specialization}</p>
                  <SlateTag className="mt-1">{currentDoctor.doctor_id}</SlateTag>
                </div>
              </div>
            )}
          </ReviewCard>

          <ReviewCard
            icon={UserCheck}
            label="Avatar"
            isMissing={!(selectedScenario || selectedAvatar)}
            missingLabel="No avatar selected"
          >
            <div className="flex items-center gap-4">
              {(selectedScenario?.photo_url || selectedAvatar?.preview_image_url) ? (
                <img
                  src={selectedScenario?.photo_url || selectedAvatar?.preview_image_url}
                  alt={selectedScenario?.name || selectedAvatar?.name}
                  className="w-20 h-20 rounded-xl object-cover border border-line shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-signal-soft border border-signal/15 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-8 h-8 text-signal" />
                </div>
              )}
              <div className="min-w-0">
                <h4 className="font-semibold text-ink text-sm truncate">{selectedScenario?.name || selectedAvatar?.name}</h4>
                <span className="text-xs text-ink-muted capitalize block">
                  Background: {selectedScenario?.background_type || 'Clinic'} ({selectedScenario?.position || 'Center'})
                </span>
                <span className="text-[11px] text-ink-muted/80 block truncate">
                  Format: {selectedScenario?.aspect_ratio || settings.aspect_ratio}
                </span>
              </div>
            </div>
          </ReviewCard>
        </div>

        {/* Right Column: Voice, Script & Settings */}
        <div className="space-y-5">
          <ReviewCard
            icon={Volume2}
            label="Voice & output settings"
            isMissing={!(selectedVoiceRecord || selectedVoice)}
            missingLabel="No voice selected"
          >
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>Voice:</span>
                <strong className="text-ink">{selectedVoiceRecord?.name || selectedVoice?.name || selectedVoice?.voice_id}</strong>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Format:</span>
                <strong className="text-ink">{selectedScenario?.aspect_ratio || settings.aspect_ratio}</strong>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Captions:</span>
                <strong className="text-ink">{settings.captions ? 'Enabled' : 'Disabled'}</strong>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Estimated length:</span>
                <strong className="text-success">~{estimatedSeconds} seconds</strong>
              </div>
            </div>
          </ReviewCard>

          <ReviewCard icon={FileText} label={`Script (${wordCount} words)`} isMissing={!script.trim()} missingLabel="No script written yet">
            <p className="text-xs text-ink-soft line-clamp-3 bg-surface-sunken p-3 rounded-xl border border-line italic leading-relaxed">
              "{script}"
            </p>
          </ReviewCard>
        </div>
      </div>

      <WizardFooter
        onBack={() => setActiveStep(5)}
        backLabel="Edit settings"
        onNext={handleGenerateVideo}
        nextLabel={submitting ? 'Starting generation…' : 'Generate video'}
        loading={submitting}
      />
    </div>
  );
};
