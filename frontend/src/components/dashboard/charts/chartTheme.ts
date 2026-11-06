/**
 * Chart colours, validated with the dataviz palette checker against the dark
 * panel surface (#0b0f18): lightness band, chroma floor, CVD + normal-vision
 * separation and contrast all pass. UI accent tokens (--og-cyan …) are brighter
 * and reserved for chrome; data marks use these steps.
 */
export const CHART = {
  surface: '#0b0f18',
  grid: 'rgba(150, 170, 215, 0.09)',
  axis: '#5a6379',
  tick: '#8d96ab',
  text: '#e9edf5',
  // categorical, fixed order — colour follows the entity, never its rank
  series1: '#16a6c2',
  series2: '#8a6be6',
  series3: '#c4842c',
  // posts vs high-severity posts
  posts: '#16a6c2',
  highSeverity: '#e65a45',
  // ordinal severity ramp, low → high (validated --ordinal)
  severityRamp: ['#7a3d34', '#9a473b', '#bb5142', '#dc5c49', '#f7735e'],
};

/** Stable platform → colour mapping (does not change when filters remove a platform). */
export const PLATFORM_COLORS: Record<string, string> = {
  X: CHART.series1,
  Telegram: CHART.series2,
  Facebook: CHART.series3,
};

export const platformColor = (platform: string) => PLATFORM_COLORS[platform] ?? '#5a6379';

export const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.tick, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
  tickLine: false,
  axisLine: { stroke: CHART.grid },
} as const;

export const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

export function formatDay(bucket: string, withYear = false): string {
  const date = new Date(`${bucket}T00:00:00`);
  if (Number.isNaN(date.getTime())) return bucket;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
}
