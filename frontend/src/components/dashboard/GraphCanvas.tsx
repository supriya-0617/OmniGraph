import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { AlertTriangle, LocateFixed, Maximize, Network, RefreshCw, SearchX, Tag, ZoomIn, ZoomOut } from 'lucide-react';
import { GraphData, GraphNode } from '../../types/graph';
import { LoadingSpinner } from '../common/LoadingSpinner';

/**
 * Investigation graph (Person-1 workstream).
 * Imperative API lets the dashboard focus clusters and highlight AI evidence; each call
 * returns the IDs that are not in the rendered graph so the UI can say so.
 */
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

const LEGEND = [
  { label: 'User', className: 'rounded-full og-node-legend-user' },
  { label: 'Flagged account', className: 'rounded-full og-node-legend-flagged' },
  { label: 'Post', className: 'rounded-[2px] og-node-legend-post' },
  { label: 'Hashtag', className: 'rotate-45 og-node-legend-hashtag' },
  { label: 'IP address', className: 'rounded-[2px] og-node-legend-ip' },
];

const HIGHLIGHT_CLASSES = 'evidence origin evidence-neighbor dimmed cluster-focus connected cluster-edge evidence-edge';

function nodeDisplayLabel(node: GraphNode): string {
  if (node.props.handle) return node.props.handle;
  if (node.props.tag) return node.props.tag;
  if (node.props.address) return node.props.address;
  if (node.label === 'Post') {
    const text = String(node.props.text ?? '').trim();
    return text ? `${text.slice(0, 28)}${text.length > 28 ? '…' : ''}` : node.id;
  }
  return node.id;
}

function layoutFor(count: number, animate: boolean): cytoscape.LayoutOptions {
  return {
    name: 'cose',
    animate,
    animationDuration: 600,
    padding: 40,
    randomize: !animate,
    nodeDimensionsIncludeLabels: false,
    idealEdgeLength: () => (count > 250 ? 42 : 60),
    nodeRepulsion: () => (count > 250 ? 5200 : 8000),
    edgeElasticity: () => 90,
    gravity: 0.35,
    numIter: count > 300 ? 700 : 1000,
    componentSpacing: 60,
  } as cytoscape.LayoutOptions;
}

