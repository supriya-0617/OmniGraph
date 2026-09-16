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

  return (
    <div className={`flex items-center justify-between p-3.5 rounded-lg border text-xs font-medium ${styles[type]} shadow-lg`}>
      <div className="flex items-center gap-2.5">
        {icons[type]}
        <span>{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} className="p-1 hover:bg-black/20 rounded transition-colors">
          <X className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />
        </button>
      )}
    </div>
  );
};
