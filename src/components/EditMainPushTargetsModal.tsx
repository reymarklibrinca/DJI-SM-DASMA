import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Target,
  Users,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Search,
  CheckSquare,
  Square,
  Box,
  Sliders,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { DEFAULT_MAIN_PUSH_TARGETS } from '../hooks/useDjiStore';
import {
  KNOWN_SERIES_VARIANTS,
  DEFAULT_MAIN_PUSH_VARIANTS,
  StockSubvariantItem,
  getAllStockSubvariants,
  getStockSubvariantsForTarget,
  isHardwareUnitItem,
  formatCurrency,
  isSeriesStrictMatch,
} from '../utils/calculations';
import { DJI_DATA, MASTER_SERIES_LIST, MASTER_PRODUCTS } from '../data/initialData';

interface EditMainPushTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTargets: Record<string, number>;
  currentVariants?: Record<string, string[]>;
  currentDividers?: Record<string, number>;
  onSaveTargets: (
    newTargets: Record<string, number>,
    newVariants?: Record<string, string[]>,
    newDividers?: Record<string, number>
  ) => void;
  onResetTargets?: () => void;
  onDeleteTarget?: (modelName: string) => void;
  soldByModel?: Record<string, number>;
  variantSales?: Record<string, Record<string, number>>;
  activeMonthName?: string;
}

