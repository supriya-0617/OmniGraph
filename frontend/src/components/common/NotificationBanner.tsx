import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface Props {
  type?: 'error' | 'success' | 'info' | 'warning';
  message: string;
  title?: string;
  onClose?: () => void;
  action?: React.ReactNode;
}

const TONES = {
  error: { color: 'var(--og-coral)', bg: 'rgba(255, 112, 92, 0.08)', Icon: AlertTriangle, label: 'Error' },
  warning: { color: 'var(--og-amber)', bg: 'rgba(255, 184, 77, 0.08)', Icon: AlertTriangle, label: 'Warning' },
  success: { color: 'var(--og-mint)', bg: 'rgba(92, 242, 176, 0.08)', Icon: CheckCircle2, label: 'Done' },
  info: { color: 'var(--og-cyan)', bg: 'rgba(34, 225, 255, 0.07)', Icon: Info, label: 'Notice' },
};

export const NotificationBanner: React.FC<Props> = ({ type = 'error', message, title, onClose, action }) => {
  const tone = TONES[type];
  const isError = type === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="relative flex items-start gap-3 py-3 pl-4 pr-3 text-sm animate-og-rise"
      style={{
        border: '1px solid color-mix(in srgb, ' + tone.color + ' 35%, transparent)',
        borderLeft: `3px solid ${tone.color}`,
        borderRadius: 'var(--og-radius-sm)',
        background: tone.bg,
        backdropFilter: 'blur(14px)',
      }}
    >
      <tone.Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: tone.color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="og-stamp mr-2 align-middle" style={{ color: tone.color }}>{title ?? tone.label}</span>
        <span className="align-middle text-ink/90 leading-relaxed">{message}</span>
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="shrink-0 rounded p-1 text-ink/60 hover:text-ink hover:bg-white/5 transition-colors"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
