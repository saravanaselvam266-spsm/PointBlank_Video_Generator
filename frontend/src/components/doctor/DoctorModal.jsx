import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { doctorApi } from '../../api/client';
import { User, Stethoscope, PlusCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';
import { EmptyState } from '../ui/EmptyState';
import { AlertBanner } from '../ui/AlertBanner';
import { SlateTag } from '../ui/SlateTag';

export const DoctorModal = () => {
  const { currentDoctor, setCurrentDoctor, setActiveStep, setSelectedScenario, setSelectedAvatar, setSelectedVoiceRecord, setSelectedVoice } = useApp();
  const [doctorsList, setDoctorsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [doctorName, setDoctorName] = useState('');
  const [specialization, setSpecialization] = useState('Cardiology & Internal Medicine');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await doctorApi.list();
      setDoctorsList(res.data);
      if (res.data.length > 0 && !currentDoctor) {
        setCurrentDoctor(res.data[0]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    if (!doctorName.trim() || !specialization.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const res = await doctorApi.create({
        doctor_name: doctorName.trim(),
        specialization: specialization.trim(),
        avatar_type: 'public'
      });

      const newDoc = res.data;
      setDoctorsList([newDoc, ...doctorsList]);
      setCurrentDoctor(newDoc);
      setShowCreateForm(false);
      setDoctorName('');
      setActiveStep(2);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create doctor profile');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <StepHeader
        step={1}
        icon={Stethoscope}
        title="Choose a doctor profile"
        description={
          <>
            Select the doctor this video is for, or register a new profile. Each profile keeps its own avatars,
            voices, and video history under a unique PointBlank ID.
          </>
        }
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-signal animate-spin mb-3" />
          <p className="text-ink-muted text-sm">Loading doctor profiles…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {doctorsList.length === 0 && !showCreateForm ? (
            <EmptyState
              icon={Stethoscope}
              title="No doctor profiles yet"
              description="Register your first doctor profile to start building videos for them."
              action={
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-sm transition-all shadow-cta"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create doctor profile</span>
                </button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctorsList.map((doc, i) => {
                  const isSelected = currentDoctor?.id === doc.id;
                  return (
                    <button
                      type="button"
                      key={doc.id}
                      onClick={() => {
                        if (currentDoctor?.id !== doc.id) {
                          setCurrentDoctor(doc);
                          setSelectedScenario(null);
                          setSelectedAvatar(null);
                          // Never carry one doctor's voice selection into another
                          // doctor's video — the new doctor's voices are loaded fresh.
                          setSelectedVoiceRecord(null);
                          setSelectedVoice(null);
                        }
                      }}
                      className={`text-left p-5 rounded-2xl border transition-all pb-reveal ${
                        isSelected
                          ? 'border-signal bg-signal-soft shadow-panel'
                          : 'border-line bg-surface hover:border-accent/40 hover:bg-surface-sunken'
                      }`}
                      style={{ '--pb-i': i }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg shrink-0 ${
                              isSelected ? 'bg-signal text-white' : 'bg-surface-sunken text-ink-soft'
                            }`}
                          >
                            {doc.doctor_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-ink text-base truncate">{doc.doctor_name}</h3>
                            <p className="text-xs text-ink-muted truncate">{doc.specialization}</p>
                            <SlateTag className="mt-2">{doc.doctor_id}</SlateTag>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-6 h-6 text-signal flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Row */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-line">
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-surface hover:bg-surface-sunken text-ink-soft font-medium text-sm transition-all border border-line"
                >
                  <PlusCircle className="w-4 h-4 text-signal" />
                  <span>{showCreateForm ? 'Cancel new profile' : 'Register another doctor'}</span>
                </button>

                {currentDoctor && (
                  <button
                    onClick={() => setActiveStep(2)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-sm transition-all shadow-cta"
                  >
                    <span>Continue with {currentDoctor.doctor_name}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Doctor Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateDoctor} className="p-6 rounded-2xl bg-surface-sunken border border-line space-y-4 pb-reveal">
          <h3 className="text-base font-semibold text-ink flex items-center gap-2">
            <User className="w-5 h-5 text-signal" strokeWidth={1.75} />
            <span>New doctor profile</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
              Full name (with title)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Sarah Jenkins, M.D."
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-line text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 text-sm placeholder:text-ink-muted"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
              Medical specialization
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Chief of Cardiology & Cardiovascular Surgery"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface border border-line text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 text-sm placeholder:text-ink-muted"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-sm transition-all shadow-cta disabled:opacity-60"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Save doctor profile</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
