import { fetchCloudData, saveCloudData, subscribeToCloudData } from '../cloudStorage';
import { reconcileStoreState } from '../utils/syncReconciliation';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  DEFAULT_MAIN_PUSH_VARIANTS,
} from '../utils/calculations';

const STORAGE_KEY = 'oh2';

export const DEFAULT_MAIN_PUSH_TARGETS: Record<string, number> = {
  'OSMO ACTION 6 SERIES': 54,
  'OSMO POCKET 4 SERIES': 45,
  'NEO 2 SERIES': 18,
  'LITO X1 SERIES': 15,
  'MINI 5 PRO SERIES': 9,
};

const defaultLocalState: LocalStorageState = {
  sales: [],
  tasks: {},
  leads: {},
  final: {},
  goal: 232258, // Daily target in PHP
  pm: { 0: 2400000, 1: 2400000, 2: 2400000 }, // Christian, Donna, Jobert
  mainPushTargets: DEFAULT_MAIN_PUSH_TARGETS,
  mainPushVariants: DEFAULT_MAIN_PUSH_VARIANTS,
  mainPushDividers: { 'OSMO ACTION 6 SERIES': 3, 'OSMO POCKET 4 SERIES': 3, 'NEO 2 SERIES': 3, 'LITO X1 SERIES': 3, 'MINI 5 PRO SERIES': 3 },
};

