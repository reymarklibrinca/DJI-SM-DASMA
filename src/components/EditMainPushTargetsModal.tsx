import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Target,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  AlertCircle,
  PlusCircle,
  Search,
  CheckSquare,
  Square,
  Box,
} from 'lucide-react';
import { DEFAULT_MAIN_PUSH_TARGETS } from '../hooks/useDjiStore';
import {
  KNOWN_SERIES_VARIANTS,
  DEFAULT_MAIN_PUSH_VARIANTS,
  SeriesVariantInfo,
  StockSubvariantItem,
  getAllStockSubvariants,
  getStockSubvariantsForTarget,
  isHardwareUnitItem,
  formatCurrency,
} from '../utils/calculations';
import { DJI_DATA } from '../data/initialData';

interface EditMainPushTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTargets: Record<string, number>;
  currentVariants?: Record<string, string[]>;
  onSaveTargets: (
    newTargets: Record<string, number>,
    newVariants?: Record<string, string[]>
  ) => void;
  onResetTargets?: () => void;
  onDeleteTarget?: (modelName: string) => void;
  soldByModel?: Record<string, number>;
  variantSales?: Record<string, Record<string, number>>;
}

export const EditMainPushTargetsModal: React.FC<EditMainPushTargetsModalProps> = ({
  isOpen,
  onClose,
  currentTargets,
  currentVariants = {},
  onSaveTargets,
  onResetTargets,
  onDeleteTarget,
  soldByModel = {},
  variantSales = {},
}) => {
  const [draftTargets, setDraftTargets] = useState<Record<string, number>>({});
  const [draftVariants, setDraftVariants] = useState<Record<string, string[]>>({});
  const [availableVariantsBySeries, setAvailableVariantsBySeries] = useState<
    Record<string, SeriesVariantInfo[]>
  >({});
  const [newModelName, setNewModelName] = useState('');
  const [newModelTarget, setNewModelTarget] = useState(10);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});
  const [customVariantInputs, setCustomVariantInputs] = useState<Record<string, string>>({});
  const [stockSearchQuery, setStockSearchQuery] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Master list of all subvariants (hardware units only) from stock
  const allStockSubvariants = useMemo(() => getAllStockSubvariants(), []);

  // Group all stock subvariants by series for organized catalog view (units only)
  const stockBySeries = useMemo(() => {
    const map = new Map<string, StockSubvariantItem[]>();
    allStockSubvariants.forEach((item) => {
      if (!isHardwareUnitItem(item.seriesName, item.productName)) return;
      const list = map.get(item.seriesName) || [];
      list.push(item);
      map.set(item.seriesName, list);
    });
    return map;
  }, [allStockSubvariants]);

  // Initialize draft state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftTargets({ ...currentTargets });
      setErrorMessage(null);

      const initialVariants: Record<string, string[]> = {};
      const initialAvailable: Record<string, SeriesVariantInfo[]> = {};

      Object.keys(currentTargets).forEach((series) => {
        const candidateItems: SeriesVariantInfo[] = [];

        // 1. Check known series items (units/combos only)
        const known = KNOWN_SERIES_VARIANTS[series];
        if (known && known.length > 0) {
          candidateItems.push(...known.filter((k) => isHardwareUnitItem(k.rawSerName, k.label)));
        } else {
          const upper = series.toUpperCase();
          const matches = DJI_DATA.ser
            .filter((s) => isHardwareUnitItem(s))
            .filter((s) => s.includes(upper) || upper.includes(s));
          if (matches.length > 0) {
            candidateItems.push(...matches.map((m) => ({ label: m, rawSerName: m })));
          } else if (isHardwareUnitItem(series)) {
            candidateItems.push({ label: series, rawSerName: series });
          }
        }

        // 2. Hardware units from Stocks matching this series (Subvariant = Units only)
        const stockUnits = getStockSubvariantsForTarget(series);
        stockUnits.forEach((su) => {
          if (
            isHardwareUnitItem(su.seriesName, su.productName) &&
            !candidateItems.some((c) => c.label.toLowerCase() === su.productName.toLowerCase())
          ) {
            candidateItems.push({
              label: su.productName,
              rawSerName: su.seriesName,
            });
          }
        });

        // Filter candidateItems to strictly hardware units
        const filteredCandidates = candidateItems.filter((c) =>
          isHardwareUnitItem(c.rawSerName, c.label)
        );

        initialAvailable[series] = filteredCandidates;

        // 3. Active selected variants/subvariants
        if (currentVariants[series] && Array.isArray(currentVariants[series])) {
          initialVariants[series] = currentVariants[series].filter((v) =>
            filteredCandidates.some((c) => c.label === v)
          );
        } else if (DEFAULT_MAIN_PUSH_VARIANTS[series]) {
          initialVariants[series] = DEFAULT_MAIN_PUSH_VARIANTS[series].filter((v) =>
            filteredCandidates.some((c) => c.label === v)
          );
        } else {
          initialVariants[series] = filteredCandidates.map((v) => v.label);
        }
      });

      setDraftVariants(initialVariants);
      setAvailableVariantsBySeries(initialAvailable);

      // Default expand all series
      const initialExpanded: Record<string, boolean> = {};
      Object.keys(currentTargets).forEach((s) => {
        initialExpanded[s] = true;
      });
      setExpandedSeries(initialExpanded);

      setIsAddingNew(false);
      setNewModelName('');
      setNewModelTarget(10);
      setStockSearchQuery({});
    }
  }, [isOpen, currentTargets, currentVariants]);

  if (!isOpen) return null;

  const handleTargetChange = (modelName: string, value: number) => {
    setDraftTargets((prev) => ({
      ...prev,
      [modelName]: Math.max(0, value),
    }));
  };

  const handleStep = (modelName: string, step: number) => {
    setDraftTargets((prev) => {
      const current = prev[modelName] ?? 0;
      return {
        ...prev,
        [modelName]: Math.max(0, current + step),
      };
    });
  };

  // Delete a target series
  const handleDeleteSeries = (modelName: string) => {
    setDraftTargets((prev) => {
      const next = { ...prev };
      delete next[modelName];
      return next;
    });

    setDraftVariants((prev) => {
      const next = { ...prev };
      delete next[modelName];
      return next;
    });

    if (onDeleteTarget) {
      onDeleteTarget(modelName);
    }
  };

  // Restore a default series
  const handleRestoreDefaultSeries = (modelName: string) => {
    const defaultTarget = DEFAULT_MAIN_PUSH_TARGETS[modelName] ?? 15;
    const defaultVars = DEFAULT_MAIN_PUSH_VARIANTS[modelName] ?? [modelName];

    setDraftTargets((prev) => ({
      ...prev,
      [modelName]: defaultTarget,
    }));

    const candidateItems: SeriesVariantInfo[] = [];
    if (KNOWN_SERIES_VARIANTS[modelName]) {
      candidateItems.push(
        ...KNOWN_SERIES_VARIANTS[modelName].filter((k) =>
          isHardwareUnitItem(k.rawSerName, k.label)
        )
      );
    } else if (isHardwareUnitItem(modelName)) {
      candidateItems.push({ label: modelName, rawSerName: modelName });
    }
    const stockUnits = getStockSubvariantsForTarget(modelName);
    stockUnits.forEach((su) => {
      if (
        isHardwareUnitItem(su.seriesName, su.productName) &&
        !candidateItems.some((c) => c.label.toLowerCase() === su.productName.toLowerCase())
      ) {
        candidateItems.push({ label: su.productName, rawSerName: su.seriesName });
      }
    });

    const filteredCandidates = candidateItems.filter((c) =>
      isHardwareUnitItem(c.rawSerName, c.label)
    );

    setDraftVariants((prev) => ({
      ...prev,
      [modelName]: defaultVars.filter((v) =>
        filteredCandidates.some((c) => c.label === v)
      ),
    }));

    setAvailableVariantsBySeries((prev) => ({
      ...prev,
      [modelName]: filteredCandidates,
    }));

    setExpandedSeries((prev) => ({
      ...prev,
      [modelName]: true,
    }));
  };

  // Toggle variant selection under a series
  const handleToggleVariant = (seriesName: string, variantLabel: string) => {
    setDraftVariants((prev) => {
      const currentList = prev[seriesName] || [];
      const isSelected = currentList.includes(variantLabel);
      const nextList = isSelected
        ? currentList.filter((v) => v !== variantLabel)
        : [...currentList, variantLabel];

      return {
        ...prev,
        [seriesName]: nextList,
      };
    });
  };

  // Select all or deselect all subvariants for a series
  const handleSelectAll = (seriesName: string, selectAll: boolean) => {
    const allLabels = (availableVariantsBySeries[seriesName] || []).map((v) => v.label);
    setDraftVariants((prev) => ({
      ...prev,
      [seriesName]: selectAll ? [...allLabels] : [],
    }));
  };

  // Add subvariant from stocks or series to a target (units only)
  const handleAddSubvariantToSeries = (
    seriesName: string,
    subvariantName: string,
    rawSerName: string
  ) => {
    const trimmedSub = subvariantName.trim();
    if (!trimmedSub) return;

    if (!isHardwareUnitItem(rawSerName, trimmedSub)) {
      setErrorMessage(
        `"${trimmedSub}" is classified as an accessory or service plan. Main Push targets are strictly for hardware units only.`
      );
      return;
    }

    setErrorMessage(null);

    setAvailableVariantsBySeries((prev) => {
      const list = prev[seriesName] || [];
      if (list.some((v) => v.label.toLowerCase() === trimmedSub.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        [seriesName]: [
          ...list,
          {
            label: trimmedSub,
            rawSerName: rawSerName.trim() || trimmedSub,
          },
        ],
      };
    });

    setDraftVariants((prev) => {
      const list = prev[seriesName] || [];
      if (list.includes(trimmedSub)) return prev;
      return {
        ...prev,
        [seriesName]: [...list, trimmedSub],
      };
    });

    setCustomVariantInputs((prev) => ({ ...prev, [seriesName]: '' }));
  };

  // Add new target series (hardware units only)
  const handleAddNewModel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newModelName.trim();
    if (!trimmed) return;

    if (!isHardwareUnitItem(trimmed)) {
      setErrorMessage(
        `"${trimmed}" is classified as accessories/care. Main Push targets are strictly for hardware units only (e.g. Action 6, Pocket 4, Mini 5 Pro, Neo).`
      );
      return;
    }

    setErrorMessage(null);
    const initialTarget = Math.max(1, Number(newModelTarget) || 1);

    setDraftTargets((prev) => ({
      ...prev,
      [trimmed]: initialTarget,
    }));

    const candidateItems: SeriesVariantInfo[] = [];
    const upper = trimmed.toUpperCase();
    const matches = DJI_DATA.ser
      .filter((s) => isHardwareUnitItem(s))
      .filter((s) => s.includes(upper) || upper.includes(s));
    if (matches.length > 0) {
      candidateItems.push(...matches.map((m) => ({ label: m, rawSerName: m })));
    } else {
      candidateItems.push({ label: trimmed, rawSerName: trimmed });
    }

    const stockUnits = getStockSubvariantsForTarget(trimmed);
    stockUnits.forEach((su) => {
      if (
        isHardwareUnitItem(su.seriesName, su.productName) &&
        !candidateItems.some((c) => c.label.toLowerCase() === su.productName.toLowerCase())
      ) {
        candidateItems.push({ label: su.productName, rawSerName: su.seriesName });
      }
    });

    const filteredCandidates = candidateItems.filter((c) =>
      isHardwareUnitItem(c.rawSerName, c.label)
    );

    setAvailableVariantsBySeries((prev) => ({
      ...prev,
      [trimmed]: filteredCandidates,
    }));

    setDraftVariants((prev) => ({
      ...prev,
      [trimmed]: filteredCandidates.map((v) => v.label),
    }));

    setExpandedSeries((prev) => ({
      ...prev,
      [trimmed]: true,
    }));

    setNewModelName('');
    setNewModelTarget(10);
    setIsAddingNew(false);
  };

  const handleReset = () => {
    setDraftTargets({ ...DEFAULT_MAIN_PUSH_TARGETS });
    setDraftVariants({ ...DEFAULT_MAIN_PUSH_VARIANTS });
    setAvailableVariantsBySeries({ ...KNOWN_SERIES_VARIANTS });
    if (onResetTargets) {
      onResetTargets();
    }
  };

  const handleSave = () => {
    onSaveTargets(draftTargets, draftVariants);
    onClose();
  };

  // Compute total store target
  const totalTargetUnits = Object.values(draftTargets).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0
  );
  const totalSoldUnits = Object.keys(draftTargets).reduce(
    (sum, key) => sum + (soldByModel[key] || 0),
    0
  );

  // Default series that have been deleted
  const deletedDefaultSeries = Object.keys(DEFAULT_MAIN_PUSH_TARGETS).filter(
    (key) => !(key in draftTargets)
  );

  // Format Series Display Title (e.g. OA Series -> ACTION SERIES, Pocket Series -> POCKET 4 SERIES)
  const getSeriesDisplayTitle = (name: string): string => {
    const upper = name.toUpperCase();
    if (upper === 'OA SERIES' || upper.includes('ACTION')) return 'ACTION SERIES';
    if (upper === 'POCKET SERIES' || upper.includes('POCKET')) return 'POCKET 4 SERIES';
    if (upper.includes('NEO')) return 'NEO SERIES';
    if (upper.includes('MINI')) return 'MINI 5 PRO SERIES';
    if (upper.includes('LITO')) return 'LITO X1 SERIES';
    return `${upper} SERIES`;
  };

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
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Manage Main Push Targets & Subvariants
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Checkmark to Select Subvariants
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Units Only · No Accessories
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Configure monthly unit quotas and select individual subvariants. Only hardware camera, drone, and gimbal units are included (all accessories and Care Refresh are strictly excluded).
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Error / Warning Alert Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer text-xs underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Summary Box */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">
                Store Target Summary
              </div>
              <div className="text-sm text-blue-700 mt-0.5">
                Current MTD Sold: <span className="font-bold">{totalSoldUnits}</span> units across{' '}
                <span className="font-bold">{Object.keys(draftTargets).length}</span> focus targets
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-blue-900">{totalTargetUnits} units</div>
              <div className="text-[11px] font-semibold text-blue-700">
                {Math.max(0, totalTargetUnits - totalSoldUnits)} units remaining
              </div>
            </div>
          </div>

          {/* Restore Deleted Series Banner */}
          {deletedDefaultSeries.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Deleted series ({deletedDefaultSeries.length}):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {deletedDefaultSeries.map((sName) => (
                  <button
                    key={sName}
                    type="button"
                    onClick={() => handleRestoreDefaultSeries(sName)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-xs font-bold text-amber-900 shadow-2xs transition-colors cursor-pointer"
                    title={`Restore ${sName} target`}
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Restore {sName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Target Series List with Sheets Checklist UI */}
          <div className="space-y-5">
            {Object.keys(draftTargets).length === 0 && (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
                <p className="font-semibold text-slate-700">No active targets configured.</p>
                <p className="text-xs mt-1">
                  Add custom models below or click "Reset Defaults" to restore initial targets.
                </p>
              </div>
            )}

            {Object.entries(draftTargets).map(([seriesName, targetVal]) => {
              const sold = soldByModel[seriesName] || 0;
              const remaining = Math.max(0, targetVal - sold);
              const pct = targetVal > 0 ? (sold / targetVal) * 100 : 0;
              const isExpanded = !!expandedSeries[seriesName];

              const availItems = availableVariantsBySeries[seriesName] || [
                { label: seriesName, rawSerName: seriesName },
              ];
              const selectedItems = draftVariants[seriesName] || [];

              const displayTitle = getSeriesDisplayTitle(seriesName);

              return (
                <div
                  key={seriesName}
                  className="rounded-xl border border-slate-300 bg-white shadow-2xs overflow-hidden"
                >
                  {/* Top Bar for Series: Title + Quota + Actions */}
                  <div className="px-4 py-3 bg-slate-100/90 border-b border-slate-300 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm tracking-wide font-mono uppercase">
                          {displayTitle}
                        </span>
                        {seriesName !== displayTitle && (
                          <span className="text-[10px] text-slate-500 font-semibold">
                            ({seriesName})
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          {selectedItems.length} of {availItems.length} selected
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>
                          MTD Sold: <strong className="text-slate-800">{sold}</strong> units
                        </span>
                        <span>·</span>
                        <span
                          className={
                            remaining === 0
                              ? 'text-emerald-600 font-bold'
                              : 'text-amber-700 font-medium'
                          }
                        >
                          {remaining === 0 ? 'Target Hit!' : `${remaining} units remaining`}
                        </span>
                        <span>·</span>
                        <span className="text-slate-600 font-medium">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>

                    {/* Step & Target Inputs + Delete Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300">
                        <button
                          type="button"
                          onClick={() => handleStep(seriesName, -1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                          title="Decrease by 1"
                        >
                          -
                        </button>

                        <input
                          type="number"
                          min={0}
                          value={targetVal}
                          onChange={(e) =>
                            handleTargetChange(seriesName, Number(e.target.value) || 0)
                          }
                          className="w-12 px-1 py-0.5 bg-transparent text-center font-black text-slate-900 text-xs focus:outline-hidden"
                        />

                        <button
                          type="button"
                          onClick={() => handleStep(seriesName, 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                          title="Increase by 1"
                        >
                          +
                        </button>
                      </div>

                      {/* Expand / Collapse Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSeries((prev) => ({
                            ...prev,
                            [seriesName]: !prev[seriesName],
                          }))
                        }
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                          isExpanded
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-300'
                        }`}
                        title="Toggle Checklist"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSeries(seriesName)}
                        className="p-1.5 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 bg-white border border-rose-200 transition-all cursor-pointer shadow-2xs"
                        title={`Delete ${seriesName} target`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* SPREADSHEET CHECKLIST TABLE (MATCHING USER SPECIFICATION) */}
                  {isExpanded && (
                    <div className="bg-white">
                      {/* Table Toolbar: Select All / Deselect All */}
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                          Subvariant Selection Checklist
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectAll(seriesName, true)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Select All</span>
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAll(seriesName, false)}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>Deselect All</span>
                          </button>
                        </div>
                      </div>

                      {/* Spreadsheet-Style Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                              <th className="py-2.5 px-4 w-48 border-r border-slate-200">
                                CHECKMARK TO SELECT
                              </th>
                              <th className="py-2.5 px-4 border-r border-slate-200">
                                SUBVARIANT (PRODUCT / COMBO NAME)
                              </th>
                              <th className="py-2.5 px-4 w-28 text-right border-r border-slate-200">
                                SRP
                              </th>
                              <th className="py-2.5 px-4 w-28 text-center">
                                STOCK
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-sans">
                            {availItems.map((item) => {
                              const isChecked = selectedItems.includes(item.label);
                              const stockItem = allStockSubvariants.find(
                                (s) => s.productName === item.label
                              );

                              return (
                                <tr
                                  key={item.label}
                                  onClick={() => handleToggleVariant(seriesName, item.label)}
                                  className={`cursor-pointer transition-colors select-none ${
                                    isChecked
                                      ? 'bg-blue-50/50 hover:bg-blue-50/80 font-medium'
                                      : 'hover:bg-slate-50 text-slate-400'
                                  }`}
                                >
                                  {/* Column 1: CHECKMARK TO SELECT */}
                                  <td className="py-2.5 px-4 border-r border-slate-200">
                                    <div className="flex items-center gap-2.5">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // Handled by row click
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                      />
                                      <span
                                        className={`text-[11px] font-bold ${
                                          isChecked
                                            ? 'text-blue-700'
                                            : 'text-slate-400 font-normal'
                                        }`}
                                      >
                                        {isChecked ? 'SELECTED' : 'Unchecked'}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Column 2: SUBVARIANT NAME */}
                                  <td className="py-2.5 px-4 border-r border-slate-200">
                                    <span
                                      className={`text-xs ${
                                        isChecked
                                          ? 'font-bold text-slate-900'
                                          : 'text-slate-400 line-through'
                                      }`}
                                    >
                                      {item.label}
                                    </span>
                                  </td>

                                  {/* Column 3: SRP Price */}
                                  <td className="py-2.5 px-4 text-right font-mono text-xs border-r border-slate-200">
                                    {stockItem ? (
                                      <span
                                        className={
                                          isChecked
                                            ? 'text-slate-800 font-semibold'
                                            : 'text-slate-400'
                                        }
                                      >
                                        {formatCurrency(stockItem.price)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>

                                  {/* Column 4: Stock Status */}
                                  <td className="py-2.5 px-4 text-center">
                                    {stockItem ? (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          stockItem.inStockCount > 0
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-slate-100 text-slate-500'
                                        }`}
                                      >
                                        {stockItem.inStockCount} in stock
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">Series</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Bottom of Series Card: Add More Subvariants from Stock Catalog */}
                      <div className="p-3 bg-slate-50/70 border-t border-slate-200 flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <div className="flex-1 min-w-[200px]">
                          <select
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs font-medium"
                            value=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                const found = allStockSubvariants.find(
                                  (s) => s.productName === val
                                );
                                if (found) {
                                  handleAddSubvariantToSeries(
                                    seriesName,
                                    found.productName,
                                    found.seriesName
                                  );
                                }
                              }
                            }}
                          >
                            <option value="">
                              + Add other hardware unit from stock ({allStockSubvariants.length} units available · no accessories)...
                            </option>
                            {Array.from(stockBySeries.entries()).map(([serGroup, items]) => (
                              <optgroup key={serGroup} label={`SERIES: ${serGroup}`}>
                                {items
                                  .filter(
                                    (it) => !availItems.some((a) => a.label === it.productName)
                                  )
                                  .map((subItem) => (
                                    <option key={subItem.productName} value={subItem.productName}>
                                      {subItem.productName} — {formatCurrency(subItem.price)} ({subItem.inStockCount} in stock)
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        {/* Add custom input */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="text"
                            placeholder="Add custom subvariant..."
                            value={customVariantInputs[seriesName] || ''}
                            onChange={(e) =>
                              setCustomVariantInputs((prev) => ({
                                ...prev,
                                [seriesName]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = customVariantInputs[seriesName];
                                if (val) handleAddSubvariantToSeries(seriesName, val, seriesName);
                              }
                            }}
                            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 w-44"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = customVariantInputs[seriesName];
                              if (val) handleAddSubvariantToSeries(seriesName, val, seriesName);
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add New Focus Target Series Form */}
          {isAddingNew ? (
            <form
              onSubmit={handleAddNewModel}
              className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3 animate-in fade-in duration-150"
            >
              <div className="font-bold text-slate-800 text-xs">Add New Focus Series Target</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Series Target Name (e.g. Osmo 360 Series)"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="sm:col-span-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  autoFocus
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Monthly Target Units"
                  value={newModelTarget}
                  onChange={(e) => setNewModelTarget(Number(e.target.value) || 1)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-bold"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1 text-slate-500 hover:text-slate-700 font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newModelName.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors shadow-2xs"
                >
                  Confirm Add Target
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Another Focus Target Series</span>
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

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
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-md active:scale-98"
            >
              Save Targets & Subvariants
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
