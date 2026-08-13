import React from 'react';
import { useApp } from '../../context/AppContext';
import { Video, UserCheck, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';

export const Header = () => {
  const { currentDoctor, activeStep, setActiveStep, resetStudio } = useApp();

  const steps = [
    { id: 1, label: 'Doctor Profile' },
    { id: 2, label: 'Avatar' },
    { id: 3, label: 'Voice' },
    { id: 4, label: 'Script & Settings' },
    { id: 5, label: 'Preview' },
    { id: 6, label: 'Video Result' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Branding Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={resetStudio}>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Video className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">POINTBLANK</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                AI STUDIO
              </span>
            </div>
            <p className="text-xs text-slate-400">Official Healthcare HeyGen Video Engine</p>
          </div>
        </div>

        {/* Doctor Status Badge */}
        {currentDoctor ? (
          <div className="hidden md:flex items-center space-x-3 bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2">
            <div className="w-9 h-9 rounded-lg bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center border border-teal-500/30">
              {currentDoctor.doctor_name.charAt(0)}
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-white">{currentDoctor.doctor_name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-700 font-mono text-teal-400">
                  {currentDoctor.doctor_id}
                </span>
              </div>
              <p className="text-xs text-slate-400">{currentDoctor.specialization}</p>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center space-x-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Select or Create Doctor Profile</span>
          </div>
        )}

        {/* Live API Status */}
        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <ShieldCheck className="w-4 h-4" />
          <span>Official HeyGen V2/V3 API Connected</span>
        </div>

      </div>

      {/* Progress Steps Nav */}
      <div className="bg-slate-950/60 border-t border-slate-800/60 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between min-w-max">
          {steps.map((step) => {
            const isActive = activeStep === step.id;
            const isCompleted = activeStep > step.id;
            return (
              <button
                key={step.id}
                onClick={() => {
                  if (isCompleted || step.id <= activeStep) setActiveStep(step.id);
                }}
                disabled={step.id > activeStep && !currentDoctor}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 font-bold'
                    : isCompleted
                    ? 'bg-slate-800 text-teal-300 hover:bg-slate-700'
                    : 'text-slate-500 cursor-not-allowed'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                  isActive ? 'bg-slate-950 text-teal-400' : isCompleted ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-800 text-slate-500'
                }`}>
                  {step.id}
                </span>
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