export type ActiveTab = 'd' | 'b' | 't' | 'y' | 'r' | 's' | 'p' | 'l' | 'i' | 'c' | 'k' | 'inv';

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
          mainPushTargets: parsed.mainPushTargets !== undefined ? parsed.mainPushTargets : DEFAULT_MAIN_PUSH_TARGETS,
          mainPushVariants: parsed.mainPushVariants !== undefined ? parsed.mainPushVariants : DEFAULT_MAIN_PUSH_VARIANTS,
          mainPushDividers: parsed.mainPushDividers || {},
          inventoryUnits: Array.isArray(parsed.inventoryUnits) ? parsed.inventoryUnits : undefined,
          hasCustomInventory: typeof parsed.hasCustomInventory === 'boolean' ? parsed.hasCustomInventory : false,
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

  // Cloud flags & debounce refs
  const [isCloudLoaded, setIsCloudLoaded] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'connected' | 'syncing' | 'offline' | 'loading'>('loading');
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalEditTimeRef = useRef<number>(0);
  const isLocalUserActionRef = useRef<boolean>(false);
  const isSavingRef = useRef<boolean>(false);
  const lastSavedJsonRef = useRef<string>('');

  // Record a user mutation timestamp to protect against race conditions
  const recordMutation = useCallback(() => {
    isLocalUserActionRef.current = true;
    lastLocalEditTimeRef.current = Date.now();
  }, []);

  // Sync to localStorage as backup
  const saveToStorage = useCallback((state: LocalStorageState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, []);

  const localDataRef = useRef(localData);
  localDataRef.current = localData;

  // 1. Firebase Initial Load + Non-Destructive Bidirectional Reconciliation
  useEffect(() => {
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    // Never stay stuck in local/offline mode: retry with backoff and on reconnect.
    function scheduleRetry() {
      if (!isMounted) return;
      if (retryTimer) clearTimeout(retryTimer);
      const delay = Math.min(5000 * Math.pow(2, attempt++), 60000);
      retryTimer = setTimeout(() => { initCloud(); }, delay);
    }
    const handleOnline = () => { attempt = 0; initCloud(); };
    window.addEventListener('online', handleOnline);

    async function initCloud() {
      try {
        const initial = await fetchCloudData();
        if (isMounted) {
          if (initial) {
            setLocalData((prevLocal) => {
              // Non-destructively reconcile local entries with cloud state
              // All local sales, tasks, leads, custom targets, and subvariants are preserved!
              const { reconciled, hadAdditionsFromLocal } = reconcileStoreState(prevLocal, initial, {
                preferLocal: true,
              });
              saveToStorage(reconciled);
              lastSavedJsonRef.current = JSON.stringify(reconciled);

              // If local state had sales or edits that were not yet in Firestore, upload reconciled truth once!
              if (hadAdditionsFromLocal) {
                saveCloudData(reconciled).catch((e) => console.warn('Cloud sync push error:', e));
              }
              return reconciled;
            });
          } else {
            // Document does not exist yet: push current local state to Firestore so nothing is lost
            lastSavedJsonRef.current = JSON.stringify(localDataRef.current);
            saveCloudData(localDataRef.current).catch((e) => console.warn('Cloud sync init error:', e));
          }
          isLocalUserActionRef.current = false;
          attempt = 0;
          setCloudSyncStatus('connected');
        }
      } catch (err) {
        console.error('Error on Firebase startup fetch:', err);
        if (isMounted) {
          setCloudSyncStatus('offline');
          scheduleRetry();
        }
      } finally {
        if (isMounted) setIsCloudLoaded(true);
      }
    }

    initCloud();

    // Listen for live updates across other devices (Phone/PC) with strict anti-clobber protection
    const unsubscribe = subscribeToCloudData((incoming, meta) => {
      if (!incoming || !isMounted) return;
      if (!meta?.fromCache) setCloudSyncStatus('connected');

      // Check if user recently edited within the last 4000ms, or has unsaved edits pending
      const timeSinceLastEdit = Date.now() - lastLocalEditTimeRef.current;
      const hasRecentLocalMutation = timeSinceLastEdit < 4000 || isLocalUserActionRef.current || isSavingRef.current;

      // CRITICAL: If the user is currently typing, editing targets, or logging sales,
      // DO NOT let the background snapshot interfere with their active state!
      if (hasRecentLocalMutation) {
        return;
      }

      setLocalData((prev) => {
        // Reconcile non-destructively: local inputs are never wiped out
        const { reconciled } = reconcileStoreState(
          prev,
          incoming,
          { preferLocal: false }
        );

        // If identical, return prev to prevent re-render of components and modals!
        if (JSON.stringify(prev) === JSON.stringify(reconciled)) {
          return prev;
        }

        saveToStorage(reconciled);
        lastSavedJsonRef.current = JSON.stringify(reconciled);

        // Inbound snapshot from cloud: do NOT flag as local user action!
        isLocalUserActionRef.current = false;

        return reconciled;
      });
    }, () => {
      if (isMounted) {
        setCloudSyncStatus('offline');
        scheduleRetry();
      }
    });

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [saveToStorage]);

  // 2. Debounced Cloud Save to Firebase - ONLY fires for real user actions!
  useEffect(() => {
    if (!isCloudLoaded) return;

    // CRITICAL: If this update came from an incoming Firebase snapshot, do NOT loop back and save!
    if (!isLocalUserActionRef.current) {
      return;
    }

    const currentJson = JSON.stringify(localData);
    if (currentJson === lastSavedJsonRef.current) {
      isLocalUserActionRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setCloudSyncStatus('syncing');

    saveTimeoutRef.current = setTimeout(() => {
      isLocalUserActionRef.current = false;
      isSavingRef.current = true;
      saveCloudData(localData)
        .then((ok) => {
          if (ok) {
            lastSavedJsonRef.current = JSON.stringify(localData);
          }
          setCloudSyncStatus(ok ? 'connected' : 'offline');
          if (!ok) setTimeout(() => { isLocalUserActionRef.current = true; setLocalData((d) => ({ ...d })); }, 15000);
        })
        .catch((err) => {
          console.error('Failed to sync to Firebase cloud:', err);
          setCloudSyncStatus('offline');
        })
        .finally(() => {
          isSavingRef.current = false;
        });
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localData, isCloudLoaded]);

  // Manual Trigger to Sync & Reconcile Now
  const syncNow = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setCloudSyncStatus('syncing');
    setSyncFeedback('Syncing with Firebase...');
    try {
      let remote: any = null;
      try {
        remote = await fetchCloudData();
      } catch (fetchErr) {
        console.warn('Manual sync: fetch had error, continuing to save...', fetchErr);
      }

      let nextState = localData;
      if (remote) {
        const { reconciled } = reconcileStoreState(localData, remote, { preferLocal: true });
        nextState = reconciled;
        setLocalData(reconciled);
        saveToStorage(reconciled);
      }
      const ok = await saveCloudData(nextState);
      if (ok) {
        lastSavedJsonRef.current = JSON.stringify(nextState);
      }
      isLocalUserActionRef.current = false;
      setCloudSyncStatus(ok ? 'connected' : 'offline');
      const msg = ok
        ? 'Synced with Firebase! All sales, leads, tasks, and targets preserved.'
        : 'Firebase unreachable. Local changes preserved in browser.';
      setSyncFeedback(msg);
      setTimeout(() => setSyncFeedback(null), 4000);
      return { success: ok, message: msg };
    } catch (err: any) {
      setCloudSyncStatus('offline');
      const msg = `Sync error: ${err?.message || 'Network error'}`;
      setSyncFeedback(msg);
      setTimeout(() => setSyncFeedback(null), 4000);
      return { success: false, message: msg };
    }
  }, [localData, saveToStorage]);

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
    const maxSaleDay = allSales.reduce((max, s) => Math.max(max, s[0]), todayDayOffset);
    const maxLeadDay = Object.keys(localData.leads).reduce(
      (max, d) => Math.max(max, Number(d)),
      todayDayOffset
    );
    return Math.max(maxSaleDay, maxLeadDay, todayDayOffset);
  }, [allSales, localData.leads, todayDayOffset]);

  // Active period range
  const periodRange = useMemo(() => {
    return getPeriodRange(endOffset, daysCount, selectedMonth);
  }, [endOffset, daysCount, selectedMonth]);

  // Active inventory registry (custom imported inventory, or master DJI_DATA.units if never customized)
  const activeUnits = useMemo<UnitTuple[]>(() => {
    if (localData.hasCustomInventory || localData.inventoryUnits !== undefined) {
      return localData.inventoryUnits || [];
    }
    return DJI_DATA.units;
  }, [localData.inventoryUnits, localData.hasCustomInventory]);

  // Fast Serial Number Lookup Map
  const unitsMap = useMemo(() => {
    const map = new Map<string, UnitTuple>();
    activeUnits.forEach((u) => {
      map.set(u[0].toUpperCase(), u);
    });
    return map;
  }, [activeUnits]);

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
          unit &&
          (unit[3].includes('ACCESSOR') ||
            unit[3].includes('CARE REFRESH') ||
            unit[3].includes('SERVICES'));

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

      recordMutation();
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

  // Bulk Add Sales for a Single Promoter
  const addSalesBulk = useCallback(
    (
      items: Array<{
        dayOffset: number;
        staffIndex: number;
        seriesIndex: number;
        amount: number;
        units?: number;
        serialNumber?: string;
        leadType?: number;
      }>
    ): { success: boolean; count: number; message: string; errors?: string[] } => {
      if (!items || items.length === 0) {
        return { success: false, count: 0, message: 'No sales to record.' };
      }

      const errors: string[] = [];
      const validSales: SaleTuple[] = [];
      const batchSeenSNs = new Set<string>();

      for (const item of items) {
        if (localData.final[item.dayOffset]) {
          errors.push(`Day ${formatDate(item.dayOffset)} is finalized.`);
          continue;
        }

        const cleanSn = item.serialNumber ? item.serialNumber.trim().toUpperCase() : '';
        let resolvedSeriesIdx = item.seriesIndex;
        let resolvedAmount = item.amount;

        if (cleanSn) {
          if (batchSeenSNs.has(cleanSn)) {
            errors.push(`Duplicate SN in batch: ${cleanSn}`);
            continue;
          }

          const unit = unitsMap.get(cleanSn);
          if (unit) {
            const actualSeriesIdx = DJI_DATA.ser.indexOf(unit[3]);
            if (actualSeriesIdx >= 0) {
              resolvedSeriesIdx = actualSeriesIdx;
            }
            if (resolvedAmount <= 0) {
              resolvedAmount = unit[2];
            }
          }

          const isPlain =
            unit &&
            (unit[3].includes('ACCESSOR') ||
              unit[3].includes('CARE REFRESH') ||
              unit[3].includes('SERVICES'));

          if (!isPlain) {
            const staticSold = DJI_DATA.sold[cleanSn];
            const localSold = localData.sales.find((s) => s[6]?.toUpperCase() === cleanSn);
            const isMarkedSold = unit && unit[4] === 'SOLD';

            if (staticSold || localSold || isMarkedSold) {
              errors.push(`Unit SN ${cleanSn} is already recorded as sold!`);
              continue;
            }
          }

          batchSeenSNs.add(cleanSn);
        }

        const newSale: SaleTuple = [
          item.dayOffset,
          item.staffIndex,
          resolvedSeriesIdx,
          resolvedAmount,
          item.units ?? 1,
          0,
          cleanSn || '',
          item.leadType !== undefined ? item.leadType : 3,
        ];

        validSales.push(newSale);
      }

      if (validSales.length === 0) {
        return {
          success: false,
          count: 0,
          message: errors.length > 0 ? errors.join(', ') : 'No valid sales to add.',
          errors,
        };
      }

      recordMutation();
      setLocalData((prev) => {
        const updated = {
          ...prev,
          sales: [...prev.sales, ...validSales],
        };
        saveToStorage(updated);
        return updated;
      });

      const staffName = DJI_DATA.staff[items[0]?.staffIndex] || 'Promoter';
      return {
        success: true,
        count: validSales.length,
        message: `Successfully logged ${validSales.length} sale${validSales.length === 1 ? '' : 's'} for ${staffName}!`,
        errors: errors.length > 0 ? errors : undefined,
      };
    },
    [localData.final, localData.sales, unitsMap, saveToStorage]
  );

  // Override local sales with imported sales from Excel (replaces current input sales data)
  const overrideSales = useCallback(
    (newSales: SaleTuple[]): { success: boolean; count: number; message: string } => {
      recordMutation();
      setLocalData((prev) => {
        const updated: LocalStorageState = {
          ...prev,
          sales: [...newSales],
        };
        saveToStorage(updated);
        return updated;
      });
      return {
        success: true,
        count: newSales.length,
        message: `Successfully loaded ${newSales.length} transactions (current input data overridden).`,
      };
    },
    [saveToStorage]
  );

  // Append imported sales
  const appendSales = useCallback(
    (newSales: SaleTuple[]): { success: boolean; count: number; message: string } => {
      recordMutation();
      setLocalData((prev) => {
        const updated: LocalStorageState = {
          ...prev,
          sales: [...prev.sales, ...newSales],
        };
        saveToStorage(updated);
        return updated;
      });
      return {
        success: true,
        count: newSales.length,
        message: `Successfully appended ${newSales.length} transactions.`,
      };
    },
    [saveToStorage]
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

      recordMutation();
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

      recordMutation();
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

      recordMutation();
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

      recordMutation();
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
    recordMutation();
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
      recordMutation();
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
      recordMutation();
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
      recordMutation();
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

  // Update Single Main Push Target
  const updateMainPushTarget = useCallback(
    (modelName: string, target: number) => {
      recordMutation();
      setLocalData((prev) => {
        const updated = {
          ...prev,
          mainPushTargets: {
            ...(prev.mainPushTargets || DEFAULT_MAIN_PUSH_TARGETS),
            [modelName]: Math.max(0, target),
          },
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Delete target series completely
  const deleteMainPushTarget = useCallback(
    (modelName: string) => {
      recordMutation();
      setLocalData((prev) => {
        const nextTargets = { ...(prev.mainPushTargets || DEFAULT_MAIN_PUSH_TARGETS) };
        delete nextTargets[modelName];
        const nextVariants = { ...(prev.mainPushVariants || DEFAULT_MAIN_PUSH_VARIANTS) };
        delete nextVariants[modelName];
        const updated = {
          ...prev,
          mainPushTargets: nextTargets,
          mainPushVariants: nextVariants,
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Update selected variants for a series
  const updateSeriesVariants = useCallback(
    (seriesName: string, selectedVariants: string[]) => {
      recordMutation();
      setLocalData((prev) => {
        const updated = {
          ...prev,
          mainPushVariants: {
            ...(prev.mainPushVariants || DEFAULT_MAIN_PUSH_VARIANTS),
            [seriesName]: selectedVariants,
          },
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Update All Main Push Targets, Variants, and Person Dividers at once
  const updateAllMainPushTargets = useCallback(
    (
      newTargets: Record<string, number>,
      newVariants?: Record<string, string[]>,
      newDividers?: Record<string, number>
    ) => {
      recordMutation();
      setLocalData((prev) => {
        const updated = {
          ...prev,
          mainPushTargets: {
            ...newTargets,
          },
          ...(newVariants ? { mainPushVariants: { ...newVariants } } : {}),
          ...(newDividers !== undefined ? { mainPushDividers: { ...newDividers } } : {}),
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Update how many persons divide a specific model target
  const updateMainPushDivider = useCallback(
    (modelName: string, divider: number) => {
      recordMutation();
      setLocalData((prev) => {
        const currentDividers = prev.mainPushDividers || {};
        const updated = {
          ...prev,
          mainPushDividers: {
            ...currentDividers,
            [modelName]: Math.max(1, Math.round(divider)),
          },
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Reset Main Push Targets to Defaults
  const resetMainPushTargets = useCallback(() => {
    recordMutation();
      setLocalData((prev) => {
      const updated = {
        ...prev,
        mainPushTargets: DEFAULT_MAIN_PUSH_TARGETS,
        mainPushVariants: DEFAULT_MAIN_PUSH_VARIANTS,
      };
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Toggle routine task
  const toggleTask = useCallback(
    (taskIndex: number, dateKey: string = new Date().toDateString()) => {
      recordMutation();
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
          mainPushTargets: parsed.mainPushTargets || defaultLocalState.mainPushTargets,
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

  // Completely wipe all system transactions, leads, tasks, and finalized day records
  const clearAllSystemData = useCallback(async () => {
    const cleanState: LocalStorageState = {
      sales: [],
      tasks: {},
      leads: {},
      final: {},
      goal: defaultLocalState.goal,
      pm: defaultLocalState.pm,
      mainPushTargets: DEFAULT_MAIN_PUSH_TARGETS,
      mainPushVariants: DEFAULT_MAIN_PUSH_VARIANTS,
    };
    setLocalData(cleanState);
    saveToStorage(cleanState);
    try {
      await saveCloudData(cleanState);
    } catch (e) {
      console.error('Failed to clear cloud database:', e);
    }
  }, [saveToStorage]);

  // Wipe all inventory units completely (0 inventory)
  const deleteAllInventory = useCallback(async () => {
    const updated: LocalStorageState = {
      ...localData,
      inventoryUnits: [],
      hasCustomInventory: true,
    };
    setLocalData(updated);
    saveToStorage(updated);
    try {
      await saveCloudData(updated);
    } catch (e) {
      console.error('Failed to sync inventory deletion to cloud:', e);
    }
  }, [localData, saveToStorage]);

  // Inventory Management: Append new incoming units
  const importInventoryAppend = useCallback(
    (newUnits: UnitTuple[]) => {
      recordMutation();
      setLocalData((prev) => {
        const currentList = (prev.hasCustomInventory || prev.inventoryUnits !== undefined)
          ? (prev.inventoryUnits || [])
          : DJI_DATA.units;
        const map = new Map<string, UnitTuple>();
        currentList.forEach((u) => map.set(u[0].toUpperCase(), u));
        newUnits.forEach((u) => map.set(u[0].toUpperCase(), u));
        const merged = Array.from(map.values());
        const updated: LocalStorageState = {
          ...prev,
          inventoryUnits: merged,
          hasCustomInventory: true,
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Inventory Management: Override / replace all active units
  const importInventoryOverride = useCallback(
    (allUnits: UnitTuple[]) => {
      recordMutation();
      setLocalData((prev) => {
        const updated: LocalStorageState = {
          ...prev,
          inventoryUnits: allUnits,
          hasCustomInventory: true,
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Add a single unit to inventory
  const addInventoryUnit = useCallback(
    (unit: UnitTuple) => {
      recordMutation();
      setLocalData((prev) => {
        const currentList = (prev.hasCustomInventory || prev.inventoryUnits !== undefined)
          ? (prev.inventoryUnits || [])
          : DJI_DATA.units;
        const snUpper = unit[0].toUpperCase();
        const exists = currentList.some((u) => u[0].toUpperCase() === snUpper);
        const nextList = exists
          ? currentList.map((u) => (u[0].toUpperCase() === snUpper ? unit : u))
          : [unit, ...currentList];
        const updated: LocalStorageState = {
          ...prev,
          inventoryUnits: nextList,
          hasCustomInventory: true,
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Delete a unit from inventory by Serial Number
  const deleteInventoryUnit = useCallback(
    (serialNumber: string) => {
      recordMutation();
      setLocalData((prev) => {
        const currentList = (prev.hasCustomInventory || prev.inventoryUnits !== undefined)
          ? (prev.inventoryUnits || [])
          : DJI_DATA.units;
        const snUpper = serialNumber.trim().toUpperCase();
        const nextList = currentList.filter((u) => u[0].toUpperCase() !== snUpper);
        const updated: LocalStorageState = {
          ...prev,
          inventoryUnits: nextList,
          hasCustomInventory: true,
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Delete many units at once by Serial Number (used by "wipe filtered" in the Stock tab)
  const deleteInventoryUnits = useCallback(
    (serialNumbers: string[]) => {
      if (!serialNumbers.length) return;
      recordMutation();
      const drop = new Set(serialNumbers.map((s) => s.trim().toUpperCase()));
      setLocalData((prev) => {
        const currentList = (prev.hasCustomInventory || prev.inventoryUnits !== undefined)
          ? (prev.inventoryUnits || [])
          : DJI_DATA.units;
        const updated: LocalStorageState = {
          ...prev,
          inventoryUnits: currentList.filter((u) => !drop.has(u[0].toUpperCase())),
          hasCustomInventory: true,
        };
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // Reset inventory back to master baseline
  const resetInventoryToMaster = useCallback(() => {
    recordMutation();
      setLocalData((prev) => {
      const next: LocalStorageState = { ...prev };
      delete next.inventoryUnits;
      next.hasCustomInventory = false;
      saveToStorage(next);
      return next;
    });
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
          matches = activeUnits.filter((u) => {
            const sn = u[0].toUpperCase();
            const ean = (u[5] || '').toUpperCase();
            return sn.endsWith(q) || ean.endsWith(q);
          });
        }
        if (!matches.length && q.length >= 4) {
          matches = activeUnits.filter((u) => {
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
    [unitsMap, activeUnits, localData.sales]
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
    const customOrUndefined = (localData.hasCustomInventory || localData.inventoryUnits !== undefined)
      ? activeUnits
      : undefined;
    return calculateStockMetrics(allSales, endOffset, localData.sales, customOrUndefined);
  }, [allSales, endOffset, localData.sales, activeUnits, localData.hasCustomInventory, localData.inventoryUnits]);

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
    mainPushTargets: localData.mainPushTargets || DEFAULT_MAIN_PUSH_TARGETS,
    mainPushVariants: localData.mainPushVariants || DEFAULT_MAIN_PUSH_VARIANTS,
    mainPushDividers: localData.mainPushDividers || {},
    updateMainPushDivider,
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
    activeUnits,
    importInventoryAppend,
    importInventoryOverride,
    addInventoryUnit,
    deleteInventoryUnit,
    resetInventoryToMaster,
    deleteAllInventory,
    deleteInventoryUnits,
    isCloudLoaded,
    cloudSyncStatus,
    syncNow,
    syncFeedback,
    addSale,
    addSalesBulk,
    overrideSales,
    appendSales,
    deleteSale,
    addLead,
    removeLead,
    resetLeadsForDay,
    resetAllLeads,
    toggleFinalizeDay,
    updateDailyGoal,
    updatePromoterTarget,
    updateMainPushTarget,
    deleteMainPushTarget,
    updateSeriesVariants,
    updateAllMainPushTargets,
    resetMainPushTargets,
    toggleTask,
    searchSerialNumber,
    exportDataJSON,
    importDataJSON,
    resetToOriginalData,
    clearAllSystemData,
  };
}
