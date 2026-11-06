import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

interface Props {
  data: Array<{ bucket: string; count: number }>;
}

function formatBucketDate(bucket: string): string {
  const date = new Date(`${bucket}T00:00:00`);
  if (Number.isNaN(date.getTime())) return bucket;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const PostsOverTimePlaceholder: React.FC<Props> = ({ data }) => {
  const chartData = data.map((item) => ({
    date: formatBucketDate(item.bucket),
    posts: item.count,
  }));

  return (
    <div className="og-card flex flex-col h-full">
      <div className="og-card-header py-2.5">
        <div className="og-section-title">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0" strokeWidth={1.75} />
          <span>Posts Over Time</span>
        </div>
        <span className="og-badge-muted">Filtered results</span>
      </div>

      <div className="w-full flex-1 min-h-[140px] px-2 pb-3 pt-1">
        {chartData.length ? <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 16 }}>
            <defs>
              <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--og-mint)" stopOpacity={0.56} />
                <stop offset="95%" stopColor="var(--og-mint)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="var(--og-subtle)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Date', position: 'insideBottom', offset: -12, fill: 'var(--og-muted)', fontSize: 10 }}
            />
            <YAxis
              stroke="var(--og-subtle)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={42}
              label={{ value: 'Posts', angle: -90, position: 'insideLeft', fill: 'var(--og-muted)', fontSize: 10 }}
            />
            <Tooltip
              labelFormatter={(label) => `Date: ${label}`}
              formatter={(value) => [value, 'Posts']}
              contentStyle={{
                backgroundColor: 'var(--og-overlay)',
                borderColor: 'var(--og-border)',
                borderRadius: '10px',
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              itemStyle={{ color: 'var(--og-mint)' }}
            />
            <Area
              type="monotone"
              dataKey="posts"
              name="Posts"
              stroke="var(--og-mint)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPosts)"
            />
          </AreaChart>
        </ResponsiveContainer> : <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">No posts in this date range.</div>}
      </div>
    </div>
  );
};
