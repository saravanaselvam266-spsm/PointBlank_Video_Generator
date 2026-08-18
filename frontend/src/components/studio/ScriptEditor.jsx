import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { scriptApi } from '../../api/client';
import {
  FileText,
  Clock,
  Type,
  Trash2,
  Sparkles,
  BookOpen,
  AlertCircle,
  PenLine,
  UploadCloud,
  Wand2,
  File as FileIcon,
  X,
  Loader2,
} from 'lucide-react';
import { StepHeader } from '../ui/StepHeader';
import { AlertBanner } from '../ui/AlertBanner';

const HEALTHCARE_TEMPLATES = [
  {
    category: 'Patient education',
    title: 'Cardiology wellness guidelines',
    text: 'Welcome to PointBlank Cardiology. Maintaining a healthy cardiovascular system involves regular aerobic exercise, a Mediterranean-style diet, and routine blood pressure monitoring. If you experience shortness of breath or persistent fatigue, schedule a consultation with our cardiology clinic immediately.'
  },
  {
    category: 'Post-op recovery',
    title: 'Post-operative recovery advice',
    text: 'Hello patient. Following your outpatient procedure today, please ensure rest for the next 48 hours. Keep incision areas clean and dry, avoid strenuous heavy lifting, and take your prescribed antibiotics as directed. Our triage team is available 24/7 for any urgent questions.'
  },
  {
    category: 'Preventive care',
    title: 'Seasonal flu vaccination notice',
    text: 'Protect yourself and your family this influenza season. Annual flu vaccinations reduce hospital visits and prevent serious complications. Visit PointBlank Health Clinic this week for quick, hassle-free immunization.'
  },
  {
    category: 'Doctor introduction',
    title: 'Welcome to my medical practice',
    text: "Hello, I'm your physician here at the practice. My focus is delivering compassionate, evidence-based care tailored to your unique wellness goals. I look forward to working with you towards long-term health and vitality."
  },
  {
    category: 'Treatment explanation',
    title: 'Managing hypertension effectively',
    text: 'Hypertension, or high blood pressure, often displays no early symptoms. Through consistent medication adherence, sodium reduction, and routine clinic checkups, we can manage blood pressure effectively and protect your vascular health.'
  },
  {
    category: 'Appointment reminder',
    title: 'Annual health checkup reminder',
    text: 'This is a friendly reminder from PointBlank Health Center. Your annual preventative health checkup is due. Regular screening enables early detection and proactive wellness care. Contact our front desk today to confirm your time.'
  }
];

const MODES = [
  { key: 'write', label: 'Write', icon: PenLine },
  { key: 'document', label: 'Upload Document', icon: UploadCloud },
  { key: 'ai', label: 'Generate with AI', icon: Wand2 },
];

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt'];

const DOCUMENT_STAGES = ['Uploading document…', 'Reading document…', 'Analyzing content…', 'Writing script…', 'Finalizing script…'];
const AI_STAGES = ['Understanding your scenario…', 'Writing the script…', 'Preparing your draft…'];

/** Cycles through believable stage labels while `active`, holding on the last one until the real request resolves. */
const useStagedProgress = (stages, active) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setIndex((prev) => Math.min(prev + 1, stages.length - 1));
    }, 1100);
    return () => clearInterval(timer);
  }, [active, stages.length]);
  return stages[index];
};

const StageIndicator = ({ label }) => (
  <div className="flex items-center gap-2.5 text-signal">
    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
    <span className="text-sm font-medium">{label}</span>
  </div>
);

const ModeTabs = ({ mode, setMode }) => (
  <div role="tablist" aria-label="Script creation method" className="flex flex-col sm:flex-row gap-1 bg-surface-sunken p-1 rounded-xl">
    {MODES.map((m) => {
      const Icon = m.icon;
      const isActive = mode === m.key;
      return (
        <button
          key={m.key}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => setMode(m.key)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            isActive ? 'bg-surface text-signal shadow-panel' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} />
          <span>{m.label}</span>
        </button>
      );
    })}
  </div>
);

