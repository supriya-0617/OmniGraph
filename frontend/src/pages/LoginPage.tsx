import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBanner } from '../components/common/NotificationBanner';
import { Network, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    setValidationError(null);
    clearError();

    if (!email.trim()) {
      setValidationError('Email address is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setValidationError('Password is required.');
      return false;
    }
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters long.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      // Error handled in AuthContext & displayed via banner
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page min-h-screen bg-[#0b0f19] bg-grid-pattern flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="auth-brand-mark inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 glow-cyan mb-4">
            <div className="w-full h-full bg-[#0b0f19] rounded-[14px] flex items-center justify-center">
              <Network className="w-7 h-7 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold font-mono text-white tracking-tight">OmniGraph</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">OSINT Disinformation Network Workstation</p>
        </div>

        {/* Card Form */}
        <div className="auth-card glass-panel p-8 rounded-2xl shadow-2xl border border-slate-800">
          <h2 className="text-lg font-bold font-mono text-white mb-6 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <span>Analyst Authentication</span>
          </h2>

          {(validationError || error) && (
            <div className="mb-6">
              <NotificationBanner
                type="error"
                message={validationError || error || ''}
                onClose={() => {
                  setValidationError(null);
                  clearError();
                }}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 text-xs font-mono">
            {/* Email Field */}
            <div>
              <label className="block text-slate-300 font-semibold mb-2">
                Analyst Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@agency.gov"
                  className="auth-input w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-600 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-slate-300 font-semibold mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="auth-input w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-600 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="auth-submit w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg glow-cyan"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Access Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Registration Redirect Link */}
          <div className="auth-footer mt-6 pt-6 border-t border-slate-800/80 text-center text-xs font-mono text-slate-400">
            <span>New analyst? </span>
            <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4">
              Register Analyst Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
