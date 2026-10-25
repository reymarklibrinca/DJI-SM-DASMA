import { fetchCloudData, saveCloudData } from '../cloudStorage';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { DJI_DATA, ROUTINE_TASKS } from '../data/initialData';
import {
  LocalStorageState,
  SaleTuple,
  UnitTuple,
} from '../types';
import {
  dateToDayOffset,
  dayOffsetToDate,
  formatDate,
  getPeriodRange,
  aggregateSales,
  calculateStockMetrics,
  calculatePercentChange,
} from '../utils/calculations';

const STORAGE_KEY = 'oh2';

const defaultLocalState: LocalStorageState = {
  sales: [],
  tasks: {},
  leads: {},
  final: {},
  goal: 232258, // Daily target in PHP
  pm: { 0: 2400000, 1: 2400000, 2: 2400000 }, // Christian, Donna, Jobert
};

useEffect(() => {
  async function loadDataOnStartup() {
    try {
      // 1. Download your record from JSONBin
      const cloudData = await fetchCloudData();

      // 2. If valid data came back, populate the app's state
      if (cloudData) {
        if (Array.isArray(cloudData.sales)) setSales(cloudData.sales);
        if (cloudData.tasks) setTasks(cloudData.tasks);
        if (cloudData.leads) setLeads(cloudData.leads);
        if (cloudData.final) setFinal(cloudData.final);
        if (typeof cloudData.goal === 'number') setGoal(cloudData.goal);
        if (cloudData.pm) setPm(cloudData.pm);
      }
    } catch (err) {
      console.error('Failed to load startup data from JSONBin:', err);
    }
  }

  loadDataOnStartup();
}, []); // <--- The empty brackets [] mean: run ONCE when app opens

export type ActiveTab = 'd' | 'b' | 't' | 'y' | 'r' | 's' | 'p' | 'l' | 'i' | 'c' | 'k';

