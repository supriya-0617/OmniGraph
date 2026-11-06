import React, { useMemo } from 'react';
import { Bot, Hash, LocateFixed, MessageSquare, Network, ShieldAlert, User, X } from 'lucide-react';
import { GraphData, GraphNode } from '../../types/graph';

interface Props {
  node: GraphNode | null;
  onClose: () => void;
  /** Rendered graph, used to list connected evidence. */
  graphData?: GraphData | null;
  onSelectNode?: (node: GraphNode) => void;
  onFocusNodes?: (nodeIds: string[]) => void;
  onAskAi?: (node: GraphNode) => void;
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string }> = {
  User: { icon: User, color: 'var(--og-mint)' },
  Post: { icon: MessageSquare, color: 'var(--og-amber)' },
  Hashtag: { icon: Hash, color: 'var(--og-violet)' },
  IPAddress: { icon: Network, color: 'var(--og-ip)' },
};

const RELATION_LABEL: Record<string, [string, string]> = {
  // [outgoing, incoming]
  POSTED: ['Posted', 'Posted by'],
  RETWEETED: ['Retweeted', 'Retweeted by'],
  MENTIONS: ['Mentions', 'Mentioned in'],
  POSTED_FROM: ['Connects from', 'Accounts on this IP'],
  FOLLOWS: ['Follows', 'Followed by'],
  REPLIED_TO: ['Replies to', 'Replies'],
  TAGGED_USER: ['Tags', 'Tagged in'],
};

function display(node: GraphNode): string {
  return node.props.handle ?? node.props.tag ?? node.props.address ?? (node.props.text ? `${String(node.props.text).slice(0, 48)}…` : node.id);
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid rgba(150,170,215,0.08)' }}>
    <span className="text-ink/50 shrink-0">{label}</span>
    <span className="text-right text-ink/90 break-all">{children}</span>
  </div>
);

