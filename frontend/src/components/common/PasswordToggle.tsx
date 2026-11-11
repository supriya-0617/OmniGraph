import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const PasswordToggle: React.FC<{ visible: boolean; onToggle: () => void }> = ({ visible, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className="grid place-items-center w-8 h-8 rounded-md text-ink/50 hover:text-accent-olive hover:bg-ink/5 transition-colors"
    aria-label={visible ? 'Hide password' : 'Show password'}
    aria-pressed={visible}
  >
    {visible ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
  </button>
);
