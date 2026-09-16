import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

const sampleTimeSeries = [
  { time: 'Sep 10', posts: 12 },
  { time: 'Sep 11', posts: 18 },
  { time: 'Sep 12', posts: 45 },
  { time: 'Sep 13', posts: 82 },
  { time: 'Sep 14', posts: 64 },
  { time: 'Sep 15', posts: 38 },
  { time: 'Sep 16', posts: 52 },
];

export const PostsOverTimePlaceholder: React.FC = () => {
  return (
    <div className="og-card flex flex-col h-full">
      <div className="og-card-header py-2.5">
        <div className="og-section-title">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0" strokeWidth={1.75} />
          <span>Amplification Stream Over Time</span>
        </div>
        <span className="og-badge-muted">Sample time series</span>
      </div>

      <div className="w-full flex-1 min-h-[140px] px-2 pb-3 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampleTimeSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
        </ResponsiveContainer>
      </div>
    </div>
  );
};
