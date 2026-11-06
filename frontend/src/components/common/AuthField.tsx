import React from 'react';

interface Props {
  id: string;
  label: string;
  icon: React.ReactNode;
  hint?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

export const AuthField: React.FC<Props> = ({ id, label, icon, hint, trailing, children }) => (
  <div className="auth-field">
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <label htmlFor={id} className="og-control-label">
        {label}
      </label>
      {hint && <span className="text-[11px] text-ink/50">{hint}</span>}
    </div>
    <div className="auth-input-shell relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40">{icon}</span>
      {children}
      {trailing && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  </div>
);
