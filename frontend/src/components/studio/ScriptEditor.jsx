import React from 'react';
import { useApp } from '../../context/AppContext';
import { FileText, Clock, Type, Upload, Trash2, Sparkles, BookOpen } from 'lucide-react';

export const ScriptEditor = () => {
  const { script, setScript } = useApp();

  const healthcareTemplates = [
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
    <div className="bg-white border border-slate-200 rounded-3xl p-6 text-left shadow-xs font-sans">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
          <FileText className="w-5 h-5 text-[#005570]" />
          <span>Doctor Video Script Editor</span>
        </h3>

        <div className="flex items-center space-x-2">
          <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-all flex items-center space-x-1 border border-slate-200">
            <Upload className="w-3.5 h-3.5 text-[#005570]" />
            <span>Upload .TXT</span>
            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
          </label>
          {script && (
            <button
              onClick={() => setScript('')}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-500 transition-all border border-slate-200"
              title="Clear text"
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
        placeholder="Enter medical explanation, patient advice, or consultation script here..."
        className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-hidden focus:border-[#007799] focus:ring-2 focus:ring-[#007799]/10 transition-all resize-y leading-relaxed font-sans placeholder:text-slate-400"
      />

      {/* Live Metrics Row */}
      <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200 gap-2">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <Type className="w-4 h-4 text-[#005570]" />
            <span>Characters: <strong className="text-slate-800 font-mono">{charCount}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Words: <strong className="text-slate-800 font-mono">{wordCount}</strong></span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 bg-[#E6F3F7] text-[#005570] px-3 py-1 rounded-lg border border-[#007799]/20 font-medium">
          <Clock className="w-4 h-4" />
          <span>Estimated Duration: <strong className="font-mono">{durationFormatted}</strong> (~{estimatedSeconds}s)</span>
        </div>
      </div>

      {/* Healthcare Script Templates */}
      <div className="mt-6">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#005570]" />
          <span>Healthcare Script Templates</span>
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {healthcareTemplates.map((template, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setScript(template.text)}
              className="p-3 rounded-xl bg-slate-50 hover:bg-[#E6F3F7] text-left border border-slate-200 hover:border-[#007799]/40 transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold text-[#005570] uppercase">{template.category}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#005570] transition-colors">{template.title}</h4>
              <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-normal">{template.text}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
