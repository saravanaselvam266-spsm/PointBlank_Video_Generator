import React from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, Monitor, Smartphone, Square, Subtitles, Palette } from 'lucide-react';

export const VideoSettings = () => {
  const { settings, setSettings } = useApp();

  const aspectRatios = [
    { id: '16:9', label: '16:9 Landscape', desc: 'YouTube, Web Player, Presentations', icon: Monitor },
    { id: '9:16', label: '9:16 Portrait', desc: 'Mobile Shorts, Reels, Stories', icon: Smartphone },
    { id: '1:1', label: '1:1 Square', desc: 'Instagram, LinkedIn Feed', icon: Square },
  ];

  const bgColors = [
    { id: '#0F172A', label: 'Dark Slate' },
    { id: '#FAFAFA', label: 'Clean White' },
    { id: '#0D9488', label: 'Medical Teal' },
    { id: '#1E293B', label: 'Slate Grey' }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 text-left space-y-6 shadow-sm">
      <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
        <Settings className="w-5 h-5 text-[#005570]" />
        <span>Video Settings & Format</span>
      </h3>

      {/* Aspect Ratio Selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
          Aspect Ratio
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {aspectRatios.map((ar) => {
            const Icon = ar.icon;
            const isSelected = settings.aspect_ratio === ar.id;
            return (
              <button
                key={ar.id}
                type="button"
                onClick={() => setSettings({ ...settings, aspect_ratio: ar.id })}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-[#005570] bg-[#E6F3F7] shadow-md shadow-[#005570]/10'
                    : 'border-slate-200 hover:border-[#007799]/40 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-[#005570]' : 'text-slate-400'}`} />
                  <span className="font-bold text-slate-900 text-sm">{ar.label}</span>
                </div>
                <p className="text-[11px] text-slate-500">{ar.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Captions & Background Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
        
        {/* Captions Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center space-x-3">
            <Subtitles className="w-5 h-5 text-[#005570]" />
            <div>
              <span className="font-bold text-slate-900 text-sm block">Embedded Captions</span>
              <span className="text-xs text-slate-500">Burned-in dynamic subtitles</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, captions: !settings.captions })}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              settings.captions ? 'bg-[#005570]' : 'bg-slate-300'
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
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center space-x-3 mb-3">
            <Palette className="w-5 h-5 text-[#005570]" />
            <span className="font-bold text-slate-900 text-sm">Background Canvas</span>
          </div>
          <div className="flex space-x-3">
            {bgColors.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setSettings({ ...settings, background_color: bg.id })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  settings.background_color === bg.id ? 'border-[#005570] scale-110 shadow-md' : 'border-slate-300 hover:border-slate-400'
                }`}
                style={{ backgroundColor: bg.id }}
                title={bg.label}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
