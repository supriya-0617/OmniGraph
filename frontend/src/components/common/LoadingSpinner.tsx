import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<Props> = ({ message = 'Loading...', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 gap-3 text-slate-400">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-cyan-400`} />
      {message && <span className="text-xs font-mono tracking-wide">{message}</span>}
    </div>
  );
};
