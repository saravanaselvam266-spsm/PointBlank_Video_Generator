import React, { useState, useRef, useEffect } from 'react';
import { voiceApi } from '../../api/client';
import { X, UploadCloud, Loader2, CheckCircle2, FileAudio } from 'lucide-react';
import { AlertBanner } from '../ui/AlertBanner';
import { motion, AnimatePresence } from 'framer-motion';

const POLL_INTERVAL_MS = 3000;

/**
 * Doctor Original Voice upload modal: pick an audio recording, submit it for
 * storage + real cloning, then poll until the provider reports the cloned
 * voice is ready. Used from both the Voice Library page and the Create Video
 * wizard's Voice step, so all clone-state UI copy lives here once.
 */
export const UploadDoctorVoiceModal = ({ doctorId, doctorName, onClose, onReady }) => {
  const [name, setName] = useState(doctorName ? `${doctorName} Original Voice` : 'Original Voice');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [voice, setVoice] = useState(null); // latest Voice record while pending/cloning/ready/failed
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const pollCloneStatus = (voiceId) => {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await voiceApi.getCloneStatus(voiceId);
        setVoice(res.data);
        if (res.data.clone_status === 'ready') {
          onReady?.(res.data);
        } else if (res.data.clone_status === 'cloning' || res.data.clone_status === 'pending') {
          pollCloneStatus(voiceId);
        }
        // 'failed' — stop polling, let the user retry.
      } catch (err) {
        // Transient network hiccup while polling — keep trying rather than
        // surfacing a scary error for what's likely a momentary blip.
        pollCloneStatus(voiceId);
      }
    }, POLL_INTERVAL_MS);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !name.trim() || !doctorId) return;

    setSubmitting(true);
    setError(null);
    setVoice(null);

    try {
      const formData = new FormData();
      formData.append('doctor_id', doctorId);
      formData.append('name', name.trim());
      formData.append('file', file);

      const res = await voiceApi.uploadAndClone(formData);
      setVoice(res.data);

      if (res.data.clone_status === 'ready') {
        onReady?.(res.data);
      } else if (res.data.clone_status === 'cloning' || res.data.clone_status === 'pending') {
        pollCloneStatus(res.data.id);
      }
    } catch (err) {
      setError(err.message || "We couldn't upload this recording. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!voice) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await voiceApi.retryClone(voice.id);
      setVoice(res.data);
      if (res.data.clone_status === 'ready') {
        onReady?.(res.data);
      } else if (res.data.clone_status === 'cloning') {
        pollCloneStatus(res.data.id);
      }
    } catch (err) {
      setError(err.message || 'Retry failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = submitting || voice?.clone_status === 'pending' || voice?.clone_status === 'cloning';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs px-4" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-surface rounded-2xl shadow-panel border border-line overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <span className="font-mono text-[10px] font-medium text-accent uppercase tracking-[0.14em]">Voice · Upload</span>
            <h3 className="font-display text-lg text-ink">Upload doctor voice</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-sunken text-ink-muted" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && <AlertBanner>{error}</AlertBanner>}

          <AnimatePresence mode="wait">
            {!voice || voice.clone_status === 'failed' ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleUpload}
                className="space-y-4"
              >
                <p className="text-xs text-ink-muted leading-relaxed">
                  Upload the doctor's real recorded voice. We'll clone it so their videos sound like them — not a generic voice.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Doctor</label>
                  <div className="px-4 py-2.5 rounded-xl bg-surface-sunken border border-line text-ink text-sm">
                    {doctorName || 'Selected doctor'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Voice name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-line text-ink text-sm focus:outline-hidden focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Audio file</label>
                  <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-accent/40 bg-surface-sunken cursor-pointer hover:bg-signal-soft transition-colors">
                    <UploadCloud className="w-5 h-5 text-signal shrink-0" strokeWidth={1.75} />
                    <span className="text-xs text-ink-soft truncate">
                      {file ? file.name : 'Choose a WAV or MP3 recording'}
                    </span>
                    <input type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" onChange={handleFileChange} className="hidden" />
                  </label>
                  <p className="text-[10px] text-ink-muted mt-1.5">WAV or MP3, up to 32MB.</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-surface border border-line text-ink-soft text-xs font-semibold hover:bg-surface-sunken">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!file || submitting}
                    className="px-5 py-2.5 rounded-xl bg-signal hover:bg-signal-strong text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-60 shadow-cta"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{voice?.clone_status === 'failed' ? 'Retry upload' : 'Upload voice'}</span>
                  </button>
                </div>

                {voice?.clone_status === 'failed' && voice.source_audio_blob_name && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={submitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-signal-soft text-signal text-xs font-semibold disabled:opacity-60"
                  >
                    Retry cloning (uses the same recording)
                  </button>
                )}
              </motion.form>
            ) : (
              <motion.div
                key="status"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-6 space-y-3"
              >
                {voice.clone_status === 'ready' ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-success" />
                    <p className="text-sm font-semibold text-ink">Voice ready</p>
                    <p className="text-xs text-ink-muted">"{voice.name}" is ready to use in Create Video.</p>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <FileAudio className="w-10 h-10 text-signal" />
                      <Loader2 className="w-5 h-5 text-accent animate-spin absolute -bottom-1 -right-1 bg-surface rounded-full" />
                    </div>
                    <p className="text-sm font-semibold text-ink">Creating voice…</p>
                    <p className="text-xs text-ink-muted">This can take a minute. You can keep this window open.</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {isBusy && voice && (
            <button type="button" onClick={onClose} className="w-full px-4 py-2 rounded-xl text-ink-muted text-xs font-medium hover:bg-surface-sunken">
              Close and continue in background
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
