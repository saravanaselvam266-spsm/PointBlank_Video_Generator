import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi } from '../api/client';
import { Stethoscope, Plus, Video, Search, AlertCircle, X, UserRound, AudioLines, ArrowUpRight } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { AlertBanner } from '../components/ui/AlertBanner';
import { SlateTag } from '../components/ui/SlateTag';
import { motion, AnimatePresence } from 'framer-motion';

export const Doctors = () => {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [docName, setDocName] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [modalErr, setModalErr] = useState('');

  const fetchDoctors = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await doctorApi.list();
      setDoctors(res.data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch doctor profiles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    if (!docName || !docSpec) {
      setModalErr('Please fill in both doctor name and specialization.');
      return;
    }
    setIsCreating(true);
    setModalErr('');

    try {
      await doctorApi.create({
        doctor_name: docName,
        specialization: docSpec,
        avatar_type: 'public'
      });
      setShowAddModal(false);
      setDocName('');
      setDocSpec('');
      fetchDoctors();
    } catch (err) {
      setModalErr(err.message || 'Failed to create doctor profile');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredDoctors = doctors.filter(
    (d) =>
      d.doctor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.doctor_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-7 select-none font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-line pb-reveal">
        <div className="space-y-1.5">
          <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.16em]">Content · Doctors</span>
          <h1 className="font-display text-3xl text-ink tracking-tight">Doctors</h1>
          <p className="text-sm text-ink-soft max-w-xl">
            Physician identities and avatar mappings scoped to your account.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs shadow-cta transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add doctor profile</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="relative flex-1 max-w-md pb-reveal" style={{ '--pb-i': 1 }}>
        <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-3 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, specialization, or ID…"
          className="w-full pl-10 pr-4 py-2 text-xs bg-surface border border-line rounded-xl focus:outline-hidden focus:border-accent transition-all"
        />
      </div>

      {/* Doctor Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="pb-card p-6 animate-pulse space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-surface-sunken" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 bg-surface-sunken rounded" />
                  <div className="h-2.5 w-1/2 bg-surface-sunken rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center text-error flex flex-col items-center gap-2 pb-card">
          <AlertCircle className="w-6 h-6" />
          <p className="text-xs font-medium">{errorMsg}</p>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No doctor profiles yet"
          description="Add a doctor to get started with video generation."
          action={
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 rounded-xl bg-signal text-white text-sm font-semibold shadow-cta"
            >
              Add doctor profile →
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doc, i) => (
            <div
              key={doc.id}
              onClick={() => navigate(`/app/doctors/${doc.id}`)}
              className="pb-card pb-card-hover p-6 flex flex-col justify-between gap-4 pb-reveal cursor-pointer"
              style={{ '--pb-i': Math.min(i, 8) }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-signal text-white flex items-center justify-center font-semibold text-sm shrink-0">
                  {doc.doctor_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <SlateTag className="mb-1">{doc.doctor_id}</SlateTag>
                  <h3 className="text-base font-semibold text-ink truncate">
                    {doc.doctor_name}
                  </h3>
                  <p className="text-xs text-ink-muted truncate">{doc.specialization}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-ink-muted shrink-0" />
              </div>

              <div className="flex items-center gap-4 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5"><UserRound className="w-3.5 h-3.5 text-accent" />{doc.scenario_count || 0}</span>
                <span className="flex items-center gap-1.5"><AudioLines className="w-3.5 h-3.5 text-accent" />{doc.voice_count || 0}</span>
                <span className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5 text-accent" />{doc.video_count || 0}</span>
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-between text-xs">
                <span className="font-semibold text-signal">Open profile →</span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/app/create-video'); }}
                  className="font-semibold text-ink-soft hover:text-signal hover:underline"
                >
                  Create video
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Doctor Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-surface rounded-2xl max-w-md w-full p-6 space-y-5 border border-line shadow-panel"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-signal" strokeWidth={1.75} />
                  <h3 className="font-display text-lg text-ink">Add doctor profile</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-ink-muted hover:text-ink" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalErr && <AlertBanner>{modalErr}</AlertBanner>}

              <form onSubmit={handleCreateDoctor} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-soft mb-1">
                    Doctor full name & credentials
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Alexander Vance, M.D."
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-surface-sunken border border-line rounded-xl focus:bg-surface focus:border-accent outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-soft mb-1">
                    Medical specialization
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cardiology & Cardiovascular Medicine"
                    value={docSpec}
                    onChange={(e) => setDocSpec(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-surface-sunken border border-line rounded-xl focus:bg-surface focus:border-accent outline-hidden font-medium"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-soft hover:bg-surface-sunken"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-5 py-2 rounded-xl bg-signal text-white font-semibold text-xs hover:bg-signal-strong transition-colors disabled:opacity-60"
                  >
                    {isCreating ? 'Creating profile…' : 'Save doctor profile'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
