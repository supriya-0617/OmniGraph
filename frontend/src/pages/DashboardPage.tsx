import React, { useState } from 'react';
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
import { MessageSquare, Users, ShieldAlert, Cpu } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  const handleFocusCluster = (cluster: CoordinatedCluster) => {
    if (cluster.user_handles && cluster.user_handles.length > 0) {
      setHighlightedNodeId('u_004');
    }
  };

  const handleHighlightOrigin = (nodeId: string) => {
    setHighlightedNodeId(nodeId);
  };

  return (
    <div className="min-h-screen bg-surface text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header />
      <FilterBar />

      <main className="flex-1 py-5 lg:py-6 og-container flex flex-col gap-5 lg:gap-6">
        {/* KPI row — values from Phase 1 demo dataset (not live API yet) */}
        <section aria-label="Key metrics">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-mono font-semibold uppercase tracking-widest text-slate-500">
              Threat Overview
            </h2>
            <span className="og-badge-muted">Demo metrics · Phase 2 API pending</span>
          </div>
          <div className="og-kpi-grid">
            <KpiCard
              title="Total Amplified Posts"
              value="142"
              change="+18% past 24h"
              icon={<MessageSquare className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />}
            />
            <KpiCard
              title="Flagged Bot Accounts"
              value="12"
              change="3 shared IPs"
              isDanger
              icon={<Users className="w-5 h-5 text-rose-400" strokeWidth={1.75} />}
            />
            <KpiCard
              title="Coordinated Clusters"
              value="3"
              change="High risk density"
              isDanger
              icon={<ShieldAlert className="w-5 h-5 text-amber-400" strokeWidth={1.75} />}
            />
            <KpiCard
              title="Avg Threat Severity"
              value="78%"
              change="Heuristic score"
              icon={<Cpu className="w-5 h-5 text-purple-400" strokeWidth={1.75} />}
            />
          </div>
        </section>

        {/* Amplification trend — preserved from Phase 1 shell */}
        <section aria-label="Amplification over time" className="h-52 sm:h-56">
          <PostsOverTimePlaceholder />
        </section>

        {/* Narratives + coordinated clusters */}
        <section
          aria-label="Narratives and clusters"
          className="grid grid-cols-1 xl:grid-cols-2 gap-5 lg:gap-6 items-stretch"
        >
          <div className="min-h-[280px]">
            <HashtagChartPlaceholder />
          </div>
          <div className="min-h-[280px] flex flex-col">
            <ClusterTablePlaceholder onFocusCluster={handleFocusCluster} />
          </div>
        </section>

        {/* Cytoscape workspace — full width */}
        <section aria-label="Network graph" className="relative min-h-[520px] lg:min-h-[560px] flex flex-col">
          <GraphCanvas
            onSelectNode={(node) => setSelectedNode(node)}
            highlightNodeId={highlightedNodeId}
          />
          {selectedNode && (
            <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          )}
        </section>

        {/* GraphRAG assistant */}
        <section aria-label="GraphRAG assistant">
          <AiChatPanel onHighlightOriginNode={handleHighlightOrigin} />
        </section>
      </main>
    </div>
  );
};
