import React from 'react';

interface Props {
  title: string;
  value: string | number;
  change?: string;
  isDanger?: boolean;
  icon: React.ReactNode;
}

export const KpiCard: React.FC<Props> = ({ title, value, change, isDanger, icon }) => {
  return (
    <div
      className={`og-card p-4 flex items-stretch justify-between gap-4 h-full ${
        isDanger ? 'border-rose-900/40 bg-rose-950/10 glow-danger' : ''
      }`}
    >
      <div className="flex flex-col justify-center min-w-0">
        <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">{title}</p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1.5">
          <span
            className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums ${
              isDanger ? 'text-rose-400' : 'text-white'
            }`}
          >
            {value}
          </span>
          {change && (
            <span
              className={`text-[10px] font-mono leading-snug ${
                isDanger ? 'text-rose-400/90' : 'text-cyan-400/90'
              }`}
            >
              {change}
            </span>
          )}
        </div>
      </div>
      <div
        className={`shrink-0 self-center p-3 rounded-lg border ${
          isDanger
            ? 'bg-rose-900/25 text-rose-400 border-rose-800/40'
            : 'bg-slate-800/80 text-cyan-400 border-slate-700/50'
        }`}
      >
        {icon}
      </div>
    </div>
  );
};