/** Selected-node inspector (Person-1 workstream) with connected evidence. */
export const NodeDetailPanel: React.FC<Props> = ({ node, onClose, graphData, onSelectNode, onFocusNodes, onAskAi }) => {
  const connections = useMemo(() => {
    if (!node || !graphData) return [];
    const byId = new Map(graphData.nodes.map((item) => [item.id, item]));
    const groups = new Map<string, GraphNode[]>();
    graphData.edges.forEach((edge) => {
      const outgoing = edge.source === node.id;
      if (!outgoing && edge.target !== node.id) return;
      const other = byId.get(outgoing ? edge.target : edge.source);
      if (!other) return;
      const label = (RELATION_LABEL[edge.type] ?? [edge.type, edge.type])[outgoing ? 0 : 1];
      groups.set(label, [...(groups.get(label) ?? []), other]);
    });
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [node, graphData]);

  if (!node) return null;
  const meta = TYPE_META[node.label] ?? TYPE_META.User;
  const Icon = meta.icon;
  const createdDaysAgo = node.props.created_at ? Math.floor((Date.now() - new Date(node.props.created_at).getTime()) / 864e5) : null;
  const neighborIds = connections.flatMap(([, nodes]) => nodes.map((item) => item.id));

  return (
    <aside
      aria-label={`${node.label} details`}
      className="og-node-detail-panel og-card absolute top-[70px] right-3 z-30 w-[min(100%-1.5rem,22rem)] max-h-[calc(100%-90px)] overflow-y-auto font-mono text-xs animate-[fadeIn_0.2s_ease-out]"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--og-border)', background: 'var(--og-glass-strong)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid place-items-center w-8 h-8 rounded-lg shrink-0" style={{ color: meta.color, border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)`, background: `color-mix(in srgb, ${meta.color} 10%, transparent)` }}>
            <Icon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span className="og-kicker block" style={{ fontSize: 9 }}>{node.label}</span>
            <span className="block text-[13px] font-sans font-semibold text-ink truncate">{display(node)}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="og-icon-btn shrink-0" aria-label="Close node details">
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="px-4 py-3 space-y-0.5">
        {node.props.flagged !== undefined && (
          <div className="flex items-center justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid rgba(150,170,215,0.08)' }}>
            <span className="text-ink/50">Status</span>
            {node.props.flagged ? (
              <span className="og-badge-danger"><ShieldAlert className="w-3 h-3" aria-hidden="true" /> Flagged</span>
            ) : (
              <span className="og-badge-mint">Not flagged</span>
            )}
          </div>
        )}
        {node.props.text && (
          <div className="py-2" style={{ borderBottom: '1px solid rgba(150,170,215,0.08)' }}>
            <span className="text-ink/50 block mb-1.5">Post text</span>
            <p className="font-sans text-[12px] leading-relaxed text-ink/90 rounded-md p-2.5" style={{ background: 'rgba(4,6,11,0.6)', border: '1px solid var(--og-border)' }}>
              “{node.props.text}”
            </p>
          </div>
        )}
        {node.props.severity !== undefined && (
          <Row label="Severity">
            <span style={{ color: Number(node.props.severity) >= 0.7 ? 'var(--og-coral)' : 'var(--og-text)' }}>{Math.round(Number(node.props.severity) * 100)}%</span>
          </Row>
        )}
        {node.props.platform && <Row label="Platform">{node.props.platform}</Row>}
        {node.props.timestamp && <Row label="Posted">{new Date(node.props.timestamp).toLocaleString()}</Row>}
        {node.props.follower_count !== undefined && <Row label="Followers">{Number(node.props.follower_count).toLocaleString()}</Row>}
        {createdDaysAgo !== null && (
          <Row label="Account age">
            <span style={{ color: createdDaysAgo < 60 ? 'var(--og-amber)' : undefined }}>
              {createdDaysAgo} days{createdDaysAgo < 60 ? ' · new' : ''}
            </span>
          </Row>
        )}
        {node.props.network_type && <Row label="Network">{node.props.network_type}</Row>}
        {(node.props.geo_region || node.props.geo) && <Row label="Region">{node.props.geo_region ?? node.props.geo}</Row>}
        <Row label="Node ID"><span className="text-accent-cyan">{node.id}</span></Row>
      </div>

      {connections.length > 0 && (
        <div className="px-4 pb-3">
          <p className="og-kicker mb-2" style={{ fontSize: 9.5 }}>Connected evidence · {neighborIds.length}</p>
          <div className="space-y-2.5">
            {connections.map(([label, nodes]) => (
              <div key={label}>
                <span className="text-ink/50">{label} <span className="text-ink/35">({nodes.length})</span></span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {nodes.slice(0, 8).map((item) => (
                    <button key={item.id} type="button" className="og-chip max-w-[200px]" onClick={() => onSelectNode?.(item)} title={item.id} disabled={!onSelectNode}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: (TYPE_META[item.label] ?? TYPE_META.User).color }} aria-hidden="true" />
                      <span className="truncate">{display(item)}</span>
                    </button>
                  ))}
                  {nodes.length > 8 && <span className="og-chip cursor-default">+{nodes.length - 8}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(onFocusNodes || onAskAi) && (
        <footer className="sticky bottom-0 flex gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--og-border)', background: 'var(--og-glass-strong)' }}>
          {onFocusNodes && (
            <button type="button" className="og-btn-ghost flex-1 min-h-[34px]" onClick={() => onFocusNodes([node.id, ...neighborIds])}>
              <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" /> Focus
            </button>
          )}
          {onAskAi && (
            <button type="button" className="og-btn-primary og-btn-violet flex-1 min-h-[34px] text-[11.5px]" onClick={() => onAskAi(node)}>
              <Bot className="w-3.5 h-3.5" aria-hidden="true" /> Ask AI
            </button>
          )}
        </footer>
      )}
    </aside>
  );
};
