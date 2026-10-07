import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Hash } from 'lucide-react';

interface Props {
  data: Array<{ tag: string; count: number }>;
}

const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981'];

export const HashtagChartPlaceholder: React.FC<Props> = ({ data }) => {
  return (
    <div className="og-card flex flex-col h-full min-h-[280px]">
      <div className="og-card-header">
        <div className="og-section-title">
          <Hash className="w-4 h-4 text-amber-400 shrink-0" strokeWidth={1.75} />
          <span>Top Narratives &amp; Hashtags</span>
        </div>
        <span className="og-badge-muted">Filtered results</span>
      </div>

      <div className="px-4 pt-2 pb-3 flex flex-wrap gap-2">
        {data.slice(0, 4).map((item, index) => (
          <span
            key={item.tag}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono border border-slate-700/70 bg-slate-900/80"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
              aria-hidden
            />
            <span className="text-slate-300">{item.tag}</span>
            <span className="text-slate-500">·</span>
            <span className="text-cyan-400/90 tabular-nums">{item.count}</span>
          </span>
        ))}
      </div>

      <div className="w-full flex-1 min-h-[160px] px-2 pb-4">
        {data.length ? <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis
              dataKey="tag"
              type="category"
              stroke="#94a3b8"
              fontSize={10}
              width={118}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(51, 65, 85, 0.25)' }}
              contentStyle={{
                backgroundColor: '#0b0f19',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              itemStyle={{ color: '#38bdf8' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer> : <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">No hashtag activity in this view.</div>}
      </div>
    </div>
  );
};
