import React from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, Monitor, Smartphone, Square, Subtitles, Palette } from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';

const ASPECT_RATIOS = [
  { id: '16:9', label: 'Landscape', desc: 'YouTube, web pages, presentations', icon: Monitor },
  { id: '9:16', label: 'Portrait', desc: 'Mobile shorts, reels, stories', icon: Smartphone },
  { id: '1:1', label: 'Square', desc: 'Instagram and LinkedIn feed posts', icon: Square },
];

// Curated to the PointBlank palette rather than arbitrary hex values.
const BACKGROUNDS = [
  { id: '#FFFFFF', label: 'White' },
  { id: '#F4F5F7', label: 'Soft gray' },
  { id: '#0D3A52', label: 'Signal petrol' },
  { id: '#14181C', label: 'Charcoal' },
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
        <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
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
                    ? 'border-signal bg-signal-soft shadow-panel'
                    : 'border-line hover:border-accent/40 bg-surface-sunken hover:bg-surface'
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-signal' : 'text-ink-muted'}`} strokeWidth={1.75} />
                  <span className="font-semibold text-ink text-sm">{ar.label}</span>
                  <span className="text-[10px] font-mono text-ink-muted ml-auto">{ar.id}</span>
                </div>
                <p className="text-[11px] text-ink-muted">{ar.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Captions & Background Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Captions Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-sunken border border-line">
          <div className="flex items-center gap-3">
            <Subtitles className="w-5 h-5 text-signal" strokeWidth={1.75} />
            <div>
              <span className="font-semibold text-ink text-sm block">Captions</span>
              <span className="text-xs text-ink-muted">Show subtitles on the video</span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.captions}
            onClick={() => setSettings({ ...settings, captions: !settings.captions })}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
              settings.captions ? 'bg-signal' : 'bg-line-strong'
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
        <div className="p-4 rounded-2xl bg-surface-sunken border border-line">
          <div className="flex items-center gap-3 mb-3">
            <Palette className="w-5 h-5 text-signal" strokeWidth={1.75} />
            <span className="font-semibold text-ink text-sm">Background</span>
          </div>
          <div className="flex gap-3">
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setSettings({ ...settings, background_value: bg.id })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  settings.background_value === bg.id ? 'border-signal scale-110 shadow-sm' : 'border-line hover:border-ink-muted'
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
