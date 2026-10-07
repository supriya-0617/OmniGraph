import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { useFilters } from '../../context/FilterContext';
import { GraphData, GraphNode } from '../../types/graph';
import { Network, RefreshCw, Info } from 'lucide-react';

interface Props {
  onSelectNode: (node: GraphNode | null) => void;
  highlightNodeId?: string | null;
  graphData?: GraphData | null;
}

const LEGEND_ITEMS = [
  { label: 'User', className: 'rounded-full bg-cyan-500' },
  { label: 'Flagged Account', className: 'rounded-full bg-rose-500 ring-2 ring-rose-300/80' },
  { label: 'Post', className: 'rounded-sm bg-violet-500' },
  { label: 'Hashtag', className: 'rotate-45 bg-amber-500' },
  { label: 'IP Address', className: 'rounded-sm bg-emerald-500' },
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

export const GraphCanvas: React.FC<Props> = ({ onSelectNode, highlightNodeId, graphData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { filters } = useFilters();
  const [isEmpty, setIsEmpty] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const sampleElements: Array<{ data: CytoscapeElementData }> = [
      { data: { id: 'u_001', label: '@alpha_intel', type: 'User', flagged: false, severity: 0.2 } },
      { data: { id: 'u_004', label: '@shadow_bot01', type: 'User', flagged: true, severity: 0.95 } },
      { data: { id: 'u_005', label: '@shadow_bot02', type: 'User', flagged: true, severity: 0.92 } },
      { data: { id: 'u_006', label: '@shadow_bot03', type: 'User', flagged: true, severity: 0.92 } },
      { data: { id: 'u_003', label: '@nexus_news', type: 'User', flagged: false, severity: 0.4 } },
      { data: { id: 'p_001', label: 'Post #1', type: 'Post', text: 'Spike in network activity...', severity: 0.85 } },
      { data: { id: 'p_002', label: 'Post #2', type: 'Post', text: 'URGENT: System breakdown imminent!', severity: 0.92 } },
      { data: { id: 'h_001', label: '#DisinfoCampaign', type: 'Hashtag' } },
      { data: { id: 'h_002', label: '#BotnetDetected', type: 'Hashtag' } },
      { data: { id: 'ip_200', label: 'IP: 192.0.2.100', type: 'IPAddress', geo: 'PROXY' } },
      { data: { source: 'u_004', target: 'ip_200', label: 'POSTED_FROM' } },
      { data: { source: 'u_005', target: 'ip_200', label: 'POSTED_FROM' } },
      { data: { source: 'u_006', target: 'ip_200', label: 'POSTED_FROM' } },
      { data: { source: 'u_004', target: 'p_002', label: 'POSTED' } },
      { data: { source: 'u_005', target: 'p_002', label: 'RETWEETED' } },
      { data: { source: 'u_006', target: 'p_002', label: 'RETWEETED' } },
      { data: { source: 'p_002', target: 'h_001', label: 'MENTIONS' } },
      { data: { source: 'p_002', target: 'h_002', label: 'MENTIONS' } },
      { data: { source: 'u_001', target: 'p_001', label: 'POSTED' } },
      { data: { source: 'p_001', target: 'h_001', label: 'MENTIONS' } },
    ];
    const elements: Array<{ data: CytoscapeElementData }> = graphData === undefined
      ? sampleElements
      : [
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
            'background-color': '#8ce0bd',
            label: 'data(label)',
            color: '#e7efeb',
            'font-size': '10px',
            'font-family': 'JetBrains Mono, monospace',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            width: 28,
            height: 28,
            'border-width': 2,
            'border-color': '#0b1114',
          },
        },
        {
          selector: 'node[type = "User"]',
          style: { 'background-color': '#8ce0bd', shape: 'ellipse' },
        },
        {
          selector: 'node[flagged]',
          style: {
            'background-color': '#ff896f',
            'border-color': '#ffd0c5',
            'border-width': 3,
            width: 34,
            height: 34,
          },
        },
        {
          selector: 'node[type = "Post"]',
          style: { 'background-color': '#d8cf78', shape: 'round-rectangle' },
        },
        {
          selector: 'node[type = "Hashtag"]',
          style: { 'background-color': '#ff896f', shape: 'diamond' },
        },
        {
          selector: 'node[type = "IPAddress"]',
          style: { 'background-color': '#9fc8b4', shape: 'hexagon' },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#52625e',
            'target-arrow-color': '#52625e',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '8px',
            color: '#94a5a3',
            'text-rotation': 'autorotate',
          },
        },
        {
          selector: ':selected',
          style: {
            'border-color': '#8ce0bd',
            'border-width': 4,
            'line-color': '#8ce0bd',
            'target-arrow-color': '#8ce0bd',
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
        cyRef.current.animate({
          center: { eles: node },
          zoom: 1.5,
          duration: 500,
        });
        node.select();
      }
    }
  }, [highlightNodeId]);

  const handleResetLayout = () => {
    if (cyRef.current) {
      const layoutOptions: cytoscape.LayoutOptions =
        graphData === undefined
          ? { name: 'cose', animate: true, numIter: 150 }
          : {
              name: 'concentric',
              animate: true,
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
            {graphData === undefined ? 'Demo graph · sample data' : 'Filtered graph results'}
          </span>
          <button type="button" onClick={handleResetLayout} className="og-btn-ghost" title="Reset Graph Layout">
            <RefreshCw className="w-3 h-3 text-cyan-400 shrink-0" strokeWidth={1.75} />
            <span>Reset Layout</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full flex-1 min-h-[420px] relative cursor-grab active:cursor-grabbing bg-[#080c14]"
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
