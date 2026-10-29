import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Calendar,
  Lock,
  Unlock,
  Trash2,
  Tag,
  User,
  ShoppingBag,
  RotateCcw,
  Zap,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { DJI_DATA, LEAD_TYPE_NAMES } from '../data/initialData';
import { SaleTuple, UnitTuple } from '../types';
import {
  dateToDayOffset,
  formatCurrency,
  formatDate,
  formatISODate,
} from '../utils/calculations';
import { BulkQuickLogModal } from './BulkQuickLogModal';
import { ImportExcelModal } from './ImportExcelModal';

interface QuickLogCardProps {
  todayOffset: number;
  staffList: string[];
  archivedStaff?: number[];
  localSales: SaleTuple[];
  localLeads: Record<number, Record<string, [number, number, number]>>;
  finalizedDays: Record<number, { at: string; sa: number; un: number }>;
  onAddSale: (
    dayOffset: number,
    staffIndex: number,
    seriesIndex: number,
    amount: number,
    units?: number,
    serialNumber?: string,
    leadType?: number
  ) => { success: boolean; message: string };
  onAddSalesBulk?: (
    items: Array<{
      dayOffset: number;
      staffIndex: number;
      seriesIndex: number;
      amount: number;
      units?: number;
      serialNumber?: string;
      leadType?: number;
    }>
  ) => { success: boolean; count: number; message: string; errors?: string[] };
  onOverrideSales?: (sales: SaleTuple[]) => { success: boolean; count: number; message: string };
  onAppendSales?: (sales: SaleTuple[]) => { success: boolean; count: number; message: string };
  onDeleteSale: (index: number) => { success: boolean; message: string };
  onAddLead: (dayOffset: number, staffIndex: number | string, leadType: 0 | 1 | 2) => { success: boolean; message: string };
  onRemoveLead: (dayOffset: number, staffIndex: number | string, leadType: 0 | 1 | 2) => { success: boolean; message: string };
  onResetLeads?: (dayOffset: number) => { success: boolean; message: string };
  onToggleFinalize: (dayOffset: number) => void;
  onClearAllSystemData?: () => void;
  onSearchSN: (query: string) => {
    type: 'exact' | 'multiple' | 'none';
    unit?: UnitTuple;
    isSold?: boolean;
    soldDetail?: string;
    matches?: UnitTuple[];
    totalCount?: number;
    localSaleIndex?: number;
    isLocalSale?: boolean;
  } | null;
}

