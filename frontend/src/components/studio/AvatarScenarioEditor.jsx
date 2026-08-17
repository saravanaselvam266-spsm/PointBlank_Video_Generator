import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { avatarScenarioApi } from '../../api/client';
import {
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  PlusCircle,
  ImageIcon
} from 'lucide-react';

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
      setError(err.message || 'Failed to load avatars for selected doctor.');
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
      <div className="max-w-2xl mx-auto p-12 bg-white border border-slate-200 rounded-3xl text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-xl font-bold text-slate-900">No Doctor Profile Selected</h3>
        <p className="text-xs text-slate-500">Please select a doctor profile first to view their available avatars.</p>
        <button
          onClick={() => setActiveStep(1)}
          className="px-6 py-2.5 bg-[#005570] text-white font-bold text-xs rounded-xl hover:bg-[#004055]"
        >
          ← Go to Step 1: Select Doctor
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left font-sans select-none pb-12">
      {/* Selected Doctor Summary Card */}
      <div className="p-4 rounded-2xl bg-[#E6F3F7] border border-[#007799]/20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#005570] text-white flex items-center justify-center font-bold text-sm">
            {currentDoctor.doctor_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-[#005570] uppercase tracking-wider">Active Doctor</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-[#005570] border border-[#007799]/20">
                {currentDoctor.doctor_id}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{currentDoctor.doctor_name}</h3>
          </div>
        </div>

        <button
          onClick={() => setActiveStep(1)}
          className="text-xs font-bold text-[#005570] hover:underline"
        >
          Change Doctor
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <span className="text-xs font-bold text-[#005570] uppercase tracking-wider">Step 2 of 7</span>
          <h2 className="text-xl font-bold text-slate-900">Select Doctor Avatar</h2>
        </div>
        <span className="text-xs text-slate-500">
          Showing READY avatars for <strong className="text-slate-900">{currentDoctor.doctor_name}</strong>
        </span>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Avatars Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#005570]" />
          <p className="text-xs font-medium">Loading avatars for {currentDoctor.doctor_name}...</p>
        </div>
      ) : avatars.length === 0 ? (
        /* Empty State */
        <div className="p-12 bg-white border border-slate-200 rounded-3xl text-center space-y-5 max-w-md mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <ImageIcon className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">No ready avatars are available for this doctor yet</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Create a new AI avatar for {currentDoctor.doctor_name} using professional look generation.
            </p>
          </div>
          <button
            onClick={() => navigate('/app/create-avatar')}
            className="px-6 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-extrabold text-xs shadow-md shadow-[#005570]/20 flex items-center justify-center space-x-2 mx-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Avatar →</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {avatars.map((sc) => {
            const isSelected = selectedScenario?.id === sc.id;
            const previewUrl = sc.heygen_preview_image_url || sc.photo_url || sc.original_photo_url;
            return (
              <div
                key={sc.id}
                onClick={() => handleSelectAvatarScenario(sc)}
                className={`cursor-pointer rounded-2xl border p-5 bg-white transition-all flex flex-col justify-between hover:border-[#007799] ${
                  isSelected
                    ? 'border-[#005570] ring-2 ring-[#005570]/30 shadow-md bg-gradient-to-b from-teal-50/20 to-white'
                    : 'border-slate-200'
                }`}
              >
                <div className="space-y-4">
                  {/* Real HeyGen Preview Image */}
                  <div className="aspect-3/4 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={sc.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      READY
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm truncate">{sc.name}</h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{sc.avatar_scenario_id}</p>
                  </div>

                  <div className="pt-2 text-[11px] text-slate-600 space-y-1 border-t border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Doctor:</span>
                      <strong className="text-slate-900 truncate max-w-[150px]">{currentDoctor.doctor_name}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Doctor ID:</span>
                      <strong className="text-[#005570] font-mono">{currentDoctor.doctor_id}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-xs font-extrabold ${isSelected ? 'text-[#005570]' : 'text-slate-500'}`}>
                    {isSelected ? '✓ Selected Avatar' : 'Select Avatar'}
                  </span>
                  <CheckCircle2 className={`w-4 h-4 ${isSelected ? 'text-[#005570]' : 'text-slate-300'}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Step Navigation Row */}
      <div className="flex justify-between items-center pt-6 border-t border-slate-200">
        <button
          onClick={() => setActiveStep(1)}
          className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Doctor Selection</span>
        </button>

        <button
          onClick={() => setActiveStep(3)}
          disabled={!selectedScenario}
          className="px-8 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-extrabold text-xs shadow-md shadow-[#005570]/20 flex items-center space-x-2 disabled:opacity-40"
        >
          <span>Proceed to Voice Selection →</span>
        </button>
      </div>
    </div>
  );
};
