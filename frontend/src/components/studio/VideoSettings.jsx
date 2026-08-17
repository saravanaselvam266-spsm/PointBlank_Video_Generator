import React from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, Monitor, Smartphone, Square, Subtitles, Palette } from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';

const ASPECT_RATIOS = [
  { id: '16:9', label: 'Landscape', desc: 'YouTube, web pages, presentations', icon: Monitor },
  { id: '9:16', label: 'Portrait', desc: 'Mobile shorts, reels, stories', icon: Smartphone },
  { id: '1:1', label: 'Square', desc: 'Instagram and LinkedIn feed posts', icon: Square },
];

const BACKGROUNDS = [
  { id: '#0F172A', label: 'Dark Slate' },
  { id: '#FAFAFA', label: 'Clean White' },
  { id: '#0D9488', label: 'Medical Teal' },
  { id: '#1E293B', label: 'Slate Grey' }
];

export const VideoSettings = () => {
  const { settings, setSettings } = useApp();

  return (
    <div className="space-y-6">
      <StepHeader
        step={5}
        icon={Settings}
        title="Set up your video"
        description="Choose the format your video will be shown in. You can change these anytime before generating."
      />

      {/* Aspect Ratio Selector */}
      <div>
        <label className="block text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">
          Video shape
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ASPECT_RATIOS.map((ar) => {
            const Icon = ar.icon;
            const isSelected = settings.aspect_ratio === ar.id;
            return (
              <button
                key={ar.id}
                type="button"
                onClick={() => setSettings({ ...settings, aspect_ratio: ar.id })}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-[#005570] bg-[#E6F3F7] shadow-sm'
                    : 'border-[#E5E7EB] hover:border-[#007799]/40 bg-[#F5F7F8] hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-[#005570]' : 'text-[#9CA3AF]'}`} />
                  <span className="font-bold text-[#1F2937] text-sm">{ar.label}</span>
                  <span className="text-[10px] font-mono text-[#9CA3AF] ml-auto">{ar.id}</span>
                </div>
                <p className="text-[11px] text-[#6B7280]">{ar.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Captions & Background Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Captions Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F5F7F8] border border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <Subtitles className="w-5 h-5 text-[#005570]" />
            <div>
              <span className="font-bold text-[#1F2937] text-sm block">Captions</span>
              <span className="text-xs text-[#6B7280]">Show subtitles on the video</span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.captions}
            onClick={() => setSettings({ ...settings, captions: !settings.captions })}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
              settings.captions ? 'bg-[#005570]' : 'bg-[#D1D5DB]'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${
                settings.captions ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Background Color Picker */}
        <div className="p-4 rounded-2xl bg-[#F5F7F8] border border-[#E5E7EB]">
          <div className="flex items-center gap-3 mb-3">
            <Palette className="w-5 h-5 text-[#005570]" />
            <span className="font-bold text-[#1F2937] text-sm">Background</span>
          </div>
          <div className="flex gap-3">
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setSettings({ ...settings, background_color: bg.id })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  settings.background_color === bg.id ? 'border-[#005570] scale-110 shadow-sm' : 'border-[#E5E7EB] hover:border-[#9CA3AF]'
                }`}
                style={{ backgroundColor: bg.id }}
                title={bg.label}
                aria-label={bg.label}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
