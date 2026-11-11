import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationBanner } from '../components/common/NotificationBanner';
import { AuthField } from '../components/common/AuthField';
import { AuthLayout } from '../components/common/AuthLayout';
import { PasswordToggle } from '../components/common/PasswordToggle';
import { useHealth } from '../components/common/SystemStatus';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, error, notice, clearError } = useAuth();
  const health = useHealth(60000);
  const devAccount = Boolean(health?.dev_account_enabled);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    setValidationError(null);
    clearError();
    const isDev = devAccount && email.trim() === '1234';
    if (!email.trim()) return fail('Email address is required.');
    if (!isDev && !EMAIL.test(email.trim())) return fail('Enter a valid email address.');
    if (!password) return fail('Password is required.');
    return true;
  };
  const fail = (message: string) => {
    setValidationError(message);
    return false;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      // surfaced through AuthContext.error
    } finally {
      setIsSubmitting(false);
    }
  };

  const message = validationError || error;

  return (
    <AuthLayout
      eyebrow="Analyst access"
      title={<>Sign in to the <span className="og-serif" style={{ color: 'var(--og-olive)' }}>workspace</span></>}
      subtitle="Use your OmniGraph analyst account. Sessions are signed with JWT and expire automatically."
    >
      {notice && !message && (
        <div className="mb-5">
          <NotificationBanner type="info" message={notice} onClose={clearError} />
        </div>
      )}
      {message && (
        <div className="mb-5">
          <NotificationBanner type="error" message={message} onClose={() => { setValidationError(null); clearError(); }} />
        </div>
      )}
      {devAccount && (
        <div className="auth-dev-hint">
          <span>DEV GRAPH · demo login 1234 / 1234</span>
          <button
            type="button"
            className="underline underline-offset-4 hover:text-ink"
            onClick={() => { setEmail('1234'); setPassword('1234'); }}
          >
            Fill
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AuthField id="login-email" label="Email" icon={<Mail className="w-4 h-4" aria-hidden="true" />}>
          <input
            id="login-email"
            type={devAccount ? 'text' : 'email'}
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="analyst@organisation.org"
            className="og-input auth-input"
            aria-invalid={Boolean(validationError) || undefined}
            autoFocus
          />
        </AuthField>

        <AuthField
          id="login-password"
          label="Password"
          icon={<Lock className="w-4 h-4" aria-hidden="true" />}
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
        >
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="og-input auth-input"
          />
        </AuthField>

        <button type="submit" disabled={isSubmitting} className="og-btn-primary w-full min-h-[50px] text-sm mt-2">
          {isSubmitting ? 'Verifying credentials…' : (<>Enter workspace <ArrowRight className="w-4 h-4" aria-hidden="true" /></>)}
        </button>
      </form>

      <p className="auth-footer">
        New to OmniGraph? <Link to="/register">Create an analyst account</Link>
      </p>
    </AuthLayout>
  );
};
