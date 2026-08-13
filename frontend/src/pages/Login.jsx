import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Activity, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await login(email, password);
      navigate('/app/dashboard');
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 select-none font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Side: PointBlank Brand & Healthcare Experience */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#005570] via-[#004055] to-[#002B3A] p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-lg text-cyan-300">
                PB
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-white font-sans">
                POINTBLANK
              </span>
            </div>

            <div className="pt-4 space-y-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                <Activity className="w-3.5 h-3.5 mr-1.5" />
                Healthcare AI SaaS
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white leading-snug">
                Scientific & Evidence-Based AI Video Production
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Transform complex medical communications into engaging, doctor-anchored video experiences powered by PointBlank's enterprise AI video engine.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10 space-y-3">
            <div className="flex items-center space-x-2 text-xs text-cyan-200 font-medium">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>HIPAA Compliant & Enterprise Isolated</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Official PointBlank Healthcare Solution © {new Date().getFullYear()}
            </p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-center bg-white">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="mb-6">
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Welcome back
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Sign in to your PointBlank Healthcare account to continue
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-xs text-rose-700 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@pointblank.co.in"
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-[#007799] focus:ring-2 focus:ring-[#007799]/20 transition-all placeholder-slate-400 outline-hidden font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Please contact your PointBlank Administrator to reset your password.');
                    }}
                    className="text-xs font-semibold text-[#007799] hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-[#007799] focus:ring-2 focus:ring-[#007799]/20 transition-all placeholder-slate-400 outline-hidden font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-md border-slate-300 text-[#005570] focus:ring-[#007799]"
                  />
                  <span className="text-xs font-medium text-slate-600">Remember me for 24 hours</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#005570] hover:bg-[#004055] text-white font-bold text-xs shadow-md shadow-[#005570]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Platform</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-500">
                Default Credentials: <span className="font-mono text-slate-700 font-semibold">admin@pointblank.co.in</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
