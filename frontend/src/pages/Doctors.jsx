import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi } from '../api/client';
import { Stethoscope, Plus, Loader2, Video, Search, UserRound, AlertCircle, X } from 'lucide-react';

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
    <div className="space-y-6 select-none font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Doctor Profiles</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage physician identities and avatar mappings scoped to your PointBlank account.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-xs shadow-md shadow-[#005570]/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Doctor Profile</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by doctor name, specialization, or PB-DOC-000001..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#007799] focus:ring-2 focus:ring-[#007799]/20 transition-all"
          />
        </div>
      </div>

      {/* Doctor Cards Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-500 flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#005570]" />
          <p className="text-xs font-medium">Loading PostgreSQL doctor records...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center text-rose-600 flex flex-col items-center space-y-2 pb-card">
          <AlertCircle className="w-6 h-6" />
          <p className="text-xs font-medium">{errorMsg}</p>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="p-12 text-center pb-card flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">No doctor profiles found</p>
            <p className="text-xs text-slate-500">Add a new doctor to get started with video generation.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 px-4 py-2 rounded-lg bg-[#005570] text-white text-xs font-bold hover:bg-[#004055] transition-colors"
          >
            + Add Doctor Profile
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doc) => (
            <div key={doc.id} className="pb-card pb-card-hover p-6 flex flex-col justify-between space-y-4">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-[#005570] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                  {doc.doctor_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#E6F3F7] text-[#005570] mb-1">
                    {doc.doctor_id}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {doc.doctor_name}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">{doc.specialization}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-1">
                  <Video className="w-3.5 h-3.5 text-[#007799]" />
                  <span>{doc.video_count || 0} Videos Generated</span>
                </div>
                <button
                  onClick={() => navigate('/app/create-video')}
                  className="font-bold text-[#007799] hover:underline"
                >
                  Create Video →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Stethoscope className="w-5 h-5 text-[#005570]" />
                <h3 className="text-base font-bold text-slate-900">Add Doctor Profile</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalErr && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {modalErr}
              </div>
            )}

            <form onSubmit={handleCreateDoctor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Doctor Full Name & Credentials
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Alexander Vance, M.D."
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#007799] outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Medical Specialization
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cardiology & Cardiovascular Medicine"
                  value={docSpec}
                  onChange={(e) => setDocSpec(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#007799] outline-hidden font-medium"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-xl bg-[#005570] text-white font-bold text-xs hover:bg-[#004055] transition-colors"
                >
                  {isCreating ? 'Creating Profile...' : 'Save Doctor Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
