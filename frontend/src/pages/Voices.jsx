import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { voiceApi, heyGenApi } from '../api/client';
import { AudioLines, Loader2, Search, Volume2, Globe, AlertCircle, Trash2, Video, BookmarkCheck, Play, Pause } from 'lucide-react';

export const Voices = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('saved'); // 'saved', 'catalog'
  const [savedVoices, setSavedVoices] = useState([]);
  const [heygenVoices, setHeygenVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [search, setSearch] = useState('');
  
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [audioObj, setAudioObj] = useState(null);

  useEffect(() => {
    fetchData();
    return () => {
      if (audioObj) audioObj.pause();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Saved Voices
      const resSv = await voiceApi.list().catch(() => ({ data: [] }));
      setSavedVoices(Array.isArray(resSv.data) ? resSv.data : []);

      // 2. Fetch HeyGen Voice Catalog
      const resHg = await heyGenApi.getVoices().catch(() => ({ data: [] }));
      const rawV = Array.isArray(resHg.data) ? resHg.data : resHg.data?.voices || [];
      setHeygenVoices(rawV);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load voice resources');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayVoice = (previewUrl, vId) => {
    if (audioObj) audioObj.pause();
    if (!previewUrl) return;

    if (playingVoiceId === vId) {
      setPlayingVoiceId(null);
      setAudioObj(null);
      return;
    }

    const audio = new Audio(previewUrl);
    audio.play();
    setAudioObj(audio);
    setPlayingVoiceId(vId);

    audio.onended = () => {
      setPlayingVoiceId(null);
      setAudioObj(null);
    };
  };

  const handleDeleteVoice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Saved Voice? Existing generated videos will be preserved.')) return;
    try {
      await voiceApi.delete(id);
      setSavedVoices((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete voice');
    }
  };

  const filteredSaved = savedVoices.filter((v) =>
    (v.name || v.voice_id || v.doctor_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredCatalog = heygenVoices.filter((v) =>
    (v.name || v.voice_id || v.language || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 select-none font-sans text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E6F3F7] text-[#005570] mb-1">
            <AudioLines className="w-3.5 h-3.5 text-[#007799]" />
            <span>Doctor Voice Library</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Voice Library</h2>
          <p className="text-xs text-slate-500">
            Manage Doctor Saved Voices (PB-VCE-xxxx) and explore HeyGen AI multi-lingual voice library.
          </p>
        </div>

        <button
          onClick={() => navigate('/app/create-video')}
          className="px-5 py-2.5 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-xs shadow-md shadow-[#005570]/20 flex items-center space-x-2"
        >
          <Video className="w-4 h-4" />
          <span>New Doctor Voice</span>
        </button>
      </div>

      {/* Tabs & Search Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex space-x-2 bg-slate-100 p-1.5 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'saved' ? 'bg-[#005570] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Saved Doctor Voices ({savedVoices.length})
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'catalog' ? 'bg-[#005570] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            HeyGen AI Library ({heygenVoices.length})
          </button>
        </div>

        <div className="w-full sm:w-64 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voices..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#007799]"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-slate-500 flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#005570]" />
          <p className="text-xs font-medium">Loading voice library...</p>
        </div>
      ) : activeTab === 'saved' ? (
        <>
          {filteredSaved.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-500">
              <AudioLines className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No Saved Doctor Voices</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Save voices from the HeyGen AI Library to assign them to doctor profiles.</p>
              <button
                onClick={() => setActiveTab('catalog')}
                className="px-4 py-2 rounded-xl bg-[#005570] text-white text-xs font-bold"
              >
                Browse HeyGen Voices
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredSaved.map((v) => {
                const isPlay = playingVoiceId === v.id;
                return (
                  <div
                    key={v.id}
                    className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-[#007799] transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E6F3F7] text-[#005570] border border-[#007799]/20">
                          {v.voice_id}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 capitalize">{v.language || 'English'}</span>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{v.name}</h4>
                        <p className="text-xs text-slate-500">Doctor: {v.doctor_name || 'Assigned Doctor'}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {v.preview_url ? (
                        <button
                          type="button"
                          onClick={() => handlePlayVoice(v.preview_url, v.id)}
                          className={`p-2 rounded-xl transition-all ${
                            isPlay ? 'bg-[#005570] text-white' : 'bg-slate-100 text-[#005570] hover:bg-[#E6F3F7]'
                          }`}
                        >
                          {isPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                      ) : <div />}

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDeleteVoice(v.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Voice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate('/app/create-video')}
                          className="px-3 py-1.5 rounded-lg bg-[#005570] hover:bg-[#004055] text-white text-xs font-bold"
                        >
                          Use in Studio →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCatalog.slice(0, 40).map((v, idx) => {
            const isPlay = playingVoiceId === v.voice_id;
            return (
              <div key={v.voice_id || idx} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between hover:border-[#007799] transition-all">
                <div className="space-y-1 min-w-0 pr-2">
                  <p className="text-xs font-bold text-slate-900 truncate">{v.name || `Voice #${idx + 1}`}</p>
                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-500">
                    <Globe className="w-3 h-3 text-[#007799]" />
                    <span>{v.language || 'English'}</span>
                    {v.gender && <span className="uppercase text-[9px] font-semibold text-slate-400">• {v.gender}</span>}
                  </div>
                </div>

                {(v.preview_audio || v.sample_url || v.audio_sample) && (
                  <button
                    onClick={() => handlePlayVoice(v.preview_audio || v.sample_url || v.audio_sample, v.voice_id)}
                    className={`p-2.5 rounded-full transition-colors ${
                      isPlay
                        ? 'bg-[#005570] text-white animate-pulse'
                        : 'bg-slate-100 text-slate-600 hover:bg-[#E6F3F7] hover:text-[#005570]'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
