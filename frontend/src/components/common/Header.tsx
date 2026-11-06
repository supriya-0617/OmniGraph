import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandMark, Wordmark } from './Brand';
import { SystemStatus, useHealth } from './SystemStatus';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const health = useHealth();
  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <header
      className="dashboard-header sticky top-0 z-50"
      style={{
        borderBottom: '1px solid var(--og-border)',
        background: 'rgba(6, 8, 14, 0.72)',
        backdropFilter: 'blur(22px) saturate(150%)',
        WebkitBackdropFilter: 'blur(22px) saturate(150%)',
      }}
    >
      <div className="og-container min-h-16 flex items-center justify-between gap-4 py-2">
        <Link to="/" className="dashboard-brand flex items-center gap-3 min-w-0 text-ink no-underline" aria-label="OmniGraph home">
          <BrandMark size={34} />
          <span className="min-w-0 leading-none">
            <Wordmark />
            <span className="og-kicker mt-1 block truncate" style={{ fontSize: 9.5 }}>
              Analyst workspace
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="hidden md:inline-flex">
            <SystemStatus health={health} />
          </span>
          <span className="md:hidden">
            <SystemStatus health={health} compact />
          </span>
          {user && (
            <span
              className="dashboard-user hidden sm:inline-flex items-center gap-2 max-w-[220px] pl-1 pr-3 py-1 rounded-full text-xs"
              style={{ border: '1px solid var(--og-border)', background: 'rgba(255,255,255,0.03)' }}
              title={user.email}
            >
              <span
                className="grid place-items-center w-7 h-7 rounded-full font-mono text-[10px] font-bold"
                style={{ background: 'var(--og-cyan)', color: '#02121a' }}
                aria-hidden="true"
              >
                {initials}
              </span>
              <span className="font-mono truncate text-ink/80">{user.email}</span>
            </span>
          )}
          <button type="button" onClick={() => logout()} className="og-btn-ghost dashboard-logout" title="Sign out">
            <LogOut className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
