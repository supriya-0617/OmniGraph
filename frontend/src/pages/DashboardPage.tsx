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
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { MessageSquare, Users, ShieldAlert, Cpu } from 'lucide-react';

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

const UpdatingOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div className="og-updating-overlay absolute inset-0 z-10 flex items-center justify-center rounded-xl">
      <LoadingSpinner message="Updating analytics…" size="sm" />
    </div>
  );
};

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
  const hasLoadedAnalytics = summary !== null;
  const showInitialAnalyticsSpinner = isLoading && !hasLoadedAnalytics;
  const showInitialGraphSpinner = isLoading && graphData === null;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const clearDashboardData = () => {
      setGraphData(null);
      setSummary(null);
      setClusters([]);
      setSelectedNode(null);
      setHighlightedNodeId(null);
    };

    if (!token) {
      setIsLoading(false);
      clearDashboardData();
      setLoadError('Sign in to load the live graph and analytics.');
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    if (invalidDateRange) {
      setIsLoading(false);
      clearDashboardData();
      setLoadError('The start date must be on or before the end date.');
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    setIsLoading(true);
    setLoadError(null);
    setSelectedNode(null);
    setHighlightedNodeId(null);

    Promise.all([
      fetchGraphApi(filters, token, controller.signal),
      fetchAnalyticsSummaryApi(filters, token, controller.signal),
      fetchClustersApi(filters, token, controller.signal),
    ])
      .then(([nextGraph, nextSummary, nextClusters]) => {
        if (cancelled) return;
        setGraphData(nextGraph);
        setSummary(nextSummary);
        setClusters(nextClusters);
      })
      .catch((error: unknown) => {
        if (cancelled || isAbortError(error)) return;
        clearDashboardData();
        setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filters, invalidDateRange, token]);

  const handleFocusCluster = (cluster: CoordinatedCluster) => {
    setHighlightedNodeId(cluster.user_ids[0] ?? cluster.post_ids[0] ?? null);
  };

  const statusLabel = invalidDateRange
    ? 'Invalid date range'
    : isLoading
      ? hasLoadedAnalytics
        ? 'Updating filters…'
        : 'Loading analytics…'
      : loadError
        ? 'Analytics unavailable'
        : 'Live API results';

  return (
    <div className="dashboard-page min-h-screen bg-surface text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
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

        <section aria-label="Key metrics" aria-busy={isLoading}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-mono font-semibold uppercase tracking-widest text-slate-500">
              Threat Overview
            </h2>
            <span className="og-badge-muted">{statusLabel}</span>
          </div>
          {showInitialAnalyticsSpinner ? (
            <div className="og-card min-h-[120px] flex items-center justify-center">
              <LoadingSpinner message="Loading analytics…" size="md" />
            </div>
          ) : (
            <div className="relative">
              <UpdatingOverlay visible={isLoading && hasLoadedAnalytics} />
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
                  tone="violet"
                  icon={<Cpu className="w-5 h-5 text-purple-400" strokeWidth={1.75} />}
                />
              </div>
            </div>
          )}
        </section>

        <section aria-label="Posts over time" className="h-[260px] sm:h-72" aria-busy={isLoading}>
          {showInitialAnalyticsSpinner ? (
            <div className="og-card h-full flex items-center justify-center">
              <LoadingSpinner message="Loading posts over time…" size="sm" />
            </div>
          ) : summary ? (
            <div className="relative h-full">
              <UpdatingOverlay visible={isLoading} />
              <PostsOverTimePlaceholder data={summary.posts_over_time} />
            </div>
          ) : (
            <div className="og-card h-full flex items-center justify-center text-xs text-slate-500 font-mono px-4 text-center">
              Posts-over-time data is unavailable for the current filters.
            </div>
          )}
        </section>

        <section
          aria-label="Narratives and clusters"
          className="grid grid-cols-1 xl:grid-cols-2 gap-5 lg:gap-6 items-stretch"
          aria-busy={isLoading}
        >
          <div className="min-h-[280px]">
            {showInitialAnalyticsSpinner ? (
              <div className="og-card h-full min-h-[280px] flex items-center justify-center">
                <LoadingSpinner message="Loading hashtag activity…" size="sm" />
              </div>
            ) : summary ? (
              <div className="relative h-full">
                <UpdatingOverlay visible={isLoading} />
                <HashtagChartPlaceholder data={summary.top_hashtags} />
              </div>
            ) : (
              <div className="og-card h-full min-h-[280px] flex items-center justify-center text-xs text-slate-500 font-mono px-4 text-center">
                Hashtag analytics are unavailable for the current filters.
              </div>
            )}
          </div>
          <div className="min-h-[280px] flex flex-col">
            {showInitialAnalyticsSpinner ? (
              <div className="og-card h-full min-h-[280px] flex items-center justify-center">
                <LoadingSpinner message="Loading coordinated clusters…" size="sm" />
              </div>
            ) : summary ? (
              <div className="relative h-full flex flex-col">
                <UpdatingOverlay visible={isLoading} />
                <ClusterTablePlaceholder clusters={clusters} onFocusCluster={handleFocusCluster} />
              </div>
            ) : (
              <div className="og-card h-full min-h-[280px] flex items-center justify-center text-xs text-slate-500 font-mono px-4 text-center">
                Cluster results are unavailable for the current filters.
              </div>
            )}
          </div>
        </section>

        <section aria-label="Network graph" className="relative min-h-[520px] lg:min-h-[560px] flex flex-col" aria-busy={isLoading}>
          {showInitialGraphSpinner ? (
            <div className="og-card relative w-full h-full min-h-[520px] flex items-center justify-center">
              <LoadingSpinner message="Loading network graph…" />
            </div>
          ) : (
            <>
              <UpdatingOverlay visible={isLoading && graphData !== null} />
              <GraphCanvas
                onSelectNode={(node) => setSelectedNode(node)}
                highlightNodeId={highlightedNodeId}
                graphData={graphData ?? { nodes: [], edges: [] }}
              />
              {selectedNode && (
                <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
              )}
            </>
          )}
        </section>

        <section aria-label="GraphRAG assistant">
          <AiChatPanel />
        </section>
      </main>
    </div>
  );
};
