import React, { useEffect, useRef, useState } from 'react';
import { Header } from '../components/common/Header';
import { FilterBar } from '../components/dashboard/FilterBar';
import { GraphCanvas, GraphCanvasHandle } from '../components/dashboard/GraphCanvas';
import { KpiCard } from '../components/dashboard/KpiCard';
import { HashtagChartPlaceholder } from '../components/dashboard/HashtagChartPlaceholder';
import { PostsOverTimePlaceholder } from '../components/dashboard/PostsOverTimePlaceholder';
import { ClusterTablePlaceholder } from '../components/dashboard/ClusterTablePlaceholder';
import { AiChatPanel } from '../components/dashboard/AiChatPanel';
import { NodeDetailPanel } from '../components/dashboard/NodeDetailPanel';
import { AiEvidenceResponse, GraphHighlight, GraphNode } from '../types/graph';
import { CoordinatedCluster } from '../types/analytics';
import { AnalyticsSummary } from '../types/analytics';
import { GraphData } from '../types/graph';
import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import {
  createCoordinationDemoApi,
  fetchAnalyticsSummaryApi,
  fetchClustersApi,
  fetchGraphApi,
} from '../services/api';
import { NotificationBanner } from '../components/common/NotificationBanner';
import { Activity, MessageSquare, Radio, Users, ShieldAlert, Cpu } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [graphNotice, setGraphNotice] = useState<string | null>(null);
  const [hasEvidenceHighlights, setHasEvidenceHighlights] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [clusters, setClusters] = useState<CoordinatedCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const graphRef = useRef<GraphCanvasHandle>(null);
  const { filters } = useFilters();
  const { token } = useAuth();
  const invalidDateRange = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );

  useEffect(() => {
    setGraphData(null);
    setSummary(null);
    setClusters([]);
    setSelectedNode(null);
    setGraphNotice(null);
    setHasEvidenceHighlights(false);
    if (!token) {
      setIsLoading(false);
      setLoadError('Sign in to load the live graph and analytics.');
      return;
    }
    if (invalidDateRange) {
      setIsLoading(false);
      setLoadError(null);
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
  }, [filters, invalidDateRange, refreshVersion, token]);

  const handleGenerateDemo = async () => {
    if (!token || isGeneratingDemo) return;
    const platform = filters.platform === 'ALL' ? 'X' : filters.platform;
    setIsGeneratingDemo(true);
    setDemoMessage(null);
    setLoadError(null);
    try {
      const result = await createCoordinationDemoApi(platform, token);
      setDemoMessage(
        `Added ${result.posts_created} synthetic repeated posts from ${result.accounts_created} accounts on ${result.platform}. Shared test IP ${result.shared_ip}; refreshing the cluster table.`,
      );
      setRefreshVersion((version) => version + 1);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to create demo activity.');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const handleFocusCluster = (cluster: CoordinatedCluster) => {
    const nodeIds = [...cluster.user_ids, ...cluster.post_ids];
    graphRef.current?.clearHighlights();
    const missingIds = graphRef.current?.focusNodes(nodeIds) ?? nodeIds;
    setSelectedNode(null);
    setHasEvidenceHighlights(false);
    setGraphNotice(
      missingIds.length
        ? `${missingIds.length} cluster node${missingIds.length === 1 ? '' : 's'} are not in the currently rendered graph.`
        : `Focused ${nodeIds.length} graph nodes for ${cluster.hashtag}.`,
    );
  };

  const handleEvidenceHighlight = (response: AiEvidenceResponse) => {
    const highlight: GraphHighlight = {
      originNodeId: response.likely_origin_node_id,
      evidenceNodeIds: response.evidence_node_ids,
    };
    const hasEvidence = Boolean(
      highlight.originNodeId || highlight.evidenceNodeIds.length,
    );
    if (!hasEvidence) {
      graphRef.current?.clearHighlights();
      setHasEvidenceHighlights(false);
      setGraphNotice('The AI response did not identify graph nodes to highlight.');
      return;
    }
    const missingIds = graphRef.current?.highlightNodes(
      highlight.evidenceNodeIds,
      highlight.originNodeId,
    ) ?? [
      ...highlight.evidenceNodeIds,
      ...(highlight.originNodeId ? [highlight.originNodeId] : []),
    ];
    setHasEvidenceHighlights(true);
    setGraphNotice(
      missingIds.length
        ? `${missingIds.length} AI evidence node${missingIds.length === 1 ? '' : 's'} are not in the currently filtered graph.`
        : 'AI origin and evidence nodes are highlighted in the graph.',
    );
  };

  const handleClearHighlights = () => {
    graphRef.current?.clearHighlights();
    setHasEvidenceHighlights(false);
    setGraphNotice(null);
  };

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
        {demoMessage && (
          <NotificationBanner
            type="success"
            message={demoMessage}
            onClose={() => setDemoMessage(null)}
          />
        )}
        {graphNotice && (
          <NotificationBanner
            type="info"
            message={graphNotice}
            onClose={() => setGraphNotice(null)}
          />
        )}

        <section aria-label="Key metrics">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-mono font-semibold uppercase tracking-widest text-slate-500">
              Threat Overview
            </h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="og-badge-muted">{isLoading ? 'Updating filters…' : 'Live API results'}</span>
              <button
                type="button"
                onClick={handleGenerateDemo}
                disabled={!token || isGeneratingDemo}
                className="og-btn-ghost border-amber-700/50 text-amber-200 hover:bg-amber-950/60"
                title="Adds synthetic repeated posts with a fictional shared IP; does not inspect Wi-Fi traffic."
              >
                {isGeneratingDemo
                  ? <Activity className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
                  : <Radio className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{isGeneratingDemo ? 'Generating…' : 'Generate demo burst'}</span>
              </button>
            </div>
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

        <section
          aria-label="Investigation workspace"
          className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.8fr)_minmax(24rem,0.82fr)] lg:gap-6"
        >
          <div className="relative min-h-[540px] lg:min-h-[620px]">
            <GraphCanvas
              ref={graphRef}
              onSelectNode={setSelectedNode}
              graphData={graphData}
              isLoading={isLoading}
              error={invalidDateRange ? 'Correct the date range above to load graph results.' : loadError}
            />
            {selectedNode && (
              <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
            )}
          </div>
          <div className="min-h-[540px] 2xl:min-h-[620px]">
            <ClusterTablePlaceholder
              clusters={clusters}
              onFocusCluster={handleFocusCluster}
              isLoading={isLoading}
              error={loadError}
            />
          </div>
        </section>

        <section
          aria-label="Analytics"
          className="grid grid-cols-1 gap-5 xl:grid-cols-2 lg:gap-6"
        >
          <div className="h-56">
            <PostsOverTimePlaceholder
              data={summary?.posts_over_time ?? []}
              isLoading={isLoading}
              error={loadError}
            />
          </div>
          <div className="min-h-[280px]">
            <HashtagChartPlaceholder
              data={summary?.top_hashtags ?? []}
              isLoading={isLoading}
              error={loadError}
            />
          </div>
        </section>

        <section aria-label="GraphRAG assistant">
          <AiChatPanel
            onEvidenceHighlight={handleEvidenceHighlight}
            onClearHighlights={handleClearHighlights}
            hasEvidenceHighlights={hasEvidenceHighlights}
            filters={filters}
          />
        </section>
      </main>
    </div>
  );
};
