import React from 'react';

/** The OmniGraph mark: four linked nodes inside a viewfinder. */
export const BrandMark: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    aria-hidden="true"
    className={className}
    style={{ flexShrink: 0 }}
  >
    <rect x="1" y="1" width="62" height="62" rx="13" fill="#1A1F1B" stroke="#4A4F3F" />
    <g stroke="#A6A17A" strokeWidth="2.2" strokeLinecap="round" opacity="0.75">
      <line x1="20" y1="22" x2="42" y2="18" />
      <line x1="20" y1="22" x2="30" y2="44" />
      <line x1="42" y1="18" x2="30" y2="44" />
      <line x1="42" y1="18" x2="48" y2="40" />
    </g>
    <circle cx="20" cy="22" r="4.6" fill="#84977B" />
    <circle cx="42" cy="18" r="4.6" fill="#C5A16B" />
    <circle cx="30" cy="44" r="5.6" fill="#B66B4E" />
    <circle cx="48" cy="40" r="3.8" fill="#9B8AB4" />
  </svg>
);

export const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`og-display text-[17px] font-bold tracking-[-0.02em] ${className}`}>
    OMNIGRAPH<span style={{ color: 'var(--og-olive)' }}>.</span>
  </span>
);
