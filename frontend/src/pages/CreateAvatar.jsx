import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { doctorApi, avatarLookApi, avatarScenarioApi } from '../api/client';
import {
  Sparkles,
  Upload,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ImageIcon,
  Clock,
  RefreshCw
} from 'lucide-react';

export const CreateAvatar = () => {
  const navigate = useNavigate();
  const { currentDoctor, setCurrentDoctor, setSelectedScenario, setSelectedAvatar } = useApp();

  // Workflow Step (1..6)
  // 1: Select Doctor, 2: Select Look, 3: Upload Photo, 4: Base Avatar Preparation, 5: Generate & Poll Look, 6: Preview & Save
  const [internalStep, setInternalStep] = useState(1);

  // Data Lists
  const [doctors, setDoctors] = useState([]);
  const [looks, setLooks] = useState([]);
  const [loadingLooks, setLoadingLooks] = useState(true);

  // Selected State
  const [selectedDoctorId, setSelectedDoctorId] = useState(currentDoctor?.id || '');
  const [selectedLook, setSelectedLook] = useState(null);

  // Photo & Scenario State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [scenarioId, setScenarioId] = useState(null);
  const [baseLookId, setBaseLookId] = useState(null);
  const [generatedLookId, setGeneratedLookId] = useState(null);
  const [realPreviewUrl, setRealPreviewUrl] = useState(null);

  // Status & Polling
  const [isBaseReady, setIsBaseReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoadingLooks(true);
    try {
      const [docsRes, looksRes] = await Promise.all([
        doctorApi.list().catch(() => ({ data: [] })),
        avatarLookApi.list().catch(() => ({ data: [] }))
      ]);

      const docList = Array.isArray(docsRes.data) ? docsRes.data : [];
      setDoctors(docList);
      if (docList.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docList[0].id);
        if (!currentDoctor) setCurrentDoctor(docList[0]);
      }

      const lookList = Array.isArray(looksRes.data) ? looksRes.data : [];
      setLooks(lookList);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load doctor profiles or Look presets.');
    } finally {
      setLoadingLooks(false);
    }
  };

  const handleDoctorChange = (docId) => {
    setSelectedDoctorId(docId);
    const doc = doctors.find((d) => d.id === docId);
    if (doc) setCurrentDoctor(doc);
  };

  // Step 1 -> Step 2
  const handleProceedToLook = () => {
    if (!selectedDoctorId) {
      setErrorMessage('Please select a Doctor profile.');
      return;
    }
    setErrorMessage(null);
    setInternalStep(2);
  };

  // Step 2 -> Step 3
  const handleSelectLook = (look) => {
    setSelectedLook(look);
    setErrorMessage(null);
  };

  const handleProceedToUpload = () => {
    if (!selectedLook) {
      setErrorMessage('Please select a professional Look preset first.');
      return;
    }
    setErrorMessage(null);
    setInternalStep(3);
  };

  // Step 3: Select Photo
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Please upload a portrait photo in JPG, PNG, or WEBP format.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Image file size must be less than 15MB.');
      return;
    }

    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(objectUrl);
  };

  // Step 3 -> 4: Create Base Photo Avatar and poll until BASE_READY
  const handleStartBaseAvatarCreation = async () => {
    if (!selectedDoctorId || !selectedLook || !photoFile) {
      setErrorMessage('Missing required inputs. Please ensure Doctor, Look, and Photo are selected.');
      return;
    }

    setIsProcessing(true);
    setIsBaseReady(false);
    setErrorMessage(null);

    try {
      setInternalStep(4);
      setProcessingStatusText('Uploading doctor photo and initializing scenario...');

      // 1. Upload Photo
      const uploadFd = new FormData();
      uploadFd.append('file', photoFile);
      uploadFd.append('doctor_id', selectedDoctorId);

      const uploadRes = await avatarScenarioApi.uploadPhoto(uploadFd);
      const scId = uploadRes.data.scenario_id;
      setScenarioId(scId);

      // 2. Submit Base Avatar Request (POST /v3/avatars type=photo)
      setProcessingStatusText('Creating base doctor avatar on HeyGen...');

      const baseFd = new FormData();
      baseFd.append('scenario_id', scId);
      baseFd.append('doctor_id', selectedDoctorId);

      const baseRes = await avatarScenarioApi.createBaseAvatar(baseFd);
      const bLookId = baseRes.data.base_look_id;
      setBaseLookId(bLookId);

      setProcessingStatusText('HeyGen is preparing your base avatar...');

      // 3. Poll GET /v3/avatars/looks/{heygen_base_look_id} until status == base_ready
      startPollingBaseAvatar(scId);

    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setInternalStep(3);
      setErrorMessage(err.message || 'Base Avatar creation failed.');
    }
  };

  const startPollingBaseAvatar = (scId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await avatarScenarioApi.getStatus(scId);
        const data = res.data;

        if (data.status === 'base_ready') {
          clearInterval(pollTimerRef.current);
          setIsBaseReady(true);
          setIsProcessing(false);
          setProcessingStatusText('Base avatar ready ✓');
          if (data.preview_image_url) {
            setPhotoPreviewUrl(data.preview_image_url);
          }
        } else if (data.status === 'failed') {
          clearInterval(pollTimerRef.current);
          setIsProcessing(false);
          setInternalStep(3);
          setErrorMessage(data.error || 'HeyGen reported base avatar preparation failure.');
        } else {
          setProcessingStatusText('HeyGen is preparing your base avatar. Polling status...');
        }
      } catch (pollErr) {
        console.warn('Base polling notice:', pollErr.message);
      }
    }, 3000);
  };

  // Step 4 -> 5: Generate Selected Look (only when Base Avatar is BASE_READY)
  const handleGenerateSelectedLook = async () => {
    if (!scenarioId || !selectedDoctorId || !selectedLook || !isBaseReady) {
      setErrorMessage('Base avatar is still being prepared by HeyGen. Please wait until base avatar is ready.');
      return;
    }

    setIsProcessing(true);
    setInternalStep(5);
    setErrorMessage(null);
    setProcessingStatusText(`HeyGen is generating your '${selectedLook.name}' look...`);

    try {
      const lookFd = new FormData();
      lookFd.append('scenario_id', scenarioId);
      lookFd.append('doctor_id', selectedDoctorId);
      lookFd.append('look_id', selectedLook.id);

      const lookRes = await avatarScenarioApi.generateLook(lookFd);
      const gLookId = lookRes.data.heygen_look_id;
      setGeneratedLookId(gLookId);

      setProcessingStatusText('HeyGen is creating your Professional Doctor look. Polling status...');

      startPollingGeneratedLook(scenarioId);

    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setInternalStep(4);
      setErrorMessage(err.message || 'Look Generation failed.');
    }
  };

  const startPollingGeneratedLook = (scId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await avatarScenarioApi.getStatus(scId);
        const data = res.data;

        if (data.status === 'completed') {
          clearInterval(pollTimerRef.current);
          setRealPreviewUrl(data.preview_image_url);
          setIsProcessing(false);
          setInternalStep(6); // Final Preview & Confirmation
        } else if (data.status === 'failed') {
          clearInterval(pollTimerRef.current);
          setIsProcessing(false);
          setInternalStep(4);
          setErrorMessage(data.error || 'HeyGen reported avatar look creation failure.');
        } else {
          setProcessingStatusText('HeyGen is creating your Professional Doctor look. Status: processing...');
        }
      } catch (pollErr) {
        console.warn('Generated look polling notice:', pollErr.message);
      }
    }, 3000);
  };

  // Step 6: Confirm & Navigate to Avatar Library
  const handleConfirmAndSaveAvatar = () => {
    const activeDoc = doctors.find((d) => d.id === selectedDoctorId) || currentDoctor;
    const avatarObj = {
      type: 'photo',
      avatar_id: generatedLookId || baseLookId,
      talking_photo_id: generatedLookId || baseLookId,
      name: `${activeDoc?.doctor_name || 'Doctor'} — ${selectedLook?.name || 'Avatar'}`,
      preview_image_url: realPreviewUrl || photoPreviewUrl
    };

    setSelectedAvatar(avatarObj);
    navigate('/app/avatars');
  };

  const stepsList = [
    { num: 1, label: 'Doctor' },
    { num: 2, label: 'Select Look' },
    { num: 3, label: 'Upload Photo' },
    { num: 4, label: 'Base Avatar' },
    { num: 5, label: 'HeyGen Look' },
    { num: 6, label: 'Preview & Save' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans select-none text-left pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E6F3F7] text-[#005570] mb-2 border border-[#007799]/20">
            <Sparkles className="w-3.5 h-3.5 text-[#007799]" />
            <span>Official HeyGen V3 Avatar Creation</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Doctor Avatar</h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate professional doctor looks using official HeyGen API (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded">POST /v3/avatars</code>).
          </p>
        </div>

        {/* Doctor Selection Pill */}
        <div className="mt-4 sm:mt-0 flex items-center space-x-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
          <UserCheck className="w-4 h-4 text-[#005570] shrink-0 pl-1" />
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-700">Doctor:</span>
            <select
              value={selectedDoctorId}
              onChange={(e) => handleDoctorChange(e.target.value)}
              className="text-xs font-bold text-[#005570] bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-[#007799]"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.doctor_name} ({d.doctor_id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 6-Step Stepper Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between overflow-x-auto">
          {stepsList.map((s, idx) => {
            const isDone = internalStep > s.num;
            const isCurrent = internalStep === s.num;
            return (
              <React.Fragment key={s.num}>
                <div
                  className={`flex items-center space-x-2 shrink-0 transition-colors ${
                    isCurrent
                      ? 'text-[#005570] font-bold'
                      : isDone
                      ? 'text-emerald-700 font-semibold'
                      : 'text-slate-400 font-medium'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-[#005570] text-white shadow-xs'
                        : isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span className="hidden sm:inline text-xs">{s.label}</span>
                </div>
                {idx < stepsList.length - 1 && (
                  <div className={`flex-1 min-w-[12px] h-0.5 mx-2 ${internalStep > idx + 1 ? 'bg-emerald-200' : 'bg-slate-100'}`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Global Error Notice */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1: SELECT DOCTOR */}
      {internalStep === 1 && (
        <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-[#005570] uppercase tracking-wider">Step 1 of 6</span>
            <h2 className="text-xl font-bold text-slate-900">Select Target Doctor Profile</h2>
            <p className="text-xs text-slate-500 mt-1">Select the doctor profile that will own this AI avatar.</p>
          </div>

          <div className="space-y-3">
            {doctors.map((d) => (
              <div
                key={d.id}
                onClick={() => handleDoctorChange(d.id)}
                className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  selectedDoctorId === d.id
                    ? 'border-[#005570] bg-[#E6F3F7]/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#005570] text-white flex items-center justify-center font-bold text-sm">
                    {d.doctor_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{d.doctor_name}</h3>
                    <p className="text-xs text-slate-500">{d.specialization} • <span className="font-mono">{d.doctor_id}</span></p>
                  </div>
                </div>
                <span className={`text-xs font-bold ${selectedDoctorId === d.id ? 'text-[#005570]' : 'text-slate-400'}`}>
                  {selectedDoctorId === d.id ? '✓ Selected' : 'Select'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={handleProceedToLook}
              className="px-8 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-extrabold text-xs shadow-md shadow-[#005570]/20 flex items-center space-x-2"
            >
              <span>Continue to Look Presets →</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: LOOK LIBRARY */}
      {internalStep === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="text-xs font-bold text-[#005570] uppercase tracking-wider">Step 2 of 6</span>
              <h2 className="text-xl font-bold text-slate-900">Select Professional Look Preset</h2>
            </div>
            <button onClick={() => setInternalStep(1)} className="text-xs font-bold text-[#005570] hover:underline">
              ← Back to Doctor Selection
            </button>
          </div>

          {loadingLooks ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#005570]" />
              <p className="text-xs font-medium">Loading Look Presets...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {looks.map((look) => {
                const isSelected = selectedLook?.id === look.id;
                const lookImgUrl = look.preview_image_url || `/uploads/look_previews/${look.name.toLowerCase().replace(/\s+/g, '_')}.jpg`;
                return (
                  <div
                    key={look.id}
                    onClick={() => handleSelectLook(look)}
                    className={`cursor-pointer rounded-3xl border p-5 bg-white transition-all flex flex-col justify-between hover:border-[#007799] ${
                      isSelected
                        ? 'border-[#005570] ring-2 ring-[#005570]/30 shadow-lg bg-gradient-to-b from-teal-50/20 to-white'
                        : 'border-slate-200 hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Look Preview Picture Container */}
                      <div className="aspect-3/4 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 relative group shadow-xs">
                        <img
                          src={lookImgUrl}
                          alt={look.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/uploads/look_previews/professional_doctor.jpg';
                          }}
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-black/60 text-white backdrop-blur-xs border border-white/20">
                          {look.look_id}
                        </div>
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-[#E6F3F7] text-[#005570] border border-[#007799]/30">
                          {look.aspect_ratio || '16:9'}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base flex items-center justify-between">
                          <span>{look.name}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#005570]" />}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{look.description}</p>
                      </div>

                      <div className="pt-2 text-[11px] text-slate-600 space-y-1 border-t border-slate-100">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Clothing:</span>
                          <strong className="text-slate-900 truncate max-w-[160px]">{look.clothing_style || 'Professional Attire'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Lighting:</span>
                          <strong className="text-slate-900 truncate max-w-[160px]">{look.lighting_style || 'Soft Studio'}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className={`text-xs font-extrabold ${isSelected ? 'text-[#005570]' : 'text-slate-500'}`}>
                        {isSelected ? '✓ Selected Look' : 'Select Look'}
                      </span>
                      <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-[#005570]' : 'text-slate-400'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              onClick={handleProceedToUpload}
              disabled={!selectedLook}
              className="px-8 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-extrabold text-xs shadow-md shadow-[#005570]/20 flex items-center space-x-2 disabled:opacity-40"
            >
              <span>Continue to Upload Photo →</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: UPLOAD DOCTOR PHOTO */}
      {internalStep === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="text-xs font-bold text-[#005570] uppercase tracking-wider">Step 3 of 6</span>
              <h2 className="text-xl font-bold text-slate-900">Upload Doctor Photo</h2>
            </div>
            <button onClick={() => setInternalStep(2)} className="text-xs font-bold text-[#005570] hover:underline">
              ← Change Look ({selectedLook?.name})
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#E6F3F7] border border-[#007799]/20 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#005570] text-white flex items-center justify-center font-mono font-bold text-xs">
                {selectedLook?.look_id}
              </div>
              <div>
                <p className="text-xs font-bold text-[#005570] uppercase tracking-wider">Selected Look Preset</p>
                <p className="text-sm font-extrabold text-slate-900">{selectedLook?.name}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white text-[#005570] border border-[#007799]/20">
              {selectedLook?.aspect_ratio}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-7 space-y-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                    <Upload className="w-4 h-4 text-[#005570]" />
                    <span>Doctor Portrait Photo</span>
                  </span>
                  <span className="text-[10px] text-slate-400">JPG, PNG, WEBP (&lt; 15MB)</span>
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50/50 text-center hover:border-[#007799] transition-colors">
                  <label className="cursor-pointer block">
                    <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <span className="text-xs font-bold text-[#005570] block mb-1">
                      {photoFile ? `Selected: ${photoFile.name}` : 'Drag & Drop Doctor Photo Here or Click to Browse'}
                    </span>
                    <span className="text-[11px] text-slate-400 block max-w-xs mx-auto">
                      Real hospital or portrait photos are accepted. HeyGen performs the visual look generation.
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="md:col-span-5">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block border-b border-slate-100 pb-2">
                  Photo Preview
                </span>

                <div className="aspect-3/4 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center">
                  {photoPreviewUrl ? (
                    <img src={photoPreviewUrl} alt="Doctor Photo" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center text-slate-400 p-6">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">No Photo Selected</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartBaseAvatarCreation}
                  disabled={!photoFile || isProcessing}
                  className="w-full py-3.5 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-extrabold text-xs shadow-md shadow-[#005570]/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create Base Avatar via HeyGen →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: BASE AVATAR PREPARATION VIEW */}
      {internalStep === 4 && (
        <div className="max-w-xl mx-auto p-12 bg-white border border-slate-200 rounded-3xl shadow-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#E6F3F7] text-[#005570] flex items-center justify-center mx-auto border border-[#007799]/20">
            {isBaseReady ? <CheckCircle2 className="w-8 h-8 text-emerald-600" /> : <Loader2 className="w-8 h-8 animate-spin" />}
          </div>

          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {isBaseReady ? 'Base Avatar Ready!' : 'Creating & Preparing Base Avatar...'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
              {isBaseReady
                ? 'Your base photo avatar is ready. You can now generate your selected professional look.'
                : 'HeyGen is preparing your base avatar photo. Polling status via GET /v3/avatars/looks/{heygen_base_look_id}...'}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border font-mono text-xs flex items-center justify-center space-x-2 ${
            isBaseReady ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-[#005570]'
          }`}>
            <Clock className={`w-4 h-4 ${isBaseReady ? 'text-emerald-600' : 'animate-spin text-[#007799]'}`} />
            <span>{processingStatusText}</span>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-center">
            <button
              onClick={handleGenerateSelectedLook}
              disabled={!isBaseReady || isProcessing}
              className="px-8 py-3.5 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-extrabold text-xs shadow-md shadow-[#005570]/20 flex items-center space-x-2 disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Selected Look ({selectedLook?.name}) →</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: HEYGEN LOOK GENERATION POLLING */}
      {internalStep === 5 && (
        <div className="max-w-xl mx-auto p-12 bg-white border border-slate-200 rounded-3xl shadow-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#E6F3F7] text-[#005570] flex items-center justify-center mx-auto border border-[#007799]/20">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>

          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Generating Professional Doctor Look...
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
              HeyGen is generating your <strong className="text-slate-800">{selectedLook?.name}</strong> look from base avatar ID <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{baseLookId}</code>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs text-[#005570] flex items-center justify-center space-x-2">
            <Clock className="w-4 h-4 animate-spin text-[#007799]" />
            <span>{processingStatusText}</span>
          </div>
        </div>
      )}

      {/* STEP 6: REAL HEYGEN PREVIEW & CONFIRMATION */}
      {internalStep === 6 && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="text-xs font-bold text-[#005570] uppercase tracking-wider">Step 6 of 6</span>
              <h2 className="text-xl font-bold text-slate-900">Your Professional HeyGen Avatar</h2>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Status: READY</span>
            </span>
          </div>

          {/* Real HeyGen Preview Image */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-md space-y-6 text-center">
            <div className="max-w-md mx-auto aspect-3/4 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-xs relative">
              <img
                src={realPreviewUrl || photoPreviewUrl}
                alt="Real HeyGen Generated Avatar"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-left grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Doctor Profile</span>
                <strong className="text-slate-900">{currentDoctor?.doctor_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Selected Look</span>
                <strong className="text-[#005570]">{selectedLook?.name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">HeyGen Look ID</span>
                <strong className="text-slate-900 font-mono text-[11px] truncate block">{generatedLookId || baseLookId}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Base Look ID</span>
                <strong className="text-slate-900 font-mono text-[11px] truncate block">{baseLookId}</strong>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setInternalStep(2)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                ← Select Different Look
              </button>

              <button
                onClick={handleConfirmAndSaveAvatar}
                className="px-8 py-3 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-extrabold text-xs shadow-md shadow-[#005570]/20 flex items-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Use This Avatar →</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
