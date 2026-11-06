import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import cytoscape from 'cytoscape';
import { GraphData, GraphNode } from '../../types/graph';
import {
  Info,
  Maximize,
  Network,
  RefreshCw,
  LocateFixed,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export interface GraphCanvasHandle {
  focusNodes: (nodeIds: string[]) => string[];
  highlightNodes: (nodeIds: string[], originNodeId?: string | null) => string[];
  clearHighlights: () => void;
}

interface Props {
  onSelectNode: (node: GraphNode | null) => void;
  graphData?: GraphData | null;
  isLoading?: boolean;
  error?: string | null;
}

interface CytoscapeNodeData {
  id: string;
  label: string;
  type: string;
  props: GraphNode['props'];
  flagged?: boolean;
  severity?: number;
  [key: string]: unknown;
}

interface CytoscapeEdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
}

const LEGEND_ITEMS = [
  { label: 'User', className: 'rounded-full bg-cyan-500' },
  { label: 'Flagged / high severity', className: 'rounded-full bg-rose-500 ring-2 ring-rose-300/80' },
  { label: 'Post', className: 'rounded-sm bg-violet-500' },
  { label: 'Hashtag', className: 'rotate-45 bg-amber-500' },
  { label: 'IP address', className: 'rounded-sm bg-emerald-500' },
];

const SAMPLE_NODES: GraphNode[] = [
  { id: 'u_001', label: 'User', props: { handle: '@alpha_intel', flagged: false } },
  { id: 'u_004', label: 'User', props: { handle: '@shadow_bot01', flagged: true } },
  { id: 'u_005', label: 'User', props: { handle: '@shadow_bot02', flagged: true } },
  { id: 'u_006', label: 'User', props: { handle: '@shadow_bot03', flagged: true } },
  { id: 'p_001', label: 'Post', props: { text: 'Spike in network activity...', severity: 0.45 } },
  { id: 'p_002', label: 'Post', props: { text: 'Repeated narrative signal', severity: 0.92 } },
  { id: 'h_001', label: 'Hashtag', props: { tag: '#DisinfoCampaign' } },
  { id: 'ip_200', label: 'IPAddress', props: { address: '192.0.2.100', geo_region: 'SIMULATED' } },
];

const SAMPLE_GRAPH: GraphData = {
  nodes: SAMPLE_NODES,
  edges: [
    { source: 'u_001', target: 'p_001', type: 'POSTED' },
    { source: 'u_004', target: 'p_002', type: 'POSTED' },
    { source: 'u_005', target: 'p_002', type: 'RETWEETED' },
    { source: 'u_006', target: 'p_002', type: 'RETWEETED' },
    { source: 'p_001', target: 'h_001', type: 'MENTIONS' },
    { source: 'p_002', target: 'h_001', type: 'MENTIONS' },
    { source: 'u_004', target: 'ip_200', type: 'POSTED_FROM' },
    { source: 'u_005', target: 'ip_200', type: 'POSTED_FROM' },
    { source: 'u_006', target: 'ip_200', type: 'POSTED_FROM' },
  ],
};

function nodeDisplayLabel(node: GraphNode): string {
  return (
    node.props.handle ??
    node.props.tag ??
    node.props.address ??
    (node.label === 'Post' ? `Post ${node.id}` : node.id)
  );
}

