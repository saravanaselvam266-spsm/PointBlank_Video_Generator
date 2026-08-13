import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { videoApi } from '../../api/client';
import { User, UserCheck, Volume2, FileText, Play, Sparkles, Loader2, AlertCircle, Image as ImageIcon, ArrowLeft } from 'lucide-react';

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
      setError('Please ensure Doctor Profile, Avatar Scenario, Voice, and Script are all configured.');
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
          engine: isAvatarIV ? 'avatar_iv' : 'v2'
        }
      };

      const res = await videoApi.generate(payload);
      setActiveVideo(res.data);
      setActiveStep(7); // Move to Video Tracking & Result Step
    } catch (err) {
      console.error(err);
      setError(err.message || 'Video job submission failed');
      setIsGenerating(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-left font-sans select-none space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E6F3F7] text-[#005570] border border-[#007799]/20 mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Configuration Preview</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto">
          Review your complete AI video setup before submitting to the official HeyGen rendering engine.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Left Column: Doctor & Avatar Scenario */}
        <div className="space-y-4">
          
          {/* Doctor Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-[#005570] uppercase tracking-wider block mb-3 flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Target Doctor Profile</span>
            </span>
            {currentDoctor ? (
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-[#005570] text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {currentDoctor.doctor_name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{currentDoctor.doctor_name}</h4>
                  <p className="text-xs text-slate-500">{currentDoctor.specialization}</p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[#E6F3F7] text-[#005570] border border-[#007799]/20">
                    {currentDoctor.doctor_id}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-600 font-medium">⚠ No Doctor Selected</p>
            )}
          </div>

          {/* Avatar Scenario Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-[#005570] uppercase tracking-wider block mb-3 flex items-center space-x-2">
              <UserCheck className="w-4 h-4" />
              <span>Avatar Scenario ({selectedScenario?.avatar_scenario_id || 'Custom'})</span>
            </span>
            {(selectedScenario || selectedAvatar) ? (
              <div className="flex items-center space-x-4">
                {(selectedScenario?.photo_url || selectedAvatar?.preview_image_url) ? (
                  <img
                    src={selectedScenario?.photo_url || selectedAvatar?.preview_image_url}
                    alt={selectedScenario?.name || selectedAvatar?.name}
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-[#E6F3F7] border border-[#007799]/20 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-8 h-8 text-[#005570]" />
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{selectedScenario?.name || selectedAvatar?.name}</h4>
                  <span className="text-xs text-slate-500 capitalize block">
                    Background: {selectedScenario?.background_type || 'Clinic'} ({selectedScenario?.position || 'Center'})
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[200px]">
                    Aspect Ratio: {selectedScenario?.aspect_ratio || settings.aspect_ratio}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-600 font-medium">⚠ No Avatar Scenario Configured</p>
            )}
          </div>

        </div>

        {/* Right Column: Voice, Script & Settings */}
        <div className="space-y-4">
          
          {/* Voice Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-[#005570] uppercase tracking-wider block mb-3 flex items-center space-x-2">
              <Volume2 className="w-4 h-4" />
              <span>Voice & Output Settings</span>
            </span>
            {(selectedVoiceRecord || selectedVoice) ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Voice Record:</span>
                  <strong className="text-[#005570] font-mono">{selectedVoiceRecord?.voice_id || 'AI Voice'}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Voice Name:</span>
                  <strong className="text-slate-900">{selectedVoiceRecord?.name || selectedVoice?.name || selectedVoice?.voice_id}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Aspect Ratio:</span>
                  <strong className="text-[#005570] font-mono">{selectedScenario?.aspect_ratio || settings.aspect_ratio}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Captions:</span>
                  <strong className="text-slate-900">{settings.captions ? 'Enabled' : 'Disabled'}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Est. Duration:</span>
                  <strong className="text-emerald-600 font-mono">~{estimatedSeconds} seconds</strong>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-600 font-medium">⚠ No Voice Selected</p>
            )}
          </div>

          {/* Script Snippet Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-[#005570] uppercase tracking-wider block mb-2 flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Script Summary ({wordCount} words)</span>
            </span>
            <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-3 rounded-xl border border-slate-200 font-sans italic leading-relaxed">
              "{script}"
            </p>
          </div>

        </div>

      </div>

      {/* Action Navigation & Generate Button */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <button
          onClick={() => setActiveStep(5)}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 flex items-center space-x-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Edit Video Settings</span>
        </button>

        <button
          onClick={handleGenerateVideo}
          disabled={submitting}
          className="inline-flex items-center space-x-3 px-8 py-4 rounded-2xl bg-[#005570] hover:bg-[#004055] text-white font-extrabold text-base transition-all shadow-xl shadow-[#005570]/25 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5 fill-current" />
          )}
          <span>{submitting ? 'Submitting to HeyGen...' : 'Generate Final Video'}</span>
        </button>
      </div>
    </div>
  );
};
