import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { useFilters } from '../../context/FilterContext';
import { GraphData, GraphNode } from '../../types/graph';
import { Network, RefreshCw, Info } from 'lucide-react';

interface Props {
  onSelectNode: (node: GraphNode | null) => void;
  highlightNodeId?: string | null;
  /** Evidence set from the AI analyst or a selected cluster; other elements are faded. */
  highlightNodeIds?: string[];
  /** Likely-origin node from the AI analyst (drawn with an amber ring). */
  originNodeId?: string | null;
  graphData?: GraphData | null;
}

const LEGEND_ITEMS = [
  { label: 'User', className: 'rounded-full og-node-legend-user' },
  { label: 'Flagged Account', className: 'rounded-full og-node-legend-flagged' },
  { label: 'Post', className: 'rounded-sm og-node-legend-post' },
  { label: 'Hashtag', className: 'rotate-45 og-node-legend-hashtag' },
  { label: 'IP Address', className: 'rounded-sm og-node-legend-ip' },
];

interface CytoscapeElementData {
  id?: string;
  source?: string;
  target?: string;
  label?: string;
  type?: string;
  severity?: number;
  flagged?: boolean;
  text?: string;
  [key: string]: any;
}

export const GraphCanvas: React.FC<Props> = ({ onSelectNode, highlightNodeId, highlightNodeIds, originNodeId, graphData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { filters } = useFilters();
  const [isEmpty, setIsEmpty] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const palette = getComputedStyle(containerRef.current);
    const graphColors = {
      mint: palette.getPropertyValue('--og-mint').trim(),
      coral: palette.getPropertyValue('--og-coral').trim(),
      amber: palette.getPropertyValue('--og-amber').trim(),
      violet: palette.getPropertyValue('--og-violet').trim(),
      text: palette.getPropertyValue('--og-text').trim(),
      muted: palette.getPropertyValue('--og-muted').trim(),
      border: palette.getPropertyValue('--og-subtle').trim(),
      ip: palette.getPropertyValue('--og-ip').trim(),
      background: palette.getPropertyValue('--og-bg').trim(),
    };

    const elements: Array<{ data: CytoscapeElementData }> = [
          ...(graphData?.nodes ?? []).map((node) => ({
            data: {
              ...node.props,
              id: node.id,
              label:
                node.props.handle ??
                node.props.tag ??
                node.props.address ??
                (node.label === 'Post' ? `Post ${node.id}` : node.id),
              type: node.label,
            },
          })),
          ...(graphData?.edges ?? []).map((edge, index) => ({
            data: {
              id: `${edge.source}-${edge.type}-${edge.target}-${index}`,
              source: edge.source,
              target: edge.target,
              label: edge.type,
              timestamp: edge.timestamp,
            },
          })),
        ];

    const filteredNodes = elements.filter((el) => {
      if (el.data.source || el.data.target) return false;
      if (el.data.severity !== undefined) {
        return el.data.severity >= filters.minSeverity;
      }
      return true;
    });
    const visibleNodeIds = new Set(filteredNodes.map((el) => el.data.id));
    const filteredElements = [
      ...filteredNodes,
      ...elements.filter(
        (el) =>
          el.data.source &&
          visibleNodeIds.has(el.data.source) &&
          visibleNodeIds.has(el.data.target)
      ),
    ];

    setIsEmpty(filteredElements.length === 0);

    const layout = graphData === undefined
      ? { name: 'cose', animate: false, padding: 50, numIter: 150 }
      : {
          name: 'concentric',
          animate: false,
          padding: 50,
          concentric: (node: cytoscape.NodeSingular) =>
            (node.data('flagged') ? 100 : 0) + node.degree(),
          levelWidth: () => 2,
        };

    const cy = cytoscape({
      container: containerRef.current,
      elements: filteredElements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': graphColors.mint,
            label: 'data(label)',
            color: graphColors.text,
            'font-size': '10px',
            'font-family': 'JetBrains Mono, monospace',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            width: 28,
            height: 28,
            'border-width': 2,
            'border-color': graphColors.background,
          },
        },
        {
          selector: 'node[type = "User"]',
          style: { 'background-color': graphColors.mint, shape: 'ellipse' },
        },
        {
          selector: 'node[?flagged]',
          style: {
            'background-color': graphColors.coral,
            'border-color': '#f5c2b2',
            'border-width': 3,
            width: 34,
            height: 34,
          },
        },
        {
          selector: 'node[type = "Post"]',
          style: { 'background-color': graphColors.amber, shape: 'round-rectangle' },
        },
        {
          selector: 'node[type = "Hashtag"]',
          style: { 'background-color': graphColors.violet, shape: 'diamond' },
        },
        {
          selector: 'node[type = "IPAddress"]',
          style: { 'background-color': graphColors.ip, shape: 'hexagon' },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': graphColors.border,
            'target-arrow-color': graphColors.border,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '8px',
            color: graphColors.muted,
            'text-rotation': 'autorotate',
          },
        },
        {
          selector: '.faded',
          style: { opacity: 0.12, 'text-opacity': 0 },
        },
        {
          selector: 'node.evidence',
          style: {
            'border-color': graphColors.violet,
            'border-width': 4,
            'overlay-color': graphColors.violet,
            'overlay-opacity': 0.12,
            'overlay-padding': 6,
            'z-index': 20,
          },
        },
        {
          selector: 'edge.evidence',
          style: { 'line-color': graphColors.violet, 'target-arrow-color': graphColors.violet, width: 2.5, 'z-index': 19 },
        },
        {
          selector: 'node.origin',
          style: {
            'border-color': graphColors.amber,
            'border-width': 5,
            width: 44,
            height: 44,
            'overlay-color': graphColors.amber,
            'overlay-opacity': 0.16,
            'overlay-padding': 8,
            'font-weight': 'bold',
            'z-index': 21,
          },
        },
        {
          selector: ':selected',
          style: {
            'border-color': graphColors.mint,
            'border-width': 4,
            'line-color': graphColors.mint,
            'target-arrow-color': graphColors.mint,
          },
        },
      ],
      layout,
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      onSelectNode({
        id: node.id(),
        label: node.data('type') || 'User',
        props: node.data(),
      });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        onSelectNode(null);
      }
    });

    cyRef.current = cy;
    const resizeObserver = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 40);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      cy.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback identity should not recreate the graph
  }, [filters, graphData]);

  useEffect(() => {
    if (cyRef.current && highlightNodeId) {
      const node = cyRef.current.$id(highlightNodeId);
      if (node.length > 0) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          cyRef.current.center(node);
          cyRef.current.zoom(1.5);
        } else {
          cyRef.current.animate({
            center: { eles: node },
            zoom: 1.5,
            duration: 500,
          });
        }
        node.select();
      }
    }
  }, [highlightNodeId]);

  // AI evidence / cluster highlighting: emphasise the set, fade everything else.
  const highlightKey = (highlightNodeIds ?? []).join('|') + `#${originNodeId ?? ''}`;
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('evidence origin faded');
    const ids = new Set(highlightNodeIds ?? []);
    if (originNodeId) ids.add(originNodeId);
    const nodes = cy.nodes().filter((node) => ids.has(node.id()));
    if (nodes.length === 0) return;
    const edges = nodes.edgesWith(nodes);
    nodes.addClass('evidence');
    edges.addClass('evidence');
    if (originNodeId) cy.$id(originNodeId).addClass('origin');
    cy.elements().difference(nodes.union(edges)).addClass('faded');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) cy.fit(nodes, 80);
    else cy.animate({ fit: { eles: nodes, padding: 80 }, duration: 550, easing: 'ease-in-out-cubic' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id set
  }, [highlightKey, graphData]);

  const handleResetLayout = () => {
    if (cyRef.current) {
      const layoutOptions: cytoscape.LayoutOptions =
        graphData === undefined
          ? {
              name: 'cose',
              animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
              numIter: 150,
            }
          : {
              name: 'concentric',
              animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
              concentric: (node: cytoscape.NodeSingular) =>
                (node.data('flagged') ? 100 : 0) + node.degree(),
              levelWidth: () => 2,
            };
      cyRef.current.layout(layoutOptions).run();
      cyRef.current.fit(undefined, 40);
    }
  };

  return (
    <div className="og-card relative w-full h-full min-h-[520px] bg-surface bg-grid-pattern overflow-hidden flex flex-col shadow-panel-glow">
      <div className="og-card-header bg-slate-900/50 shrink-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono">
          <Network className="w-4 h-4 text-cyan-400 shrink-0" strokeWidth={1.75} />
          <span className="font-semibold text-white">Cytoscape Network Workspace</span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="text-slate-400">Interactive Node Canvas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="og-badge-muted hidden md:inline-flex">
            {highlightNodeIds?.length ? `${highlightNodeIds.length} highlighted` : 'Filtered graph results'}
          </span>
          <button type="button" onClick={handleResetLayout} className="og-btn-ghost" title="Reset Graph Layout">
            <RefreshCw className="w-3 h-3 text-cyan-400 shrink-0" strokeWidth={1.75} />
            <span>Reset Layout</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full flex-1 min-h-[420px] relative cursor-grab active:cursor-grabbing bg-surface"
      />

      {isEmpty && (
        <div className="absolute inset-0 top-12 bg-surface/90 backdrop-blur flex flex-col items-center justify-center p-6 text-center z-20">
          <Info className="w-12 h-12 text-slate-600 mb-3" strokeWidth={1.25} />
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">
            No Graph Data In Active Filter
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mt-2 leading-relaxed">
            Adjust the active filters to expand the sub-graph view.
          </p>
        </div>
      )}

      <div
        className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-xl z-10 og-card px-3 py-2.5 bg-slate-900/95 border-slate-800/90"
        role="list"
        aria-label="Graph legend"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-mono">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="inline-flex items-center gap-2" role="listitem">
              <span className={`w-2.5 h-2.5 shrink-0 ${item.className}`} aria-hidden />
              <span className="text-slate-300 whitespace-nowrap">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