const layoutOptions = (isSample: boolean): cytoscape.LayoutOptions =>
  isSample
    ? { name: 'cose', animate: false, padding: 48, numIter: 180 }
    : {
        name: 'concentric',
        animate: false,
        padding: 48,
        concentric: (node) => (node.data('flagged') ? 100 : 0) + node.degree(),
        levelWidth: () => 2,
      };

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(
  ({ onSelectNode, graphData, isLoading = false, error }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<cytoscape.Core | null>(null);
    const onSelectNodeRef = useRef(onSelectNode);
    const focusedIdsRef = useRef<string[]>([]);
    const [isEmpty, setIsEmpty] = useState(false);

    onSelectNodeRef.current = onSelectNode;

    useImperativeHandle(ref, () => ({
      focusNodes(nodeIds) {
        const cy = cyRef.current;
        if (!cy) return nodeIds;
        cy.nodes().removeClass('cluster-focus');
        cy.edges().removeClass('cluster-edge');
        const visible = cy.collection();
        const missing: string[] = [];
        nodeIds.forEach((id) => {
          const node = cy.$id(id);
          if (node.empty()) missing.push(id);
          else visible.merge(node);
        });
        if (!visible.empty()) {
          focusedIdsRef.current = visible.map((node) => node.id());
          visible.addClass('cluster-focus');
          visible.connectedEdges().addClass('cluster-edge');
          cy.animate({ fit: { eles: visible, padding: 100 }, duration: 450 });
        }
        return missing;
      },
      highlightNodes(nodeIds, originNodeId) {
        const cy = cyRef.current;
        if (!cy) return nodeIds;
        cy.nodes().removeClass('evidence origin evidence-neighbor dimmed');
        cy.edges().removeClass('evidence-edge dimmed');
        const requestedIds = [...new Set([...nodeIds, ...(originNodeId ? [originNodeId] : [])])];
        const visible = cy.collection();
        const missing: string[] = [];
        requestedIds.forEach((id) => {
          const node = cy.$id(id);
          if (node.empty()) {
            missing.push(id);
          } else {
            visible.merge(node);
            node.addClass(id === originNodeId ? 'origin' : 'evidence');
          }
        });
        if (!visible.empty()) {
          visible.neighborhood('node').addClass('evidence-neighbor');
          cy.nodes().not(visible.union(visible.neighborhood('node'))).addClass('dimmed');
          visible.connectedEdges().addClass('evidence-edge');
          cy.edges().not(visible.connectedEdges()).addClass('dimmed');
          focusedIdsRef.current = visible.map((node) => node.id());
          cy.animate({ fit: { eles: visible, padding: 110 }, duration: 450 });
        }
        return missing;
      },
      clearHighlights() {
        const cy = cyRef.current;
        if (!cy) return;
        cy.nodes().removeClass('evidence origin evidence-neighbor dimmed cluster-focus');
        cy.edges().removeClass('evidence-edge cluster-edge dimmed connected');
        focusedIdsRef.current = [];
      },
    }), []);

    useEffect(() => {
      if (!containerRef.current) return;
      focusedIdsRef.current = [];
      const isSample = graphData === undefined;
      const data = isSample ? SAMPLE_GRAPH : graphData;
      const nodes = data?.nodes ?? [];
      const validIds = new Set(nodes.map((node) => node.id));
      const elements: cytoscape.ElementDefinition[] = [
        ...nodes.map((node) => ({
          classes:
            node.props.flagged === true || (node.props.severity ?? 0) >= 0.8
              ? 'high-severity'
              : '',
          data: {
            ...node.props,
            id: node.id,
            label: nodeDisplayLabel(node),
            type: node.label,
            props: node.props,
          } as CytoscapeNodeData,
        })),
        ...(data?.edges ?? [])
          .filter((edge) => validIds.has(edge.source) && validIds.has(edge.target))
          .map((edge, index) => ({
            data: {
              id: `${edge.source}-${edge.type}-${edge.target}-${index}`,
              source: edge.source,
              target: edge.target,
              label: edge.type,
            } as CytoscapeEdgeData,
          })),
      ];

      setIsEmpty(nodes.length === 0);
      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#06b6d4',
              label: '',
              color: '#e2e8f0',
              'font-size': '10px',
              'font-family': 'JetBrains Mono, monospace',
              'text-valign': 'bottom',
              'text-margin-y': 5,
              width: 30,
              height: 30,
              'border-width': 2,
              'border-color': '#164e63',
              'text-outline-color': '#080c14',
              'text-outline-width': 2,
            },
          },
          { selector: 'node[type = "User"]', style: { shape: 'ellipse' } },
          {
            selector: 'node[type = "Post"]',
            style: { 'background-color': '#8b5cf6', shape: 'round-rectangle' },
          },
          {
            selector: 'node[type = "Hashtag"]',
            style: { 'background-color': '#f59e0b', shape: 'diamond' },
          },
          {
            selector: 'node[type = "IPAddress"]',
            style: { 'background-color': '#10b981', shape: 'hexagon' },
          },
          {
            selector: 'node.high-severity',
            style: {
              'background-color': '#f43f5e',
              'border-color': '#fecdd3',
              'border-width': 3,
              width: 36,
              height: 36,
            },
          },
          {
            selector: 'node.connected',
            style: { 'border-color': '#22d3ee', 'border-width': 3, label: 'data(label)' },
          },
          {
            selector: 'node.hovered',
            style: { label: 'data(label)', 'text-opacity': 1 },
          },
          {
            selector: 'node.dimmed',
            style: { opacity: 0.18, 'text-opacity': 0.25 },
          },
          {
            selector: 'node.evidence',
            style: {
              'border-color': '#facc15',
              'border-width': 5,
              width: 40,
              height: 40,
              label: 'data(label)',
            },
          },
          {
            selector: 'node.origin',
            style: {
              'border-color': '#fb7185',
              'border-width': 6,
              width: 46,
              height: 46,
              label: 'data(label)',
            },
          },
          {
            selector: 'node.evidence-neighbor',
            style: { 'border-color': '#a3e635', 'border-width': 3, label: 'data(label)' },
          },
          {
            selector: 'node.cluster-focus',
            style: { 'border-color': '#67e8f9', 'border-width': 5, label: 'data(label)' },
          },
          {
            selector: 'edge',
            style: {
              width: 1.5,
              'line-color': '#475569',
              'target-arrow-color': '#475569',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              label: '',
              'font-size': '8px',
              color: '#94a3b8',
              'text-rotation': 'autorotate',
              'text-outline-color': '#080c14',
              'text-outline-width': 2,
            },
          },
          {
            selector: 'edge.connected',
            style: {
              'line-color': '#22d3ee',
              'target-arrow-color': '#22d3ee',
              width: 2.5,
              label: 'data(label)',
            },
          },
          {
            selector: 'edge.evidence-edge',
            style: {
              'line-color': '#facc15',
              'target-arrow-color': '#facc15',
              width: 2.5,
              label: 'data(label)',
            },
          },
          {
            selector: 'edge.cluster-edge',
            style: {
              'line-color': '#67e8f9',
              'target-arrow-color': '#67e8f9',
              width: 2.5,
              label: 'data(label)',
            },
          },
          {
            selector: 'edge.dimmed',
            style: { opacity: 0.08, 'text-opacity': 0.1 },
          },
          {
            selector: ':selected',
            style: {
              'border-color': '#67e8f9',
              'border-width': 5,
              'overlay-opacity': 0,
              label: 'data(label)',
            },
          },
        ],
        layout: layoutOptions(isSample),
      });

      cy.on('tap', 'node', (event) => {
        const selected = event.target as cytoscape.NodeSingular;
        cy.nodes().removeClass('connected dimmed');
        const neighborhood = selected.closedNeighborhood();
        neighborhood.nodes().addClass('connected');
        cy.nodes().not(neighborhood.nodes()).addClass('dimmed');
        neighborhood.edges().addClass('connected');
        cy.edges().not(neighborhood.edges()).addClass('dimmed');
        selected.addClass('connected');
        selected.neighborhood('edge').addClass('connected');
        const node = nodes.find((item) => item.id === selected.id());
        if (node) onSelectNodeRef.current(node);
      });

      cy.on('tap', (event) => {
        if (event.target === cy) {
          cy.nodes().removeClass('connected dimmed');
          cy.edges().removeClass('connected dimmed');
          onSelectNodeRef.current(null);
        }
      });
      cy.on('mouseover', 'node', (event) => {
        event.target.addClass('hovered');
      });
      cy.on('mouseout', 'node', (event) => {
        event.target.removeClass('hovered');
      });

      cyRef.current = cy;
      const resizeObserver = new ResizeObserver(() => {
        cy.resize();
        if (cy.elements().nonempty()) cy.fit(undefined, 48);
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        cy.destroy();
        if (cyRef.current === cy) cyRef.current = null;
      };
    }, [graphData]);

    const withGraph = (action: (cy: cytoscape.Core) => void) => {
      const cy = cyRef.current;
      if (cy && cy.nodes().nonempty()) action(cy);
    };

    const handleFocus = () => {
      withGraph((cy) => {
        const selected = cy.$(':selected');
        const targets = selected.nonempty()
          ? selected
          : cy.collection().union(focusedIdsRef.current.map((id) => cy.$id(id)));
        if (targets.nonempty()) cy.animate({ fit: { eles: targets, padding: 100 }, duration: 350 });
      });
    };

    const handleResetLayout = () => {
      withGraph((cy) => {
        const options =
          graphData === undefined
            ? { name: 'cose' as const, animate: true, padding: 48, numIter: 180 }
            : {
                name: 'concentric' as const,
                animate: true,
                padding: 48,
                concentric: (node: cytoscape.NodeSingular) =>
                  (node.data('flagged') ? 100 : 0) + node.degree(),
                levelWidth: () => 2,
              };
        cy.layout(options).run();
        cy.fit(undefined, 48);
      });
    };

    return (
      <div className="og-card relative flex h-full min-h-[520px] w-full flex-col overflow-hidden bg-surface shadow-panel-glow">
        <div className="og-card-header shrink-0 bg-slate-900/50">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono">
            <Network className="h-4 w-4 shrink-0 text-cyan-400" strokeWidth={1.75} />
            <span className="font-semibold text-white">Investigation graph</span>
            <span className="hidden text-slate-600 sm:inline">|</span>
            <span className="text-slate-400">
              {graphData === undefined ? 'Sample network' : `${nodesCount(graphData)} visible nodes`}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => withGraph((cy) => cy.zoom(cy.zoom() * 1.2))} className="og-btn-ghost px-2" aria-label="Zoom in" title="Zoom in">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => withGraph((cy) => cy.zoom(cy.zoom() / 1.2))} className="og-btn-ghost px-2" aria-label="Zoom out" title="Zoom out">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => withGraph((cy) => cy.fit(undefined, 48))} className="og-btn-ghost px-2" aria-label="Fit graph" title="Fit graph">
              <Maximize className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handleFocus} className="og-btn-ghost px-2" aria-label="Focus selection" title="Focus selected or highlighted nodes">
              <LocateFixed className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handleResetLayout} className="og-btn-ghost px-2" aria-label="Reset graph layout" title="Reset graph layout">
              <RefreshCw className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="min-h-[420px] w-full flex-1 cursor-grab bg-[#080c14] active:cursor-grabbing"
          aria-label="Interactive network graph"
        />

        {isLoading && (
          <div className="absolute inset-0 top-12 z-20 flex items-center justify-center bg-surface/75 backdrop-blur-sm" role="status">
            <span className="og-badge-cyan">Loading graph and analytics…</span>
          </div>
        )}
        {!isLoading && error && (
          <div className="absolute inset-0 top-12 z-20 flex items-center justify-center bg-surface/90 p-6 text-center" role="alert">
            <div className="max-w-sm">
              <Info className="mx-auto mb-3 h-10 w-10 text-rose-400" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-rose-200">Graph unavailable</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{error}</p>
            </div>
          </div>
        )}
        {!isLoading && !error && isEmpty && (
          <div className="absolute inset-0 top-12 z-20 flex flex-col items-center justify-center bg-surface/90 p-6 text-center">
            <Info className="mb-3 h-10 w-10 text-slate-600" strokeWidth={1.25} />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
              No graph data in active filters
            </h3>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
              Adjust the shared filters to expand the investigation graph.
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 rounded-lg border border-slate-800/90 bg-slate-900/95 px-3 py-2.5 sm:right-auto sm:max-w-xl" role="list" aria-label="Graph legend">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-mono">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="inline-flex items-center gap-2" role="listitem">
                <span className={`h-2.5 w-2.5 shrink-0 ${item.className}`} aria-hidden />
                <span className="whitespace-nowrap text-slate-300">{item.label}</span>
              </div>
            ))}
            <span className="text-slate-500">Yellow = AI evidence · cyan = cluster</span>
          </div>
        </div>
      </div>
    );
  },
);

GraphCanvas.displayName = 'GraphCanvas';

function nodesCount(data?: GraphData | null): number {
  return data?.nodes.length ?? 0;
}
