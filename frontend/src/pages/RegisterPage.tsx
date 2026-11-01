import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBanner } from '../components/common/NotificationBanner';
import { AuthField } from '../components/common/AuthField';
import { Network, Lock, Mail, ArrowRight, UserPlus } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, login, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await register(email, password);
      setSuccessMessage('Account registered successfully! Logging you in...');
      
      // Auto-login upon successful registration
      setTimeout(async () => {
        try {
          await login(email, password);
          navigate('/dashboard');
        } catch {
          navigate('/login');
        }
      }, 1000);
    } catch (err) {
      // Error handled in AuthContext & displayed via banner
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="auth-brand-mark inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 glow-cyan mb-4">
            <div className="w-full h-full bg-[#0b0f19] rounded-[14px] flex items-center justify-center">
              <Network className="w-7 h-7 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-3xl font-semibold font-display text-white tracking-tight">OmniGraph</h1>
          <p className="text-sm text-slate-400 mt-1">OSINT &amp; disinformation network analysis</p>
        </div>

        {/* Card Form */}
        <div className="auth-card glass-panel p-8 rounded-2xl shadow-2xl border border-slate-800">
          <h2 className="auth-heading text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan-400" />
            <span>Register New Analyst</span>
          </h2>

          {successMessage && (
            <div className="mb-6">
              <NotificationBanner type="success" message={successMessage} />
            </div>
          )}

          {(validationError || error) && !successMessage && (
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

          <form onSubmit={handleSubmit} className="space-y-4 text-sm font-sans">
            {/* Email Field */}
            <AuthField
              id="register-email"
              label="Analyst email address"
              icon={<Mail className="w-4 h-4 absolute left-3.5 top-3.5" aria-hidden="true" />}
            >
              <input
                id="register-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@agency.gov"
                className="auth-input w-full border pl-10 pr-4 py-2.5 placeholder-slate-600 outline-none transition-colors"
              />
            </AuthField>

            {/* Password Field */}
            <AuthField
              id="register-password"
              label="Password (minimum 6 characters)"
              icon={<Lock className="w-4 h-4 absolute left-3.5 top-3.5" aria-hidden="true" />}
            >
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="auth-input w-full border pl-10 pr-4 py-2.5 placeholder-slate-600 outline-none transition-colors"
              />
            </AuthField>

            {/* Confirm Password Field */}
            <AuthField
              id="register-confirm-password"
              label="Confirm password"
              icon={<Lock className="w-4 h-4 absolute left-3.5 top-3.5" aria-hidden="true" />}
            >
              <input
                id="register-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter your password again"
                className="auth-input w-full border pl-10 pr-4 py-2.5 placeholder-slate-600 outline-none transition-colors"
              />
            </AuthField>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="auth-submit w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg glow-cyan mt-2"
            >
              {isSubmitting ? (
                <span>Registering Account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Login Redirect Link */}
          <div className="auth-footer mt-6 pt-6 border-t border-slate-800/80 text-center text-xs font-mono text-slate-400">
            <span>Already registered? </span>
            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4">
              Sign In to Workstation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