const WriteMode = ({ script, setScript }) => {
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const charCount = script.length;
  const estimatedSeconds = Math.round((wordCount / 150) * 60);
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  const durationFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-surface-sunken border border-line p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Video script</span>
          {script && (
            <button
              onClick={() => setScript('')}
              className="p-1.5 rounded-xl bg-surface hover:bg-error-soft text-ink-muted hover:text-error transition-all border border-line"
              title="Clear script"
              aria-label="Clear script"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <textarea
          rows={11}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Write your video script…"
          aria-label="Video script text"
          className="w-full p-5 rounded-xl bg-surface border border-line text-ink text-[16px] focus:outline-hidden focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all resize-y leading-[1.8] placeholder:text-ink-muted font-sans"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-ink-muted gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Type className="w-4 h-4 text-signal" />
              <span>Characters: <strong className="text-ink font-mono">{charCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-success" />
              <span>Words: <strong className="text-ink font-mono">{wordCount}</strong></span>
            </div>
          </div>

          {script.trim() ? (
            <div className="flex items-center gap-1.5 bg-signal-soft text-signal px-3 py-1 rounded-lg font-medium">
              <Clock className="w-4 h-4" />
              <span>Estimated length: <strong className="font-mono">{durationFormatted}</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-warning-soft text-warning px-3 py-1 rounded-lg font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>A script is required to continue</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-signal" />
          <span>Start from a template</span>
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {HEALTHCARE_TEMPLATES.map((template, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setScript(template.text)}
              className="p-3.5 rounded-xl bg-surface hover:bg-signal-soft/60 text-left border border-line hover:border-accent/40 transition-all group"
            >
              <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">{template.category}</span>
              <h4 className="text-xs font-semibold text-ink group-hover:text-signal transition-colors mt-0.5">
                {template.title}
              </h4>
              <p className="text-[11px] text-ink-muted line-clamp-2 mt-1 leading-normal">{template.text}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const DocumentMode = ({ onScriptGenerated }) => {
  const [file, setFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const stageLabel = useStagedProgress(DOCUMENT_STAGES, isProcessing);

  const validateAndSetFile = (candidate) => {
    setError(null);
    if (!candidate) return;
    const ext = candidate.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
      return;
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      setError('This file is too large. Please upload a file under 15MB.');
      return;
    }
    setFile(candidate);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    validateAndSetFile(e.dataTransfer.files?.[0]);
  };

  const handleGenerate = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await scriptApi.fromDocument(formData);
      onScriptGenerated(res.data.script);
    } catch (err) {
      setError(err.message || "Couldn't read this document. Please try another PDF or DOCX file.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && <AlertBanner>{error}</AlertBanner>}

      {isProcessing ? (
        <div className="rounded-2xl border border-line bg-surface-sunken p-10 flex flex-col items-center justify-center gap-3 text-center">
          <StageIndicator label={stageLabel} />
          <p className="text-xs text-ink-muted max-w-sm">This can take a few seconds while we read and rewrite your document into a spoken script.</p>
        </div>
      ) : file ? (
        <div className="rounded-2xl border border-line bg-surface-sunken p-6 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-signal-soft text-signal flex items-center justify-center shrink-0">
            <FileIcon className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink truncate">{file.name}</p>
            <p className="text-xs text-ink-muted">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            onClick={() => setFile(null)}
            className="p-2 rounded-lg text-ink-muted hover:text-error hover:bg-error-soft transition-colors"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 text-center transition-colors ${
            isDragActive ? 'border-signal bg-signal-soft/40' : 'border-line bg-surface-sunken'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-signal-soft text-signal flex items-center justify-center">
            <UploadCloud className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Upload your document</p>
            <p className="text-xs text-ink-muted mt-0.5">Drag & drop your file here, or</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-signal hover:bg-signal-strong text-white text-xs font-semibold shadow-cta transition-all"
          >
            Choose file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => validateAndSetFile(e.target.files?.[0])}
            aria-label="Upload document"
          />
          <p className="text-[11px] text-ink-muted">Supported formats: PDF, DOCX, TXT · up to 15MB</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!file || isProcessing}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-sm shadow-cta transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Wand2 className="w-4 h-4" />
        <span>{isProcessing ? 'Generating…' : 'Generate script from document'}</span>
      </button>
    </div>
  );
};

const TONE_OPTIONS = ['Professional', 'Friendly', 'Educational'];
const LENGTH_OPTIONS = ['Short', 'Medium', 'Long'];

const AIMode = ({ onScriptGenerated }) => {
  const [scenario, setScenario] = useState('');
  const [tone, setTone] = useState('Professional');
  const [length, setLength] = useState('Medium');
  const [language, setLanguage] = useState('English');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const stageLabel = useStagedProgress(AI_STAGES, isGenerating);

  const handleGenerate = async () => {
    if (!scenario.trim()) {
      setError('Please describe what the doctor should talk about.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const res = await scriptApi.generate({ scenario: scenario.trim(), tone: tone.toLowerCase(), length: length.toLowerCase(), language });
      onScriptGenerated(res.data.script);
    } catch (err) {
      setError(err.message || 'Script generation is temporarily unavailable. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="rounded-2xl border border-line bg-surface-sunken p-10 flex flex-col items-center justify-center gap-3 text-center">
        <StageIndicator label={stageLabel} />
        <p className="text-xs text-ink-muted max-w-sm">Writing a natural, spoken-narration script from your scenario.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <AlertBanner>{error}</AlertBanner>}

      <div className="rounded-2xl bg-surface-sunken border border-line p-5 space-y-4">
        <div>
          <label htmlFor="ai-scenario" className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
            Describe what the doctor should talk about
          </label>
          <textarea
            id="ai-scenario"
            rows={5}
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder='e.g. "Explain the importance of regular dental checkups for adults and when they should see a dentist."'
            className="w-full p-4 rounded-xl bg-surface border border-line text-ink text-[15px] focus:outline-hidden focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all resize-y leading-[1.7] placeholder:text-ink-muted font-sans"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="ai-tone" className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Tone</label>
            <select id="ai-tone" value={tone} onChange={(e) => setTone(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-surface border border-line text-sm text-ink focus:outline-hidden focus:border-accent">
              {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ai-length" className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Length</label>
            <select id="ai-length" value={length} onChange={(e) => setLength(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-surface border border-line text-sm text-ink focus:outline-hidden focus:border-accent">
              {LENGTH_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ai-language" className="block text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">Language</label>
            <input
              id="ai-language"
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-line text-sm text-ink focus:outline-hidden focus:border-accent"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!scenario.trim()}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-signal hover:bg-signal-strong text-white font-semibold text-sm shadow-cta transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Wand2 className="w-4 h-4" />
        <span>Generate script</span>
      </button>
    </div>
  );
};

export const ScriptEditor = () => {
  const { script, setScript } = useApp();
  const [mode, setMode] = useState('write');

  const handleScriptGenerated = (generatedScript) => {
    setScript(generatedScript);
    setMode('write');
  };

  return (
    <div className="space-y-6">
      <StepHeader
        step={4}
        icon={FileText}
        title="Script"
        description="Create the narration for your doctor's video — write it yourself, upload a document, or generate it with AI."
      />

      <ModeTabs mode={mode} setMode={setMode} />

      <div>
        {mode === 'write' && <WriteMode script={script} setScript={setScript} />}
        {mode === 'document' && <DocumentMode onScriptGenerated={handleScriptGenerated} />}
        {mode === 'ai' && <AIMode onScriptGenerated={handleScriptGenerated} />}
      </div>
    </div>
  );
};
