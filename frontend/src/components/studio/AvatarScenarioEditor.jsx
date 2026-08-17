import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { avatarScenarioApi } from '../../api/client';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  PlusCircle,
  ImageIcon,
  UserRound
} from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';
import { EmptyState } from '../ui/EmptyState';
import { WizardFooter } from '../ui/WizardFooter';

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
            className="px-6 py-2.5 bg-[#005570] text-white font-bold text-sm rounded-xl hover:bg-[#004055]"
          >
            Go to Step 1: Choose Doctor
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
      <div className="p-4 rounded-2xl bg-[#E6F3F7] border border-[#007799]/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#005570] text-white flex items-center justify-center font-bold text-sm shrink-0">
            {currentDoctor.doctor_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#005570] uppercase tracking-wider">Active doctor</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-[#005570] border border-[#007799]/20">
                {currentDoctor.doctor_id}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-[#1F2937] truncate">{currentDoctor.doctor_name}</h3>
          </div>
        </div>

        <button onClick={() => setActiveStep(1)} className="text-xs font-bold text-[#005570] hover:underline shrink-0">
          Change doctor
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Avatars Grid */}
      {loading ? (
        <div className="py-16 text-center text-[#6B7280] flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#005570]" />
          <p className="text-sm font-medium">Loading avatars for {currentDoctor.doctor_name}…</p>
        </div>
      ) : avatars.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          tone="warning"
          title="No avatars ready for this doctor yet"
          description={`Create a new AI avatar for ${currentDoctor.doctor_name} to use in this video.`}
          className="max-w-md mx-auto"
          action={
            <button
              onClick={() => navigate('/app/create-avatar')}
              className="px-6 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm shadow-md shadow-[#005570]/20 inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create an Avatar</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {avatars.map((sc) => {
            const isSelected = selectedScenario?.id === sc.id;
            const previewUrl = sc.heygen_preview_image_url || sc.photo_url || sc.original_photo_url;
            return (
              <button
                type="button"
                key={sc.id}
                onClick={() => handleSelectAvatarScenario(sc)}
                className={`text-left rounded-2xl border p-4 bg-white transition-all flex flex-col justify-between hover:border-[#007799] ${
                  isSelected ? 'border-[#005570] ring-2 ring-[#005570]/25 shadow-sm' : 'border-[#E5E7EB]'
                }`}
              >
                <div className="space-y-3">
                  <div className="aspect-3/4 bg-[#F5F7F8] rounded-xl overflow-hidden border border-[#E5E7EB] relative">
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
                      className="items-center justify-center h-full text-[#9CA3AF]"
                      style={{ display: previewUrl ? 'none' : 'flex' }}
                    >
                      <ImageIcon className="w-8 h-8" />
                    </div>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Ready
                    </span>
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#005570]/5 flex items-start justify-end p-2">
                        <CheckCircle2 className="w-6 h-6 text-[#005570] bg-white rounded-full" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-[#1F2937] text-sm truncate">{sc.name}</h4>
                    <p className="text-[11px] text-[#6B7280] font-mono mt-0.5 truncate">{sc.avatar_scenario_id}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F5F7F8] flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-[#005570]' : 'text-[#6B7280]'}`}>
                    {isSelected ? 'Selected' : 'Select this avatar'}
                  </span>
                  <CheckCircle2 className={`w-4 h-4 ${isSelected ? 'text-[#005570]' : 'text-[#D1D5DB]'}`} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <WizardFooter
        onBack={() => setActiveStep(1)}
        backLabel="Back to Doctor"
        onNext={() => setActiveStep(3)}
        nextLabel="Continue to Voice"
        nextDisabled={!selectedScenario}
      />
    </div>
  );
};
