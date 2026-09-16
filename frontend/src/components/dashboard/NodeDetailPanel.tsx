import React from 'react';
import { GraphNode } from '../../types/graph';
import { X, User, MessageSquare, Hash, Network, ShieldAlert } from 'lucide-react';

interface Props {
  node: GraphNode | null;
  onClose: () => void;
}

export const NodeDetailPanel: React.FC<Props> = ({ node, onClose }) => {
  if (!node) return null;

  const getIcon = () => {
    switch (node.label) {
      case 'User':
        return <User className="w-4 h-4 text-cyan-400 shrink-0" strokeWidth={1.75} />;
      case 'Post':
        return <MessageSquare className="w-4 h-4 text-purple-400 shrink-0" strokeWidth={1.75} />;
      case 'Hashtag':
        return <Hash className="w-4 h-4 text-amber-400 shrink-0" strokeWidth={1.75} />;
      case 'IPAddress':
        return <Network className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={1.75} />;
      default:
        return <User className="w-4 h-4 text-cyan-400 shrink-0" strokeWidth={1.75} />;
    }
  };

  return (
    <div className="absolute top-4 right-4 z-30 w-[min(100%,20rem)] og-card p-4 shadow-panel font-mono text-xs animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {getIcon()}
          <span className="font-bold text-white uppercase text-xs tracking-wide truncate">
            {node.label} Details
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="og-btn-ghost p-1.5 shrink-0"
          aria-label="Close node details"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      <div className="py-3 space-y-2">
        <div className="flex justify-between gap-3 py-1 border-b border-slate-800/60">
          <span className="text-slate-500 shrink-0">Node ID</span>
          <span className="text-cyan-300 font-semibold text-right break-all">{node.id}</span>
        </div>

        {node.props.handle && (
          <div className="flex justify-between gap-3 py-1 border-b border-slate-800/60">
            <span className="text-slate-500">Handle</span>
            <span className="text-white font-bold text-right">{node.props.handle}</span>
          </div>
        )}

        {node.props.flagged !== undefined && (
          <div className="flex justify-between gap-3 py-1 border-b border-slate-800/60 items-center">
            <span className="text-slate-500">Flagged</span>
            {node.props.flagged ? (
              <span className="og-badge-danger inline-flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                Suspicious bot
              </span>
            ) : (
              <span className="text-emerald-400">Normal</span>
            )}
          </div>
        )}

        {node.props.text && (
          <div className="py-1 border-b border-slate-800/60">
            <span className="text-slate-500 block mb-1">Post content</span>
            <p className="text-slate-200 bg-slate-950/80 border border-slate-800/80 p-2 rounded-lg text-[11px] leading-relaxed font-sans">
              &ldquo;{node.props.text}&rdquo;
            </p>
          </div>
        )}

        {node.props.severity !== undefined && (
          <div className="flex justify-between gap-3 py-1 border-b border-slate-800/60">
            <span className="text-slate-500">Threat severity</span>
            <span className="text-amber-400 font-bold">{Math.round(node.props.severity * 100)}%</span>
          </div>
        )}

        {node.props.geo && (
          <div className="flex justify-between gap-3 py-1">
            <span className="text-slate-500">Geo</span>
            <span className="text-emerald-400">{node.props.geo}</span>
          </div>
        )}
      </div>
    </div>
  );
};
