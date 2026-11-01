import React from 'react';
import { CoordinatedCluster } from '../../types/analytics';
import { ShieldAlert, Eye } from 'lucide-react';

interface Props {
  clusters: CoordinatedCluster[];
  onFocusCluster?: (cluster: CoordinatedCluster) => void;
}

function riskBadgeClass(score: number): string {
  if (score >= 0.9) return 'bg-rose-950/80 text-rose-200 border-rose-700/60';
  if (score >= 0.75) return 'bg-amber-950/60 text-amber-200 border-amber-700/50';
  return 'bg-slate-800 text-slate-300 border-slate-600';
}

export const ClusterTablePlaceholder: React.FC<Props> = ({ clusters, onFocusCluster }) => {
  const rankedClusters = [...clusters].sort((a, b) => {
    const riskDifference =
      (b.risk_score ?? Number.NEGATIVE_INFINITY) -
      (a.risk_score ?? Number.NEGATIVE_INFINITY);
    return riskDifference;
  });

  return (
    <div className="og-card flex flex-col h-full min-h-[280px]">
      <div className="og-card-header">
        <div className="og-section-title">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" strokeWidth={1.75} />
          <span>Suspected Coordinated Clusters</span>
        </div>
        <span className="og-badge-danger">{rankedClusters.length} active signals</span>
      </div>

      <div className="p-4 pt-2 flex-1 flex flex-col">
        <p className="text-[10px] font-mono text-slate-500 mb-3 leading-relaxed">
          Risk score is a ranking heuristic, not a calibrated probability. Per-post severity is not included in the cluster response.
        </p>
        <div className="og-table-wrap flex-1">
          <table className="og-table min-w-[900px]">
            <thead>
              <tr>
                <th>Cluster ID</th>
                <th>Shared IP</th>
                <th>Accounts</th>
                <th>Hashtag</th>
                <th>Window / Posts</th>
                <th>Risk score</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rankedClusters.map((cluster) => {
                const userIds = cluster.user_ids ?? [];
                const userHandles = cluster.user_handles ?? [];
                const postIds = cluster.post_ids ?? [];
                const riskScore = Number.isFinite(cluster.risk_score) ? cluster.risk_score : null;
                const canFocus = userIds.length > 0 || postIds.length > 0;

                return (
                  <tr key={cluster.id}>
                    <td className="max-w-[180px] break-all text-cyan-300">{cluster.id || '—'}</td>
                    <td className="max-w-[150px] break-all text-cyan-400 font-semibold">{cluster.cluster_ip || '—'}</td>
                    <td className="min-w-[150px]">
                      <span className="block text-slate-400 mb-1">{userIds.length} users</span>
                      <div className="flex flex-wrap gap-1">
                        {userHandles.map((h, i) => (
                          <span
                            key={i}
                            className="inline-block max-w-[130px] break-all px-1.5 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/60 text-[10px] text-slate-300"
                          >
                            {h}
                          </span>
                        ))}
                        {!userHandles.length && <span className="text-slate-500">Handles unavailable</span>}
                      </div>
                    </td>
                    <td className="max-w-[180px] break-all text-amber-400/95 font-medium">{cluster.hashtag || '—'}</td>
                    <td>
                      <span className="block text-slate-300">
                        {typeof cluster.time_window_minutes === 'number' && Number.isFinite(cluster.time_window_minutes)
                          ? `${cluster.time_window_minutes} min`
                          : '—'}
                      </span>
                      <span
                        className="mt-1 block max-w-[190px] break-all text-[10px] text-slate-500"
                        title={postIds.join(', ') || undefined}
                      >
                        {postIds.length
                          ? `${postIds.length} post${postIds.length === 1 ? '' : 's'}: ${postIds.slice(0, 2).join(', ')}${postIds.length > 2 ? ` +${postIds.length - 2}` : ''}`
                          : 'Post IDs unavailable'}
                      </span>
                    </td>
                    <td>
                      {riskScore === null ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${riskBadgeClass(riskScore)}`}
                        >
                          {riskScore.toFixed(3)}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => onFocusCluster?.(cluster)}
                        disabled={!canFocus || !onFocusCluster}
                        aria-label={`View cluster ${cluster.id || ''} in graph`}
                        className="og-btn-ghost py-1 px-2 text-[10px] hover:border-cyan-700/50 hover:bg-cyan-950/40 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Eye className="w-3 h-3 text-cyan-400 shrink-0" strokeWidth={1.75} />
                        <span>View in Graph</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!rankedClusters.length && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">No coordinated clusters match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
