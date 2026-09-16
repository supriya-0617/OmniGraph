import React from 'react';
import { CoordinatedCluster } from '../../types/analytics';
import { ShieldAlert, Eye } from 'lucide-react';

interface Props {
  onFocusCluster?: (cluster: CoordinatedCluster) => void;
}

const sampleClusters: CoordinatedCluster[] = [
  {
    id: 'c_01',
    cluster_ip: '192.0.2.100',
    user_handles: ['@shadow_bot01', '@shadow_bot02', '@shadow_bot03'],
    hashtag: '#BotnetDetected',
    time_window_minutes: 5,
    risk_score: 0.95,
  },
  {
    id: 'c_02',
    cluster_ip: '192.0.2.105',
    user_handles: ['@echo_chamber99', '@narrative_node'],
    hashtag: '#DisinfoCampaign',
    time_window_minutes: 12,
    risk_score: 0.82,
  },
];

function riskBadgeClass(score: number): string {
  if (score >= 0.9) return 'bg-rose-950/80 text-rose-200 border-rose-700/60';
  if (score >= 0.75) return 'bg-amber-950/60 text-amber-200 border-amber-700/50';
  return 'bg-slate-800 text-slate-300 border-slate-600';
}

export const ClusterTablePlaceholder: React.FC<Props> = ({ onFocusCluster }) => {
  return (
    <div className="og-card flex flex-col h-full min-h-[280px]">
      <div className="og-card-header">
        <div className="og-section-title">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" strokeWidth={1.75} />
          <span>Suspected Coordinated Clusters</span>
        </div>
        <span className="og-badge-danger">{sampleClusters.length} active signals</span>
      </div>

      <div className="p-4 pt-2 flex-1 flex flex-col">
        <p className="text-[10px] font-mono text-slate-500 mb-3">
          Demo cluster table · Phase 2 <code className="text-slate-400">/analytics/clusters</code>
        </p>
        <div className="og-table-wrap flex-1">
          <table className="og-table">
            <thead>
              <tr>
                <th className="w-[22%]">Shared IP</th>
                <th className="w-[32%]">Accounts</th>
                <th className="w-[22%]">Target Hashtag</th>
                <th className="w-[12%]">Risk</th>
                <th className="w-[12%] text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sampleClusters.map((cluster) => (
                <tr key={cluster.id}>
                  <td className="text-cyan-400 font-semibold whitespace-nowrap">{cluster.cluster_ip}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {cluster.user_handles.map((h, i) => (
                        <span
                          key={i}
                          className="inline-block px-1.5 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/60 text-[10px] text-slate-300"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-amber-400/95 font-medium whitespace-nowrap">{cluster.hashtag}</td>
                  <td>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${riskBadgeClass(
                        cluster.risk_score
                      )}`}
                    >
                      {Math.round(cluster.risk_score * 100)}%
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => onFocusCluster?.(cluster)}
                      className="og-btn-ghost py-1 px-2 text-[10px] hover:border-cyan-700/50 hover:bg-cyan-950/40 hover:text-cyan-300"
                    >
                      <Eye className="w-3 h-3 text-cyan-400 shrink-0" strokeWidth={1.75} />
                      <span>View in Graph</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
