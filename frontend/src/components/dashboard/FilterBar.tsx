import React from 'react';
import { useFilters } from '../../context/FilterContext';
import { Filter, Calendar, ShieldAlert, Share2, Layers, RotateCcw } from 'lucide-react';

export const FilterBar: React.FC = () => {
  const { filters, updateFilter, resetFilters } = useFilters();

  return (
    <div className="sticky top-16 z-40 border-b border-slate-800/90 bg-surface-raised/95 backdrop-blur-md">
      <div className="og-container py-4">
        <div className="og-card overflow-hidden">
          <div className="og-card-header bg-slate-900/40">
            <div className="og-section-title text-cyan-400">
              <Filter className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span>Analyst Controls</span>
            </div>
            <span className="og-badge-muted hidden sm:inline-flex">Filters drive canvas &amp; analytics</span>
          </div>

          <div className="p-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
            {/* Date range */}
            <div className="og-control-group flex-1 min-w-[240px] lg:max-w-md">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={1.75} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="flex items-center gap-2">
                  <span className="og-control-label">From</span>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                    className="og-input py-1.5 min-h-[34px] cursor-pointer"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="og-control-label">To</span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                    className="og-input py-1.5 min-h-[34px] cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Platform */}
            <div className="og-control-group min-w-[180px]">
              <Share2 className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={1.75} />
              <label className="flex items-center gap-2 flex-1">
                <span className="og-control-label">Platform</span>
                <select
                  value={filters.platform}
                  onChange={(e) => updateFilter('platform', e.target.value)}
                  className="og-select flex-1 min-w-[120px] min-h-[34px]"
                >
                  <option value="ALL">All Platforms</option>
                  <option value="X">X (Twitter)</option>
                  <option value="Telegram">Telegram</option>
                  <option value="Facebook">Facebook</option>
                </select>
              </label>
            </div>

            {/* Severity slider */}
            <div className="og-control-group flex-1 min-w-[200px] lg:max-w-xs">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" strokeWidth={1.75} />
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <span className="og-control-label shrink-0">Min Severity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={filters.minSeverity}
                  onChange={(e) => updateFilter('minSeverity', parseFloat(e.target.value))}
                  className="flex-1 min-w-[72px]"
                  aria-valuenow={filters.minSeverity}
                  aria-valuetext={`${Math.round(filters.minSeverity * 100)} percent`}
                />
                <span className="text-cyan-400 font-semibold font-mono text-xs w-10 text-right shrink-0">
                  {Math.round(filters.minSeverity * 100)}%
                </span>
              </div>
            </div>

            {/* Density slider */}
            <div className="og-control-group flex-1 min-w-[180px] lg:max-w-xs">
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" strokeWidth={1.75} />
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <span className="og-control-label shrink-0">Min Density</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={filters.minDensity}
                  onChange={(e) => updateFilter('minDensity', parseInt(e.target.value, 10))}
                  className="flex-1 min-w-[64px]"
                  aria-valuenow={filters.minDensity}
                />
                <span className="text-cyan-400 font-semibold font-mono text-xs w-8 text-right shrink-0">
                  {filters.minDensity}x
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="og-btn-ghost self-start lg:self-auto"
              title="Reset filters to default"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
