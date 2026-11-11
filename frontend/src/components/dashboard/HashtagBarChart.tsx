import React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Hash } from 'lucide-react';
import { ChartCard, ChartEmpty, ChartTooltip, DataTable } from './charts/ChartCard';
import { axisProps, CHART, formatNumber } from './charts/chartTheme';

interface Props {
  data: Array<{ tag: string; count: number }>;
  updating?: boolean;
}

const shorten = (tag: string) => (tag.length > 20 ? `${tag.slice(0, 19)}…` : tag);

/** Ranked narratives: one series → one colour for every bar. */
export const HashtagBarChart: React.FC<Props> = ({ data, updating }) => {
  const ranked = [...data].sort((a, b) => b.count - a.count);
  const height = Math.max(200, ranked.length * 30 + 24);

  return (
    <ChartCard
      kicker="Narratives"
      title="Top hashtags"
      icon={<Hash className="w-4 h-4 text-accent-lavender" strokeWidth={1.75} aria-hidden="true" />}
      meta={<span className="og-badge hidden sm:inline-flex">Distinct posts</span>}
      updating={updating}
      className="h-full"
      table={ranked.length ? (
        <DataTable columns={['#', 'Hashtag', 'Posts']} rows={ranked.map((row, index) => [index + 1, row.tag, formatNumber(row.count)])} />
      ) : undefined}
    >
      <div className="px-2 pt-2 pb-3" style={{ height }}>
        {ranked.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ranked} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 4 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke={CHART.grid} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis
                dataKey="tag"
                type="category"
                {...axisProps}
                axisLine={false}
                width={138}
                tickFormatter={shorten}
                tick={{ fill: CHART.text, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <Tooltip
                cursor={{ fill: CHART.cursorFill }}
                content={({ active, payload }) => (
                  <ChartTooltip
                    active={active}
                    label={payload?.[0]?.payload?.tag}
                    rows={(payload ?? []).map((item) => ({ color: CHART.series1, label: 'Posts', value: formatNumber(Number(item.value)) }))}
                  />
                )}
              />
              <Bar dataKey="count" fill={CHART.series1} radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false}>
                <LabelList dataKey="count" position="right" fill={CHART.tick} fontSize={10} fontFamily="JetBrains Mono, monospace" formatter={(value: number) => formatNumber(value)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty message="No hashtag activity in this view." />
        )}
      </div>
    </ChartCard>
  );
};
