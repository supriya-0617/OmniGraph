import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertOctagon, Gauge, Info, MessageSquare, Radio, RefreshCw, ShieldAlert, Users, X } from 'lucide-react';
import { Header } from '../components/common/Header';
import { FilterBar } from '../components/dashboard/FilterBar';
import { GraphCanvas, GraphCanvasHandle } from '../components/dashboard/GraphCanvas';
import { KpiCard } from '../components/dashboard/KpiCard';
import { HashtagBarChart } from '../components/dashboard/HashtagBarChart';
import { PostsOverTimeChart } from '../components/dashboard/PostsOverTimeChart';
import { SignalMixPanel } from '../components/dashboard/SignalMixPanel';
import { ClusterTable } from '../components/dashboard/ClusterTable';
import { AiChatPanel, AiFocus, AskRequest } from '../components/dashboard/AiChatPanel';
import { NodeDetailPanel } from '../components/dashboard/NodeDetailPanel';
import { ChartSkeleton } from '../components/dashboard/charts/ChartCard';
import { NotificationBanner } from '../components/common/NotificationBanner';
import { GraphData, GraphNode } from '../types/graph';
import { AnalyticsSummary, CoordinatedCluster } from '../types/analytics';
import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import { createCoordinationDemoApi, fetchAnalyticsSummaryApi, fetchClustersApi, fetchGraphApi } from '../services/api';
import '../components/dashboard/dashboard.css';

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

const SectionHeading: React.FC<{ index: string; title: string; children?: React.ReactNode }> = ({ index, title, children }) => (
  <div className="og-section-heading">
    <div className="flex items-baseline gap-3 min-w-0">
      <span className="og-kicker">{index}</span>
      <h2 className="truncate">{title}</h2>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
  </div>
);

const severityTone = (value: number) => (value >= 0.6 ? 'crimson' : value >= 0.4 ? 'orange' : 'sage');

const NODE_QUESTIONS: Record<string, (label: string) => string> = {
  User: (label) => `What role does ${label} play in this network, and does its behaviour look coordinated?`,
  Post: () => 'Where did the narrative in this post originate, and who amplified it?',
  Hashtag: (label) => `Who is driving ${label}, and is the activity around it coordinated?`,
  IPAddress: (label) => `Which accounts share ${label}, and do they behave in a coordinated way?`,
};

