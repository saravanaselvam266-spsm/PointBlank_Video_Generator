import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doctorApi, avatarScenarioApi, voiceApi } from '../api/client';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  UploadCloud,
  Video,
  UserRound,
  AudioLines,
  ArrowLeft,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { SlateTag } from '../components/ui/SlateTag';
import { UploadDoctorVoiceModal } from '../components/voice/UploadDoctorVoiceModal';
import { DoctorAvatarCard } from '../components/doctor/DoctorAvatarCard';
import { DoctorVoiceCard } from '../components/doctor/DoctorVoiceCard';
import { DoctorVideoCard } from '../components/doctor/DoctorVideoCard';

const Section = ({ eyebrow, title, action, children }) => (
  <section className="space-y-4 pb-reveal">
    <div className="flex items-center justify-between gap-3">
      <div>
        <span className="font-mono text-[10px] font-medium text-accent uppercase tracking-[0.16em]">{eyebrow}</span>
        <h2 className="font-display text-xl text-ink tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const DoctorProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    setCurrentDoctor,
    setSelectedScenario,
    setSelectedAvatar,
    setSelectedVoiceRecord,
    setSelectedVoice,
    setActiveStep,
  } = useApp();

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [audioObj, setAudioObj] = useState(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await doctorApi.getProfile(id);
      setProfile(res.data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load doctor profile');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProfile();
    return () => { if (audioObj) audioObj.pause(); };
  }, [fetchProfile]);

  const goToStudio = (doctor) => {
    setCurrentDoctor(doctor);
  };

  const handleCreateAvatar = () => {
    goToStudio(profile.doctor);
    navigate('/app/create-avatar');
  };

  const handleUploadVoice = () => setShowUploadModal(true);

  const handleCreateVideo = () => {
    goToStudio(profile.doctor);
    navigate('/app/create-video');
  };

  const handleUseAvatar = (sc) => {
    goToStudio(profile.doctor);
    setSelectedScenario(sc);
    setSelectedAvatar({
      type: sc.avatar_type || 'photo',
      avatar_id: sc.heygen_avatar_id,
      talking_photo_id: sc.heygen_talking_photo_id,
      name: sc.name,
      preview_image_url: sc.photo_url,
    });
    setActiveStep(3);
    navigate('/app/create-video');
  };

  const handleUseVoice = (v) => {
    goToStudio(profile.doctor);
    setSelectedVoiceRecord(v);
    setSelectedVoice({ voice_id: v.heygen_voice_id, name: v.name });
    setActiveStep(4);
    navigate('/app/create-video');
  };

  const handleDeleteAvatar = async (sc) => {
    if (!window.confirm('Are you sure you want to delete this Avatar Scenario? Existing generated videos will be preserved.')) return;
    try {
      await avatarScenarioApi.delete(sc.id);
      setProfile((prev) => ({ ...prev, avatars: prev.avatars.filter((a) => a.id !== sc.id) }));
    } catch (err) {
      alert(err.message || 'Failed to delete scenario');
    }
  };

  const handleDeleteVoice = async (v) => {
    if (!window.confirm('Are you sure you want to delete this Saved Voice? Existing generated videos will be preserved.')) return;
    try {
      await voiceApi.delete(v.id);
      setProfile((prev) => ({ ...prev, voices: prev.voices.filter((x) => x.id !== v.id) }));
    } catch (err) {
      alert(err.message || 'Failed to delete voice');
    }
  };

  const handleRetryClone = async (v) => {
    setRetryingId(v.id);
    try {
      const res = await voiceApi.retryClone(v.id);
      setProfile((prev) => ({ ...prev, voices: prev.voices.map((x) => (x.id === v.id ? res.data : x)) }));
    } catch (err) {
      alert(err.message || 'Retry failed. Please try again.');
    } finally {
      setRetryingId(null);
    }
  };

  const handleTogglePlay = (previewUrl, voiceId) => {
    if (audioObj) audioObj.pause();
    if (!previewUrl) return;

    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      setAudioObj(null);
      return;
    }

    const audio = new Audio(previewUrl);
    audio.play();
    setAudioObj(audio);
    setPlayingVoiceId(voiceId);
    audio.onended = () => {
      setPlayingVoiceId(null);
      setAudioObj(null);
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-muted gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-signal" />
        <span className="text-sm font-medium">Loading doctor profile…</span>
      </div>
    );
  }

  if (errorMsg || !profile) {
    return (
      <div className="p-8 text-center text-error flex flex-col items-center gap-3 pb-card">
        <AlertCircle className="w-6 h-6" />
        <p className="text-sm font-medium">{errorMsg || 'Doctor profile not found.'}</p>
        <button onClick={() => navigate('/app/doctors')} className="text-xs font-semibold text-signal hover:underline">
          ← Back to Doctors
        </button>
      </div>
    );
  }

  const { doctor, avatars, voices, recent_videos: recentVideos } = profile;
  const readyAvatarThumb = avatars.find((a) => a.creation_status === 'READY' && (a.thumbnail_url || a.photo_url));

  return (
    <div className="space-y-10 select-none font-sans">
      {showUploadModal && (
        <UploadDoctorVoiceModal
          doctorId={doctor.id}
          doctorName={doctor.doctor_name}
          onClose={() => setShowUploadModal(false)}
          onReady={() => {
            setShowUploadModal(false);
            fetchProfile();
          }}
        />
      )}

      <div>
        <button
          onClick={() => navigate('/app/doctors')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-signal mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Doctors</span>
        </button>

        <div className="pb-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6 pb-reveal">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-signal text-white flex items-center justify-center font-semibold text-2xl shrink-0 border-2 border-surface shadow-panel">
            {readyAvatarThumb ? (
              <img src={readyAvatarThumb.thumbnail_url || readyAvatarThumb.photo_url} alt={doctor.doctor_name} className="w-full h-full object-cover" />
            ) : (
              doctor.doctor_name.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <SlateTag className="mb-1.5">{doctor.doctor_id}</SlateTag>
            <h1 className="font-display text-2xl sm:text-3xl text-ink tracking-tight truncate">{doctor.doctor_name}</h1>
            <p className="text-sm text-ink-soft">{doctor.specialization}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-ink-muted">
              <span className="flex items-center gap-1.5"><UserRound className="w-3.5 h-3.5 text-accent" />{doctor.scenario_count || 0} avatars</span>
              <span className="flex items-center gap-1.5"><AudioLines className="w-3.5 h-3.5 text-accent" />{doctor.voice_count || 0} voices</span>
              <span className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5 text-accent" />{doctor.video_count || 0} videos</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleCreateAvatar}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-line text-ink-soft hover:bg-surface-sunken font-semibold text-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New avatar</span>
            </button>
            <button
              onClick={handleUploadVoice}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-line text-ink-soft hover:bg-surface-sunken font-semibold text-xs transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload voice</span>
            </button>
            <button
              onClick={handleCreateVideo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs shadow-cta transition-all"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Create video</span>
            </button>
          </div>
        </div>
      </div>

      <Section eyebrow="Identity" title="Avatars">
        {avatars.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No avatars yet"
            description="Create this doctor's first avatar to start building videos."
            action={
              <button onClick={handleCreateAvatar} className="px-5 py-2.5 rounded-xl bg-signal text-white text-sm font-semibold shadow-cta">
                Create doctor avatar →
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {avatars.map((sc, i) => (
              <DoctorAvatarCard
                key={sc.id}
                scenario={sc}
                onUse={handleUseAvatar}
                onDelete={handleDeleteAvatar}
                onRetry={handleCreateAvatar}
                style={{ '--pb-i': Math.min(i, 8) }}
              />
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="Voice" title="Voices">
        {voices.length === 0 ? (
          <EmptyState
            icon={AudioLines}
            title="No voices yet"
            description="Upload this doctor's original recording to create a cloned voice."
            action={
              <button onClick={handleUploadVoice} className="px-5 py-2.5 rounded-xl bg-signal text-white text-sm font-semibold shadow-cta">
                Upload doctor voice →
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {voices.map((v, i) => (
              <DoctorVoiceCard
                key={v.id}
                voice={v}
                isPlaying={playingVoiceId === v.id}
                onTogglePlay={handleTogglePlay}
                onDelete={handleDeleteVoice}
                onRetry={handleRetryClone}
                isRetrying={retryingId === v.id}
                onUse={handleUseVoice}
                style={{ '--pb-i': Math.min(i, 8) }}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        eyebrow="Output"
        title="Recent videos"
        action={
          <button onClick={() => navigate('/app/videos')} className="text-xs font-semibold text-signal hover:underline">
            View all →
          </button>
        }
      >
        {recentVideos.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No videos yet"
            description="Generate this doctor's first video."
            action={
              <button onClick={handleCreateVideo} className="px-5 py-2.5 rounded-xl bg-signal text-white text-sm font-semibold shadow-cta">
                Create video →
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentVideos.map((v, i) => (
              <DoctorVideoCard
                key={v.id}
                video={v}
                onClick={() => navigate(`/app/videos/${v.id}`)}
                style={{ '--pb-i': Math.min(i, 8) }}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};
