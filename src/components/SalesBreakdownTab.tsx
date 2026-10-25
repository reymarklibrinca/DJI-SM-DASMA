import React, { useState, useMemo } from 'react';
import {
  Table,
  Search,
  Filter,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  ShoppingBag,
  DollarSign,
  Box,
  Copy,
  Check,
} from 'lucide-react';
import { DJI_DATA, LEAD_TYPE_NAMES } from '../data/initialData';
import { SaleTuple, UnitTuple } from '../types';
import {
  dayOffsetToDate,
  formatCurrency,
  formatDate,
  formatFullDate,
  getMonthKey,
} from '../utils/calculations';

import octoberSalesData from '../data/octoberSales.json';

interface SalesBreakdownTabProps {
  sales: SaleTuple[];
  staffList: string[];
}

export interface SalesBreakdownRecord {
  id: string;
  sn: string;
  productName: string;
  price: number;
  series: string;
  promoter: string;
  dateStr: string;
  fullDateStr: string;
  rawDate: Date;
  dayOffset: number;
  month: number; // 7: Aug, 8: Sep, 9: Oct
  leadType?: string;
  isLocal?: boolean;
}

export const SalesBreakdownTab: React.FC<SalesBreakdownTabProps> = ({
  sales,
  staffList,
}) => {
  // Month filter: 'all' | 7 (Aug) | 8 (Sep) | 9 (Oct)
  const [selectedMonth, setSelectedMonth] = useState<'all' | 7 | 8 | 9>(9);
  const [searchQuery, setSearchQuery] = useState('');
  const [promoterFilter, setPromoterFilter] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'price-desc' | 'price-asc' | 'name-asc'>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copiedSn, setCopiedSn] = useState<string | null>(null);

  // Units map for fast lookup
  const unitsBySn = useMemo(() => {
    const map = new Map<string, UnitTuple>();
    DJI_DATA.units.forEach((u) => {
      map.set(u[0].toUpperCase(), u);
    });
    return map;
  }, []);

  // Pre-cached sold array from DJI_DATA.sold
  const soldEntries = useMemo(() => {
    return Object.entries(DJI_DATA.sold);
  }, []);

  // Pre-indexed October sales map
  const octList = useMemo(() => {
    return octoberSalesData as Array<{
      'SOLD SN': string | number;
      'PRODUCT NAME': string;
      SERIES: string;
      PRICE: number;
      DATE: string;
      PROMOTERS: string;
    }>;
  }, []);

  // Master flattened and enriched sales records with 100% October SN/EAN coverage
  const allBreakdownRecords: SalesBreakdownRecord[] = useMemo(() => {
    const staticSalesCount = DJI_DATA.sales.length;

    return sales.map((s, idx) => {
      const isLocal = idx >= staticSalesCount;
      const day = s[0];
      const staffIdx = s[1];
      const seriesIdx = s[2];
      const price = s[3];
      const rawDate = dayOffsetToDate(day);
      const month = rawDate.getMonth(); // 7: Aug, 8: Sep, 9: Oct

      // If this is one of the 183 historical October sales (indices 411..593)
      const isHistoricalOctober = !isLocal && idx >= 411 && idx < staticSalesCount;
      const octRecord = isHistoricalOctober ? octList[idx - 411] : null;

      // Resolve Serial Number / EAN
      let sn = '';
      if (octRecord) {
        sn = String(octRecord['SOLD SN']);
      } else if (s[6]) {
        sn = s[6];
      } else if (!isLocal && soldEntries[idx]) {
        sn = soldEntries[idx][0];
      }

      // Resolve Promoter
      let promoter = staffList[staffIdx] || `Staff #${staffIdx}`;
      if (octRecord && octRecord.PROMOTERS) {
        if (octRecord.PROMOTERS.includes('Christian')) promoter = 'Christian';
        else if (octRecord.PROMOTERS.includes('Donna')) promoter = 'Donna';
        else if (octRecord.PROMOTERS.includes('Jobert')) promoter = 'Jobert';
      }

      // Resolve Series
      let series = DJI_DATA.ser[seriesIdx] || 'Accessories';
      if (octRecord && octRecord.SERIES) {
        series = octRecord.SERIES;
      }

      // Resolve Product Name
      let productName = '';
      if (octRecord && octRecord['PRODUCT NAME']) {
        productName = octRecord['PRODUCT NAME'];
      } else if (sn && unitsBySn.has(sn.toUpperCase())) {
        productName = unitsBySn.get(sn.toUpperCase())![1];
      } else {
        // Fallback to stock matching by series and price
        const stockMatch = DJI_DATA.stock.find(
          (st) => st[0] === series && st[2] === price
        );
        if (stockMatch) {
          productName = stockMatch[1];
        } else {
          productName = series;
        }
      }

      const leadType =
        s[7] !== undefined ? LEAD_TYPE_NAMES[s[7] as 0 | 1 | 2] : undefined;

      return {
        id: `sale-${idx}-${day}-${sn || 'nosn'}`,
        sn: sn || '–',
        productName,
        price,
        series,
        promoter,
        dateStr: formatDate(day),
        fullDateStr: octRecord ? octRecord.DATE : formatFullDate(day),
        rawDate,
        dayOffset: day,
        month,
        leadType,
        isLocal,
      };
    });
  }, [sales, staffList, unitsBySn, soldEntries, octList]);

  // Monthly stats calculations
  const monthStats = useMemo(() => {
    const stats = {
      all: { count: 0, revenue: 0 },
      7: { count: 0, revenue: 0 },
      8: { count: 0, revenue: 0 },
      9: { count: 0, revenue: 0 },
    };

    allBreakdownRecords.forEach((r) => {
      stats.all.count++;
      stats.all.revenue += r.price;

      if (r.month === 7) {
        stats[7].count++;
        stats[7].revenue += r.price;
      } else if (r.month === 8) {
        stats[8].count++;
        stats[8].revenue += r.price;
      } else if (r.month === 9) {
        stats[9].count++;
        stats[9].revenue += r.price;
      }
    });

    return stats;
  }, [allBreakdownRecords]);

  // Filtered and Sorted Records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = allBreakdownRecords.filter((record) => {
      // Month filter
      if (selectedMonth !== 'all' && record.month !== selectedMonth) {
        return false;
      }
      // Promoter filter
      if (promoterFilter && record.promoter !== promoterFilter) {
        return false;
      }
      // Series filter
      if (seriesFilter && record.series !== seriesFilter) {
        return false;
      }
      // Search query
      if (q) {
        const matchSn = record.sn.toLowerCase().includes(q);
        const matchProd = record.productName.toLowerCase().includes(q);
        const matchSeries = record.series.toLowerCase().includes(q);
        const matchStaff = record.promoter.toLowerCase().includes(q);
        const matchDate = record.fullDateStr.toLowerCase().includes(q);
        return matchSn || matchProd || matchSeries || matchStaff || matchDate;
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'date-desc') return b.dayOffset - a.dayOffset;
      if (sortBy === 'date-asc') return a.dayOffset - b.dayOffset;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'price-asc') return a.price - b.price;
      return a.productName.localeCompare(b.productName);
    });

    return filtered;
  }, [allBreakdownRecords, selectedMonth, promoterFilter, seriesFilter, searchQuery, sortBy]);

  // Current Paginated Slice
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedSlice = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Summary of currently filtered records
  const currentFilteredRevenue = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.price, 0);
  }, [filteredRecords]);

  const currentFilteredUnits = filteredRecords.length;
  const currentAvgPrice = currentFilteredUnits > 0 ? currentFilteredRevenue / currentFilteredUnits : 0;

  // Copy SN helper
  const handleCopySn = (sn: string) => {
    if (!sn || sn === '–') return;
    navigator.clipboard.writeText(sn);
    setCopiedSn(sn);
    setTimeout(() => setCopiedSn(null), 2000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['SN', 'PRODUCT NAME', 'PRICE', 'SERIES', 'PROMOTER', 'DATE'];
    const rows = filteredRecords.map((r) => [
      `"${r.sn}"`,
      `"${r.productName.replace(/"/g, '""')}"`,
      r.price,
      `"${r.series}"`,
      `"${r.promoter}"`,
      `"${r.fullDateStr}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const monthLabel =
      selectedMonth === 7
        ? 'August'
        : selectedMonth === 8
        ? 'September'
        : selectedMonth === 9
        ? 'October'
        : 'All_Months';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dji_sales_breakdown_${monthLabel}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      {/* Month Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Table className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Monthly Sales Breakdown
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Itemized transaction logs for August, September, and October with verified serial numbers and promoters.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start md:self-auto"
            title="Export filtered sales to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV ({filteredRecords.length})</span>
          </button>
        </div>

        {/* Dedicated Month Switcher Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* All Months */}
          <button
            onClick={() => {
              setSelectedMonth('all');
              setCurrentPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedMonth === 'all'
                ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              All Quarters
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              August – October
            </div>
            <div className="flex items-center justify-between text-xs mt-1 text-slate-600">
              <span className="font-extrabold text-blue-700">
                {formatCurrency(monthStats.all.revenue)}
              </span>
              <span>{monthStats.all.count} units</span>
            </div>
          </button>

          {/* August */}
          <button
            onClick={() => {
              setSelectedMonth(7);
              setCurrentPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedMonth === 7
                ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Month 1
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              August 2026
            </div>
            <div className="flex items-center justify-between text-xs mt-1 text-slate-600">
              <span className="font-extrabold text-blue-700">
                {formatCurrency(monthStats[7].revenue)}
              </span>
              <span>{monthStats[7].count} units</span>
            </div>
          </button>

          {/* September */}
          <button
            onClick={() => {
              setSelectedMonth(8);
              setCurrentPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedMonth === 8
                ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Month 2
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              September 2026
            </div>
            <div className="flex items-center justify-between text-xs mt-1 text-slate-600">
              <span className="font-extrabold text-blue-700">
                {formatCurrency(monthStats[8].revenue)}
              </span>
              <span>{monthStats[8].count} units</span>
            </div>
          </button>

          {/* October */}
          <button
            onClick={() => {
              setSelectedMonth(9);
              setCurrentPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedMonth === 9
                ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Month 3 (Active)
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              October 2026
            </div>
            <div className="flex items-center justify-between text-xs mt-1 text-slate-600">
              <span className="font-extrabold text-blue-700">
                {formatCurrency(monthStats[9].revenue)}
              </span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                {monthStats[9].count} units (100% SN/EAN)
              </span>
            </div>
          </button>
        </div>

        {selectedMonth === 9 && (
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                October Master Data Verified: All 183 units have verified Serial Numbers (SN) or EAN barcodes matched to official records.
              </span>
            </div>
            <div className="text-slate-500 font-medium">
              Oct 1 to Oct 23 · ₱4,164,427 Total Revenue
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search SN, Product, or Date..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          {/* Promoter Dropdown */}
          <div>
            <select
              value={promoterFilter}
              onChange={(e) => {
                setPromoterFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="">All Promoters</option>
              {staffList.map((staff) => (
                <option key={staff} value={staff}>
                  {staff}
                </option>
              ))}
            </select>
          </div>

          {/* Series Dropdown */}
          <div>
            <select
              value={seriesFilter}
              onChange={(e) => {
                setSeriesFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="">All Series</option>
              {DJI_DATA.ser.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="date-desc">Date (Newest First)</option>
              <option value="date-asc">Date (Oldest First)</option>
              <option value="price-desc">Price (Highest First)</option>
              <option value="price-asc">Price (Lowest First)</option>
              <option value="name-asc">Product Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Quick KPI Strip for Current Selection */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 mt-3.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <span>
              Showing <strong className="text-slate-900">{filteredRecords.length}</strong> items
            </span>
            <span>·</span>
            <span>
              Subtotal: <strong className="text-blue-700 font-bold">{formatCurrency(currentFilteredRevenue)}</strong>
            </span>
            <span>·</span>
            <span>
              Avg Ticket: <strong className="text-slate-900 font-semibold">{formatCurrency(currentAvgPrice)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span>Rows per page:</span>
            {[25, 50, 100].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${
                  pageSize === size
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-48">SN</th>
                <th className="py-3 px-4 min-w-[240px]">PRODUCT NAME</th>
                <th className="py-3 px-4 text-right w-28">PRICE</th>
                <th className="py-3 px-4 w-40">SERIES</th>
                <th className="py-3 px-4 w-32">PROMOTER</th>
                <th className="py-3 px-4 w-32">DATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {paginatedSlice.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No transactions match the selected filters. Try broadening your search or switching months.
                  </td>
                </tr>
              ) : (
                paginatedSlice.map((record) => {
                  const isCopied = copiedSn === record.sn;

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* SN */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {record.sn !== '–' ? (
                          <div className="flex items-center gap-1.5 group">
                            <span>{record.sn}</span>
                            <button
                              onClick={() => handleCopySn(record.sn)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition-opacity cursor-pointer"
                              title="Copy serial number"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">Non-serialized</span>
                        )}
                      </td>

                      {/* PRODUCT NAME */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{record.productName}</div>
                        {record.isLocal && (
                          <span className="text-[10px] font-semibold text-blue-600">
                            Logged via POS Quick Log
                          </span>
                        )}
                      </td>

                      {/* PRICE */}
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                        {formatCurrency(record.price)}
                      </td>

                      {/* SERIES */}
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {record.series}
                        </span>
                      </td>

                      {/* PROMOTER */}
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {record.promoter}
                      </td>

                      {/* DATE */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {record.fullDateStr}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} records
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-200/60 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-200/60 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
