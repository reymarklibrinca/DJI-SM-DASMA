import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Zap,
  CheckCircle,
  AlertCircle,
  Trash2,
  Tag,
  User,
  ShoppingBag,
  RotateCcw,
  Sparkles,
  Clipboard,
  Check,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { DJI_DATA, LEAD_TYPE_NAMES } from '../data/initialData';
import { SaleTuple, UnitTuple } from '../types';
import {
  dateToDayOffset,
  formatCurrency,
  formatDate,
  formatISODate,
} from '../utils/calculations';

interface BulkQuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: string[];
  archivedStaff?: number[];
  initialStaffIndex?: number;
  initialDayOffset?: number;
  finalizedDays: Record<number, { at: string; sa: number; un: number }>;
  localSales: SaleTuple[];
  onAddSalesBulk: (
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
}

interface ParsedBulkUnitItem {
  id: string;
  rawSn: string;
  cleanSn: string;
  unit: UnitTuple | null;
  productName: string;
  seriesName: string;
  seriesIndex: number;
  price: number;
  isSold: boolean;
  soldDetail?: string;
  isUnknown: boolean;
  leadType: 0 | 1 | 2 | 3; // 0: Walk-in, 1: Revisit, 2: Online, 3: Not tagged
}

export const BulkQuickLogModal: React.FC<BulkQuickLogModalProps> = ({
  isOpen,
  onClose,
  staffList,
  archivedStaff = [],
  initialStaffIndex = 0,
  initialDayOffset,
  finalizedDays,
  localSales,
  onAddSalesBulk,
}) => {
  // Selected Promoter (Single Promoter flow)
  const [selectedStaff, setSelectedStaff] = useState<number>(initialStaffIndex);

  // Selected Date
  const defaultDayOffset = initialDayOffset !== undefined ? initialDayOffset : 85;
  const [selectedDateISO, setSelectedDateISO] = useState<string>(formatISODate(defaultDayOffset));

  // Raw pasted text from textarea
  const [pastedText, setPastedText] = useState<string>('');

  // Per-item override prices and lead types: id -> value
  const [itemPriceOverrides, setItemPriceOverrides] = useState<Record<string, number>>({});
  const [itemLeadOverrides, setItemLeadOverrides] = useState<Record<string, 0 | 1 | 2 | 3>>({});
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // Global default lead type to apply
  const [globalLeadType, setGlobalLeadType] = useState<0 | 1 | 2 | 3>(0); // 0 = Walk-in

  // Feedback states
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    count: number;
    message: string;
    items?: ParsedBulkUnitItem[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Units map for instant lookup
  const unitsMap = useMemo(() => {
    const map = new Map<string, UnitTuple>();
    DJI_DATA.units.forEach((u) => {
      map.set(u[0].toUpperCase(), u);
    });
    return map;
  }, []);

  // Sync state on modal open
  useEffect(() => {
    if (isOpen) {
      if (initialStaffIndex >= 0 && initialStaffIndex < staffList.length) {
        setSelectedStaff(initialStaffIndex);
      }
      if (initialDayOffset !== undefined) {
        setSelectedDateISO(formatISODate(initialDayOffset));
      }
      setPastedText('');
      setItemPriceOverrides({});
      setItemLeadOverrides({});
      setExcludedIds(new Set());
      setSubmissionResult(null);
      setErrorMessage(null);
    }
  }, [isOpen, initialStaffIndex, initialDayOffset, staffList.length]);

  const selectedDayOffset = useMemo(() => {
    return dateToDayOffset(selectedDateISO);
  }, [selectedDateISO]);

  const isSelectedDayFinalized = Boolean(finalizedDays[selectedDayOffset]);

  // Parse raw text into structured items
  const parsedItems = useMemo<ParsedBulkUnitItem[]>(() => {
    if (!pastedText.trim()) return [];

    // Split by newlines, commas, semicolons, or multiple spaces
    const tokens = pastedText
      .split(/[\r\n,;\t]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    return tokens.map((token, index) => {
      const clean = token.toUpperCase().replace(/\s+/g, '');
      const id = `${clean}-${index}`;

      const unit = unitsMap.get(clean) || null;
      let isSold = false;
      let soldDetail = '';

      if (unit) {
        const isPlain =
          unit[3].includes('ACCESSOR') ||
          unit[3].includes('CARE REFRESH') ||
          unit[3].includes('SERVICES');
        if (!isPlain) {
          const staticSold = DJI_DATA.sold[clean];
          const localSold = localSales.find((s) => s[6]?.toUpperCase() === clean);
          const isMarkedSold = unit[4] === 'SOLD';

          if (staticSold) {
            isSold = true;
            soldDetail = `Sold on Day ${staticSold[0]} by ${staffList[staticSold[1]] || 'Staff'}`;
          } else if (localSold) {
            isSold = true;
            soldDetail = `Sold locally on Day ${localSold[0]} by ${staffList[localSold[1]] || 'Staff'}`;
          } else if (isMarkedSold) {
            isSold = true;
            soldDetail = 'Catalog status: SOLD';
          }
        }
      }

      // Series & Product resolution
      let productName = 'Unknown Product';
      let seriesName = 'OTHERS';
      let defaultPrice = 0;

      if (unit) {
        productName = unit[1];
        seriesName = unit[3];
        defaultPrice = unit[2];
      } else {
        // Fallback or guess
        productName = token;
        seriesName = 'OTHERS';
      }

      let seriesIndex = DJI_DATA.ser.indexOf(seriesName);
      if (seriesIndex < 0) seriesIndex = 0;

      const overriddenPrice = itemPriceOverrides[id];
      const finalPrice = overriddenPrice !== undefined ? overriddenPrice : defaultPrice;

      const overriddenLead = itemLeadOverrides[id];
      const finalLead = overriddenLead !== undefined ? overriddenLead : globalLeadType;

      return {
        id,
        rawSn: token,
        cleanSn: clean,
        unit,
        productName,
        seriesName,
        seriesIndex,
        price: finalPrice,
        isSold,
        soldDetail,
        isUnknown: !unit,
        leadType: finalLead,
      };
    });
  }, [pastedText, unitsMap, localSales, staffList, itemPriceOverrides, itemLeadOverrides, globalLeadType]);

  // Active items (excluding those user manually removed)
  const activeItems = useMemo(() => {
    return parsedItems.filter((item) => !excludedIds.has(item.id));
  }, [parsedItems, excludedIds]);

  // Valid items that can be logged (not sold)
  const validItemsToLog = useMemo(() => {
    return activeItems.filter((item) => !item.isSold && item.price > 0);
  }, [activeItems]);

  const totalAmount = useMemo(() => {
    return validItemsToLog.reduce((sum, item) => sum + item.price, 0);
  }, [validItemsToLog]);

  // Handle removing single item
  const handleRemoveItem = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Handle per-item price change
  const handlePriceChange = (id: string, price: number) => {
    setItemPriceOverrides((prev) => ({
      ...prev,
      [id]: Math.max(0, price),
    }));
  };

  // Handle per-item lead change
  const handleLeadChange = (id: string, lead: 0 | 1 | 2 | 3) => {
    setItemLeadOverrides((prev) => ({
      ...prev,
      [id]: lead,
    }));
  };

  // Set all items lead type
  const handleApplyGlobalLead = (type: 0 | 1 | 2 | 3) => {
    setGlobalLeadType(type);
    const overrides: Record<string, 0 | 1 | 2 | 3> = {};
    activeItems.forEach((item) => {
      overrides[item.id] = type;
    });
    setItemLeadOverrides(overrides);
  };

  // Load sample in-stock serial numbers
  const handleLoadSampleSNs = () => {
    // Find 3 in-stock units
    const inStockUnits = DJI_DATA.units
      .filter((u) => u[4] === 'IN STOCK' && !DJI_DATA.sold[u[0]] && !localSales.some((s) => s[6]?.toUpperCase() === u[0]))
      .slice(0, 3);

    if (inStockUnits.length > 0) {
      const sampleText = inStockUnits.map((u) => u[0]).join('\n');
      setPastedText(sampleText);
      setExcludedIds(new Set());
      setErrorMessage(null);
    }
  };

  // Paste from clipboard if supported
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setPastedText((prev) => (prev ? `${prev}\n${text}` : text));
        }
      }
    } catch {
      setErrorMessage('Clipboard access restricted. Please paste using Ctrl+V / Cmd+V directly in the text box.');
    }
  };

  // Submit all valid sales in bulk
  const handleSubmitBulk = () => {
    if (isSelectedDayFinalized) {
      setErrorMessage(`Day ${formatDate(selectedDayOffset)} is finalized. Reopen day to log sales.`);
      return;
    }

    if (validItemsToLog.length === 0) {
      setErrorMessage('No valid sales to record. Check prices or serial numbers.');
      return;
    }

    const payload = validItemsToLog.map((item) => ({
      dayOffset: selectedDayOffset,
      staffIndex: selectedStaff,
      seriesIndex: item.seriesIndex,
      amount: item.price,
      units: 1,
      serialNumber: item.cleanSn,
      leadType: item.leadType,
    }));

    const res = onAddSalesBulk(payload);

    if (res.success) {
      setSubmissionResult({
        success: true,
        count: res.count,
        message: res.message,
        items: [...validItemsToLog],
      });
      setPastedText('');
      setExcludedIds(new Set());
      setItemPriceOverrides({});
      setItemLeadOverrides({});
      setErrorMessage(null);
    } else {
      setErrorMessage(res.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Bulk Quick Log by Serial Number
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Single Promoter POS
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Paste one or multiple SNs to instantly retrieve stock details, series, SRP, and log sales in bulk.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {/* Success Banner when batch is committed */}
          {submissionResult && submissionResult.success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{submissionResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmissionResult(null)}
                  className="px-3 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  Log Another Batch
                </button>
              </div>

              {submissionResult.items && submissionResult.items.length > 0 && (
                <div className="mt-2 bg-white/80 rounded-lg border border-emerald-200 p-2.5 divide-y divide-emerald-100">
                  <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide pb-1">
                    Receipt of Logged Units ({submissionResult.items.length})
                  </div>
                  {submissionResult.items.map((it, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-semibold text-slate-900">{it.productName}</span>
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {it.cleanSn}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">{LEAD_TYPE_NAMES[it.leadType]}</span>
                        <span className="font-bold text-emerald-700">{formatCurrency(it.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Setup Controls: Promoter Selection & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/80 border border-slate-200 rounded-xl">
            {/* Promoter Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Target Promoter <span className="text-blue-600 font-normal">(Sales will be credited to this staff)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {staffList.map((staffName, idx) => {
                  const isSelected = selectedStaff === idx;
                  if (archivedStaff.includes(idx) && !isSelected) return null;
                  return (
                    <button
                      key={staffName}
                      type="button"
                      onClick={() => setSelectedStaff(idx)}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {staffName.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs truncate">{staffName}</div>
                        <div
                          className={`text-[10px] ${
                            isSelected ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          Promoter #{idx + 1}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Sale Date</span>
                {isSelectedDayFinalized && (
                  <span className="text-rose-600 font-bold flex items-center gap-1 text-[11px]">
                    <AlertTriangle className="w-3 h-3" /> Day is Finalized (Locked)
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedDateISO}
                  onChange={(e) => setSelectedDateISO(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>Day Index: {selectedDayOffset} ({formatDate(selectedDayOffset)})</span>
                <span>Oct 2026 Target Tracking</span>
              </div>
            </div>
          </div>

          {/* Paste Serial Numbers Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Paste Serial Numbers (SN)</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  (Single or multiple lines/commas supported)
                </span>
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Paste Clipboard</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleSNs}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>Try Sample SNs</span>
                </button>
                {pastedText.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setPastedText('');
                      setExcludedIds(new Set());
                      setErrorMessage(null);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-slate-600 rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={3}
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                setSubmissionResult(null);
                setErrorMessage(null);
              }}
              placeholder="Paste one or multiple serial numbers here...
Example:
82JVNBT00E0FKF
1581FA6QC267L01CHKWG
82JVNBT00E0PPN"
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden leading-relaxed placeholder:font-sans placeholder:text-slate-400"
            />
          </div>

          {/* Live Details Window / Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* Table Controls & Batch Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-xs">
                    Detected Units ({activeItems.length})
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-emerald-700 font-bold">
                    {validItemsToLog.length} valid to log
                  </span>
                  {activeItems.some((i) => i.isSold) && (
                    <>
                      <span className="text-slate-500">·</span>
                      <span className="text-rose-600 font-semibold">
                        {activeItems.filter((i) => i.isSold).length} already sold
                      </span>
                    </>
                  )}
                </div>

                {/* Bulk Tag All Leads */}
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-600 font-semibold mr-1">Set All Leads:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalLead(0)}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      globalLeadType === 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    Walk-in
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalLead(1)}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      globalLeadType === 1
                        ? 'bg-blue-600 text-white'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    Revisit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalLead(2)}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      globalLeadType === 2
                        ? 'bg-blue-600 text-white'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    Online
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalLead(3)}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      globalLeadType === 3
                        ? 'bg-blue-600 text-white'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    Untagged
                  </button>
                </div>
              </div>

              {/* Items List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                {activeItems.map((item) => {
                  return (
                    <div
                      key={item.id}
                      className={`p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-colors ${
                        item.isSold
                          ? 'bg-rose-50/50 hover:bg-rose-50'
                          : item.isUnknown
                          ? 'bg-amber-50/40 hover:bg-amber-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Product & SN Details */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.productName}
                          </span>
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            SN: {item.cleanSn}
                          </span>
                          {/* Stock Status Badge */}
                          {item.isSold ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              {item.soldDetail || 'ALREADY SOLD'}
                            </span>
                          ) : item.isUnknown ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              Custom SN / Not in Catalog
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              IN STOCK
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>
                            Series: <strong className="text-slate-700">{item.seriesName}</strong>
                          </span>
                          {item.unit && item.unit[5] && (
                            <>
                              <span>·</span>
                              <span>EAN: {item.unit[5]}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Price, Lead Type, Remove */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Price Input */}
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                          <span className="text-slate-400 font-semibold text-xs">₱</span>
                          <input
                            type="number"
                            min={0}
                            value={item.price}
                            onChange={(e) =>
                              handlePriceChange(item.id, Number(e.target.value) || 0)
                            }
                            className="w-20 font-bold text-slate-900 text-xs bg-transparent focus:outline-hidden"
                            title="Sales Amount (₱)"
                          />
                        </div>

                        {/* Lead Type Selector */}
                        <select
                          value={item.leadType}
                          onChange={(e) =>
                            handleLeadChange(
                              item.id,
                              Number(e.target.value) as 0 | 1 | 2 | 3
                            )
                          }
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value={0}>Walk-in</option>
                          <option value={1}>Revisit</option>
                          <option value={2}>Online</option>
                          <option value={3}>Not tagged</option>
                        </select>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove item from batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State when no text entered */}
          {parsedItems.length === 0 && (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-2">
              <ShoppingBag className="w-8 h-8 mx-auto text-slate-400" />
              <p className="font-bold text-slate-700 text-sm">No Serial Numbers Entered Yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Paste one or multiple SNs in the box above or click{' '}
                <button
                  type="button"
                  onClick={handleLoadSampleSNs}
                  className="text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  "Try Sample SNs"
                </button>{' '}
                to see live product resolution.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer / Commit Bar */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Batch Summary for {staffList[selectedStaff]}
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {validItemsToLog.length} unit{validItemsToLog.length === 1 ? '' : 's'} ·{' '}
                <span className="text-blue-700 font-black">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={validItemsToLog.length === 0 || isSelectedDayFinalized}
              onClick={handleSubmitBulk}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-white transition-all cursor-pointer shadow-md ${
                validItemsToLog.length === 0 || isSelectedDayFinalized
                  ? 'bg-slate-300 cursor-not-allowed opacity-70'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>
                Record {validItemsToLog.length} Sale{validItemsToLog.length === 1 ? '' : 's'} to {staffList[selectedStaff]}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