// Normalizer helper (nk = normalized key)
const nk = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const EditMainPushTargetsModal: React.FC<EditMainPushTargetsModalProps> = ({
  isOpen,
  onClose,
  currentTargets,
  currentVariants = {},
  currentDividers = {},
  onSaveTargets,
  onResetTargets,
  onDeleteTarget,
  soldByModel = {},
  variantSales = {},
  activeMonthName,
}) => {
  const [draftTargets, setDraftTargets] = useState<Record<string, number>>({});
  const [draftVariants, setDraftVariants] = useState<Record<string, string[]>>({});
  const [draftDividers, setDraftDividers] = useState<Record<string, number>>({});
  const [globalDivider, setGlobalDivider] = useState<number>(3);
  const [newModelDivider, setNewModelDivider] = useState<number>(3);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [openCatalogs, setOpenCatalogs] = useState<Record<string, boolean>>({});
  const [openSeriesMap, setOpenSeriesMap] = useState<Record<string, boolean>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Group State (Follows Master Series)
  const [selectedMasterSeries, setSelectedMasterSeries] = useState<string>('');
  const [customSeriesInput, setCustomSeriesInput] = useState<string>('');
  const [newModelTarget, setNewModelTarget] = useState<number>(10);

  // Per-Group "Add Subvariant" inputs
  const [newSubvariantInputs, setNewSubvariantInputs] = useState<Record<string, string>>({});

  // Hardware Master Series (Drone, Handheld, Audio, Power)
  const hardwareMasterSeries = useMemo(() => {
    return MASTER_SERIES_LIST.filter((s) => isHardwareUnitItem(s));
  }, []);

  // Master list of all subvariants (hardware units only) from stock
  const allStockSubvariants = useMemo(() => getAllStockSubvariants(), []);

  // Group all stock subvariants by series for organized catalog view (units only)
  const stockBySeries = useMemo(() => {
    const map = new Map<string, StockSubvariantItem[]>();
    allStockSubvariants.forEach((item) => {
      if (!isHardwareUnitItem(item.seriesName, item.productName)) return;
      const list = map.get(item.seriesName) || [];
      if (!list.some((existing) => nk(existing.productName) === nk(item.productName))) {
        list.push(item);
      }
      map.set(item.seriesName, list);
    });
    return map;
  }, [allStockSubvariants]);

  // List of all unique hardware series names sorted logically
  const allSeriesNames = useMemo(() => {
    const names = Array.from(stockBySeries.keys());
    return names.sort((a, b) => {
      const getPriority = (s: string) => {
        const u = s.toUpperCase();
        if (u.includes('ACTION')) return 1;
        if (u.includes('POCKET')) return 2;
        if (u.includes('MINI 5')) return 3;
        if (u.includes('NEO')) return 4;
        if (u.includes('LITO')) return 5;
        if (u.includes('AIR')) return 6;
        if (u.includes('AVATA')) return 7;
        if (u.includes('OSMO 360')) return 8;
        if (u.includes('MAVIC')) return 9;
        if (u.includes('RONIN') || u.includes('RS')) return 10;
        return 20;
      };
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    });
  }, [stockBySeries]);

    const wasOpenRef = useRef(false);

  // Initialize draft state ONLY when the modal transitions from closed to open.
  // This guarantees that background updates, re-renders, or syncs NEVER wipe out
  // whatever targets or subvariants the user is actively typing!
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setDraftTargets({ ...currentTargets });
      setDraftDividers({ ...currentDividers });
      setErrorMessage(null);
      setSearchQueries({});
      setNewSubvariantInputs({});

      const initialVariants: Record<string, string[]> = {};
      const initialCatalogs: Record<string, boolean> = {};
      const initialSeriesMap: Record<string, boolean> = {};

      Object.keys(currentTargets).forEach((series) => {
        initialCatalogs[series] = false;

        // Pre-select variants based on currentVariants, or defaults, or known variants
        if (currentVariants[series] && Array.isArray(currentVariants[series])) {
          initialVariants[series] = [...currentVariants[series]];
        } else if (DEFAULT_MAIN_PUSH_VARIANTS[series]) {
          initialVariants[series] = [...DEFAULT_MAIN_PUSH_VARIANTS[series]];
        } else {
          const stockUnits = getStockSubvariantsForTarget(series);
          initialVariants[series] = stockUnits.map((s) => s.productName);
        }

        // Open the matching series for each group
        const uGroup = series.toUpperCase();
        allSeriesNames.forEach((ser) => {
          const uSer = ser.toUpperCase();
          const shouldOpen =
            (uGroup.includes('ACTION') && uSer.includes('ACTION')) ||
            (uGroup.includes('POCKET') && uSer.includes('POCKET')) ||
            (uGroup.includes('MINI 5') && uSer.includes('MINI 5')) ||
            (uGroup.includes('NEO') && uSer.includes('NEO')) ||
            (uGroup.includes('LITO') && uSer.includes('LITO')) ||
            uGroup === uSer ||
            uGroup.includes(uSer) ||
            uSer.includes(uGroup);

          if (shouldOpen) {
            initialSeriesMap[`${series}|${ser}`] = true;
          }
        });
      });

      setDraftVariants(initialVariants);
      setOpenCatalogs(initialCatalogs);
      setOpenSeriesMap(initialSeriesMap);
      setIsAddingNew(false);
      setSelectedMasterSeries('');
      setCustomSeriesInput('');
      setNewModelTarget(10);
      setNewModelDivider(3);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTargetChange = (groupName: string, value: number) => {
    setDraftTargets((prev) => ({
      ...prev,
      [groupName]: Math.max(0, value),
    }));
  };


  const handleDividerChange = (groupName: string, value: number) => {
    setDraftDividers((prev) => ({
      ...prev,
      [groupName]: Math.max(1, Math.round(value)),
    }));
  };

  const handleStepDivider = (groupName: string, delta: number) => {
    setDraftDividers((prev) => {
      const current = prev[groupName] ?? 3;
      return {
        ...prev,
        [groupName]: Math.max(1, current + delta),
      };
    });
  };

  const handleApplyGlobalDivider = (dividerVal: number) => {
    const val = Math.max(1, Math.round(dividerVal));
    const next: Record<string, number> = {};
    Object.keys(draftTargets).forEach((k) => {
      next[k] = val;
    });
    setDraftDividers(next);
  };

  const handleStep = (groupName: string, delta: number) => {
    setDraftTargets((prev) => {
      const cur = prev[groupName] || 0;
      return {
        ...prev,
        [groupName]: Math.max(0, cur + delta),
      };
    });
  };

  // Toggle variant selection inside a target group
  const handleToggleUnit = (groupName: string, productName: string) => {
    setDraftVariants((prev) => {
      const cur = prev[groupName] || [];
      const normProd = nk(productName);
      const isSelected = cur.some((v) => nk(v) === normProd);
      let updated: string[];
      if (isSelected) {
        updated = cur.filter((v) => nk(v) !== normProd);
      } else {
        updated = [...cur, productName];
      }
      return { ...prev, [groupName]: updated };
    });
  };

  // ADD A SUBVARIANT DIRECTLY (NO SUGGESTIONS)
  const handleAddSubvariant = (groupName: string) => {
    const rawVal = newSubvariantInputs[groupName]?.trim();
    if (!rawVal) return;

    setDraftVariants((prev) => {
      const cur = prev[groupName] || [];
      if (cur.some((v) => nk(v) === nk(rawVal))) {
        return prev; // already exists
      }
      return {
        ...prev,
        [groupName]: [...cur, rawVal],
      };
    });

    setNewSubvariantInputs((prev) => ({
      ...prev,
      [groupName]: '',
    }));
  };

  // DELETE A SUBVARIANT DIRECTLY
  const handleDeleteSubvariant = (groupName: string, subvariantName: string) => {
    setDraftVariants((prev) => {
      const cur = prev[groupName] || [];
      return {
        ...prev,
        [groupName]: cur.filter((v) => nk(v) !== nk(subvariantName)),
      };
    });
  };

  // Toggle entire series in catalog tree
  const handleToggleSeriesInGroup = (groupName: string, serName: string) => {
    const unitsInSeries = stockBySeries.get(serName) || [];
    setDraftVariants((prev) => {
      const cur = prev[groupName] || [];
      const curKeys = new Set(cur.map(nk));
      const seriesKeys = unitsInSeries.map((u) => nk(u.productName));
      const allSelected = seriesKeys.every((k) => curKeys.has(k));

      let updated: string[];
      if (allSelected) {
        updated = cur.filter((v) => !seriesKeys.includes(nk(v)));
      } else {
        const toAdd = unitsInSeries
          .filter((u) => !curKeys.has(nk(u.productName)))
          .map((u) => u.productName);
        updated = [...cur, ...toAdd];
      }
      return { ...prev, [groupName]: updated };
    });
  };

  const handleToggleCatalogDrawer = (groupName: string) => {
    setOpenCatalogs((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const handleToggleSeriesFolder = (groupName: string, serName: string) => {
    const key = `${groupName}|${serName}`;
    setOpenSeriesMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Delete a target series group
  const handleDeleteGroup = (groupName: string) => {
    setDraftTargets((prev) => {
      const next = { ...prev };
      delete next[groupName];
      return next;
    });
    setDraftVariants((prev) => {
      const next = { ...prev };
      delete next[groupName];
      return next;
    });
    if (onDeleteTarget) {
      onDeleteTarget(groupName);
    }
  };

  // ADD NEW TARGET GROUP FOLLOWING THE MASTER SERIES
  const handleAddNewGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSeriesName =
      selectedMasterSeries === '__CUSTOM__'
        ? customSeriesInput.trim()
        : (selectedMasterSeries || customSeriesInput).trim();

    if (!finalSeriesName) {
      setErrorMessage('Please select a Master Series or enter a custom target name.');
      return;
    }

    if (!isHardwareUnitItem(finalSeriesName)) {
      setErrorMessage(
        `"${finalSeriesName}" is classified as an accessory or service plan. Main Push targets follow hardware series only (e.g. Action 6, Pocket 4, Mini 5 Pro, Neo 2).`
      );
      return;
    }

    if (draftTargets[finalSeriesName] !== undefined) {
      setErrorMessage(`Target group "${finalSeriesName}" already exists in the list.`);
      return;
    }

    setErrorMessage(null);
    const initialTarget = Math.max(1, Number(newModelTarget) || 1);

    // Populate default subvariants from Master Catalog products for this series strictly
    const masterProds = MASTER_PRODUCTS.filter(
      (p) =>
        isSeriesStrictMatch(p.series, finalSeriesName) &&
        isHardwareUnitItem(p.series, p.productName)
    ).map((p) => p.productName);

    const stockUnits = masterProds.length > 0 ? masterProds : getStockSubvariantsForTarget(finalSeriesName).map((s) => s.productName);

    setDraftTargets((prev) => ({
      ...prev,
      [finalSeriesName]: initialTarget,
    }));

    setDraftVariants((prev) => ({
      ...prev,
      [finalSeriesName]: stockUnits,
    }));

    setOpenCatalogs((prev) => ({
      ...prev,
      [finalSeriesName]: false,
    }));

    setSelectedMasterSeries('');
    setCustomSeriesInput('');
    setNewModelTarget(10);
    setIsAddingNew(false);
  };

  // Reset defaults
  const handleReset = () => {
    setDraftTargets({ ...DEFAULT_MAIN_PUSH_TARGETS });
    setDraftVariants({ ...DEFAULT_MAIN_PUSH_VARIANTS });
    if (onResetTargets) {
      onResetTargets();
    }
  };

  // Save changes
  const handleSave = () => {
    onSaveTargets(draftTargets, draftVariants, draftDividers);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white leading-tight">
                  Edit Main Push Targets & Subvariants
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Follows Master Series
                </span>
                {activeMonthName && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Active: {activeMonthName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Set monthly target quotas by master series and customize included subvariants without automated suggestions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Store Target Summary */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Store Main Push Quota Summary ({activeMonthName || 'Current Month'})
              </div>
              <div className="text-xs text-slate-700 mt-0.5">
                Current Sales Sold: <span className="font-bold text-slate-900">{totalSoldUnits}</span> units across{' '}
                <span className="font-bold text-slate-900">{Object.keys(draftTargets).length}</span> series targets
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-black text-slate-900">{totalTargetUnits} units</div>
                <div className="text-[11px] font-semibold text-slate-500">
                  {Math.max(0, totalTargetUnits - totalSoldUnits)} units remaining
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Series Target</span>
              </button>
            </div>
          </div>

          {/* ADD NEW TARGET GROUP (FOLLOWS MASTER SERIES) */}
          {isAddingNew && (
            <form
              onSubmit={handleAddNewGroup}
              className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 animate-in fade-in duration-150"
            >
              <div className="font-bold text-blue-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Add Main Push Target (Follow Master Series)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
                >
                  ✕ Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Select Master Series
                  </label>
                  <select
                    value={selectedMasterSeries}
                    onChange={(e) => setSelectedMasterSeries(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">-- Choose from Master Series catalog --</option>
                    {hardwareMasterSeries.map((s) => (
                      <option key={s} value={s} disabled={draftTargets[s] !== undefined}>
                        {s} {draftTargets[s] !== undefined ? '(Already Added)' : ''}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Custom Series Name...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Monthly Quota (Units)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newModelTarget}
                    onChange={(e) => setNewModelTarget(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {selectedMasterSeries === '__CUSTOM__' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Custom Target Series Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MAVIC 4 PRO SERIES or SPECIAL COMBO"
                    value={customSeriesInput}
                    onChange={(e) => setCustomSeriesInput(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    autoFocus
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedMasterSeries && !customSeriesInput}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Confirm & Add Target
                </button>
              </div>
            </form>
          )}

          {/* TARGET GROUPS LIST */}
          <div className="space-y-4">
            {Object.keys(draftTargets).length === 0 && (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
                <p className="font-semibold text-slate-700">No active targets configured.</p>
                <p className="text-xs mt-1">
                  Click "+ Add Series Target" to select from the Master Series catalog or "Reset Defaults".
                </p>
              </div>
            )}

            {Object.entries(draftTargets).map(([groupName, targetVal]) => {
              const sold = soldByModel[groupName] || 0;
              const remaining = Math.max(0, targetVal - sold);
              const pct = targetVal > 0 ? (sold / targetVal) * 100 : 0;
              const selectedUnits = draftVariants[groupName] || [];
              const selectedKeys = new Set(selectedUnits.map(nk));
              const isCatalogOpen = openCatalogs[groupName] ?? false;
              const searchQuery = searchQueries[groupName] || '';
              const queryNormalized = nk(searchQuery);

              // Catalog products belonging to this series that are not yet added (strict series match)
              const availableCatalogSkus = MASTER_PRODUCTS.filter(
                (p) =>
                  isSeriesStrictMatch(p.series, groupName) &&
                  isHardwareUnitItem(p.series, p.productName) &&
                  !selectedKeys.has(nk(p.productName))
              ).map((p) => p.productName);

              return (
                <div
                  key={groupName}
                  className="rounded-xl border border-slate-300 bg-white shadow-2xs overflow-hidden"
                >
                  {/* Top Bar: Group Name + Target Stepper + Delete */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm tracking-wide uppercase font-mono">
                          {groupName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          {selectedUnits.length} subvariants active
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>
                          Current Month Sold: <strong className="text-slate-900">{sold}</strong> units
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

                    {/* Step & Target Inputs + Custom Person Divider + Delete Button */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                      {/* Target Stepper */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Target:
                        </span>
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleStep(groupName, -1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                            title="Decrease quota"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={targetVal}
                            onChange={(e) =>
                              handleTargetChange(groupName, Number(e.target.value) || 0)
                            }
                            className="w-12 px-1 py-0.5 bg-transparent text-center font-black text-slate-900 text-xs focus:outline-hidden"
                            title="Monthly Target Quota"
                          />
                          <button
                            type="button"
                            onClick={() => handleStep(groupName, 1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                            title="Increase quota"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Custom Persons Divider */}
                      <div className="flex items-center gap-1 bg-blue-50/80 px-2 py-0.5 rounded-lg border border-blue-200">
                        <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="text-[11px] font-bold text-blue-800">
                          Divide by:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStepDivider(groupName, -1)}
                          className="w-5 h-5 rounded bg-white hover:bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer border border-blue-200"
                          title="Decrease number of persons"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={draftDividers[groupName] ?? 3}
                          onChange={(e) =>
                            handleDividerChange(groupName, Number(e.target.value) || 1)
                          }
                          className="w-8 px-0.5 py-0.5 bg-white text-center font-black text-blue-950 text-xs rounded border border-blue-200 focus:outline-hidden"
                          title="Number of persons dividing this target"
                        />
                        <button
                          type="button"
                          onClick={() => handleStepDivider(groupName, 1)}
                          className="w-5 h-5 rounded bg-white hover:bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer border border-blue-200"
                          title="Increase number of persons"
                        >
                          +
                        </button>
                        <span className="text-[11px] font-semibold text-blue-700">
                          persons
                        </span>
                      </div>

                      {/* Dynamic Result Pill */}
                      <div className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                        <span>=</span>
                        <span className="font-black text-emerald-900">
                          {Math.round(targetVal / Math.max(1, draftDividers[groupName] ?? 3))}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700">/ person</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(groupName)}
                        className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 bg-white border border-rose-200 transition-all cursor-pointer shadow-2xs font-bold text-xs flex items-center gap-1"
                        title={`Remove ${groupName} target`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>
                  </div>

                  {/* SUBVARIANT MANAGEMENT (OPTION TO ADD A SUBVARIANT - NO SUGGESTIONS) */}
                  <div className="p-4 space-y-3 bg-white">
                    {/* Add Subvariant Form */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-blue-600" />
                          <span>Add Subvariant</span>
                        </label>
                        <span className="text-[10px] text-slate-500">
                          Type custom variant name or select catalog SKU
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Type subvariant name (e.g. Fly More Combo, 256GB)..."
                          value={newSubvariantInputs[groupName] || ''}
                          onChange={(e) =>
                            setNewSubvariantInputs((prev) => ({
                              ...prev,
                              [groupName]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSubvariant(groupName);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />

                        {availableCatalogSkus.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setNewSubvariantInputs((prev) => ({
                                  ...prev,
                                  [groupName]: e.target.value,
                                }));
                              }
                            }}
                            value=""
                            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="">Or select catalog SKU ({availableCatalogSkus.length})...</option>
                            {availableCatalogSkus.map((sku) => (
                              <option key={sku} value={sku}>
                                {sku}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => handleAddSubvariant(groupName)}
                          disabled={!newSubvariantInputs[groupName]?.trim()}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                        >
                          + Add Subvariant
                        </button>
                      </div>
                    </div>

                    {/* Active Subvariants List with Checkbox Toggle & Delete */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                        <span>Active Subvariants in Quota ({selectedUnits.length}):</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Check to include in target quota · Click ✕ to remove
                        </span>
                      </div>

                      {selectedUnits.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                          No subvariants added yet. Use "Add Subvariant" above or open the Catalog below.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedUnits.map((uName) => {
                            const stockInfo = allStockSubvariants.find(
                              (s) => nk(s.productName) === nk(uName)
                            );
                            return (
                              <div
                                key={uName}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                              >
                                <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={true}
                                    onChange={() => handleToggleUnit(groupName, uName)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span className="text-xs font-semibold text-slate-800 truncate" title={uName}>
                                    {uName}
                                  </span>
                                  {stockInfo && (
                                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                      {formatCurrency(stockInfo.price)}
                                    </span>
                                  )}
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubvariant(groupName, uName)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors ml-2 cursor-pointer"
                                  title={`Remove ${uName}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Expandable Catalog Accordion for Complete Stock Exploration */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleToggleCatalogDrawer(groupName)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {isCatalogOpen ? 'Hide Master Catalog Browser' : 'Browse All Master Catalog SKUs'}
                        </span>
                        {isCatalogOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isCatalogOpen && (
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) =>
                                setSearchQueries((prev) => ({
                                  ...prev,
                                  [groupName]: e.target.value,
                                }))
                              }
                              placeholder="Search master catalog products..."
                              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 font-medium focus:outline-hidden"
                            />
                            {searchQuery && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSearchQueries((prev) => ({
                                    ...prev,
                                    [groupName]: '',
                                  }))
                                }
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-200 bg-white">
                            {allSeriesNames
                              .map((serName) => {
                                const allUnitsInSeries = stockBySeries.get(serName) || [];
                                const visibleUnits = queryNormalized
                                  ? allUnitsInSeries.filter(
                                      (u) =>
                                        nk(u.productName).includes(queryNormalized) ||
                                        nk(serName).includes(queryNormalized)
                                    )
                                  : allUnitsInSeries;
                                if (visibleUnits.length === 0) return null;

                                const selectedCountInSeries = allUnitsInSeries.filter((u) =>
                                  selectedKeys.has(nk(u.productName))
                                ).length;
                                const isAllSelected =
                                  allUnitsInSeries.length > 0 &&
                                  selectedCountInSeries === allUnitsInSeries.length;
                                const isPartial = selectedCountInSeries > 0 && !isAllSelected;
                                const isSeriesOpen =
                                  openSeriesMap[`${groupName}|${serName}`] ||
                                  Boolean(queryNormalized);

                                return (
                                  <div key={serName} className="text-xs">
                                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleSeriesFolder(groupName, serName)
                                          }
                                          className="text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
                                        >
                                          {isSeriesOpen ? (
                                            <ChevronDown className="w-3.5 h-3.5" />
                                          ) : (
                                            <ChevronUp className="w-3.5 h-3.5 rotate-90" />
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleSeriesInGroup(groupName, serName)
                                          }
                                          className="flex items-center gap-1.5 text-left cursor-pointer truncate font-bold text-slate-800"
                                        >
                                          {isAllSelected ? (
                                            <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                                          ) : isPartial ? (
                                            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-500 flex items-center justify-center shrink-0">
                                              <div className="w-2 h-2 bg-blue-600 rounded-xs" />
                                            </div>
                                          ) : (
                                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                          )}
                                          <span className="truncate">{serName}</span>
                                        </button>
                                      </div>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        {selectedCountInSeries}/{allUnitsInSeries.length}
                                      </span>
                                    </div>

                                    {isSeriesOpen && (
                                      <div className="px-3 py-1.5 divide-y divide-slate-100 pl-8 bg-white">
                                        {visibleUnits.map((unit) => {
                                          const checked = selectedKeys.has(nk(unit.productName));
                                          return (
                                            <label
                                              key={unit.productName}
                                              className="flex items-center justify-between py-1.5 hover:bg-slate-50 px-2 rounded cursor-pointer"
                                            >
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={() =>
                                                    handleToggleUnit(groupName, unit.productName)
                                                  }
                                                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span className="truncate text-slate-700">
                                                  {unit.productName}
                                                </span>
                                              </div>
                                              <span className="text-[10px] font-mono text-slate-500">
                                                {formatCurrency(unit.price)}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                              .filter(Boolean)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Reset to Master Series defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Master Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Save & Apply Targets</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
