import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { heyGenApi } from '../../api/client';
import { UserCheck, Upload, AlertCircle, CheckCircle2, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';

export const AvatarSelector = () => {
  const { selectedAvatar, setSelectedAvatar, setActiveStep } = useApp();
  
  const [activeTab, setActiveTab] = useState('studio'); // Default tab: 'studio' (verified public studio avatars)
  const [avatarsList, setAvatarsList] = useState([]);
  const [avatarsV3List, setAvatarsV3List] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Photo Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(null);

  useEffect(() => {
    fetchAvatars();
  }, []);

  const fetchAvatars = async () => {
    setLoading(true);
    setError(null);
    try {
      const resV2 = await heyGenApi.getAvatars().catch(() => ({ data: { avatars: [] } }));
      const rawV2 = resV2.data?.avatars || resV2.data?.data?.avatars || resV2.data || [];
      const studioAvatars = Array.isArray(rawV2) ? rawV2 : [];

      // Filter Avatar IV (v3 Engine) candidates from live working catalog
      const v3ExpressiveAvatars = studioAvatars.filter(av => 
        (av.avatar_id || '').toLowerCase().includes('expressive') || 
        (av.preview_image_url || '').includes('/v3/')
      );

      setAvatarsList(studioAvatars);
      setAvatarsV3List(v3ExpressiveAvatars.length > 0 ? v3ExpressiveAvatars : studioAvatars);

      // Initialize default selected avatar with a verified Studio Avatar from live catalog
      if (studioAvatars.length > 0 && !selectedAvatar) {
        const firstAv = studioAvatars[0];
        setSelectedAvatar({
          type: 'public',
          engine: 'v2',
          avatar_id: firstAv.avatar_id,
          name: firstAv.avatar_name || firstAv.name || 'Studio Avatar',
          gender: firstAv.gender,
          preview_image_url: firstAv.preview_image_url,
          preview_video_url: firstAv.preview_video_url
        });
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load avatars.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      setPhotoError('Only JPG, PNG, and WEBP image formats are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Image file size must be less than 10MB.');
      return;
    }

    setUploading(true);
    setPhotoError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', 'Doctor Photo Avatar');

    try {
      const res = await heyGenApi.uploadPhotoAvatar(formData);
      const data = res.data;
      
      const photoAvObj = {
        type: 'photo',
        talking_photo_id: data.talking_photo_id,
        name: 'Doctor Photo Avatar',
        preview_image_url: URL.createObjectURL(file)
      };

      setUploadedPhoto(photoAvObj);
      setSelectedAvatar(photoAvObj);
    } catch (err) {
      console.error(err);
      setPhotoError(err.message || 'Photo avatar creation failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const tabBase = 'px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5';
  const tabActive = 'bg-[#005570] text-white shadow-md shadow-[#005570]/20';
  const tabInactive = 'text-slate-500 hover:text-slate-700 hover:bg-slate-100';

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E6F3F7] text-[#005570] border border-[#007799]/20 mb-4">
          <UserCheck className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Select Avatar</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto">
          Choose a Studio Avatar or upload a doctor photo to create a Photo Avatar.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-100 border border-slate-200 p-1.5 rounded-2xl flex space-x-1">
          <button
            onClick={() => setActiveTab('studio')}
            className={`${tabBase} ${activeTab === 'studio' ? tabActive : tabInactive}`}
          >
            Studio Avatars ({avatarsList.length})
          </button>
          <button
            onClick={() => setActiveTab('avatar_iv')}
            className={`${tabBase} ${activeTab === 'avatar_iv' ? tabActive : tabInactive}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Avatar IV (v3 Engine) ({avatarsV3List.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('photo')}
            className={`${tabBase} ${activeTab === 'photo' ? tabActive : tabInactive}`}
          >
            Photo Avatar Upload
          </button>
          <button
            onClick={() => setActiveTab('instant')}
            className={`${tabBase} ${activeTab === 'instant' ? tabActive : tabInactive}`}
          >
            Instant Avatars
          </button>
        </div>
      </div>

      {/* Tab 1: Studio Avatars (Default) */}
      {activeTab === 'studio' && (
        <>
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#005570] animate-spin mb-3" />
              <p className="text-slate-500 text-sm">Loading avatars...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {avatarsList.map((av) => {
                const isSelected = selectedAvatar?.type === 'public' && selectedAvatar?.avatar_id === av.avatar_id && selectedAvatar?.engine !== 'avatar_iv';
                return (
                  <div
                    key={av.avatar_id}
                    onClick={() => {
                      setSelectedAvatar({
                        type: 'public',
                        engine: 'v2',
                        avatar_id: av.avatar_id,
                        name: av.avatar_name || av.name || 'Studio Avatar',
                        gender: av.gender,
                        preview_image_url: av.preview_image_url,
                        preview_video_url: av.preview_video_url
                      });
                    }}
                    className={`cursor-pointer group relative rounded-2xl overflow-hidden border transition-all ${
                      isSelected
                        ? 'border-[#005570] ring-2 ring-[#005570]/30 shadow-xl shadow-[#005570]/15'
                        : 'border-slate-200 hover:border-[#007799]/50 hover:shadow-md'
                    }`}
                  >
                    <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                      <img
                        src={av.preview_image_url}
                        alt={av.avatar_name || av.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-[#005570] text-white p-1.5 rounded-full shadow-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-white text-left">
                      <h4 className="font-bold text-slate-900 text-xs truncate">{av.avatar_name || av.name}</h4>
                      <p className="text-[10px] font-mono text-slate-400 truncate">{av.avatar_id}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab 2: Avatar IV (V3 Engine) */}
      {activeTab === 'avatar_iv' && (
        <>
          <div className="mb-6 p-4 rounded-2xl bg-[#E6F3F7] border border-[#007799]/30 text-left flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-[#005570] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Avatar IV (v3 Engine) Active</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Default v3 rendering engine supporting high-expressiveness, arbitrary image animation, motion prompts, and natural gesture control.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#005570] animate-spin mb-3" />
              <p className="text-slate-500 text-sm">Loading Avatar IV avatars...</p>
            </div>
          ) : avatarsV3List.length === 0 ? (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl">
              <p className="text-slate-500 text-sm">No custom Avatar IV records returned. Switch to Studio Avatars or upload a Doctor Photo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {avatarsV3List.map((av) => {
                const avId = av.avatar_id || av.id;
                const isSelected = selectedAvatar?.engine === 'avatar_iv' && selectedAvatar?.avatar_id === avId;
                return (
                  <div
                    key={avId}
                    onClick={() => {
                      setSelectedAvatar({
                        type: 'public',
                        engine: 'avatar_iv',
                        avatar_id: avId,
                        name: av.avatar_name || av.name || 'Avatar IV',
                        gender: av.gender,
                        preview_image_url: av.preview_image_url,
                        preview_video_url: av.preview_video_url
                      });
                    }}
                    className={`cursor-pointer group relative rounded-2xl overflow-hidden border transition-all ${
                      isSelected
                        ? 'border-[#005570] ring-2 ring-[#005570]/30 shadow-xl shadow-[#005570]/15'
                        : 'border-slate-200 hover:border-[#007799]/50 hover:shadow-md'
                    }`}
                  >
                    <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                      {av.preview_image_url ? (
                        <img
                          src={av.preview_image_url}
                          alt={av.name || av.avatar_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                          Avatar IV
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#005570] text-white font-bold text-[9px]">
                        AVATAR IV
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-[#005570] text-white p-1.5 rounded-full shadow-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-white text-left">
                      <h4 className="font-bold text-slate-900 text-xs truncate">{av.name || av.avatar_name || 'Avatar IV'}</h4>
                      <p className="text-[10px] font-mono text-slate-400 truncate">{avId}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab 3: Photo Avatar Upload */}
      {activeTab === 'photo' && (
        <div className="max-w-xl mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#E6F3F7] text-[#005570] border border-[#007799]/20 mx-auto flex items-center justify-center mb-4">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Upload Doctor Photo</h3>
          <p className="text-xs text-slate-500 mb-6">
            Upload a clear front-facing doctor portrait to create a Photo Avatar for this doctor.
          </p>

          {photoError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{photoError}</span>
            </div>
          )}

          {uploading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-[#005570] animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-900">Processing Photo Avatar...</p>
              <p className="text-xs text-slate-500 mt-1">Registering talking photo resource anchor</p>
            </div>
          ) : uploadedPhoto ? (
            <div className="p-6 rounded-2xl bg-[#E6F3F7] border border-[#007799]/30 text-center">
              <img src={uploadedPhoto.preview_image_url} alt="Uploaded Doctor" className="w-32 h-32 rounded-2xl object-cover mx-auto mb-4 border-2 border-[#005570]" />
              <span className="inline-block px-3 py-1 rounded-full bg-[#005570] text-white font-bold text-xs mb-2">
                Photo Avatar Registered & Confirmed
              </span>
              <p className="text-xs font-mono text-[#005570]">talking_photo_id: {uploadedPhoto.talking_photo_id}</p>
            </div>
          ) : (
            <label className="block cursor-pointer p-8 border-2 border-dashed border-slate-300 hover:border-[#007799] rounded-2xl transition-all bg-slate-50 hover:bg-[#E6F3F7]/30">
              <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <span className="text-sm font-bold text-[#005570] block mb-1">Click to browse or drag image file</span>
              <span className="text-xs text-slate-500 block">Supports JPG, JPEG, PNG, WEBP (Max 10MB)</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          )}
        </div>
      )}

      {/* Tab 4: Instant Avatars Notice */}
      {activeTab === 'instant' && (
        <div className="max-w-xl mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 border border-amber-200 mx-auto flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Instant Digital Twin Avatars</h3>
          <p className="text-sm text-slate-600 mb-4">
            Instant Avatar / Digital Twin creation requires enterprise account configuration and manual training.
          </p>
          <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-500 border border-slate-200">
            Please use Studio Avatars or Photo Avatars for automated API video generation.
          </div>
        </div>
      )}

      {/* Continue Action */}
      {selectedAvatar && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => setActiveStep(3)}
            className="px-8 py-3.5 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-sm transition-all shadow-lg shadow-[#005570]/20"
          >
            Continue with Selected Avatar →
          </button>
        </div>
      )}
    </div>
  );
};
