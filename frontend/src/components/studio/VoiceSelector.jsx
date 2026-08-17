import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { heyGenApi, voiceApi } from '../../api/client';
import { Volume2, Play, Pause, CheckCircle2, Search, Loader2, AlertCircle, Save, BookmarkCheck } from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';
import { WizardFooter } from '../ui/WizardFooter';

export const VoiceSelector = () => {
  const { currentDoctor, selectedVoiceRecord, setSelectedVoiceRecord, selectedVoice, setSelectedVoice, setActiveStep } = useApp();

  const [activeTab, setActiveTab] = useState('saved'); // 'saved', 'heygen'
  const [savedVoices, setSavedVoices] = useState([]);
  const [heygenVoices, setHeygenVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingVoice, setSavingVoice] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');

  // Playing audio state
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [audioElement, setAudioElement] = useState(null);

  useEffect(() => {
    fetchVoicesData();
    return () => {
      if (audioElement) audioElement.pause();
    };
  }, [currentDoctor]);

  const fetchVoicesData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Saved Voices for Doctor
      let savedList = [];
      if (currentDoctor?.id) {
        const resSv = await voiceApi.list(currentDoctor.id).catch(() => ({ data: [] }));
        savedList = Array.isArray(resSv.data) ? resSv.data : [];
        setSavedVoices(savedList);
      }

      // 2. Fetch Live Voice Library
      const resHg = await heyGenApi.getVoices();
      const hgList = Array.isArray(resHg.data) ? resHg.data : resHg.data?.voices || [];
      setHeygenVoices(hgList);

      // Default selection logic
      if (savedList.length > 0 && !selectedVoiceRecord) {
        setSelectedVoiceRecord(savedList[0]);
        setSelectedVoice({ voice_id: savedList[0].heygen_voice_id, name: savedList[0].name });
      } else if (hgList.length > 0 && !selectedVoice) {
        setSelectedVoice(hgList[0]);
      }

      if (savedList.length === 0) {
        setActiveTab('heygen');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load the voice library');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAudio = (previewUrl, vId) => {
    if (!previewUrl) return;

    if (playingVoiceId === vId) {
      if (audioElement) audioElement.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioElement) audioElement.pause();

    const audio = new Audio(previewUrl);
    setAudioElement(audio);
    setPlayingVoiceId(vId);

    audio.play().catch((e) => console.error('Audio playback error:', e));
    audio.onended = () => setPlayingVoiceId(null);
  };

  const handleSaveVoiceForDoctor = async (v) => {
    if (!currentDoctor) {
      setError('Please select a doctor profile first.');
      return;
    }

    setSavingVoice(true);
    setError(null);

    try {
      const payload = {
        doctor_id: currentDoctor.id,
        name: v.name || v.voice_id || 'Doctor AI Voice',
        voice_type: 'ai_voice',
        heygen_voice_id: v.voice_id,
        language: v.language || 'English',
        gender: v.gender || 'neutral',
        accent: v.accent || null,
        preview_url: v.preview_audio || null
      };

      const res = await voiceApi.create(payload);
      const savedObj = res.data;

      setSavedVoices((prev) => [savedObj, ...prev]);
      setSelectedVoiceRecord(savedObj);
      setSelectedVoice(v);
      setActiveTab('saved');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save this voice for the doctor');
    } finally {
      setSavingVoice(false);
    }
  };

  const filteredHeyGenVoices = heygenVoices.filter((v) => {
    const nameMatch = (v.name || v.voice_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    const genderMatch = genderFilter === 'all' || (v.gender || '').toLowerCase() === genderFilter.toLowerCase();
    const langMatch = languageFilter === 'all' || (v.language || '').toLowerCase().includes(languageFilter.toLowerCase());
    return nameMatch && genderMatch && langMatch;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <StepHeader
        step={3}
        icon={Volume2}
        title="Choose a voice"
        description={`Pick a saved voice for ${currentDoctor?.doctor_name || 'this doctor'}, or browse the AI voice library.`}
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Info Notice for Voice Cloning */}
      <div className="p-3.5 rounded-xl bg-[#F5F7F8] border border-[#E5E7EB] text-[#6B7280] text-xs flex flex-wrap items-center justify-between gap-2">
        <span>Custom voice cloning isn't available on this account yet.</span>
        <span className="px-2.5 py-1 rounded bg-white text-[#374151] border border-[#E5E7EB] font-medium">
          Standard voice library active
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div className="flex space-x-1.5 bg-[#F5F7F8] p-1.5 rounded-2xl">
          {savedVoices.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'saved' ? 'bg-[#005570] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>Saved voices ({savedVoices.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('heygen')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'heygen' ? 'bg-[#005570] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Voice library ({heygenVoices.length})</span>
          </button>
        </div>

        {selectedVoice && (
          <div className="text-xs text-[#6B7280] flex items-center gap-2">
            <span>Selected:</span>
            <strong className="text-[#005570] font-bold">{selectedVoice.name || selectedVoice.voice_id}</strong>
          </div>
        )}
      </div>

      {/* Tab 1: Saved Doctor Voices */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {savedVoices.length === 0 ? (
            <div className="p-8 text-center bg-white border border-[#E5E7EB] rounded-2xl text-[#6B7280]">
              <p className="text-sm">No saved voices for this doctor yet. Browse the voice library tab to save one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {savedVoices.map((v) => {
                const isSel = selectedVoiceRecord?.id === v.id || selectedVoice?.voice_id === v.heygen_voice_id;
                const isPlay = playingVoiceId === v.id;
                return (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => {
                      setSelectedVoiceRecord(v);
                      setSelectedVoice({ voice_id: v.heygen_voice_id, name: v.name });
                    }}
                    className={`text-left p-4 rounded-2xl border transition-all ${
                      isSel
                        ? 'border-[#005570] bg-[#E6F3F7] shadow-sm'
                        : 'border-[#E5E7EB] bg-white hover:border-[#007799]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-[#1F2937] text-sm truncate">{v.name}</h4>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">{v.language} • {v.gender || 'neutral'}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {v.preview_url && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayAudio(v.preview_url, v.id);
                            }}
                            className={`p-2 rounded-xl transition-all cursor-pointer ${
                              isPlay ? 'bg-[#005570] text-white' : 'bg-[#F5F7F8] text-[#005570] hover:bg-[#E6F3F7]'
                            }`}
                          >
                            {isPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </span>
                        )}
                        {isSel && <CheckCircle2 className="w-5 h-5 text-[#005570]" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Voice Library */}
      {activeTab === 'heygen' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search voice name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2937] text-sm focus:outline-hidden focus:border-[#007799]"
              />
            </div>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-[#374151] text-sm focus:outline-hidden focus:border-[#007799]"
            >
              <option value="all">All genders</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>

            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-[#374151] text-sm focus:outline-hidden focus:border-[#007799]"
            >
              <option value="all">All languages</option>
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
            </select>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-[#005570] animate-spin mb-3" />
              <p className="text-[#6B7280] text-sm">Loading voices…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto pr-1">
              {filteredHeyGenVoices.map((v) => {
                const isSelected = selectedVoice?.voice_id === v.voice_id;
                const isPlaying = playingVoiceId === v.voice_id;
                return (
                  <div
                    key={v.voice_id}
                    onClick={() => setSelectedVoice(v)}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-[#005570] bg-[#E6F3F7] shadow-sm'
                        : 'border-[#E5E7EB] bg-white hover:border-[#007799]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-[#1F2937] text-sm truncate">{v.name || v.voice_id}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#F5F7F8] text-[#374151] font-medium border border-[#E5E7EB]">
                            {v.gender || 'neutral'}
                          </span>
                          <span className="text-[10px] text-[#6B7280]">{v.language || 'English'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {v.preview_audio && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayAudio(v.preview_audio, v.voice_id);
                            }}
                            className={`p-2 rounded-xl transition-all ${
                              isPlaying ? 'bg-[#005570] text-white' : 'bg-[#F5F7F8] text-[#005570] hover:bg-[#E6F3F7]'
                            }`}
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        )}
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-[#005570]" />}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#F5F7F8] flex items-center justify-between">
                      <span className="text-[10px] text-[#9CA3AF] truncate max-w-[120px]">{v.language || 'English'} voice</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveVoiceForDoctor(v);
                        }}
                        disabled={savingVoice}
                        className="px-2.5 py-1 rounded-lg bg-[#005570] hover:bg-[#004055] text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-60"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save voice</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <WizardFooter
        onBack={() => setActiveStep(2)}
        backLabel="Back to Avatar"
        onNext={() => setActiveStep(4)}
        nextLabel="Continue to Script"
        nextDisabled={!selectedVoice}
      />
    </div>
  );
};
