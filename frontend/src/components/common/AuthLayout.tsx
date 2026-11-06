import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandMark, Wordmark } from './Brand';
import { fetchPublicStatsApi } from '../../services/api';
import { PublicStats } from '../../types/analytics';
import './auth.css';

interface Props {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
}

function useCount(target: number | undefined, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === undefined) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

const Stat: React.FC<{ label: string; value: number | undefined; tone: string }> = ({ label, value, tone }) => {
  const shown = useCount(value);
  return (
    <div className="auth-stat">
      <span className="auth-stat-value" style={{ color: tone }}>
        {value === undefined ? '—' : shown.toLocaleString()}
      </span>
      <span className="og-kicker">{label}</span>
    </div>
  );
};

export const AuthLayout: React.FC<Props> = ({ eyebrow, title, subtitle, children }) => {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicStatsApi(controller.signal).then(setStats).catch(() => setStats(null));
    return () => controller.abort();
  }, []);

  return (
    <div className="auth-page">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside-grid" />
        <Link to="/" className="auth-brand" tabIndex={-1}>
          <BrandMark size={34} />
          <Wordmark />
        </Link>

        <div className="auth-aside-copy">
          <span className="og-stamp" style={{ color: 'var(--og-cyan)' }}>Case file · restricted</span>
          <p className="og-display auth-aside-title">
            Every network
            <br />
            leaves <span className="og-serif auth-accent">a trace.</span>
          </p>
          <p className="auth-aside-sub">
            Accounts, posts, hashtags and infrastructure resolved into one investigable graph.
          </p>
        </div>

        <div className="auth-stats">
          <Stat label="Accounts" value={stats?.entities.User} tone="var(--og-mint)" />
          <Stat label="Posts" value={stats?.entities.Post} tone="var(--og-text)" />
          <Stat label="Clusters" value={stats?.coordinated_clusters} tone="var(--og-coral)" />
        </div>
        <span className="auth-aside-foot og-kicker">
          {stats ? `Live index · ${stats.storage_mode === 'neo4j' ? 'Neo4j Aura' : 'development graph'}` : 'Connecting to index…'}
        </span>
      </aside>

      <main className="auth-main">
        <Link to="/" className="auth-back og-kicker">
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to overview
        </Link>
        <div className="auth-card og-card og-frame">
          <div className="auth-card-head">
            <span className="og-kicker" style={{ color: 'var(--og-cyan)' }}>{eyebrow}</span>
            <h1 className="og-display auth-title">{title}</h1>
            <p className="auth-subtitle">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};
