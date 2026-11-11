import React, { useState } from 'react';
import { Calendar, ChevronDown, Layers, RotateCcw, Share2, ShieldAlert, SlidersHorizontal, X } from 'lucide-react';
import { useFilters } from '../../context/FilterContext';
import { FilterState } from '../../types/graph';

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays: number) => new Date(Date.now() - offsetDays * DAY).toISOString().slice(0, 10);

const PRESETS: Array<{ label: string; days: number | null }> = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: 'All', days: null },
];

/** Shared analyst filters (Person-1 workstream): one compact sticky toolbar. */
export const FilterBar: React.FC = () => {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const { filters, setFilters, updateFilter, resetFilters } = useFilters();
  const invalidDateRange = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);

  const activePreset = PRESETS.find((preset) =>
    preset.days === null
      ? !filters.dateFrom && !filters.dateTo
      : filters.dateFrom === isoDay(preset.days) && filters.dateTo === isoDay(0),
  )?.label;

  const applyPreset = (days: number | null) =>
    setFilters((current: FilterState) => ({
      ...current,
      dateFrom: days === null ? '' : isoDay(days),
      dateTo: days === null ? '' : isoDay(0),
    }));

  const chips: Array<{ label: string; clear: () => void }> = [
    ...(filters.platform !== 'ALL' ? [{ label: filters.platform, clear: () => updateFilter('platform', 'ALL') }] : []),
    ...(filters.minSeverity > 0
      ? [{ label: `Severity ≥ ${Math.round(filters.minSeverity * 100)}%`, clear: () => updateFilter('minSeverity', 0) }]
      : []),
    ...(filters.minDensity > 1 ? [{ label: `≥ ${filters.minDensity} accounts / group`, clear: () => updateFilter('minDensity', 1) }] : []),
  ];

  return (
    <div
      className="sticky top-16 z-40"
      style={{ borderBottom: '1px solid var(--og-border)', background: 'rgb(var(--og-bg-rgb) / 0.78)', backdropFilter: 'blur(20px) saturate(150%)', WebkitBackdropFilter: 'blur(20px) saturate(150%)' }}
    >
      <div className="og-container py-2.5">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <span className="og-section-title">
            <SlidersHorizontal className="w-4 h-4 text-accent-olive" strokeWidth={1.75} aria-hidden="true" />
            Filters
            <span className="og-badge">{chips.length + (activePreset === 'All' ? 0 : 1)} active</span>
          </span>
          <button
            type="button"
            onClick={() => setMobileExpanded((expanded) => !expanded)}
            className="og-btn-ghost min-h-[34px]"
            aria-expanded={mobileExpanded}
            aria-controls="filter-controls"
          >
            {mobileExpanded ? 'Hide' : 'Edit'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>

        <div
          id="filter-controls"
          className={`${mobileExpanded ? 'flex' : 'hidden'} mt-2.5 lg:mt-0 flex-col gap-2.5 lg:flex lg:flex-row lg:flex-wrap lg:items-center`}
          role="group"
          aria-label="Analyst filters"
        >
          {/* Date range + presets */}
          <div className="og-control-group py-1.5" aria-invalid={invalidDateRange}>
            <Calendar className="w-3.5 h-3.5 text-ink/50 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <div className="inline-flex rounded-md p-0.5" style={{ border: '1px solid var(--og-border)' }} role="group" aria-label="Date presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.days)}
                  aria-pressed={activePreset === preset.label}
                  className="px-2 py-1 rounded text-[10.5px] font-mono transition-colors"
                  style={activePreset === preset.label ? { background: 'var(--og-olive)', color: 'var(--og-on-accent)' } : { color: 'var(--og-muted)' }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
              className="og-input py-1 min-h-[30px] text-xs"
              aria-label="Start date"
              aria-invalid={invalidDateRange}
              aria-describedby={invalidDateRange ? 'filter-date-error' : undefined}
            />
            <span className="text-ink/40 text-xs" aria-hidden="true">→</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
              className="og-input py-1 min-h-[30px] text-xs"
              aria-label="End date"
              aria-invalid={invalidDateRange}
              aria-describedby={invalidDateRange ? 'filter-date-error' : undefined}
            />
          </div>

          {/* Platform */}
          <label className="og-control-group py-1.5">
            <Share2 className="w-3.5 h-3.5 text-ink/50 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="og-control-label">Platform</span>
            <select value={filters.platform} onChange={(event) => updateFilter('platform', event.target.value)} className="og-select min-h-[30px] py-1 text-xs">
              <option value="ALL">All</option>
              <option value="X">X</option>
              <option value="Telegram">Telegram</option>
              <option value="Facebook">Facebook</option>
            </select>
          </label>

          {/* Severity */}
          <div className="og-control-group py-1.5 lg:w-[220px]">
            <ShieldAlert className="w-3.5 h-3.5 text-accent-crimson shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="og-control-label">Severity</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={filters.minSeverity}
              onChange={(event) => updateFilter('minSeverity', parseFloat(event.target.value))}
              className="flex-1 min-w-[60px]"
              aria-label="Minimum severity"
              aria-valuetext={`${Math.round(filters.minSeverity * 100)} percent`}
            />
            <span className="font-mono text-xs w-9 text-right text-accent-olive og-tabular">≥{Math.round(filters.minSeverity * 100)}</span>
          </div>

          {/* Density */}
          <div className="og-control-group py-1.5 lg:w-[220px]">
            <Layers className="w-3.5 h-3.5 text-accent-olive shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="og-control-label" title="Minimum accounts in a shared-IP coordination group">Density</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={filters.minDensity}
              onChange={(event) => updateFilter('minDensity', parseInt(event.target.value, 10))}
              className="flex-1 min-w-[60px]"
              aria-label="Minimum accounts per coordination group"
              aria-valuetext={`${filters.minDensity} accounts per group`}
            />
            <span className="font-mono text-xs w-6 text-right text-accent-olive og-tabular">{filters.minDensity}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 lg:ml-auto">
            {chips.map((chip) => (
              <button key={chip.label} type="button" className="og-chip" onClick={chip.clear} aria-label={`Clear ${chip.label}`}>
                {chip.label} <X className="w-3 h-3" aria-hidden="true" />
              </button>
            ))}
            <button type="button" onClick={resetFilters} className="og-btn-ghost min-h-[32px]" title="Reset filters to defaults">
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" /> Reset
            </button>
          </div>
        </div>

        {invalidDateRange && (
          <p id="filter-date-error" className="mt-2 text-[11px] text-accent-crimson" role="alert">
            Start date must be on or before the end date. Results will not refresh until corrected.
          </p>
        )}
      </div>
    </div>
  );
};
