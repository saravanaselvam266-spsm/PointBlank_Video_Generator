import React from 'react';
import { useApp } from '../../context/AppContext';
import { FileText, Clock, Type, Upload, Trash2, Sparkles, BookOpen, AlertCircle } from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';

const HEALTHCARE_TEMPLATES = [
  {
    category: 'Patient Education',
    title: 'Cardiology Wellness Guidelines',
    text: 'Welcome to PointBlank Cardiology. Maintaining a healthy cardiovascular system involves regular aerobic exercise, a Mediterranean-style diet, and routine blood pressure monitoring. If you experience shortness of breath or persistent fatigue, schedule a consultation with our cardiology clinic immediately.'
  },
  {
    category: 'Post-Op Recovery',
    title: 'Post-Operative Recovery Advice',
    text: 'Hello patient. Following your outpatient procedure today, please ensure rest for the next 48 hours. Keep incision areas clean and dry, avoid strenuous heavy lifting, and take your prescribed antibiotics as directed. Our triage team is available 24/7 for any urgent questions.'
  },
  {
    category: 'Preventive Care',
    title: 'Seasonal Flu Vaccination Notice',
    text: 'Protect yourself and your family this influenza season. Annual flu vaccinations reduce hospital visits and prevent serious complications. Visit PointBlank Health Clinic this week for quick, hassle-free immunization.'
  },
  {
    category: 'Doctor Introduction',
    title: 'Welcome to My Medical Practice',
    text: 'Hello, I am Doctor Saravana Perumal. As a healthcare provider, my focus is delivering compassionate, evidence-based care tailored to your unique wellness goals. I look forward to working with you towards long-term health and vitality.'
  },
  {
    category: 'Treatment Explanation',
    title: 'Managing Hypertension Effectively',
    text: 'Hypertension, or high blood pressure, often displays no early symptoms. Through consistent medication adherence, sodium reduction, and routine clinic checkups, we can manage blood pressure effectively and protect your vascular health.'
  },
  {
    category: 'Appointment Reminder',
    title: 'Annual Health Checkup Reminder',
    text: 'This is a friendly reminder from PointBlank Health Center. Your annual preventative health checkup is due. Regular screening enables early detection and proactive wellness care. Contact our front desk today to confirm your time.'
  }
];

export const ScriptEditor = () => {
  const { script, setScript } = useApp();

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const charCount = script.length;

  const estimatedSeconds = Math.round((wordCount / 150) * 60);
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  const durationFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setScript(event.target.result.toString());
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <StepHeader
        step={4}
        icon={FileText}
        title="Write the script"
        description="This is exactly what the avatar will say. Write your own, upload a file, or start from a template."
      />

      <div className="rounded-2xl bg-[#F5F7F8] border border-[#E5E7EB] p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">Video script</span>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-white hover:bg-[#EEF1F2] text-xs font-semibold text-[#374151] transition-all flex items-center gap-1.5 border border-[#E5E7EB]">
              <Upload className="w-3.5 h-3.5 text-[#005570]" />
              <span>Upload .txt</span>
              <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
            </label>
            {script && (
              <button
                onClick={() => setScript('')}
                className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-[#6B7280] hover:text-rose-500 transition-all border border-[#E5E7EB]"
                title="Clear script"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <textarea
          rows={7}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Enter the medical explanation, patient advice, or consultation message here…"
          className="w-full p-4 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2937] text-sm focus:outline-hidden focus:border-[#007799] focus:ring-2 focus:ring-[#007799]/10 transition-all resize-y leading-relaxed placeholder:text-[#9CA3AF]"
        />

        {/* Live Metrics Row */}
        <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-[#6B7280] gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Type className="w-4 h-4 text-[#005570]" />
              <span>Characters: <strong className="text-[#1F2937] font-mono">{charCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Words: <strong className="text-[#1F2937] font-mono">{wordCount}</strong></span>
            </div>
          </div>

          {script.trim() ? (
            <div className="flex items-center gap-1.5 bg-[#E6F3F7] text-[#005570] px-3 py-1 rounded-lg border border-[#007799]/20 font-medium">
              <Clock className="w-4 h-4" />
              <span>Estimated length: <strong className="font-mono">{durationFormatted}</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-lg border border-amber-200 font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>A script is required to continue</span>
            </div>
          )}
        </div>
      </div>

      {/* Healthcare Script Templates */}
      <div>
        <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#005570]" />
          <span>Start from a template</span>
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {HEALTHCARE_TEMPLATES.map((template, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setScript(template.text)}
              className="p-3.5 rounded-xl bg-white hover:bg-[#E6F3F7] text-left border border-[#E5E7EB] hover:border-[#007799]/40 transition-all group"
            >
              <span className="text-[10px] font-bold text-[#007799] uppercase tracking-wide">{template.category}</span>
              <h4 className="text-xs font-bold text-[#1F2937] group-hover:text-[#005570] transition-colors mt-0.5">
                {template.title}
              </h4>
              <p className="text-[11px] text-[#6B7280] line-clamp-2 mt-1 leading-normal">{template.text}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
