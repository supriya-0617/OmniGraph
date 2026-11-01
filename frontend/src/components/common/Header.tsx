import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Network, LogOut, User } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="dashboard-header sticky top-0 z-50 border-b bg-surface/95 backdrop-blur-md shadow-panel">
      <div className="og-container min-h-16 flex items-center justify-between gap-4 py-2">
        <Link to="/" className="dashboard-brand flex items-center gap-3 min-w-0" aria-label="OmniGraph home">
          <span className="dashboard-brand-mark shrink-0 w-10 h-10 rounded-xl flex items-center justify-center">
            <Network className="w-5 h-5 text-accent-mint" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-display font-semibold text-lg tracking-tight leading-none">
              OMNIGRAPH
            </span>
            <span className="mt-1 block text-xs text-slate-400 truncate">
              Analyst workspace
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {user && (
            <div className="dashboard-user hidden sm:inline-flex items-center gap-2 max-w-[200px] lg:max-w-xs px-3 py-2 rounded-lg border text-sm">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
              <span className="text-slate-300 font-mono truncate" title={user.email}>
                {user.email}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="og-btn-ghost dashboard-logout"
            title="Sign out of analyst workstation"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
