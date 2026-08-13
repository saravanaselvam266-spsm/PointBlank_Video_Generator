import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { doctorApi } from '../../api/client';
import { User, Stethoscope, PlusCircle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

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
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E6F3F7] text-[#005570] border border-[#007799]/20 mb-4">
          <Stethoscope className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Select Doctor Profile</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto">
          Create or select a doctor profile entity. Each profile is assigned a unique PointBlank ID (e.g.{' '}
          <span className="font-mono text-[#005570] font-bold">PB-DOC-000001</span>).
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Select Existing Doctors */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#005570] animate-spin mb-3" />
          <p className="text-slate-500 text-sm">Loading Doctor Profiles...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doctorsList.map((doc) => {
              const isSelected = currentDoctor?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (currentDoctor?.id !== doc.id) {
                      setCurrentDoctor(doc);
                      setSelectedScenario(null);
                      setSelectedAvatar(null);
                    }
                  }}
                  className={`cursor-pointer p-5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-[#007799] bg-[#E6F3F7] shadow-md shadow-[#005570]/10'
                      : 'border-slate-200 bg-white hover:border-[#007799]/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                        isSelected ? 'bg-[#005570] text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {doc.doctor_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{doc.doctor_name}</h3>
                        <p className="text-xs text-slate-500">{doc.specialization}</p>
                        <span className="inline-block mt-2 px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[#E6F3F7] text-[#005570] border border-[#007799]/20">
                          {doc.doctor_id}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-6 h-6 text-[#007799] flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all border border-slate-200 shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-[#005570]" />
              <span>{showCreateForm ? 'Cancel New Profile' : 'Create New Doctor Profile'}</span>
            </button>

            {currentDoctor && (
              <button
                onClick={() => setActiveStep(2)}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm transition-all shadow-lg shadow-[#005570]/20"
              >
                <span>Continue with {currentDoctor.doctor_name}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create Doctor Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateDoctor} className="mt-8 p-6 rounded-2xl bg-white border border-[#007799]/30 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <User className="w-5 h-5 text-[#005570]" />
            <span>New Doctor Profile</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Full Name (with Title)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Sarah Jenkins, M.D."
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#007799] focus:ring-2 focus:ring-[#007799]/10 text-sm placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Medical Specialization
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Chief of Cardiology & Cardiovascular Surgery"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#007799] focus:ring-2 focus:ring-[#007799]/10 text-sm placeholder:text-slate-400"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm transition-all shadow-md shadow-[#005570]/20"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Save & Register Doctor ID</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