export const QuickLogCard: React.FC<QuickLogCardProps> = ({
  todayOffset,
  staffList,
  archivedStaff = [],
  localSales,
  localLeads,
  finalizedDays,
  onAddSale,
  onAddSalesBulk,
  onOverrideSales,
  onAppendSales,
  onDeleteSale,
  onAddLead,
  onRemoveLead,
  onResetLeads,
  onToggleFinalize,
  onClearAllSystemData,
  onSearchSN,
}) => {
  // Form State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isImportExcelOpen, setIsImportExcelOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<number>(0);

  // If the selected promoter gets archived, move to the first active one
  const archivedKey = archivedStaff.join(',');
  useEffect(() => {
    if (archivedStaff.includes(selectedStaff)) {
      const first = staffList.findIndex((_, i) => !archivedStaff.includes(i));
      if (first >= 0) setSelectedStaff(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivedKey, staffList.length]);
  const [selectedDateISO, setSelectedDateISO] = useState<string>(formatISODate(todayOffset));
  const [leadType, setLeadType] = useState<0 | 1 | 2>(0);
  const [snQuery, setSnQuery] = useState<string>('');
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [isConfirmingResetLeads, setIsConfirmingResetLeads] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Fast units map for serial number and product resolution
  const unitsMap = useMemo(() => {
    const map = new Map<string, UnitTuple>();
    DJI_DATA.units.forEach((u) => {
      map.set(u[0].toUpperCase(), u);
    });
    return map;
  }, []);

  // Computed day offset of selected date
  const selectedDayOffset = useMemo(() => {
    return dateToDayOffset(selectedDateISO);
  }, [selectedDateISO]);

  const isSelectedDayFinalized = Boolean(finalizedDays[selectedDayOffset]);

  // Master product list sorted alphabetically by series and product
  const productList = useMemo(() => {
    return [...DJI_DATA.stock].sort((a, b) => {
      const seriesCompare = a[0].localeCompare(b[0]);
      if (seriesCompare !== 0) return seriesCompare;
      return a[1].localeCompare(b[1]);
    });
  }, []);

  // Sync price when user manually picks a product and no SN is active
  useEffect(() => {
    if (productList[selectedProductIndex] && !snQuery.trim()) {
      setPrice(productList[selectedProductIndex][2]);
    }
  }, [selectedProductIndex, productList, snQuery]);

  // Serial Number Search Result
  const searchResult = useMemo(() => {
    return onSearchSN(snQuery);
  }, [snQuery, onSearchSN]);

  // Auto-sync product dropdown and price when an exact unit is detected
  useEffect(() => {
    if (searchResult?.type === 'exact' && searchResult.unit) {
      const u = searchResult.unit;
      const pIdx = productList.findIndex(
        (p) => p[1] === u[1] && p[0] === u[3]
      );
      if (pIdx >= 0) {
        setSelectedProductIndex(pIdx);
      }
      setPrice(u[2]);
    }
  }, [searchResult, productList]);

  // Handle unit pick from multiple matches
  const handleSelectUnit = (unit: UnitTuple) => {
    setSnQuery(unit[0]);
    const pIdx = productList.findIndex(
      (p) => p[1] === unit[1] && p[0] === unit[3]
    );
    if (pIdx >= 0) {
      setSelectedProductIndex(pIdx);
      setPrice(unit[2]);
    }
  };

  // Add Sale Submit
  const handleAddSale = () => {
    if (!price || price <= 0) {
      setStatusFeedback({ type: 'error', text: 'Please enter a valid price amount.' });
      return;
    }

    if (isSelectedDayFinalized) {
      setStatusFeedback({
        type: 'error',
        text: `Day ${formatDate(selectedDayOffset)} is finalized. Reopen day to add sales.`,
      });
      return;
    }

    if (snQuery.trim() && searchResult?.type === 'none') {
      setStatusFeedback({
        type: 'error',
        text: 'Unknown serial number or barcode. Check the digits or clear the box.',
      });
      return;
    }

    if (searchResult?.type === 'exact' && searchResult.isSold) {
      setStatusFeedback({
        type: 'error',
        text: `Not added: Unit ${searchResult.unit![0]} is already marked SOLD! (${searchResult.soldDetail})`,
      });
      return;
    }

    // Determine target series and price from unit if exact match, or dropdown
    let targetSeriesName = '';
    let targetPrice = price;

    if (searchResult?.type === 'exact' && searchResult.unit) {
      targetSeriesName = searchResult.unit[3];
      targetPrice = price > 0 ? price : searchResult.unit[2];
    } else {
      const prod = productList[selectedProductIndex];
      targetSeriesName = prod ? prod[0] : DJI_DATA.ser[0];
      targetPrice = price;
    }

    let seriesIdx = DJI_DATA.ser.indexOf(targetSeriesName);
    if (seriesIdx < 0) {
      seriesIdx = 0;
    }

    const res = onAddSale(
      selectedDayOffset,
      selectedStaff,
      seriesIdx,
      targetPrice,
      1,
      searchResult?.unit ? searchResult.unit[0] : snQuery.trim(),
      leadType
    );

    if (res.success) {
      setStatusFeedback({ type: 'success', text: res.message });
      setSnQuery('');
    } else {
      setStatusFeedback({ type: 'error', text: res.message });
    }
  };

  // Handle Quick Lead Add
  const handleLeadAdd = (type: 0 | 1 | 2) => {
    const res = onAddLead(selectedDayOffset, selectedStaff, type);
    if (res.success) {
      setStatusFeedback({
        type: 'info',
        text: `+1 ${LEAD_TYPE_NAMES[type]} lead added for ${staffList[selectedStaff]} on ${formatDate(selectedDayOffset)}.`,
      });
    } else {
      setStatusFeedback({ type: 'error', text: res.message });
    }
  };

  // Grouped Recent Activity Feed (Local logs)
  const groupedActivity = useMemo(() => {
    const map = new Map<
      string,
      {
        sales: { localIndex: number; sale: SaleTuple }[];
        leads: { day: number; type: 0 | 1 | 2; count: number }[];
        totalSalesAmount: number;
        leadsTally: [number, number, number];
      }
    >();

    const getGroup = (key: string) => {
      if (!map.has(key)) {
        map.set(key, {
          sales: [],
          leads: [],
          totalSalesAmount: 0,
          leadsTally: [0, 0, 0],
        });
      }
      return map.get(key)!;
    };

    localSales.forEach((sale, i) => {
      const g = getGroup(String(sale[1]));
      g.sales.unshift({ localIndex: i, sale });
      g.totalSalesAmount += sale[3];
    });

    Object.entries(localLeads).forEach(([dayStr, staffObj]) => {
      const day = Number(dayStr);
      Object.entries(staffObj).forEach(([sKey, counts]) => {
        const g = getGroup(sKey);
        ([0, 1, 2] as const).forEach((t) => {
          if (counts[t] > 0) {
            g.leads.push({ day, type: t, count: counts[t] });
            g.leadsTally[t] += counts[t];
          }
        });
      });
    });

    return map;
  }, [localSales, localLeads]);

  const totalLocalSalesCount = localSales.length;
  const totalLocalSalesVal = localSales.reduce((sum, s) => sum + s[3], 0);

  // Render Status / Live SN Banner
  const renderSnFeedbackBanner = () => {
    if (!searchResult) return null;

    if (searchResult.type === 'exact' && searchResult.unit) {
      return (
        <div
          className={`p-4 rounded-xl border transition-all ${
            searchResult.isSold
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  {searchResult.unit[1]}
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-white/70 border border-current">
                  SN: {searchResult.unit[0]}
                </span>
              </div>
              <div className="text-xs opacity-80">
                Series: <strong>{searchResult.unit[3]}</strong>
                {searchResult.unit[5] && ` · EAN: ${searchResult.unit[5]}`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold">
                {formatCurrency(searchResult.unit[2])}
              </div>
              <div
                className={`text-xs font-bold ${
                  searchResult.isSold ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {searchResult.isSold
                  ? `⚠️ ${searchResult.soldDetail || 'ALREADY SOLD'}`
                  : '✓ IN STOCK — Ready to log'}
              </div>
            </div>
          </div>

          {/* Quick Unlock / Delete button if unit was accidentally logged earlier in this browser */}
          {searchResult.isSold && searchResult.localSaleIndex !== undefined && (
            <div className="mt-3 pt-3 border-t border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-xs text-rose-800">
                This unit was recorded in your recent browser logs (e.g. mislabeled as Accessories). Click below to remove that log and unlock the serial number:
              </span>
              <button
                type="button"
                onClick={() => {
                  const delRes = onDeleteSale(searchResult.localSaleIndex!);
                  if (delRes.success) {
                    setStatusFeedback({
                      type: 'info',
                      text: `Previous log for ${searchResult.unit![0]} removed! Unit is now UNLOCKED (IN STOCK). Form auto-set to ${searchResult.unit![1]} at ${formatCurrency(searchResult.unit![2])}. Click 'Record Sale' now.`,
                    });
                  }
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
              >
                Remove Accidental Log & Unlock SN
              </button>
            </div>
          )}
        </div>
      );
    }

    if (searchResult.type === 'multiple') {
      return (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-xs font-semibold text-slate-700 mb-2">
            {searchResult.totalCount} units match "{snQuery}". Select the one in your hand:
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {searchResult.matches?.map((m) => {
              const isSold = m[4] === 'SOLD' || Boolean(DJI_DATA.sold[m[0]]);
              return (
                <button
                  key={m[0]}
                  onClick={() => handleSelectUnit(m)}
                  className={`text-left px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                    isSold
                      ? 'bg-slate-100 border-slate-300 text-slate-500 hover:border-slate-400'
                      : 'bg-white border-blue-200 text-blue-900 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="font-bold">{m[0]}</div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                    {m[1]} ({isSold ? 'Sold' : 'In Stock'})
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (searchResult.type === 'none' && snQuery.trim().length >= 3) {
      return (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            No serialized unit with SN or EAN matching "{snQuery}" was found in master stock.
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Quick Log Action Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                POS Quick Log
              </h2>
              <p className="text-xs text-slate-500">
                Instantly log sales with serial number validation and record customer leads.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportExcelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-xs active:scale-98"
              title="Import Excel file (.xlsx, .xls, .csv) to override current input data"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-xs active:scale-98"
              title="Bulk Quick Log by Serial Number for a Promoter"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Bulk Quick Log (Paste SN)</span>
            </button>

            {onClearAllSystemData && (
              <button
                type="button"
                onClick={onClearAllSystemData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-xs active:scale-98"
                title="Delete all data in the system (0 sales, 0 leads, fresh start)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear All Data</span>
              </button>
            )}

            <button
              onClick={() => onToggleFinalize(selectedDayOffset)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isSelectedDayFinalized
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isSelectedDayFinalized ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Reopen Day ({formatDate(selectedDayOffset)})</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Finalize Day ({formatDate(selectedDayOffset)})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
          {/* Promoter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Promoter
            </label>
            <div className="relative">
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                {staffList.map((staff, idx) =>
                  archivedStaff.includes(idx) && idx !== selectedStaff ? null : (
                    <option key={idx} value={idx}>
                      {staff}{archivedStaff.includes(idx) ? ' (archived)' : ''}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={selectedDateISO}
              onChange={(e) => setSelectedDateISO(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            />
          </div>

          {/* Lead Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Lead Type
            </label>
            <select
              value={leadType}
              onChange={(e) => setLeadType(Number(e.target.value) as 0 | 1 | 2)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value={0}>Walk-in</option>
              <option value={1}>Revisit</option>
              <option value={2}>Online</option>
            </select>
          </div>

          {/* SN or EAN Lookup */}
          <div className="xl:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              SN / EAN (Last 5 digits)
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="e.g. ANGVP or EAN"
                value={snQuery}
                onChange={(e) => setSnQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Product Series & Model */}
          <div className="xl:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Product Model
            </label>
            <select
              value={selectedProductIndex}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setSelectedProductIndex(idx);
                if (productList[idx]) {
                  setPrice(productList[idx][2]);
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              {productList.map((prod, idx) => (
                <option key={idx} value={idx}>
                  {prod[1]} ({prod[0]})
                </option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Price ₱ (SRP)
            </label>
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Live SN Status Feedback Banner */}
        <div className="mt-4">
          {renderSnFeedbackBanner()}
        </div>

        {/* Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-5 mt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddSale}
              disabled={isSelectedDayFinalized}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer ${
                isSelectedDayFinalized
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Record Sale</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportExcelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
              title="Import Excel file to override current input data"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Excel to Override Data</span>
            </button>
          </div>

          {/* Quick Lead Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 hidden md:inline">
              Quick Lead for {staffList[selectedStaff]}:
            </span>
            <button
              onClick={() => handleLeadAdd(0)}
              disabled={isSelectedDayFinalized}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              +1 Walk-in
            </button>
            <button
              onClick={() => handleLeadAdd(1)}
              disabled={isSelectedDayFinalized}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              +1 Revisit
            </button>
            <button
              onClick={() => handleLeadAdd(2)}
              disabled={isSelectedDayFinalized}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              +1 Online
            </button>

            {/* Reset Customer Leads Button */}
            {onResetLeads && (
              <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
                {!isConfirmingResetLeads ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingResetLeads(true)}
                    disabled={isSelectedDayFinalized}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 rounded-lg text-xs font-semibold border border-rose-200 transition-all cursor-pointer disabled:opacity-50"
                    title="Reset all customer leads for this date"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Leads</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        const res = onResetLeads(selectedDayOffset);
                        setStatusFeedback({
                          type: res.success ? 'success' : 'error',
                          text: res.message,
                        });
                        setIsConfirmingResetLeads(false);
                      }}
                      className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Confirm Reset?
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingResetLeads(false)}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Toast / Status Message */}
        {statusFeedback && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-medium flex items-center justify-between ${
              statusFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusFeedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            <span>{statusFeedback.text}</span>
            <button
              onClick={() => setStatusFeedback(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Recently Added Log by Promoter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Recently Logged in this Browser
            </h3>
            <p className="text-xs text-slate-500">
              {totalLocalSalesCount} custom sale(s) amounting to {formatCurrency(totalLocalSalesVal)}.
              Grouped by promoter.
            </p>
          </div>
        </div>

        {groupedActivity.size === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No custom sales or leads logged yet in this session. Entries you log via Quick Log will appear here.
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(groupedActivity.entries()).map(([staffKey, data]) => {
              const promoterName =
                staffKey === 'u' ? 'Not Tagged' : staffList[Number(staffKey)] || `Staff #${staffKey}`;

              return (
                <div
                  key={staffKey}
                  className="rounded-xl border border-slate-200 overflow-hidden"
                >
                  <div className="bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between border-b border-slate-200 gap-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <span className="font-bold text-sm text-slate-900">
                        {promoterName}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>
                        <strong className="text-slate-900">{data.sales.length}</strong> sale(s) ·{' '}
                        <strong className="text-slate-900">{formatCurrency(data.totalSalesAmount)}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        Leads: {data.leadsTally[0]} walk-in, {data.leadsTally[1]} revisit, {data.leadsTally[2]} online
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/50 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Type</th>
                          <th className="py-2.5 px-4">Details</th>
                          <th className="py-2.5 px-4">Lead Source</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {data.sales.map(({ localIndex, sale }) => {
                          const isFinal = Boolean(finalizedDays[sale[0]]);
                          const unitMatch = sale[6] ? unitsMap.get(sale[6].toUpperCase()) : undefined;
                          const prodTitle = unitMatch ? unitMatch[1] : (DJI_DATA.ser[sale[2]] || 'Product');

                          return (
                            <tr key={`sale-${localIndex}`} className="hover:bg-slate-50/80">
                              <td className="py-2 px-4 font-medium">{formatDate(sale[0])}</td>
                              <td className="py-2 px-4">
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                  Sale
                                </span>
                              </td>
                              <td className="py-2 px-4">
                                <span className="font-semibold text-slate-900">
                                  {prodTitle}
                                </span>
                                <span className="text-slate-500 ml-1.5 font-bold">
                                  {formatCurrency(sale[3])}
                                </span>
                                {sale[6] && (
                                  <span className="font-mono text-slate-500 ml-2 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                                    SN: {sale[6]}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-slate-500">
                                {sale[7] !== undefined ? LEAD_TYPE_NAMES[sale[7] as 0 | 1 | 2] : '–'}
                              </td>
                              <td className="py-2 px-4 text-right">
                                {isFinal ? (
                                  <span className="text-[11px] text-slate-400 italic">Locked</span>
                                ) : (
                                  <button
                                    onClick={() => onDeleteSale(localIndex)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Delete this sale"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {data.leads.map((lead, lIdx) => {
                          const isFinal = Boolean(finalizedDays[lead.day]);
                          return (
                            <tr key={`lead-${lIdx}`} className="hover:bg-slate-50/80 bg-slate-50/30">
                              <td className="py-2 px-4 font-medium">{formatDate(lead.day)}</td>
                              <td className="py-2 px-4">
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                  Lead
                                </span>
                              </td>
                              <td className="py-2 px-4 text-slate-700">
                                +{lead.count} {LEAD_TYPE_NAMES[lead.type]} Lead(s)
                              </td>
                              <td className="py-2 px-4 text-slate-500">
                                {LEAD_TYPE_NAMES[lead.type]}
                              </td>
                              <td className="py-2 px-4 text-right">
                                {isFinal ? (
                                  <span className="text-[11px] text-slate-400 italic">Locked</span>
                                ) : (
                                  <button
                                    onClick={() => onRemoveLead(lead.day, staffKey, lead.type)}
                                    className="text-[11px] text-slate-500 hover:text-rose-600 font-medium transition-colors cursor-pointer"
                                  >
                                    Remove 1
                                  </button>
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
            })}
          </div>
        )}
      </div>

      {/* Bulk Quick Log Modal Window for Single Promoter */}
      <BulkQuickLogModal
        archivedStaff={archivedStaff}
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        staffList={staffList}
        initialStaffIndex={selectedStaff}
        initialDayOffset={selectedDayOffset}
        finalizedDays={finalizedDays}
        localSales={localSales}
        onAddSalesBulk={
          onAddSalesBulk ||
          ((items) => {
            let count = 0;
            const errors: string[] = [];
            items.forEach((it) => {
              const res = onAddSale(
                it.dayOffset,
                it.staffIndex,
                it.seriesIndex,
                it.amount,
                it.units,
                it.serialNumber,
                it.leadType
              );
              if (res.success) count++;
              else errors.push(res.message);
            });
            return {
              success: count > 0,
              count,
              message: count > 0 ? `Successfully logged ${count} sales!` : errors[0] || 'Failed to log.',
              errors,
            };
          })
        }
      />

      {/* Import Excel Modal Window to Override or Append Data */}
      <ImportExcelModal
        isOpen={isImportExcelOpen}
        onClose={() => setIsImportExcelOpen(false)}
        staffList={staffList}
        todayOffset={todayOffset}
        onImportOverride={(sales, populateFormItem) => {
          if (onOverrideSales) {
            onOverrideSales(sales);
            setStatusFeedback({
              type: 'success',
              text: `Excel imported successfully! ${sales.length} transactions loaded (current input data overridden).`,
            });
          }
          if (populateFormItem) {
            setSelectedStaff(populateFormItem.staffIndex);
            setSelectedDateISO(populateFormItem.dateISO);
            setSnQuery(populateFormItem.serialNumber);
            setPrice(populateFormItem.price);
            setLeadType(populateFormItem.leadType);
            const pIdx = productList.findIndex(
              (p) => p[1].toLowerCase() === populateFormItem.productName.toLowerCase()
            );
            if (pIdx >= 0) setSelectedProductIndex(pIdx);
          }
        }}
        onImportAppend={(sales, populateFormItem) => {
          if (onAppendSales) {
            onAppendSales(sales);
            setStatusFeedback({
              type: 'success',
              text: `Excel imported successfully! ${sales.length} transactions appended.`,
            });
          }
          if (populateFormItem) {
            setSelectedStaff(populateFormItem.staffIndex);
            setSelectedDateISO(populateFormItem.dateISO);
            setSnQuery(populateFormItem.serialNumber);
            setPrice(populateFormItem.price);
            setLeadType(populateFormItem.leadType);
          }
        }}
      />
    </div>
  );
};
