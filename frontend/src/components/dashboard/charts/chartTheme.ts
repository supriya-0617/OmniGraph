/**
 * Chart colours for the "Forensic Olive" theme, validated with the dataviz
 * palette checker against the panel surface (#20241F, dark mode): lightness
 * band, chroma floor, CVD + normal-vision separation and contrast all pass.
 *
 * The UI accents in index.css (--og-olive, --og-brass …) are deliberately
 * desaturated and sit below the data-mark chroma floor, so data marks use these
 * slightly richer steps of the same hue families. Recharts / SVG attributes
 * cannot resolve CSS variables, hence concrete values here.
 */
export const CHART = {
  surface: '#20241F',
  grid: 'rgba(166, 170, 157, 0.09)',
  axis: '#4A5147',
  tick: '#8E9387',
  text: '#E5E5D9',
  muted: '#A6AA9D',
  tooltipBg: 'rgba(17, 22, 19, 0.96)',
  tooltipBorder: '#464D44',
  cursorLine: 'rgba(166, 161, 122, 0.45)',   // olive crosshair
  cursorFill: 'rgba(166, 161, 122, 0.06)',   // olive hover band
  // categorical, fixed order — colour follows the entity, never its rank
  series1: '#518AC4', // steel
  series2: '#B68737', // brass
  series3: '#AA6A9C', // mauve
  // posts vs high-severity posts
  posts: '#518AC4',
  highSeverity: '#C25D58',
  // ordinal severity ramp, low → high (validated --ordinal, single crimson hue)
  severityRamp: ['#84473E', '#A1564C', '#BE665C', '#D8796F', '#EE9186'],
};

/** Stable platform → colour mapping (does not change when filters remove a platform). */
export const PLATFORM_COLORS: Record<string, string> = {
  X: CHART.series1,
  Telegram: CHART.series2,
  Facebook: CHART.series3,
};

export const platformColor = (platform: string) => PLATFORM_COLORS[platform] ?? CHART.axis;

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