export function useDjiStore() {
  const [localData, setLocalData] = useState<LocalStorageState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultLocalState,
          ...parsed,
          sales: Array.isArray(parsed.sales) ? parsed.sales : [],
          tasks: parsed.tasks || {},
          leads: parsed.leads || {},
          final: parsed.final || {},
          pm: parsed.pm || defaultLocalState.pm,
        };
      }
    } catch (e) {
      console.error('Error loading localStorage:', e);
    }
    return defaultLocalState;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('d');
  const [daysCount, setDaysCount] = useState<number>(14);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [reviewDayOffset, setReviewDayOffset] = useState<number | null>(null);

  // Sync to localStorage on state change
  const saveToStorage = useCallback((state: LocalStorageState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, []);

  // Combined sales (static + local)
  const allSales = useMemo<SaleTuple[]>(() => {
    return [...DJI_DATA.sales, ...localData.sales];
  }, [localData.sales]);

  // Today's day offset based on local clock
  const todayDayOffset = useMemo(() => {
    return dateToDayOffset(new Date());
  }, []);

  // End day offset for calculations
  const endOffset = useMemo(() => {
    const maxSaleDay = allSales.reduce((max, s) => Math.max(max, s[0]), 83);
    const maxLeadDay = Object.keys(localData.leads).reduce(
      (max, d) => Math.max(max, Number(d)),
      83
    );
    return Math.max(maxSaleDay, maxLeadDay, todayDayOffset);
  }, [allSales, localData.leads, todayDayOffset]);

  // Active period range
  const periodRange = useMemo(() => {
    return getPeriodRange(endOffset, daysCount, selectedMonth);
  }, [endOffset, daysCount, selectedMonth]);

  // Fast Serial Number Lookup Map
  const unitsMap = useMemo(() => {
    const map = new Map<string, UnitTuple>();
    DJI_DATA.units.forEach((u) => {
      map.set(u[0].toUpperCase(), u);
    });
    return map;
  }, []);

  // Add Sale
  const addSale = useCallback(
    (
      dayOffset: number,
      staffIndex: number,
      productSeriesIndex: number,
      amount: number,
      units: number = 1,
      serialNumber?: string,
      leadType?: number
    ): { success: boolean; message: string } => {
      // Check if day is finalized
      if (localData.final[dayOffset]) {
        return {
          success: false,
          message: `Day ${formatDate(dayOffset)} is finalized. Reopen the day first to add sales.`,
        };
      }

      // Check Serial Number validity if provided
      const cleanSn = serialNumber?.trim().toUpperCase();
      let resolvedSeriesIdx = productSeriesIndex;
      let resolvedAmount = amount;

      if (cleanSn) {
        const unit = unitsMap.get(cleanSn);
        if (unit) {
          // Guarantee that the unit's actual series is recorded, avoiding accidental ACCESSORIES
          const actualSeriesIdx = DJI_DATA.ser.indexOf(unit[3]);
          if (actualSeriesIdx >= 0) {
            resolvedSeriesIdx = actualSeriesIdx;
          }
          if (resolvedAmount <= 0) {
            resolvedAmount = unit[2];
          }
        }

        const isPlain =
          unit && (unit[3] === 'ACCESSORIES' || unit[3] === 'CARE REFRESH');

        if (!isPlain) {
          // Check static sold
          const staticSold = DJI_DATA.sold[cleanSn];
          // Check local sales
          const localSold = localData.sales.find((s) => s[6]?.toUpperCase() === cleanSn);
          const isMarkedSold = unit && unit[4] === 'SOLD';

          if (staticSold || localSold || isMarkedSold) {
            return {
              success: false,
              message: `Unit SN ${cleanSn} is already recorded as sold!`,
            };
          }
        }
      }

      const newSale: SaleTuple = [
        dayOffset,
        staffIndex,
        resolvedSeriesIdx,
        resolvedAmount,
        units,
        0,
        cleanSn || '',
        leadType !== undefined ? leadType : 3,
      ];

      setLocalData((prev) => {
        const updated = {
          ...prev,
          sales: [...prev.sales, newSale],
        };
        saveToStorage(updated);
        return updated;
      });

      return { success: true, message: 'Sale successfully logged!' };
    },
    [localData.final, localData.sales, unitsMap, saveToStorage]
  );

  // Delete local sale
  const deleteSale = useCallback(
    (localSaleIndex: number): { success: boolean; message: string } => {
      const sale = localData.sales[localSaleIndex];
      if (!sale) return { success: false, message: 'Sale not found.' };

      if (localData.final[sale[0]]) {
        return {
          success: false,
          message: `Cannot delete: Day ${formatDate(sale[0])} is finalized.`,
        };
      }

      setLocalData((prev) => {
        const nextSales = [...prev.sales];
        nextSales.splice(localSaleIndex, 1);
        const updated = {
          ...prev,
          sales: nextSales,
        };
        saveToStorage(updated);
        return updated;
      });

      return { success: true, message: 'Sale removed.' };
    },
    [localData.sales, localData.final, saveToStorage]
  );

  // Add Lead (+1 Walk-in, Revisit, Online)
  const addLead = useCallback(
    (dayOffset: number, staffIndex: number | string, leadType: 0 | 1 | 2) => {
      if (localData.final[dayOffset]) {
        return {
          success: false,
          message: `Day ${formatDate(dayOffset)} is finalized. Reopen day to modify leads.`,
        };
      }

      setLocalData((prev) => {
        const dayLeads = { ...(prev.leads[dayOffset] || {}) };
        const staffKey = String(staffIndex);
        const counts: [number, number, number] = dayLeads[staffKey]
          ? [...dayLeads[staffKey]]
          : [0, 0, 0];
        counts[leadType]++;
        dayLeads[staffKey] = counts;

        const updated = {
          ...prev,
          leads: {
            ...prev.leads,
            [dayOffset]: dayLeads,
          },
        };
        saveToStorage(updated);
        return updated;
      });

      return { success: true, message: 'Lead recorded.' };
    },
    [localData.final, saveToStorage]
  );

  // Remove 1 lead
  const removeLead = useCallback(
    (dayOffset: number, staffIndex: number | string, leadType: 0 | 1 | 2) => {
      if (localData.final[dayOffset]) {
        return {
          success: false,
          message: `Day ${formatDate(dayOffset)} is finalized.`,
        };
      }

      setLocalData((prev) => {
        const dayLeads = { ...(prev.leads[dayOffset] || {}) };
        const staffKey = String(staffIndex);
        if (!dayLeads[staffKey]) return prev;

        const counts: [number, number, number] = [...dayLeads[staffKey]];
        counts[leadType] = Math.max(0, counts[leadType] - 1);

        if (counts[0] === 0 && counts[1] === 0 && counts[2] === 0) {
          delete dayLeads[staffKey];
        } else {
          dayLeads[staffKey] = counts;
        }

        const nextLeads = { ...prev.leads };
        if (Object.keys(dayLeads).length === 0) {
          delete nextLeads[dayOffset];
        } else {
          nextLeads[dayOffset] = dayLeads;
        }

        const updated = {
          ...prev,
          leads: nextLeads,
        };
        saveToStorage(updated);
        return updated;
      });

      return { success: true, message: 'Lead count decremented.' };
    },
    [localData.final, saveToStorage]
  );

  // Reset Leads for a single day
  const resetLeadsForDay = useCallback(
    (dayOffset: number): { success: boolean; message: string } => {
      if (localData.final[dayOffset]) {
        return {
          success: false,
          message: `Day ${formatDate(dayOffset)} is finalized. Reopen day first to reset leads.`,
        };
      }

      setLocalData((prev) => {
        const nextLeads = { ...prev.leads };
        delete nextLeads[dayOffset];
        const updated = {
          ...prev,
          leads: nextLeads,
        };
        saveToStorage(updated);
        return updated;
      });

      return {
        success: true,
        message: `Customer leads for Day ${formatDate(dayOffset)} have been reset.`,
      };
    },
    [localData.final, saveToStorage]
  );

  // Reset All Leads across entire store
  const resetAllLeads = useCallback((): { success: boolean; message: string } => {
    setLocalData((prev) => {
      const updated = {
        ...prev,
        leads: {},
      };
      saveToStorage(updated);
      return updated;
    });

    return {
      success: true,
      message: 'All recorded customer leads have been reset.',
    };
  }, [saveToStorage]);

  // Finalize / Reopen Day
  const toggleFinalizeDay = useCallback(
    (dayOffset: number) => {
      setLocalData((prev) => {
        const nextFinal = { ...prev.final };
        if (nextFinal[dayOffset]) {
          delete nextFinal[dayOffset];
        } else {
          const dayAgg = aggregateSales(allSales, dayOffset, dayOffset);
          nextFinal[dayOffset] = {
            at: new Date().toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            }),
            sa: dayAgg.sa,
            un: dayAgg.un,
          };
        }
        const updated = {
          ...prev,
          final: nextFinal,
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [allSales, saveToStorage]
  );

  // Update Daily Goal
  const updateDailyGoal = useCallback(
    (goal: number) => {
      setLocalData((prev) => {
        const updated = { ...prev, goal };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Update Promoter Target
  const updatePromoterTarget = useCallback(
    (staffIndex: number, target: number) => {
      setLocalData((prev) => {
        const updated = {
          ...prev,
          pm: {
            ...prev.pm,
            [staffIndex]: target,
          },
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Toggle routine task
  const toggleTask = useCallback(
    (taskIndex: number, dateKey: string = new Date().toDateString()) => {
      setLocalData((prev) => {
        const dayTasks = [...(prev.tasks[dateKey] || Array(ROUTINE_TASKS.length).fill(false))];
        dayTasks[taskIndex] = !dayTasks[taskIndex];
        const updated = {
          ...prev,
          tasks: {
            [dateKey]: dayTasks,
          },
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Export JSON backup
  const exportDataJSON = useCallback(() => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(localData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `dji_store_dasma_backup_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [localData]);

  // Import JSON backup
  const importDataJSON = useCallback(
    (jsonContent: string): { success: boolean; message: string } => {
      try {
        const parsed = JSON.parse(jsonContent);
        if (typeof parsed !== 'object' || parsed === null) {
          return { success: false, message: 'Invalid JSON file format.' };
        }
        const validatedState: LocalStorageState = {
          sales: Array.isArray(parsed.sales) ? parsed.sales : [],
          tasks: parsed.tasks || {},
          leads: parsed.leads || {},
          final: parsed.final || {},
          goal: typeof parsed.goal === 'number' ? parsed.goal : defaultLocalState.goal,
          pm: parsed.pm || defaultLocalState.pm,
        };
        setLocalData(validatedState);
        saveToStorage(validatedState);
        return { success: true, message: 'Data successfully restored!' };
      } catch (err: any) {
        return { success: false, message: 'Failed to parse JSON file: ' + err.message };
      }
    },
    [saveToStorage]
  );

  // Reset local changes
  const resetToOriginalData = useCallback(() => {
    setLocalData(defaultLocalState);
    saveToStorage(defaultLocalState);
  }, [saveToStorage]);

  // Search Serial Numbers / EAN
  const searchSerialNumber = useCallback(
    (query: string) => {
      const q = query.trim().toUpperCase();
      if (!q) return null;

      // Exact match
      let exact = unitsMap.get(q);

      // Suffix search (at least 3 characters) or partial match (at least 4 characters)
      let matches: UnitTuple[] = [];
      if (!exact) {
        if (q.length >= 3) {
          matches = DJI_DATA.units.filter((u) => {
            const sn = u[0].toUpperCase();
            const ean = (u[5] || '').toUpperCase();
            return sn.endsWith(q) || ean.endsWith(q);
          });
        }
        if (!matches.length && q.length >= 4) {
          matches = DJI_DATA.units.filter((u) => {
            const sn = u[0].toUpperCase();
            const ean = (u[5] || '').toUpperCase();
            return sn.includes(q) || ean.includes(q);
          });
        }
        // Prioritize in-stock units first
        matches.sort((a, b) => (a[4] === 'IN STOCK' ? 0 : 1) - (b[4] === 'IN STOCK' ? 0 : 1));

        if (matches.length === 1) {
          exact = matches[0];
        }
      }

      if (exact) {
        const plain = exact[3] === 'ACCESSORIES' || exact[3] === 'CARE REFRESH';
        const staticSold = DJI_DATA.sold[exact[0]];
        const localSoldIdx = localData.sales.findIndex((s) => s[6]?.toUpperCase() === exact![0]);
        const localSold = localSoldIdx >= 0 ? localData.sales[localSoldIdx] : undefined;
        const isSold = !plain && (Boolean(staticSold) || Boolean(localSold) || exact[4] === 'SOLD');

        let soldDetail = '';
        if (staticSold) {
          soldDetail = `Sold on ${formatDate(staticSold[0])} by ${DJI_DATA.staff[staticSold[1]]}`;
        } else if (localSold) {
          soldDetail = `Logged sold on ${formatDate(localSold[0])} by ${DJI_DATA.staff[localSold[1]]}`;
        } else if (exact[4] === 'SOLD') {
          soldDetail = 'Marked SOLD in master inventory sheet';
        }

        return {
          type: 'exact' as const,
          unit: exact,
          isSold,
          soldDetail,
          localSaleIndex: localSoldIdx >= 0 ? localSoldIdx : undefined,
          isLocalSale: localSoldIdx >= 0,
        };
      }

      if (matches.length > 1) {
        return {
          type: 'multiple' as const,
          matches: matches.slice(0, 10),
          totalCount: matches.length,
        };
      }

      return {
        type: 'none' as const,
        matches: [],
      };
    },
    [unitsMap, localData.sales]
  );

  // Store pulse calculations
  const pulseMetrics = useMemo(() => {
    const current = aggregateSales(allSales, periodRange.a, periodRange.b);
    const prev = aggregateSales(allSales, periodRange.pa, periodRange.pb);
    const dailyTarget = localData.goal || 232258;

    // Today's revenue
    const todaySalesAgg = aggregateSales(allSales, todayDayOffset, todayDayOffset);
    const todayRevenue = todaySalesAgg.sa;
    const todayAchievementPct = Math.min(100, (todayRevenue / dailyTarget) * 100);

    const saChange = calculatePercentChange(current.sa, prev.sa);
    const unChange = calculatePercentChange(current.un, prev.un);
    const score = Math.max(5, Math.min(99, Math.round(50 + saChange * 0.7 + unChange * 0.3)));

    const statusText = score >= 70 ? 'Cruising' : score >= 45 ? 'Steady' : 'Needs attention';
    const statusColor = score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-blue-600' : 'text-amber-600';

    return {
      score,
      statusText,
      statusColor,
      todayRevenue,
      todayUnits: todaySalesAgg.un,
      todayAchievementPct,
      dailyTarget,
    };
  }, [allSales, periodRange, localData.goal, todayDayOffset]);

  // Stock calculations
  const stockMetrics = useMemo(() => {
    return calculateStockMetrics(allSales, endOffset, localData.sales);
  }, [allSales, endOffset, localData.sales]);

  return {
    staff: DJI_DATA.staff,
    series: DJI_DATA.ser,
    allSales,
    localSales: localData.sales,
    localTasks: localData.tasks,
    localLeads: localData.leads,
    finalizedDays: localData.final,
    dailyGoal: localData.goal || 232258,
    promoterMonthlyTargets: (localData.pm || defaultLocalState.pm || { 0: 2400000, 1: 2400000, 2: 2400000 }) as Record<number, number>,
    todayDayOffset,
    endOffset,
    activeTab,
    setActiveTab,
    daysCount,
    setDaysCount,
    selectedMonth,
    setSelectedMonth,
    reviewDayOffset,
    setReviewDayOffset,
    periodRange,
    pulseMetrics,
    stockMetrics,
    addSale,
    deleteSale,
    addLead,
    removeLead,
    resetLeadsForDay,
    resetAllLeads,
    toggleFinalizeDay,
    updateDailyGoal,
    updatePromoterTarget,
    toggleTask,
    searchSerialNumber,
    exportDataJSON,
    importDataJSON,
    resetToOriginalData,
  };
}
