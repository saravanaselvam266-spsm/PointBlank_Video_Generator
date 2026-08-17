import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { heyGenApi, voiceApi } from '../../api/client';
import { Volume2, Play, Pause, CheckCircle2, Search, Loader2, AlertCircle, Save, BookmarkCheck } from 'lucide-react';

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

      // 2. Fetch Live HeyGen Voices Library
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
      setError(err.message || 'Failed to fetch Voices library');
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
      setError('Please select a Doctor Profile first.');
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
      setError(err.message || 'Failed to save Voice for Doctor');
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
    <div className="max-w-5xl mx-auto p-6 text-left font-sans select-none space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E6F3F7] text-[#005570] border border-[#007799]/20 mb-3">
          <Volume2 className="w-7 h-7" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Select Doctor Voice</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-lg mx-auto">
          Choose a saved voice for {currentDoctor?.doctor_name || 'the Doctor'} or pick from our AI voice library.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Info Notice for Voice Cloning */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center justify-between">
        <span>Custom voice cloning is not currently available for this account.</span>
        <span className="px-2.5 py-1 rounded bg-white text-slate-700 border border-slate-200 font-medium shadow-xs">
          Standard AI Voice Library Active
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div className="flex space-x-2 bg-slate-100 p-1.5 rounded-2xl">
          {savedVoices.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'saved' ? 'bg-[#005570] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>Saved Doctor Voices ({savedVoices.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('heygen')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'heygen' ? 'bg-[#005570] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>AI Voice Library ({heygenVoices.length})</span>
          </button>
        </div>

        {selectedVoice && (
          <div className="text-xs text-slate-600 flex items-center space-x-2">
            <span>Selected:</span>
            <strong className="text-[#005570] font-bold">{selectedVoice.name || selectedVoice.voice_id}</strong>
          </div>
        )}
      </div>

      {/* Tab 1: Saved Doctor Voices */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {savedVoices.length === 0 ? (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500">
              <p className="text-sm">No saved voices for this doctor yet. Browse the AI Voice Library tab below to save one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {savedVoices.map((v) => {
                const isSel = selectedVoiceRecord?.id === v.id || selectedVoice?.voice_id === v.heygen_voice_id;
                const isPlay = playingVoiceId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedVoiceRecord(v);
                      setSelectedVoice({ voice_id: v.heygen_voice_id, name: v.name });
                    }}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all text-left ${
                      isSel
                        ? 'border-[#005570] bg-[#E6F3F7] shadow-md shadow-[#005570]/10'
                        : 'border-slate-200 bg-white hover:border-[#007799]/50 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#005570] text-white mb-1.5">
                          {v.voice_id}
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{v.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{v.language} • {v.gender || 'neutral'}</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {v.preview_url && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayAudio(v.preview_url, v.id);
                            }}
                            className={`p-2 rounded-xl transition-all ${
                              isPlay ? 'bg-[#005570] text-white' : 'bg-slate-100 text-[#005570] hover:bg-[#E6F3F7]'
                            }`}
                          >
                            {isPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        )}
                        {isSel && <CheckCircle2 className="w-5 h-5 text-[#005570]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live HeyGen AI Voice Library */}
      {activeTab === 'heygen' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search voice name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-[#007799]"
              />
            </div>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs focus:outline-hidden focus:border-[#007799]"
            >
              <option value="all">All Genders</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>

            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs focus:outline-hidden focus:border-[#007799]"
            >
              <option value="all">All Languages</option>
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
            </select>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-[#005570] animate-spin mb-3" />
              <p className="text-slate-500 text-sm">Loading voices...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto pr-2">
              {filteredHeyGenVoices.map((v) => {
                const isSelected = selectedVoice?.voice_id === v.voice_id;
                const isPlaying = playingVoiceId === v.voice_id;
                return (
                  <div
                    key={v.voice_id}
                    onClick={() => setSelectedVoice(v)}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all text-left ${
                      isSelected
                        ? 'border-[#005570] bg-[#E6F3F7] shadow-md shadow-[#005570]/10'
                        : 'border-slate-200 bg-white hover:border-[#007799]/50 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{v.name || v.voice_id}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium border border-slate-200">
                            {v.gender || 'neutral'}
                          </span>
                          <span className="text-[10px] text-slate-500">{v.language || 'English'}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {v.preview_audio && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayAudio(v.preview_audio, v.voice_id);
                            }}
                            className={`p-2 rounded-xl transition-all ${
                              isPlaying ? 'bg-[#005570] text-white' : 'bg-slate-100 text-[#005570] hover:bg-[#E6F3F7]'
                            }`}
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        )}
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-[#005570]" />}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">{v.voice_id}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveVoiceForDoctor(v);
                        }}
                        disabled={savingVoice}
                        className="px-2.5 py-1 rounded-lg bg-[#005570] hover:bg-[#004055] text-white text-[10px] font-bold flex items-center space-x-1"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save Voice</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      {selectedVoice && (
        <div className="mt-8 flex justify-between items-center pt-4 border-t border-slate-100">
          <button
            onClick={() => setActiveStep(2)}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
          >
            ← Back to Avatar Scenario
          </button>

          <button
            onClick={() => setActiveStep(4)}
            className="px-8 py-3.5 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm transition-all shadow-lg shadow-[#005570]/20"
          >
            Continue to Healthcare Script →
          </button>
        </div>
      )}
    </div>
  );
};
