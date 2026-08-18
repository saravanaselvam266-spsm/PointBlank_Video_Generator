import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { heyGenApi, voiceApi } from '../../api/client';
import { Volume2, Play, Pause, CheckCircle2, Search, Loader2, Save, BookmarkCheck, UploadCloud, Clock, XCircle } from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';
import { WizardFooter } from '../ui/WizardFooter';
import { AlertBanner } from '../ui/AlertBanner';
import { Badge } from '../ui/Badge';
import { UploadDoctorVoiceModal } from '../voice/UploadDoctorVoiceModal';

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
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchVoicesData();
    return () => {
      if (audioElement) audioElement.pause();
    };
  }, [currentDoctor]);

  const fetchVoicesData = async (preferVoiceId = null) => {
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

      // Default selection: only ever auto-select a READY voice (clone_status
      // absent/"ready" covers legacy catalog-saved voices too). Prefer a
      // just-uploaded voice, then the doctor's marked default, then the sole
      // ready voice if there's exactly one.
      const readyVoices = savedList.filter((v) => !v.clone_status || v.clone_status === 'ready');
      const preferred = preferVoiceId ? readyVoices.find((v) => v.id === preferVoiceId) : null;
      const defaultVoice = preferred || readyVoices.find((v) => v.is_default) || (readyVoices.length === 1 ? readyVoices[0] : null);

      if (defaultVoice) {
        setSelectedVoiceRecord(defaultVoice);
        setSelectedVoice({ voice_id: defaultVoice.heygen_voice_id, name: defaultVoice.name });
      } else if (savedList.length > 0 && !selectedVoiceRecord && !hgList.length) {
        // No ready voice yet and nothing else to show — leave selection empty
        // rather than pointing at a voice that isn't usable for video generation.
      } else if (hgList.length > 0 && !selectedVoice && savedList.length === 0) {
        setSelectedVoice(hgList[0]);
      }

      if (savedList.length === 0) {
        setActiveTab('heygen');
      } else {
        setActiveTab('saved');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load the voice library');
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceReady = (readyVoice) => {
    setShowUploadModal(false);
    fetchVoicesData(readyVoice.id);
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
        description={`Pick a saved voice for ${currentDoctor?.doctor_name || 'this doctor'}, or browse the voice library.`}
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      {showUploadModal && currentDoctor && (
        <UploadDoctorVoiceModal
          doctorId={currentDoctor.id}
          doctorName={currentDoctor.doctor_name}
          onClose={() => setShowUploadModal(false)}
          onReady={handleVoiceReady}
        />
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-line pb-4">
        <div className="flex gap-1 bg-surface-sunken p-1 rounded-xl">
          {savedVoices.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'saved' ? 'bg-surface text-signal shadow-panel' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>Saved voices ({savedVoices.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('heygen')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'heygen' ? 'bg-surface text-signal shadow-panel' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Voice library ({heygenVoices.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {selectedVoice && (
            <div className="text-xs text-ink-muted flex items-center gap-2">
              <span>Selected:</span>
              <strong className="text-signal font-semibold">{selectedVoice.name || selectedVoice.voice_id}</strong>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            disabled={!currentDoctor}
            className="px-3.5 py-2 rounded-xl bg-signal hover:bg-signal-strong text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload doctor voice</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Saved Doctor Voices */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          {savedVoices.length === 0 ? (
            <div className="p-8 text-center bg-surface border border-line rounded-2xl text-ink-muted space-y-3">
              <p className="text-sm">No voice has been added for this doctor.</p>
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-xl bg-signal hover:bg-signal-strong text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload doctor voice</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {savedVoices.map((v) => {
                const isReady = !v.clone_status || v.clone_status === 'ready';
                const isSel = isReady && (selectedVoiceRecord?.id === v.id || selectedVoice?.voice_id === v.heygen_voice_id);
                const isPlay = playingVoiceId === v.id;
                const previewUrl = v.source_preview_url || v.preview_url;
                return (
                  <button
                    type="button"
                    key={v.id}
                    disabled={!isReady}
                    onClick={() => {
                      if (!isReady) return;
                      setSelectedVoiceRecord(v);
                      setSelectedVoice({ voice_id: v.heygen_voice_id, name: v.name });
                    }}
                    className={`text-left p-4 rounded-2xl border transition-all ${
                      isSel
                        ? 'border-signal bg-signal-soft shadow-panel'
                        : isReady
                        ? 'border-line bg-surface hover:border-accent/50'
                        : 'border-line bg-surface-sunken opacity-80 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-ink text-sm truncate">{v.name}</h4>
                        <p className="text-[11px] text-ink-muted mt-0.5">{v.language || 'English'} · {v.gender || 'neutral'}</p>
                        {v.clone_status === 'pending' || v.clone_status === 'cloning' ? (
                          <span className="inline-flex mt-1.5">
                            <Badge variant="warning" icon={Clock} pulse>Creating voice…</Badge>
                          </span>
                        ) : v.clone_status === 'failed' ? (
                          <span className="inline-flex mt-1.5">
                            <Badge variant="danger" icon={XCircle}>Voice failed</Badge>
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {previewUrl && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayAudio(previewUrl, v.id);
                            }}
                            className={`p-2 rounded-xl transition-all cursor-pointer ${
                              isPlay ? 'bg-signal text-white' : 'bg-surface-sunken text-signal hover:bg-signal-soft'
                            }`}
                          >
                            {isPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </span>
                        )}
                        {isSel && <CheckCircle2 className="w-5 h-5 text-signal" />}
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
              <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search voice name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-line text-ink text-sm focus:outline-hidden focus:border-accent"
              />
            </div>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-line text-ink-soft text-sm focus:outline-hidden focus:border-accent"
            >
              <option value="all">All genders</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>

            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-line text-ink-soft text-sm focus:outline-hidden focus:border-accent"
            >
              <option value="all">All languages</option>
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
            </select>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-signal animate-spin mb-3" />
              <p className="text-ink-muted text-sm">Loading voices…</p>
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
                        ? 'border-signal bg-signal-soft shadow-panel'
                        : 'border-line bg-surface hover:border-accent/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-ink text-sm truncate">{v.name || v.voice_id}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-surface-sunken text-ink-soft font-medium border border-line">
                            {v.gender || 'neutral'}
                          </span>
                          <span className="text-[10px] text-ink-muted">{v.language || 'English'}</span>
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
                              isPlaying ? 'bg-signal text-white' : 'bg-surface-sunken text-signal hover:bg-signal-soft'
                            }`}
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        )}
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-signal" />}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                      <span className="text-[10px] text-ink-muted truncate max-w-[120px]">{v.language || 'English'} voice</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveVoiceForDoctor(v);
                        }}
                        disabled={savingVoice}
                        className="px-2.5 py-1 rounded-lg bg-signal hover:bg-signal-strong text-white text-[10px] font-semibold flex items-center gap-1 disabled:opacity-60"
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
        backLabel="Back to avatar"
        onNext={() => setActiveStep(4)}
        nextLabel="Continue to script"
        nextDisabled={!selectedVoice}
      />
    </div>
  );
};
