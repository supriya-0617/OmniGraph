import React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Layers } from 'lucide-react';
import { AnalyticsSummary } from '../../types/analytics';
import { ChartCard, ChartEmpty, ChartTooltip, DataTable } from './charts/ChartCard';
import { axisProps, CHART, formatNumber, platformColor } from './charts/chartTheme';

interface Props {
  platforms: AnalyticsSummary['platform_breakdown'];
  severity: AnalyticsSummary['severity_distribution'];
  updating?: boolean;
}

/** Platform share (tall segmented bar, ≤ 6 parts) + severity histogram (ordinal ramp). */
export const SignalMixPanel: React.FC<Props> = ({ platforms, severity, updating }) => {
  const total = platforms.reduce((sum, row) => sum + row.count, 0);
  const ordered = ['X', 'Telegram', 'Facebook']
    .map((name) => platforms.find((row) => row.platform === name))
    .filter(Boolean)
    .concat(platforms.filter((row) => !['X', 'Telegram', 'Facebook'].includes(row.platform))) as AnalyticsSummary['platform_breakdown'];

  return (
    <ChartCard
      kicker="Composition"
      title="Platform & severity mix"
      icon={<Layers className="w-4 h-4 text-accent-amber" strokeWidth={1.75} aria-hidden="true" />}
      updating={updating}
      className="h-full"
      table={total ? (
        <DataTable
          columns={['Dimension', 'Bucket', 'Posts']}
          rows={[
            ...ordered.map((row) => ['Platform', row.platform, formatNumber(row.count)]),
            ...severity.map((row) => ['Severity', row.range, formatNumber(row.count)]),
          ]}
        />
      ) : undefined}
    >
      {total ? (
        <div className="p-4 flex flex-col gap-5 h-full">
          <div>
            <p className="og-kicker mb-2.5" style={{ fontSize: 9.5 }}>Posts by platform</p>
            <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-md" role="img" aria-label="Posts by platform">
              {ordered.map((row) => {
                const share = (row.count / total) * 100;
                return (
                  <div
                    key={row.platform}
                    className="relative flex items-center px-2 text-[11px] font-semibold"
                    style={{ width: `${share}%`, background: platformColor(row.platform), color: '#06080e' }}
                    title={`${row.platform}: ${formatNumber(row.count)} (${share.toFixed(0)}%)`}
                  >
                    {share >= 16 && <span className="truncate">{share.toFixed(0)}%</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
              {ordered.map((row) => (
                <span key={row.platform} className="inline-flex items-center gap-2 text-[11px] text-ink/80">
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: platformColor(row.platform) }} aria-hidden="true" />
                  {row.platform} <span className="text-ink/50 og-tabular">{formatNumber(row.count)}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-[140px]">
            <p className="og-kicker mb-1" style={{ fontSize: 9.5 }}>Severity distribution</p>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={severity} margin={{ top: 14, right: 4, left: 0, bottom: 0 }} barCategoryGap={3}>
                <XAxis dataKey="range" {...axisProps} interval={0} />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,112,92,0.06)' }}
                  content={({ active, payload }) => (
                    <ChartTooltip
                      active={active}
                      label={`Severity ${payload?.[0]?.payload?.range ?? ''}`}
                      rows={(payload ?? []).map((item, i) => ({ color: CHART.severityRamp[i] ?? CHART.highSeverity, label: 'Posts', value: formatNumber(Number(item.value)) }))}
                    />
                  )}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {severity.map((row, index) => <Cell key={row.range} fill={CHART.severityRamp[index] ?? CHART.highSeverity} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <ChartEmpty message="No posts match the current filters." />
      )}
    </ChartCard>
  );
};
