import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertOctagon, Gauge, MessageSquare, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { Header } from '../components/common/Header';
import { FilterBar } from '../components/dashboard/FilterBar';
import { GraphCanvas } from '../components/dashboard/GraphCanvas';
import { KpiCard } from '../components/dashboard/KpiCard';
import { HashtagBarChart } from '../components/dashboard/HashtagBarChart';
import { PostsOverTimeChart } from '../components/dashboard/PostsOverTimeChart';
import { SignalMixPanel } from '../components/dashboard/SignalMixPanel';
import { ClusterTable } from '../components/dashboard/ClusterTable';
import { AiChatPanel, AiFocus, AskRequest } from '../components/dashboard/AiChatPanel';
import { NodeDetailPanel } from '../components/dashboard/NodeDetailPanel';
import { ChartSkeleton } from '../components/dashboard/charts/ChartCard';
import { NotificationBanner } from '../components/common/NotificationBanner';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { GraphData, GraphNode } from '../types/graph';
import { AnalyticsSummary, CoordinatedCluster } from '../types/analytics';
import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import { fetchAnalyticsSummaryApi, fetchClustersApi, fetchGraphApi } from '../services/api';
import '../components/dashboard/dashboard.css';

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

const UpdatingOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div className="og-updating-overlay absolute inset-0 z-10 flex items-center justify-center rounded-[inherit]">
      <LoadingSpinner message="Updating graph…" size="sm" />
    </div>
  );
};

const SectionHeading: React.FC<{ index: string; title: string; children?: React.ReactNode }> = ({ index, title, children }) => (
  <div className="og-section-heading">
    <div className="flex items-baseline gap-3 min-w-0">
      <span className="og-kicker">{index}</span>
      <h2 className="truncate">{title}</h2>
    </div>
    <div className="flex items-center gap-2 shrink-0">{children}</div>
  </div>
);

const severityTone = (value: number) => (value >= 0.6 ? 'coral' : value >= 0.4 ? 'amber' : 'mint');

