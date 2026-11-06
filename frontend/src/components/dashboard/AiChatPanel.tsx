import React, { useState } from 'react';
import { Bot, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { AiEvidenceResponse, FilterState } from '../../types/graph';

interface Props {
  filters: FilterState;
  hasEvidenceHighlights: boolean;
  onEvidenceHighlight: (response: AiEvidenceResponse) => void;
  onClearHighlights: () => void;
}

export const AiChatPanel: React.FC<Props> = ({
  filters,
  hasEvidenceHighlights,
  onClearHighlights,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const activeContext = [
    filters.platform === 'ALL' ? 'all platforms' : filters.platform,
    `${filters.dateFrom} → ${filters.dateTo}`,
    `severity ≥ ${Math.round(filters.minSeverity * 100)}%`,
    `density ≥ ${filters.minDensity}`,
  ].join(' · ');

  return (
    <div className="og-card overflow-hidden shadow-panel">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full og-card-header bg-slate-900/60 hover:bg-slate-800/50 transition-colors text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white glow-cyan">
            <Bot className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-mono font-bold text-white tracking-wide">
                GraphRAG Forensic Analyst
              </h3>
              <span className="og-badge-muted">Evidence-ready</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
              AI requests use the same active filters as graph and analytics
            </p>
          </div>
        </div>
        <span className="text-slate-400 p-1 shrink-0" aria-hidden>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>

      {isOpen && (
        <div className="p-4 flex flex-col gap-4 border-t border-slate-800/80 bg-slate-950/30">
          <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-slate-200">Graph evidence highlighting is ready for AI responses.</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                When `/ai/query` returns, pass its response to `onEvidenceHighlight`.
                IDs outside the filtered graph are reported as unavailable;
                the active filters are never changed to make them appear.
              </p>
              <p className="mt-2 break-words text-[10px] font-mono text-cyan-300/80">
                Current context: {activeContext}
              </p>
              {hasEvidenceHighlights && (
                <button
                  type="button"
                  onClick={onClearHighlights}
                  className="og-btn-ghost mt-3"
                >
                  Clear graph evidence highlights
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
