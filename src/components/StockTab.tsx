import React, { useState, useMemo } from 'react';
import {
  Layers,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { DJI_DATA } from '../data/initialData';
import { StockSeriesCover, UnitTuple } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';

interface StockTabProps {
  stockMetrics: {
    rows: StockSeriesCover[];
    totalUnitsInStock: number;
    totalSrpValue: number;
  };
}

export const StockTab: React.FC<StockTabProps> = ({ stockMetrics }) => {
  // Sort series rows by days of cover (lowest cover first)
  const sortedSeriesRows = useMemo(() => {
    return [...stockMetrics.rows].sort((a, b) => {
      const covA = a.cov ?? 999999;
      const covB = b.cov ?? 999999;
      return covA - covB;
    });
  }, [stockMetrics.rows]);

  // Full Unit Registry Search & Filter
  const [unitSearch, setUnitSearch] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN STOCK' | 'SOLD'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toUpperCase();
    return DJI_DATA.units.filter((u) => {
      if (statusFilter !== 'ALL' && u[4] !== statusFilter) return false;
      if (seriesFilter && u[3] !== seriesFilter) return false;
      if (!q) return true;

      const sn = u[0].toUpperCase();
      const name = u[1].toUpperCase();
      const ean = (u[5] || '').toUpperCase();
      return sn.includes(q) || name.includes(q) || ean.includes(q);
    });
  }, [unitSearch, seriesFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUnits.length / pageSize) || 1;
  const paginatedUnits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUnits.slice(start, start + pageSize);
  }, [filteredUnits, currentPage]);

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Inventory On Hand
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {stockMetrics.totalUnitsInStock}{' '}
            <span className="text-sm font-normal text-slate-500">units</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Active in-store stock across all 29 categories
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Valuation at SRP
          </div>
          <div className="text-2xl font-black text-blue-700 tracking-tight">
            {formatCurrency(stockMetrics.totalSrpValue)}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Estimated retail inventory asset value
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Master Sheet Audit Watch
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {DJI_DATA.stale.length}{' '}
            <span className="text-sm font-normal text-slate-500">units</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Marked 'IN STOCK' but recorded sold in sales logs
          </p>
        </div>
      </div>

      {/* Stale Stock Audit Warning Card */}
      {DJI_DATA.stale.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-xs p-5 md:p-6 bg-gradient-to-r from-amber-50/40 to-white">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 className="text-base font-bold text-slate-900">
              Audit Alert: {DJI_DATA.stale.length} Units Flagged for Master Sheet Reconciliation
            </h3>
          </div>
          <p className="text-xs text-slate-600 mb-4 max-w-3xl leading-relaxed">
            Your STOCKS master sheet indicates these {DJI_DATA.stale.length} units are "IN STOCK", but matching serial numbers are already recorded in sales transactions. The Operator Hub automatically marks them as SOLD to prevent double-booking. Please update their physical status in your master spreadsheet.
          </p>

          <div className="overflow-x-auto max-h-56">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-100/60 text-slate-700 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-2 px-3">Serial Number</th>
                  <th className="py-2 px-3">Product Name</th>
                  <th className="py-2 px-3">Series</th>
                  <th className="py-2 px-3">Sold On Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/60 text-slate-700 font-medium">
                {DJI_DATA.stale.map((item, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{item[0]}</td>
                    <td className="py-2 px-3">{item[1]}</td>
                    <td className="py-2 px-3 text-slate-500">{item[2]}</td>
                    <td className="py-2 px-3 font-semibold text-rose-700">
                      Day #{item[3]} ({formatDate(item[3])})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Cover by Series */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="border-b border-slate-100 pb-4 mb-4">
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Stock Cover & Run-Rate Days by Series
          </h3>
          <p className="text-xs text-slate-500">
            Days of cover = current inventory ÷ (sales last 30 days ÷ 30). Flags indicate fast depleting (Low &lt;14d) or slow moving (&gt;90d).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Series Name</th>
                <th className="py-3 px-4 text-center">In Stock</th>
                <th className="py-3 px-4 text-center">Sold (Last 30 Days)</th>
                <th className="py-3 px-4 text-center">Days of Cover</th>
                <th className="py-3 px-4 text-right">Status Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {sortedSeriesRows.map((series) => {
                const isZeroSales = series.cov === null;
                const isLow = series.cov !== null && series.cov < 14;
                const isSlow = series.cov !== null && series.cov > 90;

                return (
                  <tr key={series.n} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{series.n}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-slate-800">{series.in}</td>
                    <td className="py-2.5 px-4 text-center text-slate-600">{series.m}</td>
                    <td className="py-2.5 px-4 text-center font-extrabold text-slate-900">
                      {isZeroSales ? '–' : `${Math.round(series.cov!)} days`}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {isZeroSales ? (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          No 30d Sales
                        </span>
                      ) : isLow ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                          Low Stock (&lt;14d)
                        </span>
                      ) : isSlow ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          Slow Moving (&gt;90d)
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Healthy Pacing
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

      {/* Full Serialized Unit Database Browser */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Master Serial Number & EAN Registry ({filteredUnits.length} Units)
            </h3>
            <p className="text-xs text-slate-500">
              Complete catalog of 1,081 individual units tracked in the SM Dasmariñas inventory.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search SN, barcode, product..."
                value={unitSearch}
                onChange={(e) => {
                  setUnitSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-48 sm:w-60"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            <select
              value={seriesFilter}
              onChange={(e) => {
                setSeriesFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="">All Series</option>
              {DJI_DATA.ser.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="IN STOCK">In Stock Only</option>
              <option value="SOLD">Sold Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Serial Number</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Series</th>
                <th className="py-2.5 px-3">EAN Barcode</th>
                <th className="py-2.5 px-3 text-right">Price ₱</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {paginatedUnits.map((u, idx) => {
                const isInStock = u[4] === 'IN STOCK';
                return (
                  <tr key={`${u[0]}-${idx}`} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{u[0]}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{u[1]}</td>
                    <td className="py-2 px-3 text-slate-500">{u[3]}</td>
                    <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                      {u[5] || '–'}
                    </td>
                    <td className="py-2 px-3 text-right font-extrabold text-slate-900">
                      {formatCurrency(u[2])}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          isInStock
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isInStock ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            In Stock
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Sold
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredUnits.length)} of {filteredUnits.length} units
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
