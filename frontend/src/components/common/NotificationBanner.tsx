import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface Props {
  type?: 'error' | 'success' | 'info';
  message: string;
  onClose?: () => void;
}

export const NotificationBanner: React.FC<Props> = ({ type = 'error', message, onClose }) => {
  const styles = {
    error: 'bg-rose-950/80 border-rose-800 text-rose-200',
    success: 'bg-emerald-950/80 border-emerald-800 text-emerald-200',
    info: 'bg-cyan-950/80 border-cyan-800 text-cyan-200',
  };

  const icons = {
    error: <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
  };
  const isError = type === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`flex items-center justify-between gap-3 p-3.5 rounded-lg border text-sm font-medium ${styles[type]} shadow-lg`}
    >
      <div className="flex items-center gap-2.5">
        {icons[type]}
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="shrink-0 rounded p-1 hover:bg-black/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mint"
        >
          <X className="w-3.5 h-3.5 opacity-70 hover:opacity-100" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