function readTokens(element: Element) {
  const css = getComputedStyle(element);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  // Entity colours (desaturated, distinguishable): see the token table in index.css.
  return {
    bg: token('--og-bg', '#0D110F'),
    text: token('--og-text', '#E5E5D9'),
    muted: token('--og-muted', '#A6AA9D'),
    edge: token('--og-subtle', '#777E73'),
    user: token('--og-sage', '#84977B'),
    flagged: token('--og-crimson', '#B85C58'),
    post: token('--og-brass', '#C5A16B'),
    hashtag: token('--og-lavender', '#9B8AB4'),
    ip: token('--og-steel', '#8295A6'),
    evidence: token('--og-mauve', '#B18AAB'),
    origin: token('--og-oxide', '#B66B4E'),
    cluster: token('--og-olive', '#A6A17A'),
  };
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(({ onSelectNode, graphData, isLoading = false, error }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const focusedIdsRef = useRef<string[]>([]);
  const [isEmpty, setIsEmpty] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  onSelectNodeRef.current = onSelectNode;

  const fitTo = (cy: cytoscape.Core, eles: cytoscape.CollectionArgument, padding: number) => {
    if (reducedMotion) cy.fit(eles, padding);
    else cy.animate({ fit: { eles, padding }, duration: 450, easing: 'ease-in-out-cubic' });
  };

  useImperativeHandle(ref, () => ({
    focusNodes(nodeIds) {
      const cy = cyRef.current;
      if (!cy) return nodeIds;
      cy.elements().removeClass(HIGHLIGHT_CLASSES);
      const visible = cy.collection();
      const missing: string[] = [];
      nodeIds.forEach((id) => {
        const node = cy.$id(id);
        if (node.empty()) missing.push(id);
        else visible.merge(node);
      });
      if (visible.nonempty()) {
        focusedIdsRef.current = visible.map((node) => node.id());
        const internal = visible.edgesWith(visible);
        visible.addClass('cluster-focus');
        internal.addClass('cluster-edge');
        cy.elements().difference(visible.union(internal)).addClass('dimmed');
        fitTo(cy, visible, 90);
      }
      return missing;
    },
    highlightNodes(nodeIds, originNodeId) {
      const cy = cyRef.current;
      if (!cy) return nodeIds;
      cy.elements().removeClass(HIGHLIGHT_CLASSES);
      const requested = [...new Set([...nodeIds, ...(originNodeId ? [originNodeId] : [])])];
      const visible = cy.collection();
      const missing: string[] = [];
      requested.forEach((id) => {
        const node = cy.$id(id);
        if (node.empty()) {
          missing.push(id);
        } else {
          visible.merge(node);
          node.addClass(id === originNodeId ? 'origin' : 'evidence');
        }
      });
      if (visible.nonempty()) {
        const neighbors = visible.neighborhood('node').difference(visible);
        const edges = visible.edgesWith(visible.union(neighbors));
        neighbors.addClass('evidence-neighbor');
        edges.addClass('evidence-edge');
        cy.elements().difference(visible.union(neighbors).union(edges)).addClass('dimmed');
        focusedIdsRef.current = visible.map((node) => node.id());
        fitTo(cy, visible, 100);
      }
      return missing;
    },
    clearHighlights() {
      const cy = cyRef.current;
      if (!cy) return;
      cy.elements().removeClass(HIGHLIGHT_CLASSES);
      focusedIdsRef.current = [];
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    focusedIdsRef.current = [];
    const color = readTokens(containerRef.current);
    const nodes = graphData?.nodes ?? [];
    const validIds = new Set(nodes.map((node) => node.id));
    const edges = (graphData?.edges ?? []).filter((edge) => validIds.has(edge.source) && validIds.has(edge.target));
    const degree = new Map<string, number>();
    edges.forEach((edge) => {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    });

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((node) => ({
        classes: [
          node.label === 'User' && node.props.flagged === true ? 'flagged' : '',
          node.label === 'Post' && Number(node.props.severity ?? 0) >= 0.8 ? 'high-severity' : '',
        ].join(' ').trim(),
        data: {
          id: node.id,
          label: nodeDisplayLabel(node),
          type: node.label,
          size: Math.min(46, 16 + Math.sqrt(degree.get(node.id) ?? 0) * 6),
        },
      })),
      ...edges.map((edge, index) => ({
        data: { id: `${edge.source}-${edge.type}-${edge.target}-${index}`, source: edge.source, target: edge.target, label: edge.type },
      })),
    ];

    setIsEmpty(nodes.length === 0);
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.15,
      maxZoom: 3.5,
      style: [
        {
          selector: 'node',
          style: {
            width: 'data(size)',
            height: 'data(size)',
            'background-color': color.user,
            'border-width': 1.5,
            'border-color': color.bg,
            label: '',
            color: color.text,
            'font-size': 9,
            'font-family': 'JetBrains Mono, monospace',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'text-outline-color': color.bg,
            'text-outline-width': 2,
            'transition-property': 'opacity, border-width, border-color',
            'transition-duration': 200,
          } as cytoscape.Css.Node,
        },
        { selector: 'node[type = "User"]', style: { shape: 'ellipse' } },
        { selector: 'node.flagged', style: { 'background-color': color.flagged } },
        { selector: 'node[type = "Post"]', style: { shape: 'round-rectangle', 'background-color': color.post } },
        { selector: 'node.high-severity', style: { 'border-color': color.flagged, 'border-width': 3 } },
        { selector: 'node[type = "Hashtag"]', style: { shape: 'diamond', 'background-color': color.hashtag } },
        { selector: 'node[type = "IPAddress"]', style: { shape: 'hexagon', 'background-color': color.ip } },
        { selector: 'node.show-label, node.hovered, node.connected', style: { label: 'data(label)' } },
        { selector: 'node.connected', style: { 'border-color': color.cluster, 'border-width': 3 } },
        { selector: 'node.cluster-focus', style: { 'border-color': color.cluster, 'border-width': 4, 'z-index': 20 } },
        { selector: 'node.evidence', style: { 'border-color': color.evidence, 'border-width': 4, 'overlay-color': color.evidence, 'overlay-opacity': 0.12, 'overlay-padding': 6, 'z-index': 21 } },
        // Long post texts would collide; in focus modes label accounts, IPs and hashtags only.
        { selector: 'node.cluster-focus[type != "Post"], node.evidence[type != "Post"]', style: { label: 'data(label)' } },
        { selector: 'node.origin', style: { 'border-color': color.origin, 'border-width': 6, width: 48, height: 48, label: 'data(label)', 'font-weight': 'bold', 'overlay-color': color.origin, 'overlay-opacity': 0.14, 'overlay-padding': 9, 'z-index': 22 } },
        { selector: 'node.evidence-neighbor', style: { 'border-color': color.muted, 'border-width': 2 } },
        { selector: '.dimmed', style: { opacity: 0.1, 'text-opacity': 0 } },
        {
          selector: 'edge',
          style: {
            width: 1,
            'line-color': color.edge,
            'target-arrow-color': color.edge,
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.6,
            'curve-style': 'bezier',
            opacity: 0.55,
            label: '',
            'font-size': 7,
            color: color.muted,
            'text-rotation': 'autorotate',
            'text-outline-color': color.bg,
            'text-outline-width': 2,
          } as cytoscape.Css.Edge,
        },
        { selector: 'edge.connected', style: { 'line-color': color.cluster, 'target-arrow-color': color.cluster, width: 2, opacity: 1, label: 'data(label)' } },
        { selector: 'edge.cluster-edge', style: { 'line-color': color.cluster, 'target-arrow-color': color.cluster, width: 2, opacity: 1 } },
        { selector: 'edge.evidence-edge', style: { 'line-color': color.evidence, 'target-arrow-color': color.evidence, width: 2, opacity: 1 } },
        { selector: ':selected', style: { 'border-color': color.text, 'border-width': 5, 'overlay-opacity': 0, label: 'data(label)' } },
      ],
      layout: layoutFor(nodes.length, false),
    });

    cy.on('tap', 'node', (event) => {
      const selected = event.target as cytoscape.NodeSingular;
      cy.elements().removeClass('connected dimmed');
      const neighborhood = selected.closedNeighborhood();
      neighborhood.addClass('connected');
      cy.elements().difference(neighborhood).addClass('dimmed');
      const node = nodes.find((item) => item.id === selected.id());
      if (node) onSelectNodeRef.current(node);
    });
    cy.on('tap', (event) => {
      if (event.target === cy) {
        cy.elements().removeClass('connected dimmed');
        onSelectNodeRef.current(null);
      }
    });
    cy.on('mouseover', 'node', (event) => event.target.addClass('hovered'));
    cy.on('mouseout', 'node', (event) => event.target.removeClass('hovered'));

    cyRef.current = cy;
    const resizeObserver = new ResizeObserver(() => cy.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      cy.destroy();
      if (cyRef.current === cy) cyRef.current = null;
    };
  }, [graphData]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (showLabels) cy.nodes().addClass('show-label');
    else cy.nodes().removeClass('show-label');
  }, [showLabels, graphData]);

  const withGraph = (action: (cy: cytoscape.Core) => void) => {
    const cy = cyRef.current;
    if (cy && cy.nodes().nonempty()) action(cy);
  };

  const zoomBy = (factor: number) =>
    withGraph((cy) => cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }));

  const handleFocus = () =>
    withGraph((cy) => {
      const selected = cy.$(':selected');
      const targets = selected.nonempty()
        ? selected.closedNeighborhood()
        : cy.collection().union(focusedIdsRef.current.map((id) => cy.$id(id)));
      if (targets.nonempty()) fitTo(cy, targets, 90);
    });

  const handleResetLayout = () =>
    withGraph((cy) => {
      cy.elements().removeClass(HIGHLIGHT_CLASSES);
      cy.layout(layoutFor(cy.nodes().length, !reducedMotion)).run();
    });

  const nodeCount = graphData?.nodes.length ?? 0;
  const edgeCount = graphData?.edges.length ?? 0;
  const controls = [
    { label: 'Zoom in', icon: ZoomIn, onClick: () => zoomBy(1.25) },
    { label: 'Zoom out', icon: ZoomOut, onClick: () => zoomBy(1 / 1.25) },
    { label: 'Fit graph', icon: Maximize, onClick: () => withGraph((cy) => fitTo(cy, cy.elements(), 40)) },
    { label: 'Focus selected or highlighted nodes', icon: LocateFixed, onClick: handleFocus },
    { label: 'Reset layout and highlights', icon: RefreshCw, onClick: handleResetLayout },
  ];

  return (
    <section className="og-card og-frame relative flex h-full min-h-[520px] w-full flex-col overflow-hidden" aria-label="Investigation graph">
      <header className="og-card-header shrink-0">
        <div className="min-w-0">
          <span className="og-kicker block mb-1" style={{ fontSize: 9.5 }}>Cytoscape · force layout</span>
          <h3 className="og-section-title">
            <Network className="h-4 w-4 shrink-0 text-accent-olive" strokeWidth={1.75} aria-hidden="true" />
            Investigation graph
            <span className="og-badge ml-1 hidden md:inline-flex og-tabular">{nodeCount} nodes · {edgeCount} links</span>
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1" role="toolbar" aria-label="Graph controls">
          <button
            type="button"
            onClick={() => setShowLabels((value) => !value)}
            className="og-icon-btn"
            aria-pressed={showLabels}
            aria-label="Toggle labels"
            title="Toggle labels"
            style={showLabels ? { color: 'var(--og-olive)', borderColor: 'rgb(var(--og-olive-rgb) / 0.45)' } : undefined}
          >
            <Tag className="h-3.5 w-3.5" />
          </button>
          {controls.map(({ label, icon: Icon, onClick }) => (
            <button key={label} type="button" onClick={onClick} className="og-icon-btn" aria-label={label} title={label}>
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </header>

      <div
        ref={containerRef}
        className="w-full flex-1 min-h-[420px] cursor-grab active:cursor-grabbing bg-grid-pattern"
        aria-label="Interactive network graph. Click a node for details."
      />

      {isLoading && (
        <div className="og-updating-overlay absolute inset-0 top-[58px] z-20 flex items-center justify-center" role="status">
          <LoadingSpinner message={graphData ? 'Updating graph…' : 'Loading graph…'} />
        </div>
      )}
      {!isLoading && error && (
        <div className="absolute inset-0 top-[58px] z-20 flex items-center justify-center p-6 text-center" style={{ background: 'rgb(var(--og-bg-rgb) / 0.88)' }} role="alert">
          <div className="max-w-sm og-empty">
            <AlertTriangle className="h-8 w-8 text-accent-crimson" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">Graph unavailable</p>
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        </div>
      )}
      {!isLoading && !error && isEmpty && (
        <div className="absolute inset-0 top-[58px] z-20 flex items-center justify-center p-6" style={{ background: 'rgb(var(--og-bg-rgb) / 0.7)' }}>
          <div className="og-empty max-w-sm">
            <SearchX className="h-8 w-8" strokeWidth={1.4} aria-hidden="true" />
            <span className="og-stamp" style={{ color: 'var(--og-subtle)' }}>No graph data</span>
            <p className="text-xs leading-relaxed">No posts match the active filters. Widen the date range or lower the thresholds.</p>
          </div>
        </div>
      )}

      <div
        className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 sm:right-auto rounded-lg px-3 py-2"
        style={{ border: '1px solid var(--og-border)', background: 'rgb(var(--og-bg-rgb) / 0.82)', backdropFilter: 'blur(10px)' }}
        role="list"
        aria-label="Graph legend"
      >
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[10px] font-mono text-ink/75">
          {LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5" role="listitem">
              <span className={`h-2 w-2 shrink-0 ${item.className}`} aria-hidden="true" />
              {item.label}
            </span>
          ))}
          {[
            ['AI evidence', 'var(--og-mauve)'],
            ['Origin', 'var(--og-oxide)'],
            ['Cluster', 'var(--og-olive)'],
          ].map(([label, ring]) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-ink/55" role="listitem">
              <span className="h-2 w-2 rounded-full" style={{ boxShadow: `0 0 0 2px ${ring}` }} aria-hidden="true" /> {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
});

GraphCanvas.displayName = 'GraphCanvas';
