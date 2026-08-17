import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { doctorApi } from '../../api/client';
import { User, Stethoscope, PlusCircle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';
import { EmptyState } from '../ui/EmptyState';

export const DoctorModal = () => {
  const { currentDoctor, setCurrentDoctor, setActiveStep, setSelectedScenario, setSelectedAvatar } = useApp();
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
            voices, and video history under a unique PointBlank ID (e.g.{' '}
            <span className="font-mono text-[#005570] font-bold">PB-DOC-000001</span>).
          </>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#005570] animate-spin mb-3" />
          <p className="text-[#6B7280] text-sm">Loading doctor profiles…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {doctorsList.length === 0 && !showCreateForm ? (
            <EmptyState
              icon={Stethoscope}
              title="No doctor profiles yet"
              description="Register your first doctor profile to start building AI videos for them."
              action={
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm transition-all shadow-md shadow-[#005570]/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create Doctor Profile</span>
                </button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctorsList.map((doc) => {
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
                        }
                      }}
                      className={`text-left p-5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-[#007799] bg-[#E6F3F7] shadow-sm'
                          : 'border-[#E5E7EB] bg-white hover:border-[#007799]/40 hover:bg-[#F5F7F8]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                              isSelected ? 'bg-[#005570] text-white' : 'bg-[#F5F7F8] text-[#374151]'
                            }`}
                          >
                            {doc.doctor_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-[#1F2937] text-base truncate">{doc.doctor_name}</h3>
                            <p className="text-xs text-[#6B7280] truncate">{doc.specialization}</p>
                            <span className="inline-block mt-2 px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-white text-[#005570] border border-[#007799]/20">
                              {doc.doctor_id}
                            </span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-6 h-6 text-[#007799] flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Row */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-[#E5E7EB]">
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-[#F5F7F8] text-[#374151] font-medium text-sm transition-all border border-[#E5E7EB]"
                >
                  <PlusCircle className="w-4 h-4 text-[#005570]" />
                  <span>{showCreateForm ? 'Cancel new profile' : 'Register another doctor'}</span>
                </button>

                {currentDoctor && (
                  <button
                    onClick={() => setActiveStep(2)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm transition-all shadow-md shadow-[#005570]/20"
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
        <form onSubmit={handleCreateDoctor} className="p-6 rounded-2xl bg-[#F5F7F8] border border-[#E5E7EB] space-y-4">
          <h3 className="text-base font-bold text-[#1F2937] flex items-center gap-2">
            <User className="w-5 h-5 text-[#005570]" />
            <span>New doctor profile</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
              Full name (with title)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Sarah Jenkins, M.D."
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2937] focus:outline-none focus:border-[#007799] focus:ring-2 focus:ring-[#007799]/10 text-sm placeholder:text-[#9CA3AF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
              Medical specialization
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Chief of Cardiology & Cardiovascular Surgery"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2937] focus:outline-none focus:border-[#007799] focus:ring-2 focus:ring-[#007799]/10 text-sm placeholder:text-[#9CA3AF]"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm transition-all shadow-md shadow-[#005570]/20 disabled:opacity-60"
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
