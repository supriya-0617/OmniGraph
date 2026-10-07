import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Network, LogOut, User, Cpu } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/90 bg-surface/95 backdrop-blur-md shadow-panel">
      <div className="og-container h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center glow-cyan">
            <div className="w-full h-full bg-surface rounded-[7px] flex items-center justify-center">
              <Network className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h1 className="font-bold text-lg tracking-tight text-white font-mono leading-none">
                OMNIGRAPH
              </h1>
              <span className="og-badge-cyan shrink-0">Phase 2 OSINT</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              Disinformation &amp; Network Analyzer
            </p>
          </div>
        </div>

        {/* Center status — desktop */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 font-mono shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden />
            <span>
              API: <span className="text-slate-200">FastAPI</span>
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" strokeWidth={1.75} />
            <span>
              GraphRAG: <span className="text-amber-300">Planned</span>
            </span>
          </div>
        </div>

        {/* User + logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {user && (
            <div className="hidden sm:inline-flex items-center gap-2 max-w-[200px] lg:max-w-xs px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
              <span className="text-slate-300 font-mono truncate" title={user.email}>
                {user.email}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="og-btn-ghost"
            title="Sign out of analyst workstation"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
