import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { avatarScenarioApi } from '../../api/client';
import {
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ImageIcon,
  UserRound
} from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';
import { EmptyState } from '../ui/EmptyState';
import { WizardFooter } from '../ui/WizardFooter';
import { SlateTag } from '../ui/SlateTag';
import { Badge } from '../ui/Badge';

export const AvatarScenarioEditor = () => {
  const navigate = useNavigate();
  const {
    currentDoctor,
    selectedScenario,
    setSelectedScenario,
    setSelectedAvatar,
    setActiveStep
  } = useApp();

  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentDoctor?.id) {
      fetchDoctorAvatars(currentDoctor.id);
    } else {
      setAvatars([]);
      setLoading(false);
    }
  }, [currentDoctor?.id]);

  const fetchDoctorAvatars = async (doctorId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await avatarScenarioApi.list(doctorId);
      const allScenarios = Array.isArray(res.data) ? res.data : [];

      // Strict filtering: ONLY show READY avatars for the selected doctor
      const readyAvatars = allScenarios.filter(
        (sc) => sc.creation_status === 'READY' && (!sc.doctor_id || sc.doctor_id === doctorId)
      );

      setAvatars(readyAvatars);

      // Verify that if a scenario was selected, it still belongs to this doctor
      if (selectedScenario && selectedScenario.doctor_id !== doctorId) {
        setSelectedScenario(null);
        setSelectedAvatar(null);
      }
    } catch (err) {
      console.error('Failed to load doctor avatars:', err);
      setError(err.message || 'Failed to load avatars for the selected doctor.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAvatarScenario = (sc) => {
    setSelectedScenario(sc);
    setSelectedAvatar({
      type: 'photo',
      avatar_id: sc.heygen_look_id || sc.heygen_avatar_id,
      talking_photo_id: sc.heygen_look_id || sc.heygen_talking_photo_id,
      name: sc.name,
      preview_image_url: sc.heygen_preview_image_url || sc.photo_url
    });
  };

  if (!currentDoctor) {
    return (
      <EmptyState
        icon={AlertCircle}
        tone="warning"
        title="No doctor profile selected"
        description="Select a doctor profile first to see their available avatars."
        className="max-w-lg mx-auto"
        action={
          <button
            onClick={() => setActiveStep(1)}
            className="px-6 py-2.5 bg-signal text-white font-semibold text-sm rounded-xl hover:bg-signal-strong"
          >
            Go to step 1: choose doctor
          </button>
        }
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <StepHeader
        step={2}
        icon={UserRound}
        title="Choose an avatar"
        description={`Pick the on-screen look that will present the video for ${currentDoctor.doctor_name}.`}
      />

      {/* Selected Doctor Summary Card */}
      <div className="p-4 rounded-2xl bg-signal-soft border border-signal/15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-signal text-white flex items-center justify-center font-semibold text-sm shrink-0">
            {currentDoctor.doctor_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-signal uppercase tracking-wider">Active doctor</span>
              <SlateTag>{currentDoctor.doctor_id}</SlateTag>
            </div>
            <h3 className="text-sm font-semibold text-ink truncate">{currentDoctor.doctor_name}</h3>
          </div>
        </div>

        <button onClick={() => setActiveStep(1)} className="text-xs font-semibold text-signal hover:underline shrink-0">
          Change doctor
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-soft border border-error/25 text-error text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Avatars Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface overflow-hidden animate-pulse">
              <div className="aspect-3/4 bg-surface-sunken" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-2/3 bg-surface-sunken rounded" />
                <div className="h-2.5 w-1/2 bg-surface-sunken rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : avatars.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          tone="warning"
          title="No avatars ready for this doctor yet"
          description={`Create a new avatar for ${currentDoctor.doctor_name} to use in this video.`}
          className="max-w-md mx-auto"
          action={
            <button
              onClick={() => navigate('/app/create-avatar')}
              className="px-6 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-sm shadow-cta inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create an avatar</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {avatars.map((sc, i) => {
            const isSelected = selectedScenario?.id === sc.id;
            const previewUrl = sc.heygen_preview_image_url || sc.photo_url || sc.original_photo_url;
            return (
              <button
                type="button"
                key={sc.id}
                onClick={() => handleSelectAvatarScenario(sc)}
                className={`text-left rounded-2xl border p-4 bg-surface transition-all flex flex-col justify-between hover:border-accent/50 pb-reveal ${
                  isSelected ? 'border-signal ring-2 ring-signal/20 shadow-panel' : 'border-line'
                }`}
                style={{ '--pb-i': i }}
              >
                <div className="space-y-3">
                  <div className="aspect-3/4 bg-surface-sunken rounded-xl overflow-hidden border border-line relative">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={sc.name}
                        loading="lazy"
                        className="w-full h-full object-contain"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div
                      className="items-center justify-center h-full text-ink-muted"
                      style={{ display: previewUrl ? 'none' : 'flex' }}
                    >
                      <ImageIcon className="w-8 h-8" />
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge variant="success">Ready</Badge>
                    </div>
                    {isSelected && (
                      <div className="absolute inset-0 bg-signal/5 flex items-start justify-end p-2">
                        <CheckCircle2 className="w-6 h-6 text-signal bg-surface rounded-full" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-ink text-sm truncate">{sc.name}</h4>
                    <SlateTag className="mt-1">{sc.avatar_scenario_id}</SlateTag>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isSelected ? 'text-signal' : 'text-ink-muted'}`}>
                    {isSelected ? 'Selected' : 'Select this avatar'}
                  </span>
                  <CheckCircle2 className={`w-4 h-4 ${isSelected ? 'text-signal' : 'text-line-strong'}`} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <WizardFooter
        onBack={() => setActiveStep(1)}
        backLabel="Back to doctor"
        onNext={() => setActiveStep(3)}
        nextLabel="Continue to voice"
        nextDisabled={!selectedScenario}
      />
    </div>
  );
};
