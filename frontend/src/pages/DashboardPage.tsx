import React, { useEffect, useState } from 'react';
import { Header } from '../components/common/Header';
import { FilterBar } from '../components/dashboard/FilterBar';
import { GraphCanvas } from '../components/dashboard/GraphCanvas';
import { KpiCard } from '../components/dashboard/KpiCard';
import { HashtagChartPlaceholder } from '../components/dashboard/HashtagChartPlaceholder';
import { PostsOverTimePlaceholder } from '../components/dashboard/PostsOverTimePlaceholder';
import { ClusterTablePlaceholder } from '../components/dashboard/ClusterTablePlaceholder';
import { AiChatPanel } from '../components/dashboard/AiChatPanel';
import { NodeDetailPanel } from '../components/dashboard/NodeDetailPanel';
import { GraphNode } from '../types/graph';
import { CoordinatedCluster } from '../types/analytics';
import { AnalyticsSummary } from '../types/analytics';
import { GraphData } from '../types/graph';
import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import { fetchAnalyticsSummaryApi, fetchClustersApi, fetchGraphApi } from '../services/api';
import { NotificationBanner } from '../components/common/NotificationBanner';
import { MessageSquare, Users, ShieldAlert, Cpu } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [clusters, setClusters] = useState<CoordinatedCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { filters } = useFilters();
  const { token } = useAuth();
  const invalidDateRange = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setLoadError('Sign in to load the live graph and analytics.');
      return;
    }
    if (invalidDateRange) {
      setIsLoading(false);
      setLoadError('The start date must be on or before the end date.');
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      fetchGraphApi(filters, token, controller.signal),
      fetchAnalyticsSummaryApi(filters, token, controller.signal),
      fetchClustersApi(filters, token, controller.signal),
    ])
      .then(([nextGraph, nextSummary, nextClusters]) => {
        setGraphData(nextGraph);
        setSummary(nextSummary);
        setClusters(nextClusters);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [filters, invalidDateRange, token]);

  const handleFocusCluster = (cluster: CoordinatedCluster) => {
    setHighlightedNodeId(cluster.user_ids[0] ?? cluster.post_ids[0] ?? null);
  };

  return (
    <div className="min-h-screen bg-surface text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header />
      <FilterBar />

      <main className="flex-1 py-5 lg:py-6 og-container flex flex-col gap-5 lg:gap-6">
        {loadError && (
          <NotificationBanner
            type="error"
            message={loadError}
            onClose={() => setLoadError(null)}
          />
        )}

        <section aria-label="Key metrics">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-mono font-semibold uppercase tracking-widest text-slate-500">
              Threat Overview
            </h2>
            <span className="og-badge-muted">{isLoading ? 'Updating filters…' : 'Live API results'}</span>
          </div>
          <div className="og-kpi-grid">
            <KpiCard
              title="Total Posts In Filter"
              value={summary?.total_posts ?? '—'}
              change="Matching posts"
              icon={<MessageSquare className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />}
            />
            <KpiCard
              title="Flagged Users"
              value={summary?.total_flagged_users ?? '—'}
              change="In filtered network"
              isDanger
              icon={<Users className="w-5 h-5 text-rose-400" strokeWidth={1.75} />}
            />
            <KpiCard
              title="Coordinated Clusters"
              value={summary?.coordinated_clusters ?? '—'}
              change="Shared IP signals"
              isDanger
              icon={<ShieldAlert className="w-5 h-5 text-amber-400" strokeWidth={1.75} />}
            />
            <KpiCard
              title="Avg Threat Severity"
              value={summary ? `${Math.round(summary.avg_severity * 100)}%` : '—'}
              change="Average severity"
              icon={<Cpu className="w-5 h-5 text-purple-400" strokeWidth={1.75} />}
            />
          </div>
        </section>

        <section aria-label="Amplification over time" className="h-52 sm:h-56">
          <PostsOverTimePlaceholder data={summary?.posts_over_time ?? []} />
        </section>

        {/* Narratives + coordinated clusters */}
        <section
          aria-label="Narratives and clusters"
          className="grid grid-cols-1 xl:grid-cols-2 gap-5 lg:gap-6 items-stretch"
        >
          <div className="min-h-[280px]">
            <HashtagChartPlaceholder data={summary?.top_hashtags ?? []} />
          </div>
          <div className="min-h-[280px] flex flex-col">
            <ClusterTablePlaceholder clusters={clusters} onFocusCluster={handleFocusCluster} />
          </div>
        </section>

        {/* Cytoscape workspace — full width */}
        <section aria-label="Network graph" className="relative min-h-[520px] lg:min-h-[560px] flex flex-col">
          <GraphCanvas
            onSelectNode={(node) => setSelectedNode(node)}
            highlightNodeId={highlightedNodeId}
            graphData={graphData ?? { nodes: [], edges: [] }}
          />
          {selectedNode && (
            <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          )}
        </section>

        <section aria-label="GraphRAG assistant">
          <AiChatPanel />
        </section>
      </main>
    </div>
  );
};
