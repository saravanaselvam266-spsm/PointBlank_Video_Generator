import React, { useState, useEffect } from 'react';
import { heyGenApi } from '../api/client';
import { UserRound, AudioLines, Search, AlertCircle, Volume2, Globe } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';

/**
 * AI Library — the reusable, catalog-style AI resources (HeyGen's public
 * avatar + voice catalog), distinct from Doctor Profile which holds each
 * doctor's OWN created avatars and cloned voices. This page intentionally
 * does not duplicate Doctor Profile's doctor-scoped assets.
 */
export const AILibrary = () => {
  const [activeTab, setActiveTab] = useState('avatars'); // 'avatars', 'voices'
  const [avatars, setAvatars] = useState([]);
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [audioObj, setAudioObj] = useState(null);

  useEffect(() => {
    fetchData();
    return () => { if (audioObj) audioObj.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [resAv, resV] = await Promise.all([
        heyGenApi.getAvatars().catch(() => ({ data: { avatars: [] } })),
        heyGenApi.getVoices().catch(() => ({ data: [] })),
      ]);
      const rawAv = resAv.data?.avatars || resAv.data?.data?.avatars || resAv.data || [];
      setAvatars(Array.isArray(rawAv) ? rawAv : []);
      const rawV = Array.isArray(resV.data) ? resV.data : resV.data?.voices || [];
      setVoices(rawV);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load the AI Library');
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

  const filteredAvatars = avatars.filter((a) =>
    (a.avatar_name || a.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredVoices = voices.filter((v) =>
    (v.name || v.voice_id || v.language || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-7 select-none font-sans text-left">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-line pb-reveal">
        <div className="space-y-1.5">
          <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.16em]">Resources · AI Library</span>
          <h1 className="font-display text-3xl text-ink tracking-tight">AI Library</h1>
          <p className="text-sm text-ink-soft max-w-xl">
            Reusable AI avatars and voices available across every doctor. For a specific doctor's own avatars
            and voices, open their Doctor Profile.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-reveal" style={{ '--pb-i': 1 }}>
        <div className="flex gap-1 bg-surface-sunken p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('avatars')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'avatars' ? 'bg-surface text-signal shadow-panel' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <UserRound className="w-3.5 h-3.5" />
            <span>AI Avatars ({avatars.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('voices')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'voices' ? 'bg-surface text-signal shadow-panel' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <AudioLines className="w-3.5 h-3.5" />
            <span>AI Voices ({voices.length})</span>
          </button>
        </div>

        <div className="w-full sm:w-64 relative">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'avatars' ? 'Search AI avatars…' : 'Search AI voices…'}
            className="w-full pl-10 pr-4 py-2 text-xs bg-surface border border-line rounded-xl focus:outline-hidden focus:border-accent transition-colors"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-error-soft border border-error/25 text-error text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface overflow-hidden animate-pulse">
              <div className="aspect-3/4 bg-surface-sunken" />
              <div className="p-3 space-y-2">
                <div className="h-2.5 w-2/3 bg-surface-sunken rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'avatars' ? (
        filteredAvatars.length === 0 ? (
          <EmptyState icon={UserRound} title="No AI avatars found" description="The AI avatar catalog is currently empty or unreachable." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredAvatars.slice(0, 60).map((av, idx) => {
              const name = av.avatar_name || av.name || `Avatar #${idx + 1}`;
              const preview = av.preview_image_url || av.preview_url || av.thumbnail_url;
              return (
                <div key={av.avatar_id || idx} className="bg-surface rounded-2xl border border-line overflow-hidden flex flex-col group hover:border-accent/50 transition-all pb-reveal" style={{ '--pb-i': Math.min(idx, 8) }}>
                  <div className="aspect-3/4 bg-surface-sunken relative overflow-hidden">
                    {preview ? (
                      <img src={preview} alt={name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-muted bg-surface-sunken">
                        <UserRound className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-surface">
                    <p className="text-xs font-semibold text-ink truncate">{name}</p>
                    <p className="text-[10px] font-mono text-ink-muted truncate">{av.avatar_id || 'Public'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredVoices.length === 0 ? (
        <EmptyState icon={AudioLines} title="No AI voices found" description="The AI voice catalog is currently empty or unreachable." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredVoices.slice(0, 60).map((v, idx) => {
            const isPlay = playingVoiceId === v.voice_id;
            const preview = v.preview_audio || v.sample_url || v.audio_sample;
            return (
              <div key={v.voice_id || idx} className="bg-surface p-4 rounded-2xl border border-line flex items-center justify-between hover:border-accent/50 transition-all pb-reveal" style={{ '--pb-i': Math.min(idx, 8) }}>
                <div className="space-y-1 min-w-0 pr-2">
                  <p className="text-xs font-semibold text-ink truncate">{v.name || `Voice #${idx + 1}`}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-ink-muted">
                    <Globe className="w-3 h-3 text-accent" />
                    <span>{v.language || 'English'}</span>
                    {v.gender && <span className="uppercase text-[9px] font-semibold text-ink-muted/80">· {v.gender}</span>}
                  </div>
                </div>
                {preview && (
                  <button
                    onClick={() => handlePlayVoice(preview, v.voice_id)}
                    className={`p-2.5 rounded-full transition-colors ${
                      isPlay ? 'bg-signal text-white' : 'bg-surface-sunken text-ink-soft hover:bg-signal-soft hover:text-signal'
                    }`}
                  >
                    <Volume2 className={`w-4 h-4 ${isPlay ? 'animate-pulse' : ''}`} />
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
