import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Play, Eye, EyeOff } from 'lucide-react';
import { AlertBanner } from '../components/ui/AlertBanner';
import loginIllustration from '../assets/login-illustration.jpg';

const GoogleMark = () => (
  <svg className="w-4.5 h-4.5" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.7-6.1 8.1-11.3 8.1-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.1-5.1C33.8 6.2 29.1 4.4 24 4.4 12.9 4.4 4 13.3 4 24.4s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l5.9 4.3C13.7 15.4 18.5 12.4 24 12.4c3.1 0 5.8 1.1 8 3l5.1-5.1C33.8 6.2 29.1 4.4 24 4.4c-7.5 0-14 4.2-17.7 10.3z" />
    <path fill="#4CAF50" d="M24 44.4c5 0 9.6-1.9 13.1-5l-6-5.1c-2 1.4-4.6 2.2-7.1 2.2-5.2 0-9.6-3.4-11.3-8.1l-6 4.6C10 39.9 16.5 44.4 24 44.4z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6 5.1C40.4 35.9 44 30.8 44 24.4c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-8 lg:p-12 select-none font-sans"
      style={{ backgroundColor: '#0D3D6C' }}
    >
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left: illustration + brand story */}
        <div className="hidden lg:flex flex-col items-center text-center px-6 pb-reveal">
          <img
            src={loginIllustration}
            alt="Illustration of a doctor surrounded by video, voice, and health icons"
            className="w-full max-w-md mb-4 select-none pointer-events-none"
            draggable="false"
          />

          <h2 className="font-display text-3xl xl:text-4xl text-white tracking-tight leading-[1.15] max-w-md">
            Create trusted doctor videos with AI.
          </h2>
          <p className="text-sm text-white/70 mt-3 max-w-sm">
            Scripts, voices, avatars, and videos — everything in one place.
          </p>
        </div>

        {/* Right: floating sign-in card */}
        <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-8 sm:p-10 pb-reveal" style={{ '--pb-i': 1 }}>
          <div className="flex items-center gap-2 mb-8">
            <Play className="w-6 h-6 text-signal fill-signal" strokeWidth={0} />
            <span className="font-display text-xl font-bold tracking-tight text-ink">PointBlank</span>
          </div>

          <div className="mb-7">
            <h1 className="font-display text-3xl font-bold text-ink tracking-tight">Welcome back</h1>
            <p className="text-sm text-ink-soft mt-1.5">Sign in to continue creating.</p>
          </div>

          {errorMsg && <div className="mb-5"><AlertBanner>{errorMsg}</AlertBanner></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              aria-label="Email"
              className="w-full px-5 py-3.5 rounded-full text-sm bg-signal-strong text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-signal/40 transition-all"
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                aria-label="Password"
                className="w-full px-5 py-3.5 rounded-full text-sm bg-signal-strong text-white placeholder-white/50 focus:outline-hidden focus:ring-2 focus:ring-signal/40 transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-md border-line text-signal focus:ring-accent"
                />
                <span className="text-xs font-medium text-ink-soft">Remember me</span>
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Please contact your PointBlank administrator to reset your password.');
                }}
                className="text-xs font-semibold text-signal hover:underline"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-full bg-signal hover:bg-signal-strong text-white font-semibold text-sm shadow-cta transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-line" />
            <span className="text-xs text-ink-muted">or</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <button
            type="button"
            onClick={() => alert("Google sign-in isn't available yet. Please sign in with your email and password.")}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-full bg-white border border-line hover:bg-surface-sunken text-ink font-semibold text-sm transition-all"
          >
            <GoogleMark />
            <span>Sign in with Google</span>
          </button>

          <p className="text-center text-xs text-ink-muted mt-6">
            New to PointBlank?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert('Please contact your PointBlank administrator to create an account.');
              }}
              className="font-semibold text-signal hover:underline"
            >
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
