import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Trend } from '../../types/analytics';

type Tone = 'cyan' | 'mint' | 'coral' | 'amber' | 'violet';

interface Props {
  index: string;
  title: string;
  value: string | number;
  definition: string;
  tone?: Tone;
  icon: React.ReactNode;
  trend?: Trend | null;
  /** When true an increase is bad news (risk metrics) and is coloured coral. */
  higherIsWorse?: boolean;
  /** Volume metrics: show the change without a good/bad colour. */
  neutral?: boolean;
  trendLabel?: string;
  loading?: boolean;
}

const TONE_VAR: Record<Tone, string> = {
  cyan: 'var(--og-cyan)',
  mint: 'var(--og-mint)',
  coral: 'var(--og-coral)',
  amber: 'var(--og-amber)',
  violet: 'var(--og-violet)',
};

const TrendBadge: React.FC<{ trend: Trend; higherIsWorse: boolean; neutral: boolean; label: string }> = ({ trend, higherIsWorse, neutral, label }) => {
  if (trend.delta_pct === null) {
    return <span className="text-[11px] text-ink/50">New vs {label}</span>;
  }
  const up = trend.delta_pct > 0;
  const flat = Math.abs(trend.delta_pct) < 0.5;
  const bad = !flat && (up === higherIsWorse);
  const color = flat || neutral ? 'var(--og-text)' : bad ? 'var(--og-coral)' : 'var(--og-mint)';
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color }} title={`Previous period: ${trend.previous}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {up ? '+' : ''}{trend.delta_pct.toFixed(1)}%
      <span className="text-ink/45 font-sans">vs {label}</span>
    </span>
  );
};

export const KpiCard: React.FC<Props> = ({
  index, title, value, definition, tone = 'cyan', icon, trend, higherIsWorse = false, neutral = false, trendLabel = 'prev. period', loading,
}) => {
  const accent = TONE_VAR[tone];
  return (
    <article
      className="og-card og-kpi-card group p-4 flex flex-col justify-between gap-4 h-full transition-[border-color,transform] duration-300 hover:-translate-y-0.5"
      style={{ ['--kpi' as string]: accent }}
      title={definition}
    >
      <span className="absolute left-0 top-4 bottom-4 w-[2px]" style={{ background: accent }} aria-hidden="true" />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="og-kicker" style={{ fontSize: 9.5 }}>{index}</span>
          <h3 className="mt-1 text-[13px] font-medium text-ink/85">{title}</h3>
        </div>
        <span
          className="grid place-items-center w-9 h-9 shrink-0 rounded-lg"
          style={{ border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`, background: `color-mix(in srgb, ${accent} 9%, transparent)`, color: accent }}
          aria-hidden="true"
        >
          {icon}
        </span>
      </header>
      <div>
        {loading ? (
          <div className="og-skeleton h-9 w-24" />
        ) : (
          <p className="text-[2.15rem] leading-none font-semibold tracking-tight" style={{ color: 'var(--og-text)' }}>
            {value}
          </p>
        )}
        <div className="mt-2.5 min-h-[18px]">
          {!loading && trend ? (
            <TrendBadge trend={trend} higherIsWorse={higherIsWorse} neutral={neutral} label={trendLabel} />
          ) : (
            <span className="text-[11px] text-ink/45 line-clamp-1">{definition}</span>
          )}
        </div>
      </div>
    </article>
  );
};
