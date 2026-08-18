import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { doctorApi, heyGenApi, avatarScenarioApi } from '../api/client';
import {
  Sparkles,
  Upload,
  UserCheck,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ImageIcon,
  Clock,
  RefreshCw,
  Tag
} from 'lucide-react';
import { Stepper } from '../components/ui/Stepper';
import { AlertBanner } from '../components/ui/AlertBanner';
import { SlateTag } from '../components/ui/SlateTag';

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
  const [looksError, setLooksError] = useState(null);
  const [visibleLooksCount, setVisibleLooksCount] = useState(12);

  // Selected State
  const [selectedDoctorId, setSelectedDoctorId] = useState(currentDoctor?.id || '');
  const [selectedLook, setSelectedLook] = useState(null);

  // Photo & Scenario State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [originalPhotoPreviewUrl, setOriginalPhotoPreviewUrl] = useState(null);
  const [scenarioId, setScenarioId] = useState(null);
  const [avatarScenarioBusinessId, setAvatarScenarioBusinessId] = useState(null);
  const [baseLookId, setBaseLookId] = useState(null);
  const [generatedLookId, setGeneratedLookId] = useState(null);
  const [realPreviewUrl, setRealPreviewUrl] = useState(null);

  // Status & Polling
  const [isBaseReady, setIsBaseReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const pollTimerRef = useRef(null);

  // Bumped on every doctor switch / new-avatar reset. Poll callbacks capture the token
  // in effect when they started and drop their result if it no longer matches — this
  // stops a late-arriving response from an abandoned session overwriting current state.
  const sessionTokenRef = useRef(0);

  useEffect(() => {
    fetchInitialData();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoadingLooks(true);
    setLooksError(null);
    try {
      const docsRes = await doctorApi.list().catch(() => ({ data: [] }));
      const docList = Array.isArray(docsRes.data) ? docsRes.data : [];
      setDoctors(docList);
      if (docList.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docList[0].id);
        if (!currentDoctor) setCurrentDoctor(docList[0]);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load doctor profiles.');
    }

    // Real HeyGen Avatar Look library — GET /v3/avatars/looks via PointBlank backend.
    // Backend aggregates photo_avatar + studio_avatar presets, ranks by real
    // professional-appearance signal, and interleaves by gender.
    try {
      const looksRes = await heyGenApi.listAvatarLooks({ ownership: 'public' });
      const lookList = Array.isArray(looksRes.data?.data) ? looksRes.data.data : [];
      setLooks(lookList);
      setVisibleLooksCount(12);
    } catch (err) {
      console.error(err);
      setLooksError('Unable to load avatar looks. Please try again.');
    } finally {
      setLoadingLooks(false);
    }
  };

  const handleLoadMoreLooks = () => {
    setVisibleLooksCount((prev) => Math.min(prev + 12, looks.length));
  };

  const handleDoctorChange = (docId) => {
    const doc = doctors.find((d) => d.id === docId);
    const isDoctorSwitch = docId !== selectedDoctorId;

    setSelectedDoctorId(docId);
    if (doc) setCurrentDoctor(doc);

    if (isDoctorSwitch) {
      // Avoid mixing another doctor's in-progress photo/scenario with the newly selected doctor
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      sessionTokenRef.current += 1;
      setSelectedLook(null);
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setOriginalPhotoPreviewUrl(null);
      setScenarioId(null);
      setAvatarScenarioBusinessId(null);
      setBaseLookId(null);
      setGeneratedLookId(null);
      setRealPreviewUrl(null);
      setIsBaseReady(false);
      setIsProcessing(false);
      setErrorMessage(null);
      setInternalStep(1);
    }
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
      setErrorMessage('Please select an Avatar Look first.');
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
    setOriginalPhotoPreviewUrl(objectUrl);
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
      setAvatarScenarioBusinessId(uploadRes.data.avatar_scenario_id || null);

      // 2. Submit Base Avatar Request (POST /v3/avatars type=photo)
      setProcessingStatusText('Creating base doctor avatar...');

      const baseFd = new FormData();
      baseFd.append('scenario_id', scId);
      baseFd.append('doctor_id', selectedDoctorId);

      const baseRes = await avatarScenarioApi.createBaseAvatar(baseFd);
      const bLookId = baseRes.data.base_look_id;
      setBaseLookId(bLookId);

      setProcessingStatusText('Preparing your base avatar...');

      // 3. Poll GET /v3/avatars/looks/{heygen_base_look_id} until status == base_ready
      startPollingBaseAvatar(scId, sessionTokenRef.current);

    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setInternalStep(3);
      setErrorMessage(err.message || 'Base Avatar creation failed.');
    }
  };

  const startPollingBaseAvatar = (scId, sessionToken) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await avatarScenarioApi.getStatus(scId);
        if (sessionToken !== sessionTokenRef.current) {
          // A doctor switch or new-avatar reset happened while this request was in
          // flight — discard it so it can never write into the newer session's state.
          clearInterval(pollTimerRef.current);
          return;
        }
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
          setErrorMessage(data.error || 'Base avatar preparation failed.');
        } else {
          setProcessingStatusText('Preparing your base avatar. Checking status...');
        }
      } catch (pollErr) {
        console.warn('Base polling notice:', pollErr.message);
      }
    }, 3000);
  };

  // Step 4 -> 5: Generate Selected Look (only when Base Avatar is BASE_READY)
  const handleGenerateSelectedLook = async () => {
    // The selected Look must never silently fall back to a previous Look — stop and
    // require an explicit selection instead of proceeding with stale/missing data.
    if (!selectedLook) {
      setErrorMessage('Please select an avatar look before generating.');
      return;
    }
    if (!scenarioId || !selectedDoctorId || !isBaseReady) {
      setErrorMessage('Base avatar is still being prepared. Please wait until it is ready.');
      return;
    }

    const mySessionToken = sessionTokenRef.current;
    setIsProcessing(true);
    setInternalStep(5);
    setErrorMessage(null);
    setProcessingStatusText(`Generating your '${selectedLook.name}' look...`);

    try {
      const lookFd = new FormData();
      lookFd.append('scenario_id', scenarioId);
      lookFd.append('doctor_id', selectedDoctorId);
      lookFd.append('heygen_look_id', selectedLook.id);
      lookFd.append('heygen_look_name', selectedLook.name || '');
      if (selectedLook.preview_image_url) {
        lookFd.append('heygen_look_preview_image_url', selectedLook.preview_image_url);
      }
      if (selectedLook.avatar_type) {
        lookFd.append('heygen_look_avatar_type', selectedLook.avatar_type);
      }
      if (Array.isArray(selectedLook.tags) && selectedLook.tags.length > 0) {
        lookFd.append('heygen_look_tags', selectedLook.tags.join(','));
      }

      // Verify the exact identity being sent before it leaves the browser.
      console.log('[CreateAvatar] generate-look request:', {
        doctor_id: selectedDoctorId,
        scenario_id: scenarioId,
        selected_look_id: selectedLook.id,
        selected_look_name: selectedLook.name,
        selected_look_preview: selectedLook.preview_image_url,
        base_look_id: baseLookId
      });

      const lookRes = await avatarScenarioApi.generateLook(lookFd);
      const gLookId = lookRes.data.heygen_look_id;
      setGeneratedLookId(gLookId);

      setProcessingStatusText('Creating your Professional Doctor look. Checking status...');

      startPollingGeneratedLook(scenarioId, mySessionToken);

    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setInternalStep(4);
      setErrorMessage(err.message || 'Look Generation failed.');
    }
  };

  const startPollingGeneratedLook = (scId, sessionToken) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await avatarScenarioApi.getStatus(scId);
        if (sessionToken !== sessionTokenRef.current) {
          clearInterval(pollTimerRef.current);
          return;
        }
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
          setErrorMessage(data.error || 'Avatar look creation failed.');
        } else {
          setProcessingStatusText('Creating your Professional Doctor look. Status: processing...');
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
    navigate(activeDoc ? `/app/doctors/${activeDoc.id}` : '/app/doctors');
  };

  // Starts a brand-new avatar creation session for the same doctor without navigating
  // away. Clears every avatar-creation-specific field (Look, photo, scenario, base avatar,
  // generated look, preview, status/error) so nothing from the previous Look/session can
  // leak into the next one. Doctor profile and app-wide state are intentionally untouched.
  const handleStartNewAvatar = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    sessionTokenRef.current += 1;

    setSelectedLook(null);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setOriginalPhotoPreviewUrl(null);
    setScenarioId(null);
    setAvatarScenarioBusinessId(null);
    setBaseLookId(null);
    setGeneratedLookId(null);
    setRealPreviewUrl(null);
    setIsBaseReady(false);
    setIsProcessing(false);
    setProcessingStatusText('');
    setErrorMessage(null);
    setInternalStep(2);
  };

  const stepsList = [
    { key: 'doctor', label: 'Doctor', description: 'Who this avatar is for' },
    { key: 'look', label: 'Avatar look', description: 'Choose a professional style' },
    { key: 'photo', label: 'Upload photo', description: 'The real doctor photo' },
    { key: 'base', label: 'Base avatar', description: 'AI prepares the likeness' },
    { key: 'generate', label: 'Generate look', description: 'Applying the chosen style' },
    { key: 'preview', label: 'Preview & save', description: 'Confirm and use it' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-7 font-sans select-none text-left pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-line pb-6 pb-reveal">
        <div>
          <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.16em]">Create · Avatar</span>
          <h1 className="font-display text-3xl text-ink tracking-tight">Create doctor avatar</h1>
          <p className="text-sm text-ink-soft mt-1">
            Generate a professional on-screen look from a real doctor photo.
          </p>
        </div>

        {/* Doctor Selection Pill */}
        <div className="mt-4 sm:mt-0 flex items-center gap-3 bg-surface p-2 rounded-2xl border border-line shadow-panel">
          <UserCheck className="w-4 h-4 text-signal shrink-0 pl-1" strokeWidth={1.75} />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-soft">Doctor:</span>
            <select
              value={selectedDoctorId}
              onChange={(e) => handleDoctorChange(e.target.value)}
              className="text-xs font-semibold text-signal bg-surface-sunken border border-line rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-accent"
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

      {/* Stepper */}
      <div className="pb-card p-5 pb-reveal" style={{ '--pb-i': 1 }}>
        <Stepper steps={stepsList} currentIndex={internalStep - 1} />
      </div>

      {/* Global Error Notice */}
      {errorMessage && (
        <div className="flex items-start justify-between gap-3">
          <AlertBanner className="flex-1">{errorMessage}</AlertBanner>
          <button onClick={() => setErrorMessage(null)} className="text-error text-xs font-semibold hover:underline shrink-0 mt-1">
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1: SELECT DOCTOR */}
      {internalStep === 1 && (
        <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-surface border border-line shadow-panel space-y-6">
          <div className="border-b border-line pb-3">
            <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.14em]">Step 1 of 6</span>
            <h2 className="font-display text-xl text-ink">Select target doctor profile</h2>
            <p className="text-xs text-ink-muted mt-1">Select the doctor profile that will own this avatar.</p>
          </div>

          <div className="space-y-3">
            {doctors.map((d) => (
              <div
                key={d.id}
                onClick={() => handleDoctorChange(d.id)}
                className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  selectedDoctorId === d.id
                    ? 'border-signal bg-signal-soft shadow-panel'
                    : 'border-line hover:border-line-strong bg-surface'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-signal text-white flex items-center justify-center font-semibold text-sm">
                    {d.doctor_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-sm">{d.doctor_name}</h3>
                    <p className="text-xs text-ink-muted">{d.specialization} · <span className="font-mono">{d.doctor_id}</span></p>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${selectedDoctorId === d.id ? 'text-signal' : 'text-ink-muted'}`}>
                  {selectedDoctorId === d.id ? '✓ Selected' : 'Select'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-line">
            <button
              onClick={handleProceedToLook}
              className="px-8 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs shadow-cta flex items-center gap-2"
            >
              <span>Continue to avatar looks →</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: HEYGEN AVATAR LOOK LIBRARY (real GET /v3/avatars/looks) */}
      {internalStep === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.14em]">Step 2 of 6</span>
              <h2 className="font-display text-xl text-ink">Avatar looks</h2>
              <p className="text-xs text-ink-muted mt-1">
                Select the professional style to apply to the doctor's photo.
              </p>
            </div>
            <button onClick={() => setInternalStep(1)} className="text-xs font-semibold text-signal hover:underline shrink-0">
              ← Back to doctor selection
            </button>
          </div>

          {looksError && <AlertBanner>{looksError}</AlertBanner>}

          {loadingLooks ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-line bg-surface overflow-hidden animate-pulse">
                  <div className="aspect-video bg-surface-sunken" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-2/3 bg-surface-sunken rounded" />
                    <div className="h-2.5 w-1/2 bg-surface-sunken rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : looks.length === 0 ? (
            !looksError && (
              <div className="p-12 text-center bg-surface border border-line rounded-2xl text-ink-muted">
                <ImageIcon className="w-10 h-10 mx-auto text-ink-muted mb-3" />
                <p className="text-sm font-semibold text-ink-soft">No avatar looks are currently available.</p>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {looks.slice(0, visibleLooksCount).map((look) => {
                const isSelected = selectedLook?.id === look.id;
                const realTags = Array.isArray(look.tags)
                  ? look.tags.filter((t) => t && !String(t).startsWith('AvatarTags.'))
                  : [];
                return (
                  <div
                    key={look.id}
                    onClick={() => handleSelectLook(look)}
                    className={`cursor-pointer rounded-2xl border bg-surface transition-all overflow-hidden flex flex-col hover:border-accent ${
                      isSelected
                        ? 'border-signal ring-2 ring-signal/25 shadow-panel'
                        : 'border-line hover:shadow-panel'
                    }`}
                  >
                    {/* Real HeyGen Preview Image — wide rectangular, uncropped face/upper body */}
                    <div className="aspect-video bg-surface-sunken relative group overflow-hidden">
                      {look.preview_image_url ? (
                        <img
                          src={look.preview_image_url}
                          alt={look.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-ink-muted">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-signal text-white flex items-center justify-center shadow-panel">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col grow">
                      <h3 className="font-semibold text-ink text-sm truncate">{look.name}</h3>
                      <p className="text-[11px] text-ink-muted mt-0.5 capitalize">
                        {[look.gender, look.avatar_type?.replace('_', ' ')].filter(Boolean).join(' · ')}
                      </p>
                      {realTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {realTags.slice(0, 3).map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-signal-soft text-signal">
                              <Tag className="w-2.5 h-2.5" />
                              <span>{t}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-signal' : 'text-ink-muted'}`}>
                          {isSelected ? '✓ Selected' : 'Select look'}
                        </span>
                        <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-signal' : 'text-ink-muted'}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loadingLooks && visibleLooksCount < looks.length && (
            <div className="flex justify-center">
              <button
                onClick={handleLoadMoreLooks}
                className="px-6 py-2.5 rounded-xl border border-line bg-surface hover:bg-surface-sunken text-ink-soft font-semibold text-xs shadow-panel flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Load more looks</span>
              </button>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-line">
            <button
              onClick={handleProceedToUpload}
              disabled={!selectedLook}
              className="px-8 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs shadow-cta flex items-center gap-2 disabled:opacity-40"
            >
              <span>Continue to upload photo →</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: UPLOAD DOCTOR PHOTO */}
      {internalStep === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.14em]">Step 3 of 6</span>
              <h2 className="font-display text-xl text-ink">Upload doctor photo</h2>
            </div>
            <button onClick={() => setInternalStep(2)} className="text-xs font-semibold text-signal hover:underline">
              ← Change look ({selectedLook?.name})
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-signal-soft border border-signal/15 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface border border-signal/15 shrink-0">
                {selectedLook?.preview_image_url ? (
                  <img src={selectedLook.preview_image_url} alt={selectedLook?.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-signal">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-signal uppercase tracking-wider">Selected avatar look</p>
                <p className="text-sm font-semibold text-ink truncate">{selectedLook?.name}</p>
                <SlateTag className="mt-1">{selectedLook?.id}</SlateTag>
              </div>
            </div>
            {selectedLook?.avatar_type && (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-surface text-signal border border-signal/15 shrink-0">
                {selectedLook.avatar_type}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-7 space-y-6">
              <div className="p-6 rounded-2xl bg-surface border border-line shadow-panel space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-2">
                    <Upload className="w-4 h-4 text-signal" strokeWidth={1.75} />
                    <span>Doctor portrait photo</span>
                  </span>
                  <span className="text-[10px] text-ink-muted">JPG, PNG, WEBP (&lt; 15MB)</span>
                </div>

                <div className="border-2 border-dashed border-line rounded-2xl p-8 bg-surface-sunken text-center hover:border-accent transition-colors">
                  <label className="cursor-pointer block">
                    <ImageIcon className="w-10 h-10 text-ink-muted mx-auto mb-3" />
                    <span className="text-xs font-semibold text-signal block mb-1">
                      {photoFile ? `Selected: ${photoFile.name}` : 'Drag & drop doctor photo here or click to browse'}
                    </span>
                    <span className="text-[11px] text-ink-muted block max-w-xs mx-auto">
                      Real hospital or portrait photos are accepted.
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
              <div className="p-5 rounded-2xl bg-surface border border-line shadow-panel space-y-4">
                <span className="text-xs font-semibold text-ink uppercase tracking-wider block border-b border-line pb-2">
                  Photo preview
                </span>

                <div className="aspect-3/4 bg-surface-sunken rounded-2xl border border-line overflow-hidden flex items-center justify-center">
                  {photoPreviewUrl ? (
                    <img src={photoPreviewUrl} alt="Doctor Photo" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center text-ink-muted p-6">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-ink-soft">No photo selected</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartBaseAvatarCreation}
                  disabled={!photoFile || isProcessing}
                  className="w-full py-3.5 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs shadow-cta transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create base avatar →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: BASE AVATAR PREPARATION VIEW */}
      {internalStep === 4 && (
        <div className="max-w-xl mx-auto p-12 bg-surface border border-line rounded-3xl shadow-panel text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-signal-soft text-signal flex items-center justify-center mx-auto border border-signal/15">
            {isBaseReady ? <CheckCircle2 className="w-8 h-8 text-success" /> : <Loader2 className="w-8 h-8 animate-spin" />}
          </div>

          <div>
            <h3 className="font-display text-2xl text-ink tracking-tight">
              {isBaseReady ? 'Base avatar ready' : 'Creating & preparing base avatar…'}
            </h3>
            <p className="text-xs text-ink-muted mt-2 leading-relaxed max-w-md mx-auto">
              {isBaseReady
                ? 'Your base photo avatar is ready. You can now generate your selected professional look.'
                : 'Preparing your base avatar photo. Checking status...'}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border font-mono text-xs flex items-center justify-center gap-2 ${
            isBaseReady ? 'bg-success-soft border-success/25 text-success' : 'bg-surface-sunken border-line text-signal'
          }`}>
            <Clock className={`w-4 h-4 ${isBaseReady ? 'text-success' : 'animate-spin text-accent'}`} />
            <span>{processingStatusText}</span>
          </div>

          {/* Generation confirmation — exact data that will be sent to generate-look */}
          <div className="p-4 rounded-2xl bg-surface-sunken border border-line text-left space-y-3">
            <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block">
              Will generate using
            </span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface border border-line shrink-0">
                {selectedLook?.preview_image_url ? (
                  <img src={selectedLook.preview_image_url} alt={selectedLook?.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-muted">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-ink truncate">{selectedLook?.name || '—'}</p>
                <SlateTag className="mt-1">{selectedLook?.id || '—'}</SlateTag>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-line">
              <div>
                <span className="text-ink-muted block text-[10px] uppercase font-semibold">Doctor</span>
                <strong className="text-ink">{currentDoctor?.doctor_name || '—'}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px] uppercase font-semibold">Base avatar ID</span>
                <strong className="text-ink font-mono truncate block">{baseLookId || '—'}</strong>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-line flex justify-center">
            <button
              onClick={handleGenerateSelectedLook}
              disabled={!isBaseReady || isProcessing}
              className="px-8 py-3.5 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs shadow-cta flex items-center gap-2 disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate selected look ({selectedLook?.name}) →</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: HEYGEN LOOK GENERATION POLLING */}
      {internalStep === 5 && (
        <div className="max-w-xl mx-auto p-12 bg-surface border border-line rounded-3xl shadow-panel text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-signal-soft text-signal flex items-center justify-center mx-auto border border-signal/15">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>

          <div>
            <h3 className="font-display text-2xl text-ink tracking-tight">
              Generating professional doctor look…
            </h3>
            <p className="text-xs text-ink-muted mt-2 leading-relaxed max-w-md mx-auto">
              Generating your <strong className="text-ink-soft">{selectedLook?.name}</strong> look from base avatar reference <code className="font-mono bg-surface-sunken px-1 py-0.5 rounded">{baseLookId}</code>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-sunken border border-line font-mono text-xs text-signal flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin text-accent" />
            <span>{processingStatusText}</span>
          </div>
        </div>
      )}

      {/* STEP 6: REAL HEYGEN PREVIEW & CONFIRMATION */}
      {internalStep === 6 && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <span className="font-mono text-[11px] font-medium text-accent uppercase tracking-[0.14em]">Step 6 of 6</span>
              <h2 className="font-display text-xl text-ink">Your professional avatar</h2>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-success-soft text-success flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ready</span>
            </span>
          </div>

          {/* Original Photo vs Real HeyGen Generated Avatar */}
          <div className="p-6 rounded-3xl bg-surface border border-line shadow-panel space-y-6 text-center">
            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
              <div>
                <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider block mb-2">Original photo</span>
                <div className="aspect-3/4 bg-surface-sunken rounded-2xl overflow-hidden border border-line shadow-panel">
                  <img
                    src={originalPhotoPreviewUrl}
                    alt="Original Doctor Photo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-signal uppercase tracking-wider block mb-2">Generated avatar</span>
                <div className="aspect-3/4 bg-surface-sunken rounded-2xl overflow-hidden border border-signal/25 shadow-panel">
                  <img
                    src={realPreviewUrl}
                    alt="Generated Avatar"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-sunken border border-line text-xs text-left grid grid-cols-2 gap-4">
              <div>
                <span className="text-ink-muted block text-[10px] uppercase font-semibold">Doctor profile</span>
                <strong className="text-ink">{currentDoctor?.doctor_name}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px] uppercase font-semibold">Selected look</span>
                <strong className="text-signal">{selectedLook?.name}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px] uppercase font-semibold">PointBlank avatar ID</span>
                <strong className="text-ink font-mono text-[11px] truncate block">{avatarScenarioBusinessId || '—'}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px] uppercase font-semibold">Look ID</span>
                <strong className="text-ink font-mono text-[11px] truncate block">{generatedLookId || baseLookId}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px] uppercase font-semibold">Base look ID</span>
                <strong className="text-ink font-mono text-[11px] truncate block">{baseLookId}</strong>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-line">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInternalStep(2)}
                  className="px-5 py-2.5 rounded-xl border border-line text-ink-soft font-semibold text-xs hover:bg-surface-sunken"
                >
                  ← Select different look
                </button>
                <button
                  onClick={handleStartNewAvatar}
                  className="px-5 py-2.5 rounded-xl border border-line text-ink-soft font-semibold text-xs hover:bg-surface-sunken"
                >
                  Create another avatar
                </button>
              </div>

              <button
                onClick={handleConfirmAndSaveAvatar}
                className="px-8 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-xs shadow-cta flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Use this avatar →</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
