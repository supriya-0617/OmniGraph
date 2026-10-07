import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

interface Props {
  data: Array<{ bucket: string; count: number }>;
}

export const PostsOverTimePlaceholder: React.FC<Props> = ({ data }) => {
  const chartData = data.map((item) => ({
    time: new Date(`${item.bucket}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
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
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.75} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0b0f19',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              itemStyle={{ color: '#06b6d4' }}
            />
            <Area
              type="monotone"
              dataKey="posts"
              stroke="#06b6d4"
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
