import React from 'react';

interface Props {
  title: string;
  value: string | number;
  change?: string;
  isDanger?: boolean;
  tone?: 'mint' | 'coral' | 'violet';
  icon: React.ReactNode;
}

export const KpiCard: React.FC<Props> = ({ title, value, change, isDanger, tone, icon }) => {
  const accent = tone ?? (isDanger ? 'coral' : 'mint');

  return (
    <div
      className={`og-card og-kpi-card og-kpi-card--${accent} p-4 flex items-stretch justify-between gap-4 h-full`}
    >
      <div className="flex flex-col justify-center min-w-0">
        <p className="text-xs font-medium text-slate-400">{title}</p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1.5">
          <span
            className={`og-kpi-value og-kpi-value--${accent} text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums`}
          >
            {value}
          </span>
          {change && (
            <span className="text-[11px] text-slate-500 leading-snug">
              {change}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 self-center p-3 rounded-xl border border-slate-700/50 bg-slate-900/45">
        {icon}
      </div>
    </div>
  );
};
