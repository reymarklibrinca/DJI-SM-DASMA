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
  Sliders,
  Filter,
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

// Normalizer helper matching user HTML specification (nk = normalized key)
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
  onSaveTargets,
  onResetTargets,
  onDeleteTarget,
  soldByModel = {},
  variantSales = {},
}) => {
  const [draftTargets, setDraftTargets] = useState<Record<string, number>>({});
  const [draftVariants, setDraftVariants] = useState<Record<string, string[]>>({});
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [openCatalogs, setOpenCatalogs] = useState<Record<string, boolean>>({});
  const [openSeriesMap, setOpenSeriesMap] = useState<Record<string, boolean>>({});
  const [groupViewMode, setGroupViewMode] = useState<Record<string, 'catalog' | 'selected'>>({});
  const [newModelName, setNewModelName] = useState('');
  const [newModelTarget, setNewModelTarget] = useState(10);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      // Prioritize primary camera/drone series on top
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
        if (u.includes('OM')) return 10;
        if (u.includes('RONIN') || u.includes('RS')) return 11;
        return 20;
      };
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    });
  }, [stockBySeries]);

  // Initialize draft state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftTargets({ ...currentTargets });
      setErrorMessage(null);
      setSearchQueries({});

      const initialVariants: Record<string, string[]> = {};
      const initialCatalogs: Record<string, boolean> = {};
      const initialSeriesMap: Record<string, boolean> = {};
      const initialViewMode: Record<string, 'catalog' | 'selected'> = {};

      Object.keys(currentTargets).forEach((series) => {
        // Expand catalog drawer by default
        initialCatalogs[series] = true;
        initialViewMode[series] = 'catalog';

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
      setGroupViewMode(initialViewMode);
      setIsAddingNew(false);
      setNewModelName('');
      setNewModelTarget(10);
    }
  }, [isOpen, currentTargets, currentVariants, allSeriesNames]);

  if (!isOpen) return null;

  const handleTargetChange = (groupName: string, value: number) => {
    setDraftTargets((prev) => ({
      ...prev,
      [groupName]: Math.max(0, value),
    }));
  };

  const handleStep = (groupName: string, step: number) => {
    setDraftTargets((prev) => {
      const current = prev[groupName] ?? 0;
      return {
        ...prev,
        [groupName]: Math.max(0, current + step),
      };
    });
  };

  // Toggle unit selection under a target group (matching data-mp in HTML)
  const handleToggleUnit = (groupName: string, unitName: string) => {
    setDraftVariants((prev) => {
      const currentList = prev[groupName] || [];
      const key = nk(unitName);
      const isSelected = currentList.some((x) => nk(x) === key);
      const nextList = isSelected
        ? currentList.filter((x) => nk(x) !== key)
        : [...currentList, unitName];

      return {
        ...prev,
        [groupName]: nextList,
      };
    });
  };

  // Toggle whole series for a target group (matching data-sa in HTML)
  const handleToggleWholeSeries = (groupName: string, seriesName: string, selectAll: boolean) => {
    const itemsInSeries = (stockBySeries.get(seriesName) || []).map((x) => x.productName);
    const seriesKeys = new Set(itemsInSeries.map(nk));

    setDraftVariants((prev) => {
      const currentList = prev[groupName] || [];
      // Remove all items of this series
      const withoutSeries = currentList.filter((x) => !seriesKeys.has(nk(x)));
      // If selectAll is true, add all items in this series
      const nextList = selectAll ? [...withoutSeries, ...itemsInSeries] : withoutSeries;

      return {
        ...prev,
        [groupName]: nextList,
      };
    });

    // Ensure this series is open
    setOpenSeriesMap((prev) => ({
      ...prev,
      [`${groupName}|${seriesName}`]: true,
    }));
  };

  // Toggle catalog drawer open/close (matching details data-gd)
  const handleToggleCatalogDrawer = (groupName: string) => {
    setOpenCatalogs((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  // Toggle series accordion open/close (matching details data-sd)
  const handleToggleSeriesAccordion = (groupName: string, seriesName: string) => {
    const key = `${groupName}|${seriesName}`;
    setOpenSeriesMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Delete a target series group (matching data-mr in HTML)
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

  // Restore a default series
  const handleRestoreDefaultSeries = (modelName: string) => {
    const defaultTarget = DEFAULT_MAIN_PUSH_TARGETS[modelName] ?? 15;
    const defaultVars = DEFAULT_MAIN_PUSH_VARIANTS[modelName] ?? [modelName];

    setDraftTargets((prev) => ({
      ...prev,
      [modelName]: defaultTarget,
    }));

    setDraftVariants((prev) => ({
      ...prev,
      [modelName]: [...defaultVars],
    }));

    setOpenCatalogs((prev) => ({
      ...prev,
      [modelName]: true,
    }));

    // Auto open matching series
    const uGroup = modelName.toUpperCase();
    allSeriesNames.forEach((ser) => {
      const uSer = ser.toUpperCase();
      if (uGroup.includes(uSer) || uSer.includes(uGroup)) {
        setOpenSeriesMap((prev) => ({
          ...prev,
          [`${modelName}|${ser}`]: true,
        }));
      }
    });
  };

  // Add new target series group (matching #mpa in HTML)
  const handleAddNewGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newModelName.trim();
    if (!trimmed) return;

    if (!isHardwareUnitItem(trimmed)) {
      setErrorMessage(
        `"${trimmed}" is classified as an accessory or service plan. Main Push targets are strictly for hardware units only (e.g. Action 6, Pocket 4, Mini 5 Pro, Neo).`
      );
      return;
    }

    setErrorMessage(null);
    const initialTarget = Math.max(1, Number(newModelTarget) || 1);

    setDraftTargets((prev) => ({
      ...prev,
      [trimmed]: initialTarget,
    }));

    const stockUnits = getStockSubvariantsForTarget(trimmed);
    setDraftVariants((prev) => ({
      ...prev,
      [trimmed]: stockUnits.map((s) => s.productName),
    }));

    setOpenCatalogs((prev) => ({
      ...prev,
      [trimmed]: true,
    }));

    // Open matching series
    const u = trimmed.toUpperCase();
    allSeriesNames.forEach((ser) => {
      if (ser.toUpperCase().includes(u) || u.includes(ser.toUpperCase())) {
        setOpenSeriesMap((prev) => ({
          ...prev,
          [`${trimmed}|${ser}`]: true,
        }));
      }
    });

    setNewModelName('');
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

  // Format Series Display Title
  const getSeriesDisplayTitle = (name: string): string => {
    const upper = name.toUpperCase();
    if (upper === 'OA SERIES' || upper === 'ACTION' || upper.includes('ACTION')) return 'ACTION SERIES';
    if (upper === 'POCKET SERIES' || upper.includes('POCKET')) return 'POCKET 4 SERIES';
    if (upper.includes('NEO')) return 'NEO SERIES';
    if (upper.includes('MINI')) return 'MINI 5 PRO SERIES';
    if (upper.includes('LITO')) return 'LITO X1 SERIES';
    return upper.endsWith('SERIES') ? upper : `${upper} SERIES`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Main Push Targets & Catalog
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Checkmark to Select Units
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Hardware Units Only · No Accessories
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Set monthly unit quotas and check off individual subvariants from the full catalog. Accessories and Care Refresh are strictly excluded.
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
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

          {/* Target Groups List */}
          <div className="space-y-5">
            {Object.keys(draftTargets).length === 0 && (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
                <p className="font-semibold text-slate-700">No active targets configured.</p>
                <p className="text-xs mt-1">
                  Click "+ Add Group" below or "Reset Defaults" to restore initial target categories.
                </p>
              </div>
            )}

            {Object.entries(draftTargets).map(([groupName, targetVal], groupIdx) => {
              const sold = soldByModel[groupName] || 0;
              const remaining = Math.max(0, targetVal - sold);
              const pct = targetVal > 0 ? (sold / targetVal) * 100 : 0;

              const selectedUnits = draftVariants[groupName] || [];
              const selectedKeys = new Set(selectedUnits.map(nk));

              const isCatalogOpen = openCatalogs[groupName] ?? true;
              const searchQuery = searchQueries[groupName] || '';
              const queryNormalized = nk(searchQuery);

              const currentMode = groupViewMode[groupName] || 'catalog';
              const displayTitle = getSeriesDisplayTitle(groupName);

              return (
                <div
                  key={groupName}
                  className="rounded-xl border border-slate-300 bg-white shadow-2xs overflow-hidden"
                >
                  {/* Top Bar: Group Name + Target Stepper + Delete */}
                  <div className="px-4 py-3 bg-slate-100/90 border-b border-slate-300 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm tracking-wide font-mono uppercase">
                          {displayTitle}
                        </span>
                        {groupName !== displayTitle && (
                          <span className="text-[10px] text-slate-500 font-semibold">
                            ({groupName})
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          {selectedUnits.length} units selected
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
                          onClick={() => handleStep(groupName, -1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                          title="Decrease quota by 1"
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
                          title="Increase quota by 1"
                        >
                          +
                        </button>
                      </div>

                      {/* Remove Group Button (matching data-mr in HTML) */}
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(groupName)}
                        className="px-2 py-1.5 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 bg-white border border-rose-200 transition-all cursor-pointer shadow-2xs font-bold text-xs flex items-center gap-1"
                        title={`Remove ${groupName} target group`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>
                  </div>

                  {/* CATALOG ACCORDION TRIGGER (MATCHING HTML: <summary class="mut">Catalog: X units selected (checkmark to select)</summary>) */}
                  <div className="border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleToggleCatalogDrawer(groupName)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-blue-50/60 border-b border-slate-200 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">
                          Catalog:{' '}
                          <span className="text-blue-700 font-extrabold">
                            {selectedUnits.length} units selected
                          </span>{' '}
                          <span className="text-slate-500 font-normal">
                            (checkmark to select)
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                          {isCatalogOpen ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Collapse Catalog</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>Open Catalog</span>
                            </>
                          )}
                        </span>
                      </div>
                    </button>

                    {/* EXPANDABLE CATALOG ACCORDION CONTENT */}
                    {isCatalogOpen && (
                      <div className="bg-white p-3 sm:p-4 space-y-3">
                        {/* Search Bar + Quick Filter (matching data-ms in HTML) */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                          <div className="relative flex-1 min-w-[200px]">
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
                              placeholder="Search series or product (e.g. Action 6, Pocket 4, Mini 5, Combo)..."
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

                          {/* Quick Select Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                // Select all matching units
                                const allFiltered = allStockSubvariants
                                  .filter((it) => {
                                    if (!queryNormalized) return true;
                                    return (
                                      nk(it.seriesName).includes(queryNormalized) ||
                                      nk(it.productName).includes(queryNormalized)
                                    );
                                  })
                                  .map((it) => it.productName);

                                setDraftVariants((prev) => {
                                  const cur = prev[groupName] || [];
                                  const merged = Array.from(new Set([...cur, ...allFiltered]));
                                  return { ...prev, [groupName]: merged };
                                });
                              }}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Select all units currently visible"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraftVariants((prev) => ({
                                  ...prev,
                                  [groupName]: [],
                                }));
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              title="Deselect all units in this group"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Hierarchical Series Accordion Tree (matching details data-sd in HTML) */}
                        <div className="border border-slate-200 rounded-xl max-h-80 overflow-y-auto divide-y divide-slate-200">
                          {allSeriesNames
                            .map((serName) => {
                              const allUnitsInSeries = stockBySeries.get(serName) || [];
                              // Filter by search query if present
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
                              const isPartial =
                                selectedCountInSeries > 0 && !isAllSelected;

                              const isSeriesOpen =
                                openSeriesMap[`${groupName}|${serName}`] ||
                                !!queryNormalized;

                              return (
                                <div key={serName} className="bg-white">
                                  {/* Series Summary Header (matching summary in HTML) */}
                                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50/90 hover:bg-slate-100/80 transition-colors select-none">
                                    <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        ref={(el) => {
                                          if (el) el.indeterminate = isPartial;
                                        }}
                                        onChange={(e) =>
                                          handleToggleWholeSeries(
                                            groupName,
                                            serName,
                                            e.target.checked
                                          )
                                        }
                                        title="Select the whole series"
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                      />
                                      <span className="font-bold text-xs text-slate-900 font-mono tracking-wide">
                                        {serName}
                                      </span>
                                      <span className="text-[10px] font-semibold text-slate-500">
                                        {selectedCountInSeries}/{allUnitsInSeries.length} selected
                                      </span>
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleSeriesAccordion(groupName, serName)
                                      }
                                      className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                      title={isSeriesOpen ? 'Collapse series' : 'Expand series'}
                                    >
                                      {isSeriesOpen ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>

                                  {/* Individual Unit Items (matching label.t in HTML) */}
                                  {isSeriesOpen && (
                                    <div className="divide-y divide-slate-100 bg-white">
                                      {visibleUnits.map((unit) => {
                                        const isChecked = selectedKeys.has(
                                          nk(unit.productName)
                                        );
                                        return (
                                          <label
                                            key={unit.productName}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              handleToggleUnit(
                                                groupName,
                                                unit.productName
                                              );
                                            }}
                                            className={`flex items-center justify-between py-2 px-3.5 pl-9 cursor-pointer transition-colors select-none ${
                                              isChecked
                                                ? 'bg-blue-50/40 hover:bg-blue-50/70 text-slate-900'
                                                : 'hover:bg-slate-50 text-slate-500'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}} // Handled by row click
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                              />
                                              <span
                                                className={`text-xs truncate ${
                                                  isChecked
                                                    ? 'font-bold text-slate-900'
                                                    : 'text-slate-600'
                                                }`}
                                              >
                                                {unit.productName}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-2.5 shrink-0 font-mono text-xs">
                                              <span
                                                className={`font-semibold ${
                                                  isChecked
                                                    ? 'text-slate-800'
                                                    : 'text-slate-400'
                                                }`}
                                              >
                                                {formatCurrency(unit.price)}
                                              </span>
                                              <span
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-sans ${
                                                  unit.inStockCount > 0
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-slate-100 text-slate-500'
                                                }`}
                                              >
                                                {unit.inStockCount > 0
                                                  ? `${unit.inStockCount} in stock`
                                                  : '0 stock'}
                                              </span>
                                            </div>
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

                        {/* Currently Selected Units Pills Preview */}
                        {selectedUnits.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                              <span>
                                Active combos included in quota ({selectedUnits.length}):
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                Tap chip to remove
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto">
                              {selectedUnits.map((uName) => {
                                const stockInfo = allStockSubvariants.find(
                                  (s) => nk(s.productName) === nk(uName)
                                );
                                return (
                                  <span
                                    key={uName}
                                    onClick={() => handleToggleUnit(groupName, uName)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-900 border border-blue-200 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 transition-colors cursor-pointer group shadow-2xs"
                                    title={`Click to remove ${uName} from ${groupName}`}
                                  >
                                    <Check className="w-3 h-3 text-blue-600 group-hover:hidden" />
                                    <X className="w-3 h-3 text-rose-600 hidden group-hover:inline" />
                                    <span>{uName}</span>
                                    {stockInfo && (
                                      <span className="text-[10px] font-mono text-blue-700/80">
                                        ({formatCurrency(stockInfo.price)})
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add New Target Group Form (matching #mpa in HTML) */}
          {isAddingNew ? (
            <form
              onSubmit={handleAddNewGroup}
              className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3 animate-in fade-in duration-150"
            >
              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add New Target Group</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Group Name (e.g. OSMO 360 SERIES, AIR 3S)"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="sm:col-span-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  autoFocus
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Target Units"
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
                  Confirm Add Group
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
              <span>+ Add Target Group</span>
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
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
              className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-md active:scale-98 text-xs"
            >
              Save Targets & Subvariants
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
