import React from 'react';

interface Props {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 18, md: 30, lg: 44 };

/** Orbiting-node loader in the OmniGraph palette. */
export const LoadingSpinner: React.FC<Props> = ({ message = 'Loading…', size = 'md' }) => {
  const px = SIZES[size];
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center p-6 gap-3">
      <span className="relative inline-block" style={{ width: px, height: px }} aria-hidden="true">
        <span
          className="absolute inset-0 rounded-full"
          style={{ border: '1.5px solid var(--og-border-strong)', borderTopColor: 'var(--og-cyan)', animation: 'og-spin 0.9s linear infinite' }}
        />
        <span
          className="absolute rounded-full"
          style={{ inset: px * 0.32, background: 'var(--og-cyan)', boxShadow: '0 0 12px var(--og-cyan)' }}
        />
      </span>
      {message && <span className="og-kicker">{message}</span>}
    </div>
  );
};