export const DashboardPage: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [focus, setFocus] = useState<AiFocus | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [askRequest, setAskRequest] = useState<AskRequest | null>(null);
  const [graphNotice, setGraphNotice] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [clusters, setClusters] = useState<CoordinatedCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const graphRef = useRef<GraphCanvasHandle>(null);
  const investigationRef = useRef<HTMLElement>(null);
  const pendingFocusRef = useRef<string[] | null>(null);
  const { filters } = useFilters();
  const { token, user } = useAuth();
  const invalidDateRange = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const hasLoaded = summary !== null;
  const initialLoading = isLoading && !hasLoaded;

  function scrollToInvestigation() {
    investigationRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  const resetInvestigation = useCallback(() => {
    graphRef.current?.clearHighlights();
    setHighlightIds([]);
    setSelectedClusterId(null);
    setGraphNotice(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setSelectedNode(null);
    setHighlightIds([]);
    setSelectedClusterId(null);
    setGraphNotice(null);
    setFocus(null);

    if (!token || invalidDateRange) {
      setIsLoading(false);
      setGraphData(null);
      setSummary(null);
      setClusters([]);
      setLoadError(!token ? 'Sign in to load the live graph and analytics.' : null);
      return () => controller.abort();
    }

    setIsLoading(true);
    setLoadError(null);
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
        setGraphData(null);
        setSummary(null);
        setClusters([]);
        setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filters, invalidDateRange, token, reloadKey]);

  // After a demo burst refresh, focus the new cluster once the graph has rebuilt.
  useEffect(() => {
    if (!graphData || !pendingFocusRef.current) return;
    const ids = pendingFocusRef.current;
    pendingFocusRef.current = null;
    window.setTimeout(() => {
      const missing = graphRef.current?.focusNodes(ids) ?? ids;
      setHighlightIds(ids.filter((id) => !missing.includes(id)));
      // Wait for the cluster table above to finish growing, then bring the graph into view.
      requestAnimationFrame(() => requestAnimationFrame(scrollToInvestigation));
    }, 250);
  }, [graphData]);

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


  const notMissing = (missing: string[], total: number, what: string) =>
    setGraphNotice(missing.length ? `${missing.length} of ${total} ${what} are outside the rendered graph (the canvas shows the newest 120 posts).` : null);

  const clusterNodes = (cluster: CoordinatedCluster) => [cluster.ip_id, ...cluster.user_ids, ...cluster.post_ids];

  const handleFocusCluster = (cluster: CoordinatedCluster) => {
    const ids = clusterNodes(cluster);
    const missing = graphRef.current?.focusNodes(ids) ?? ids;
    setSelectedNode(null);
    setSelectedClusterId(cluster.id);
    setHighlightIds(ids.filter((id) => !missing.includes(id)));
    setFocus({ label: `${cluster.hashtag} cluster`, nodeIds: ids });
    notMissing(missing, ids.length, 'cluster nodes');
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
    const requested = Array.from(new Set([...ids, ...(origin ? [origin] : [])]));
    const missing = graphRef.current?.highlightNodes(ids, origin) ?? requested;
    setHighlightIds(requested.filter((id) => !missing.includes(id)));
    setSelectedNode(null);
    notMissing(missing, requested.length, 'evidence nodes');
  }, []);

  const handleFocusNodes = (ids: string[]) => {
    const missing = graphRef.current?.focusNodes(ids) ?? ids;
    setHighlightIds(ids.filter((id) => !missing.includes(id)));
  };

  const handleSelectFromPanel = (node: GraphNode) => {
    graphRef.current?.focusNodes([node.id]);
    setSelectedNode(node);
  };

  const handleAskNode = (node: GraphNode) => {
    const label = node.props.handle ?? node.props.tag ?? node.props.address ?? node.id;
    const neighborIds = (graphData?.edges ?? [])
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => (edge.source === node.id ? edge.target : edge.source));
    const nextFocus = { label: String(label), nodeIds: [node.id, ...neighborIds].slice(0, 60) };
    setFocus(nextFocus);
    setAskRequest({ id: Date.now(), question: (NODE_QUESTIONS[node.label] ?? NODE_QUESTIONS.User)(String(label)), focus: nextFocus });
  };

  const handleGenerateDemo = async () => {
    if (!token || isGeneratingDemo) return;
    const platform = filters.platform === 'ALL' ? 'X' : filters.platform;
    setIsGeneratingDemo(true);
    setDemoMessage(null);
    try {
      const result = await createCoordinationDemoApi(platform, token);
      setDemoMessage(
        `Injected ${result.posts_created} posts from ${result.accounts_created} new ${result.platform} accounts on ${result.shared_ip} under ${result.hashtag} (${Math.round(result.window_seconds / 60)} min burst). It is now the newest activity in the graph.`,
      );
      pendingFocusRef.current = [`demo_ip_${result.scenario_id}`, `demo_tag_${result.scenario_id}`, ...result.user_ids, ...result.post_ids];
      setReloadKey((key) => key + 1);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to create demo activity.');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

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
        {(loadError || demoMessage) && (
          <div className="flex flex-col gap-3">
            {loadError && (
              <NotificationBanner
                type="error"
                message={loadError}
                onClose={() => setLoadError(null)}
                action={token ? (
                  <button type="button" className="og-btn-ghost min-h-[30px]" onClick={() => setReloadKey((key) => key + 1)}>
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Retry
                  </button>
                ) : undefined}
              />
            )}
            {demoMessage && <NotificationBanner type="success" title="Demo burst" message={demoMessage} onClose={() => setDemoMessage(null)} />}
          </div>
        )}

        {/* ------------------------------------------------------------ overview */}
        <section aria-label="Key metrics" aria-busy={isLoading}>
          <SectionHeading index="01" title="Threat overview">
            {summary?.density_scoped && <span className="og-badge-orange" title="Every metric is limited to posts inside qualifying coordination clusters">Density-scoped</span>}
            <span className={isLoading ? 'og-badge-olive' : loadError ? 'og-badge-crimson' : 'og-badge'}>
              <span className={`og-dot ${isLoading ? 'og-dot-live' : ''}`} style={{ color: isLoading ? 'var(--og-olive)' : loadError ? 'var(--og-crimson)' : 'var(--og-sage)' }} />
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
              tone="brass"
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
              tone="crimson"
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
              tone="olive"
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
              tone={summary ? severityTone(summary.avg_severity) : 'sage'}
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
              <button type="button" className="og-badge-olive" onClick={() => { resetInvestigation(); setFocus(null); }}>
                Clear selection <X className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerateDemo}
              disabled={!token || isGeneratingDemo || isLoading}
              className="og-btn-ghost min-h-[32px] hover:!text-accent-oxide hover:!border-accent-oxide/50"
              title="Injects 10 new [DEMO] accounts on one datacenter IP posting near-identical text right now — for live walkthroughs. Uses the selected platform (X when All)."
            >
              <Radio className={`h-3.5 w-3.5 ${isGeneratingDemo ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {isGeneratingDemo ? 'Injecting…' : 'Inject live demo burst'}
            </button>
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
        <section ref={investigationRef} aria-label="Investigation workspace" className="scroll-mt-32">
          <SectionHeading index="03" title="Investigation">
            {highlightIds.length > 0 && (
              <button type="button" className="og-badge-lavender" onClick={resetInvestigation}>
                {highlightIds.length} highlighted <X className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </SectionHeading>
          {graphNotice && (
            <p className="mb-3 flex items-start gap-2 text-[12px] text-ink/70" role="status">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent-olive" aria-hidden="true" />
              {graphNotice}
              <button type="button" className="text-ink/40 hover:text-ink ml-1" onClick={() => setGraphNotice(null)} aria-label="Dismiss"><X className="w-3 h-3" /></button>
            </p>
          )}
          <div className="og-investigation-grid">
            <div className="relative min-h-[560px] lg:min-h-[680px] flex flex-col">
              <GraphCanvas
                ref={graphRef}
                onSelectNode={setSelectedNode}
                graphData={graphData}
                isLoading={isLoading}
                error={invalidDateRange ? 'Correct the date range in the filter bar to load graph results.' : loadError}
              />
              {selectedNode && (
                <NodeDetailPanel
                  node={selectedNode}
                  graphData={graphData}
                  onClose={() => setSelectedNode(null)}
                  onSelectNode={handleSelectFromPanel}
                  onFocusNodes={handleFocusNodes}
                  onAskAi={handleAskNode}
                />
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
                onClearHighlight={resetInvestigation}
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
              <span className="text-xs">{invalidDateRange ? 'Correct the date range to load analytics.' : 'Analytics are unavailable for the current filters.'}</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
