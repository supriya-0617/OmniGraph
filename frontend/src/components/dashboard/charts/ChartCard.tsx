import React, { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';

interface Props {
  title: string;
  kicker?: string;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  legend?: React.ReactNode;
  /** Accessible table view of the same data; when provided a Chart/Table toggle is shown. */
  table?: React.ReactNode;
  updating?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Shared frame for analytics charts: header, legend row, chart ↔ table toggle, refetch dimming. */
export const ChartCard: React.FC<Props> = ({ title, kicker, icon, meta, legend, table, updating, className = '', children }) => {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className={`og-card flex flex-col ${className}`} aria-busy={updating || undefined}>
      <header className="og-card-header">
        <div className="min-w-0">
          {kicker && <span className="og-kicker block mb-1" style={{ fontSize: 9.5 }}>{kicker}</span>}
          <h3 className="og-section-title">
            {icon}
            <span className="truncate">{title}</span>
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {meta}
          {table && (
            <div className="inline-flex rounded-md p-0.5" style={{ border: '1px solid var(--og-border)' }} role="group" aria-label="View">
              {(['chart', 'table'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  aria-pressed={view === option}
                  aria-label={`Show ${option}`}
                  className="grid place-items-center w-7 h-6 rounded transition-colors"
                  style={view === option ? { background: 'rgba(34,225,255,0.12)', color: 'var(--og-cyan)' } : { color: 'var(--og-muted)' }}
                >
                  {option === 'chart' ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {legend && view === 'chart' && <div className="px-4 pt-3 flex flex-wrap gap-x-4 gap-y-1.5">{legend}</div>}
      <div className="flex-1 min-h-0 transition-opacity duration-200" style={{ opacity: updating ? 0.45 : 1 }}>
        {view === 'table' && table ? <div className="p-4 overflow-auto max-h-[320px]">{table}</div> : children}
      </div>
    </section>
  );
};

export const LegendItem: React.FC<{ color: string; label: string; shape?: 'square' | 'line' }> = ({ color, label, shape = 'square' }) => (
  <span className="inline-flex items-center gap-2 text-[11px] text-ink/80">
    <span
      aria-hidden="true"
      style={shape === 'line' ? { width: 14, height: 2, background: color } : { width: 9, height: 9, borderRadius: 2, background: color }}
    />
    {label}
  </span>
);

export const ChartTooltip: React.FC<{
  active?: boolean;
  label?: React.ReactNode;
  rows: Array<{ color: string; label: string; value: React.ReactNode }>;
}> = ({ active, label, rows }) => {
  if (!active || !rows.length) return null;
  return (
    <div
      className="px-3 py-2 text-[11px] font-mono"
      style={{
        border: '1px solid var(--og-border-strong)',
        borderRadius: 8,
        background: 'rgba(8, 11, 19, 0.94)',
        backdropFilter: 'blur(12px)',
        boxShadow: '4px 4px 0 -1px #06080e, 4px 4px 0 0 rgba(34,225,255,0.35)',
        color: 'var(--og-text)',
      }}
    >
      {label && <div className="mb-1.5 text-ink/60">{label}</div>}
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color }} aria-hidden="true" />
          <span className="text-ink/70">{row.label}</span>
          <span className="ml-auto pl-4 og-tabular font-semibold">{row.value}</span>
        </div>
      ))}
    </div>
  );
};

export const DataTable: React.FC<{ columns: string[]; rows: Array<Array<React.ReactNode>> }> = ({ columns, rows }) => (
  <table className="og-table" style={{ minWidth: 0 }}>
    <thead>
      <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
    </thead>
    <tbody>
      {rows.map((row, index) => (
        <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="og-tabular">{cell}</td>)}</tr>
      ))}
    </tbody>
  </table>
);

export const ChartEmpty: React.FC<{ message: string }> = ({ message }) => (
  <div className="og-empty h-full min-h-[160px]">
    <span className="og-stamp" style={{ color: 'var(--og-subtle)' }}>No data</span>
    <span className="text-xs">{message}</span>
  </div>
);

export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 220 }) => (
  <div className="og-card p-4" aria-hidden="true">
    <div className="og-skeleton h-3 w-32 mb-5" />
    <div className="flex items-end gap-2" style={{ height }}>
      {[40, 65, 50, 80, 55, 90, 70, 45, 60, 75].map((h, i) => (
        <div key={i} className="og-skeleton flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);
