import React from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity } from 'lucide-react';
import { AnalyticsSummary } from '../../types/analytics';
import { ChartCard, ChartEmpty, ChartTooltip, DataTable, LegendItem } from './charts/ChartCard';
import { axisProps, CHART, formatDay, formatNumber } from './charts/chartTheme';

interface Props {
  data: AnalyticsSummary['posts_over_time'];
  updating?: boolean;
}

/** Daily posts with the high-severity (≥ 0.7) subset on the same axis (one scale, no dual axis). */
export const PostsOverTimeChart: React.FC<Props> = ({ data, updating }) => {
  const rows = data.map((item) => ({ ...item, label: formatDay(item.bucket) }));
  const peak = rows.reduce<(typeof rows)[number] | null>((best, row) => (!best || row.count > best.count ? row : best), null);

  return (
    <ChartCard
      kicker="Activity"
      title="Posts over time"
      icon={<Activity className="w-4 h-4 text-accent-olive" strokeWidth={1.75} aria-hidden="true" />}
      meta={peak && <span className="og-badge hidden sm:inline-flex">Peak {formatNumber(peak.count)} · {peak.label}</span>}
      legend={rows.length ? (
        <>
          <LegendItem color={CHART.posts} label="All posts" />
          <LegendItem color={CHART.highSeverity} label="High severity (≥ 0.7)" shape="line" />
        </>
      ) : undefined}
      updating={updating}
      className="h-full"
      table={rows.length ? (
        <DataTable
          columns={['Day', 'Posts', 'High severity']}
          rows={rows.map((row) => [formatDay(row.bucket, true), formatNumber(row.count), formatNumber(row.high_severity)])}
        />
      ) : undefined}
    >
      <div className="h-full min-h-[220px] px-2 pt-2 pb-3">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="og-posts-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.posts} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART.posts} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} axisLine={false} width={40} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: CHART.cursorLine, strokeWidth: 1 }}
                content={({ active, payload, label }) => (
                  <ChartTooltip
                    active={active}
                    label={label}
                    rows={(payload ?? []).map((item) => ({
                      color: item.dataKey === 'count' ? CHART.posts : CHART.highSeverity,
                      label: item.dataKey === 'count' ? 'Posts' : 'High severity',
                      value: formatNumber(Number(item.value)),
                    }))}
                  />
                )}
              />
              <Area type="monotone" dataKey="count" stroke={CHART.posts} strokeWidth={2} fill="url(#og-posts-fill)" activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="high_severity" stroke={CHART.highSeverity} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty message="No posts in this date range." />
        )}
      </div>
    </ChartCard>
  );
};
