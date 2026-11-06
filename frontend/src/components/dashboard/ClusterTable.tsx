import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Bot, Crosshair, ShieldAlert } from 'lucide-react';
import { CoordinatedCluster, RiskFactors } from '../../types/analytics';

interface Props {
  clusters: CoordinatedCluster[];
  selectedClusterId?: string | null;
  onFocusCluster?: (cluster: CoordinatedCluster) => void;
  onAskCluster?: (cluster: CoordinatedCluster) => void;
  updating?: boolean;
}

type SortKey = 'risk_score' | 'users' | 'time_window_minutes' | 'avg_severity' | 'first_seen';

const FACTOR_LABELS: Array<[keyof RiskFactors, string, number]> = [
  ['size', 'Size', 30],
  ['severity', 'Severity', 25],
  ['tempo', 'Tempo', 20],
  ['infrastructure', 'Infra', 15],
  ['duplication', 'Text dup.', 10],
];

export function riskTier(score: number) {
  if (score >= 0.75) return { label: 'Critical', color: 'var(--og-danger)' };
  if (score >= 0.6) return { label: 'High', color: 'var(--og-coral)' };
  if (score >= 0.4) return { label: 'Elevated', color: 'var(--og-amber)' };
  return { label: 'Low', color: 'var(--og-mint)' };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '—';
  const hours = diff / 36e5;
  if (hours < 1) return `${Math.max(1, Math.round(diff / 6e4))}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const SortHeader: React.FC<{ label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; align?: 'right' }> = ({ label, active, dir, onClick, align }) => (
  <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={align === 'right' ? 'text-right' : undefined}>
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 uppercase tracking-[0.16em] hover:text-accent-cyan ${active ? 'text-accent-cyan' : ''}`}>
      {label}
      {active && (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </button>
  </th>
);

export const ClusterTable: React.FC<Props> = ({ clusters, selectedClusterId, onFocusCluster, onAskCluster, updating }) => {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'risk_score', dir: 'desc' });

  const rows = useMemo(() => {
    const value = (cluster: CoordinatedCluster): number | string => {
      if (sort.key === 'users') return cluster.user_ids.length;
      if (sort.key === 'first_seen') return cluster.first_seen;
      return cluster[sort.key];
    };
    return [...clusters].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const order = left < right ? -1 : left > right ? 1 : 0;
      return sort.dir === 'asc' ? order : -order;
    });
  }, [clusters, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) => ({ key, dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc' }));

  const critical = clusters.filter((cluster) => cluster.risk_score >= 0.75).length;

  return (
    <section className="og-card flex flex-col h-full" aria-busy={updating || undefined}>
      <header className="og-card-header">
        <div>
          <span className="og-kicker block mb-1" style={{ fontSize: 9.5 }}>Coordination</span>
          <h3 className="og-section-title">
            <ShieldAlert className="w-4 h-4 text-accent-coral" strokeWidth={1.75} aria-hidden="true" />
            Suspected coordinated clusters
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {critical > 0 && <span className="og-badge-danger"><span className="og-dot og-dot-live" />{critical} critical</span>}
          <span className="og-badge">{clusters.length} total</span>
        </div>
      </header>

      <div className="px-4 pt-3 pb-4 flex-1 flex flex-col transition-opacity duration-200" style={{ opacity: updating ? 0.45 : 1 }}>
        <p className="text-[11px] text-ink/50 mb-3 leading-relaxed">
          Accounts sharing one IP that posted the same hashtag within 60 minutes. Risk is a weighted, explainable
          heuristic — <span className="text-ink/70">not a probability of malicious intent.</span>
        </p>
        <div className="og-table-wrap flex-1">
          <table className="og-table min-w-[960px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Cluster</th>
                <SortHeader label="Accounts" active={sort.key === 'users'} dir={sort.dir} onClick={() => toggle('users')} />
                <SortHeader label="Window" active={sort.key === 'time_window_minutes'} dir={sort.dir} onClick={() => toggle('time_window_minutes')} />
                <SortHeader label="Seen" active={sort.key === 'first_seen'} dir={sort.dir} onClick={() => toggle('first_seen')} />
                <SortHeader label="Severity" active={sort.key === 'avg_severity'} dir={sort.dir} onClick={() => toggle('avg_severity')} />
                <SortHeader label="Risk" active={sort.key === 'risk_score'} dir={sort.dir} onClick={() => toggle('risk_score')} />
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cluster, index) => {
                const tier = riskTier(cluster.risk_score);
                const selected = cluster.id === selectedClusterId;
                return (
                  <tr
                    key={cluster.id}
                    style={selected ? { background: 'rgba(34,225,255,0.07)', boxShadow: 'inset 2px 0 0 var(--og-cyan)' } : undefined}
                  >
                    <td className="text-ink/40 og-tabular">{String(index + 1).padStart(2, '0')}</td>
                    <td className="max-w-[230px]">
                      <span className="block font-semibold text-accent-violet truncate" title={cluster.hashtag}>{cluster.hashtag}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-[10.5px] text-ink/55">
                        <span className="truncate" title={cluster.ip_id}>{cluster.cluster_ip}</span>
                        {cluster.network_type && (
                          <span className="og-stamp" style={{ color: ['datacenter', 'vpn', 'proxy'].includes(cluster.network_type) ? 'var(--og-amber)' : 'var(--og-subtle)', fontSize: 8.5, padding: '1px 4px' }}>
                            {cluster.network_type}
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <span className="text-ink og-tabular">{cluster.user_ids.length}</span>
                      {cluster.flagged_users > 0 && <span className="ml-1.5 text-[10px] text-accent-coral">{cluster.flagged_users} flagged</span>}
                      <span className="block mt-1 text-[10px] text-ink/45 max-w-[180px] truncate" title={cluster.user_handles.join(', ')}>
                        {cluster.user_handles.slice(0, 2).join(', ')}{cluster.user_handles.length > 2 ? ` +${cluster.user_handles.length - 2}` : ''}
                      </span>
                    </td>
                    <td className="og-tabular">
                      {cluster.time_window_minutes} min
                      <span className="block mt-1 text-[10px] text-ink/45">{cluster.post_ids.length} posts</span>
                    </td>
                    <td className="text-ink/70 whitespace-nowrap" title={new Date(cluster.first_seen).toLocaleString()}>{relativeTime(cluster.first_seen)}</td>
                    <td className="og-tabular">{Math.round(cluster.avg_severity * 100)}%</td>
                    <td className="min-w-[170px]">
                      <div className="flex items-center gap-2">
                        <span className="og-tabular font-semibold text-ink w-10">{cluster.risk_score.toFixed(2)}</span>
                        <span className="relative flex-1 h-[6px] rounded-sm overflow-hidden" style={{ background: 'rgba(150,170,215,0.1)' }}>
                          <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${cluster.risk_score * 100}%`, background: tier.color }} />
                        </span>
                        <span className="text-[9.5px] uppercase tracking-[0.12em] w-14 text-right" style={{ color: tier.color }}>{tier.label}</span>
                      </div>
                      <div className="mt-1.5 flex gap-[2px]" aria-label="Risk factors">
                        {FACTOR_LABELS.map(([key, label, weight]) => (
                          <span
                            key={key}
                            className="h-[4px] flex-1 rounded-[1px]"
                            title={`${label}: ${Math.round(cluster.risk_factors[key] * 100)}% (weight ${weight}%)`}
                            style={{ background: `rgba(34,225,255,${0.12 + cluster.risk_factors[key] * 0.75})` }}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onFocusCluster?.(cluster)}
                          disabled={!onFocusCluster}
                          className="og-btn-ghost min-h-0 py-1.5 px-2.5 text-[10.5px]"
                          aria-label={`Highlight ${cluster.hashtag} cluster in graph`}
                        >
                          <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> Graph
                        </button>
                        <button
                          type="button"
                          onClick={() => onAskCluster?.(cluster)}
                          disabled={!onAskCluster}
                          className="og-btn-ghost min-h-0 py-1.5 px-2.5 text-[10.5px] hover:!text-accent-violet hover:!border-accent-violet/50"
                          aria-label={`Ask the AI analyst about the ${cluster.hashtag} cluster`}
                        >
                          <Bot className="w-3.5 h-3.5" aria-hidden="true" /> Ask AI
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={8}>
                    <div className="og-empty">
                      <span className="og-stamp" style={{ color: 'var(--og-mint)' }}>All clear</span>
                      <span className="text-xs">No coordinated clusters match these filters. Lower the density threshold or widen the date range.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
