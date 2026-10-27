import React, { useState, useMemo } from 'react';
import { Box, Search, ArrowUpRight, ArrowDownRight, ArrowUpDown } from 'lucide-react';
import { DJI_DATA } from '../data/initialData';
import { PeriodRange, SaleTuple } from '../types';
import {
  aggregateSales,
  calculatePercentChange,
  formatCurrency,
} from '../utils/calculations';

interface ProductsTabProps {
  sales: SaleTuple[];
  periodRange: PeriodRange;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  sales,
  periodRange,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState<'revenue' | 'units' | 'trend' | 'name'>('revenue');

  const currentAgg = aggregateSales(sales, periodRange.a, periodRange.b);
  const prevAgg = aggregateSales(sales, periodRange.pa, periodRange.pb);

  const maxSeriesRevenue = Math.max(
    ...Object.values(currentAgg.se).map((x) => x[0]),
    1
  );

  // Build rows for all series with sales in this period or history
  const seriesRows = useMemo(() => {
    return Object.keys(currentAgg.se)
      .map((k) => {
        const seriesIdx = Number(k);
        const name = DJI_DATA.ser[seriesIdx] || `Series #${seriesIdx}`;
        const revenue = currentAgg.se[seriesIdx][0];
        const units = currentAgg.se[seriesIdx][1];
        const prevRevenue = (prevAgg.se[seriesIdx] || [0, 0])[0];
        const hasPrev = prevRevenue > 0;
        const trend = calculatePercentChange(revenue, prevRevenue);

        return {
          seriesIdx,
          name,
          revenue,
          units,
          prevRevenue,
          hasPrev,
          trend,
        };
      })
      .filter((row) =>
        row.name.toLowerCase().includes(searchFilter.trim().toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'revenue') return b.revenue - a.revenue;
        if (sortBy === 'units') return b.units - a.units;
        if (sortBy === 'trend') return b.trend - a.trend;
        return a.name.localeCompare(b.name);
      });
  }, [currentAgg.se, prevAgg.se, searchFilter, sortBy]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-600" />
            Product Series Revenue Matrix ({periodRange.lb})
          </h3>
          <p className="text-xs text-slate-500">
            Categorical revenue performance and unit velocity across {DJI_DATA.ser.length} DJI product series.
          </p>
        </div>

        {/* Filter and Sort Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search series..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-44"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setSortBy('revenue')}
              className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                sortBy === 'revenue' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setSortBy('units')}
              className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                sortBy === 'units' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              Units
            </button>
            <button
              onClick={() => setSortBy('trend')}
              className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                sortBy === 'trend' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              Trend
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Series Name</th>
              <th className="py-3 px-4">Revenue</th>
              <th className="py-3 px-4 w-40">Revenue Share</th>
              <th className="py-3 px-4 text-center">Units Sold</th>
              <th className="py-3 px-4 text-right">Trend vs {periodRange.pl}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {seriesRows.map((series) => {
              const sharePct = (series.revenue / maxSeriesRevenue) * 100;
              const isGrowth = series.trend >= 0;

              return (
                <tr key={series.seriesIdx} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-bold text-slate-900">{series.name}</td>
                  <td className="py-3 px-4 font-extrabold text-blue-700">
                    {formatCurrency(series.revenue)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${sharePct}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-800">
                    {series.units}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {!series.hasPrev ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        New / Baseline
                      </span>
                    ) : isGrowth ? (
                      <span className="text-emerald-700 font-bold inline-flex items-center gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        +{series.trend.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-rose-700 font-bold inline-flex items-center gap-0.5">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {series.trend.toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
