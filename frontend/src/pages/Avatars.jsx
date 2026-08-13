import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { avatarScenarioApi, heyGenApi } from '../api/client';
import { UserRound, Loader2, Sparkles, AlertCircle, Search, Layers, Trash2, Video, CheckCircle2 } from 'lucide-react';

export const Avatars = () => {
  const navigate = useNavigate();
  const { setSelectedScenario, setSelectedAvatar, setActiveStep } = useApp();
  const [activeTab, setActiveTab] = useState('scenarios'); // 'scenarios', 'catalog'
  const [scenarios, setScenarios] = useState([]);
  const [heygenAvatars, setHeygenAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch saved Avatar Scenarios — only READY ones are real, usable HeyGen avatars
      const resSc = await avatarScenarioApi.list().catch(() => ({ data: [] }));
      const allScenarios = Array.isArray(resSc.data) ? resSc.data : [];
      setScenarios(allScenarios.filter((s) => s.creation_status === 'READY'));

      // 2. Fetch HeyGen catalog
      const resHg = await heyGenApi.getAvatars().catch(() => ({ data: { avatars: [] } }));
      const rawAv = resHg.data?.avatars || resHg.data?.data?.avatars || resHg.data || [];
      setHeygenAvatars(Array.isArray(rawAv) ? rawAv : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load avatar resources');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScenario = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Avatar Scenario? Existing generated videos will be preserved.')) return;
    try {
      await avatarScenarioApi.delete(id);
      setScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete scenario');
    }
  };

  const handleUseScenarioInStudio = (sc) => {
    setSelectedScenario(sc);
    setSelectedAvatar({
      type: sc.avatar_type || 'photo',
      avatar_id: sc.heygen_avatar_id,
      talking_photo_id: sc.heygen_talking_photo_id,
      name: sc.name,
      preview_image_url: sc.photo_url
    });
    setActiveStep(3); // Jump straight to Voice Selection step in Studio
    navigate('/app/create-video');
  };

  const filteredScenarios = scenarios.filter((s) =>
    (s.name || s.avatar_scenario_id || s.doctor_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredCatalog = heygenAvatars.filter((a) =>
    (a.avatar_name || a.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 select-none font-sans text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E6F3F7] text-[#005570] mb-1">
            <Layers className="w-3.5 h-3.5 text-[#007799]" />
            <span>Doctor Avatar Scenarios</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Doctor Avatar Library</h2>
          <p className="text-xs text-slate-500">
            Real HeyGen Photo Avatars created for Doctors (PB-AVT-xxxx) ready for video generation.
          </p>
        </div>

        <button
          onClick={() => navigate('/app/create-avatar')}
          className="px-5 py-2.5 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-xs shadow-md shadow-[#005570]/20 flex items-center space-x-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Create New Doctor Avatar</span>
        </button>
      </div>


      {/* Tabs & Search Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex space-x-2 bg-slate-100 p-1.5 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'scenarios' ? 'bg-[#005570] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Doctor Avatars ({scenarios.length})
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'catalog' ? 'bg-[#005570] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            HeyGen Studio Catalog ({heygenAvatars.length})
          </button>
        </div>

        <div className="w-full sm:w-64 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scenarios..."
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
          <p className="text-xs font-medium">Loading Doctor Avatar Library...</p>
        </div>
      ) : activeTab === 'scenarios' ? (
        <>
          {filteredScenarios.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 space-y-3">
              <UserRound className="w-10 h-10 mx-auto text-slate-300" />
              <div>
                <p className="text-sm font-bold text-slate-700">No Doctor Avatars Created Yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">Select an Avatar Scenario and upload a Doctor photo to create a real HeyGen Photo Avatar.</p>
              </div>
              <button
                onClick={() => navigate('/app/create-video')}
                className="px-5 py-2.5 rounded-xl bg-[#005570] text-white text-xs font-bold shadow-sm"
              >
                Create Doctor Avatar →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredScenarios.map((sc) => (
                <div
                  key={sc.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-[#007799] transition-all flex flex-col justify-between"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E6F3F7] text-[#005570] border border-[#007799]/20">
                        {sc.avatar_scenario_id}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>READY</span>
                      </span>
                    </div>

                    <div className="aspect-3/4 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-100">
                      {sc.photo_url ? (
                        <img src={sc.photo_url} alt={sc.name} className="w-full h-full object-cover" />
                      ) : (
                        <UserRound className="w-10 h-10 text-slate-300" />
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{sc.name}</h4>
                      <p className="text-xs text-slate-500">Doctor: {sc.doctor_name || 'Assigned Doctor'}</p>
                      <p className="text-[10px] text-slate-400 capitalize mt-0.5">Frame: {sc.aspect_ratio} • {sc.background_type}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => handleDeleteScenario(sc.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Scenario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleUseScenarioInStudio(sc)}
                      className="px-3 py-1.5 rounded-lg bg-[#005570] hover:bg-[#004055] text-white text-xs font-bold shadow-xs"
                    >
                      Use Avatar →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredCatalog.slice(0, 48).map((av, idx) => {
            const name = av.avatar_name || av.name || `Avatar #${idx + 1}`;
            const preview = av.preview_image_url || av.preview_url || av.thumbnail_url;
            return (
              <div key={av.avatar_id || idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col group hover:border-[#007799] transition-all">
                <div className="aspect-3/4 bg-slate-100 relative overflow-hidden">
                  {preview ? (
                    <img src={preview} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                      <UserRound className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white">
                  <p className="text-xs font-bold text-slate-900 truncate">{name}</p>
                  <p className="text-[10px] font-mono text-slate-400 truncate">{av.avatar_id || 'Public'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
