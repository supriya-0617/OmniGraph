import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationBanner } from '../components/common/NotificationBanner';
import { AuthField } from '../components/common/AuthField';
import { AuthLayout } from '../components/common/AuthLayout';
import { PasswordToggle } from '../components/common/PasswordToggle';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRENGTH = [
  { label: 'Too short', color: 'var(--og-crimson)' },
  { label: 'Weak', color: 'var(--og-crimson)' },
  { label: 'Fair', color: 'var(--og-orange)' },
  { label: 'Good', color: 'var(--og-olive)' },
  { label: 'Strong', color: 'var(--og-sage)' },
];

function passwordScore(password: string): number {
  if (password.length < 6) return 0;
  let score = 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, login, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const score = useMemo(() => passwordScore(password), [password]);

  const validate = (): string | null => {
    if (!email.trim()) return 'Email address is required.';
    if (!EMAIL.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    const problem = validate();
    setValidationError(problem);
    if (problem) return;

    setIsSubmitting(true);
    try {
      await register(email, password);
      setSuccess(true);
      try {
        await login(email, password);
        navigate('/dashboard');
      } catch {
        navigate('/login');
      }
    } catch {
      // surfaced through AuthContext.error
    } finally {
      setIsSubmitting(false);
    }
  };

  const message = validationError || error;

  return (
    <AuthLayout
      eyebrow="New analyst"
      title={<>Open a <span className="og-serif" style={{ color: 'var(--og-olive)' }}>case file</span></>}
      subtitle="Create an account to explore the network, run coordination analytics and brief the AI analyst."
    >
      {success && (
        <div className="mb-5">
          <NotificationBanner type="success" message="Account created. Signing you in…" />
        </div>
      )}
      {message && !success && (
        <div className="mb-5">
          <NotificationBanner type="error" message={message} onClose={() => { setValidationError(null); clearError(); }} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AuthField id="register-email" label="Work email" icon={<Mail className="w-4 h-4" aria-hidden="true" />}>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="analyst@organisation.org"
            className="og-input auth-input"
            autoFocus
          />
        </AuthField>

        <div>
          <AuthField
            id="register-password"
            label="Password"
            hint={password ? <span style={{ color: STRENGTH[score].color }}>{STRENGTH[score].label}</span> : 'min. 6 characters'}
            icon={<Lock className="w-4 h-4" aria-hidden="true" />}
            trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          >
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
              className="og-input auth-input"
              aria-describedby="password-strength"
            />
          </AuthField>
          <div id="password-strength" className="auth-strength" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span key={step} style={{ background: password && score >= step ? STRENGTH[score].color : undefined }} />
            ))}
          </div>
        </div>

        <AuthField id="register-confirm" label="Confirm password" icon={<Lock className="w-4 h-4" aria-hidden="true" />}>
          <input
            id="register-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat the password"
            className="og-input auth-input"
          />
        </AuthField>

        <button type="submit" disabled={isSubmitting || success} className="og-btn-primary w-full min-h-[50px] text-sm mt-2">
          {isSubmitting ? 'Creating account…' : (<>Create account <ArrowRight className="w-4 h-4" aria-hidden="true" /></>)}
        </button>
      </form>

      <p className="auth-footer">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
};