export const DashboardPage: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [originId, setOriginId] = useState<string | null>(null);
  const [focus, setFocus] = useState<AiFocus | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [askRequest, setAskRequest] = useState<AskRequest | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [clusters, setClusters] = useState<CoordinatedCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const investigationRef = useRef<HTMLElement>(null);
  const { filters } = useFilters();
  const { token, user } = useAuth();
  const invalidDateRange = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const hasLoaded = summary !== null;
  const initialLoading = isLoading && !hasLoaded;

  const clearHighlights = useCallback(() => {
    setHighlightIds([]);
    setOriginId(null);
    setSelectedClusterId(null);
  }, []);

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
    clearHighlights();
    setFocus(null);

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
        setUpdatedAt(new Date());
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
  }, [filters, invalidDateRange, token, reloadKey, clearHighlights]);

  // Lookups for AI evidence chips.
  const nodeIndex = useMemo(() => {
    const map = new Map<string, GraphNode>();
    graphData?.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [graphData]);

  const describeNode = useCallback((id: string) => {
    const node = nodeIndex.get(id);
    if (!node) return null;
    return node.props.handle ?? node.props.tag ?? node.props.address ?? (node.label === 'Post' ? 'post' : null);
  }, [nodeIndex]);
  const isNodeVisible = useCallback((id: string) => nodeIndex.has(id), [nodeIndex]);

  const scrollToInvestigation = () =>
    investigationRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

  const clusterNodes = (cluster: CoordinatedCluster) => [cluster.ip_id, ...cluster.user_ids, ...cluster.post_ids];

  const handleFocusCluster = (cluster: CoordinatedCluster) => {
    setSelectedClusterId(cluster.id);
    setHighlightIds(clusterNodes(cluster));
    setOriginId(null);
    setFocus({ label: `${cluster.hashtag} cluster`, nodeIds: clusterNodes(cluster) });
    scrollToInvestigation();
  };

  const handleAskCluster = (cluster: CoordinatedCluster) => {
    const nextFocus = { label: `${cluster.hashtag} cluster`, nodeIds: clusterNodes(cluster) };
    setSelectedClusterId(cluster.id);
    setFocus(nextFocus);
    setAskRequest({
      id: Date.now(),
      question: `Why is the ${cluster.hashtag} cluster on ${cluster.cluster_ip} suspicious, and who seeded it?`,
      focus: nextFocus,
    });
    scrollToInvestigation();
  };

  const handleHighlight = useCallback((ids: string[], origin?: string | null) => {
    setHighlightIds(ids);
    setOriginId(origin ?? null);
  }, []);

  const trends = summary?.trends ?? null;
  const statusLabel = invalidDateRange
    ? 'Invalid date range'
    : isLoading
      ? hasLoaded ? 'Updating…' : 'Loading…'
      : loadError ? 'Unavailable' : updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live';

  return (
    <div className="dashboard-page min-h-screen flex flex-col">
      <Header />
      <FilterBar />

      <main className="flex-1 og-container py-6 lg:py-8 flex flex-col gap-10">
        {loadError && (
          <NotificationBanner
            type="error"
            message={loadError}
            onClose={() => setLoadError(null)}
            action={!invalidDateRange && token ? (
              <button type="button" className="og-btn-ghost min-h-[30px]" onClick={() => setReloadKey((key) => key + 1)}>
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Retry
              </button>
            ) : undefined}
          />
        )}

        {/* ------------------------------------------------------------ overview */}
        <section aria-label="Key metrics" aria-busy={isLoading}>
          <SectionHeading index="01" title="Threat overview">
            {summary?.density_scoped && <span className="og-badge-amber" title="Every metric is limited to posts inside qualifying coordination clusters">Density-scoped</span>}
            <span className={isLoading ? 'og-badge-cyan' : loadError ? 'og-badge-danger' : 'og-badge'}>
              <span className={`og-dot ${isLoading ? 'og-dot-live' : ''}`} style={{ color: isLoading ? 'var(--og-cyan)' : loadError ? 'var(--og-coral)' : 'var(--og-mint)' }} />
              {statusLabel}
            </span>
            <button type="button" className="og-icon-btn" onClick={() => setReloadKey((key) => key + 1)} disabled={isLoading || !token} aria-label="Refresh data" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </SectionHeading>
          <div className="og-kpi-grid">
            <KpiCard
              index="KPI · 01"
              title="Posts in filter"
              value={summary ? summary.total_posts.toLocaleString() : '—'}
              definition={summary ? `${summary.total_accounts.toLocaleString()} distinct authors · ${summary.high_severity_posts.toLocaleString()} high-severity` : 'Posts matching date, platform and severity'}
              tone="cyan"
              icon={<MessageSquare className="w-4 h-4" strokeWidth={1.75} />}
              trend={trends?.total_posts}
              neutral
              loading={initialLoading}
            />
            <KpiCard
              index="KPI · 02"
              title="Flagged accounts"
              value={summary ? summary.total_flagged_users.toLocaleString() : '—'}
              definition="Distinct flagged users who posted or retweeted matching posts"
              tone="amber"
              icon={<Users className="w-4 h-4" strokeWidth={1.75} />}
              trend={trends?.total_flagged_users}
              higherIsWorse
              loading={initialLoading}
            />
            <KpiCard
              index="KPI · 03"
              title="Coordinated clusters"
              value={summary ? summary.coordinated_clusters.toLocaleString() : '—'}
              definition={`Shared IP + hashtag within 60 min, ≥ ${filters.minDensity} accounts`}
              tone="coral"
              icon={<ShieldAlert className="w-4 h-4" strokeWidth={1.75} />}
              trend={trends?.coordinated_clusters}
              higherIsWorse
              loading={initialLoading}
            />
            <KpiCard
              index="KPI · 04"
              title="Average severity"
              value={summary ? `${Math.round(summary.avg_severity * 100)}%` : '—'}
              definition="Mean post severity score (0–100%)"
              tone={summary ? severityTone(summary.avg_severity) : 'mint'}
              icon={<Gauge className="w-4 h-4" strokeWidth={1.75} />}
              trend={trends?.avg_severity}
              higherIsWorse
              loading={initialLoading}
            />
          </div>
        </section>

        {/* ------------------------------------------------------------ clusters */}
        <section aria-label="Coordinated clusters" aria-busy={isLoading}>
          <SectionHeading index="02" title="Coordination signals">
            {selectedClusterId && (
              <button type="button" className="og-badge-cyan" onClick={() => { clearHighlights(); setFocus(null); }}>
                Clear selection ✕
              </button>
            )}
          </SectionHeading>
          {initialLoading ? (
            <ChartSkeleton height={180} />
          ) : (
            <ClusterTable
              clusters={clusters}
              selectedClusterId={selectedClusterId}
              onFocusCluster={handleFocusCluster}
              onAskCluster={handleAskCluster}
              updating={isLoading}
            />
          )}
        </section>

        {/* ------------------------------------------------------------ investigation */}
        <section ref={investigationRef} aria-label="Investigation workspace" className="scroll-mt-40">
          <SectionHeading index="03" title="Investigation">
            {(highlightIds.length > 0 || originId) && (
              <button type="button" className="og-badge-violet" onClick={clearHighlights}>
                {highlightIds.length} highlighted · clear ✕
              </button>
            )}
          </SectionHeading>
          <div className="og-investigation-grid">
            <div className="relative min-h-[560px] lg:min-h-[680px] flex flex-col" aria-busy={isLoading}>
              {initialLoading ? (
                <div className="og-card relative w-full h-full min-h-[560px] flex items-center justify-center">
                  <LoadingSpinner message="Loading network graph…" />
                </div>
              ) : (
                <>
                  <UpdatingOverlay visible={isLoading && graphData !== null} />
                  <GraphCanvas
                    onSelectNode={(node) => setSelectedNode(node)}
                    highlightNodeId={highlightedNodeId}
                    highlightNodeIds={highlightIds}
                    originNodeId={originId}
                    graphData={graphData ?? { nodes: [], edges: [] }}
                  />
                  {selectedNode && <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
                </>
              )}
            </div>
            <div className="og-ai-column">
              <AiChatPanel
                filters={filters}
                token={token}
                hasGraphData={Boolean(graphData?.nodes.length)}
                nodesInView={graphData?.nodes.length ?? 0}
                describeNode={describeNode}
                isNodeVisible={isNodeVisible}
                focus={focus}
                onClearFocus={() => { setFocus(null); setSelectedClusterId(null); }}
                highlightedIds={highlightIds}
                onHighlight={handleHighlight}
                onClearHighlight={clearHighlights}
                askRequest={askRequest}
                storageKey={`omnigraph.ai.${user?.email ?? 'anon'}`}
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ analytics */}
        <section aria-label="Analytics" aria-busy={isLoading} className="pb-6">
          <SectionHeading index="04" title="Analytics">
            <span className="og-badge"><Activity className="w-3 h-3" aria-hidden="true" /> Simulated dataset</span>
          </SectionHeading>
          {initialLoading ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2"><ChartSkeleton /></div>
              <ChartSkeleton />
            </div>
          ) : summary ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2 min-h-[320px]">
                <PostsOverTimeChart data={summary.posts_over_time} updating={isLoading} />
              </div>
              <div className="min-h-[320px]">
                <SignalMixPanel platforms={summary.platform_breakdown} severity={summary.severity_distribution} updating={isLoading} />
              </div>
              <div className="xl:col-span-3">
                <HashtagBarChart data={summary.top_hashtags} updating={isLoading} />
              </div>
            </div>
          ) : (
            <div className="og-card og-empty">
              <AlertOctagon className="w-5 h-5" aria-hidden="true" />
              <span className="text-xs">Analytics are unavailable for the current filters.</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
