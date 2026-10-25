import { fetchCloudData, saveCloudData, subscribeToCloudData } from '../cloudStorage';
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

  // Cloud flags & debounce refs
  const [isCloudLoaded, setIsCloudLoaded] = useState<boolean>(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync to localStorage as backup
  const saveToStorage = useCallback((state: LocalStorageState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, []);

  // 1. Firebase Initial Load + Real-Time Live Sync Listener
  useEffect(() => {
    let isMounted = true;

    async function initCloud() {
      try {
        const initial = await fetchCloudData();
        if (initial && isMounted) {
          const validatedState: LocalStorageState = {
            sales: Array.isArray(initial.sales) ? initial.sales : [],
            tasks: initial.tasks || {},
            leads: initial.leads || {},
            final: initial.final || {},
            goal: typeof initial.goal === 'number' ? initial.goal : defaultLocalState.goal,
            pm: initial.pm || defaultLocalState.pm,
          };
          setLocalData(validatedState);
          saveToStorage(validatedState);
        }
      } catch (err) {
        console.error('Error on Firebase startup fetch:', err);
      } finally {
        if (isMounted) setIsCloudLoaded(true);
      }
    }

    initCloud();

    // Listen for live updates across other devices (Phone/PC)
    const unsubscribe = subscribeToCloudData((incoming) => {
      if (!incoming || !isMounted) return;

      setLocalData((prev) => {
        // Prevent redundant state updates if incoming matches current state
        if (JSON.stringify(prev) === JSON.stringify(incoming)) return prev;

        const updated: LocalStorageState = {
          sales: Array.isArray(incoming.sales) ? incoming.sales : [],
          tasks: incoming.tasks || {},
          leads: incoming.leads || {},
          final: incoming.final || {},
          goal: typeof incoming.goal === 'number' ? incoming.goal : defaultLocalState.goal,
          pm: incoming.pm || defaultLocalState.pm,
        };
        saveToStorage(updated);
        return updated;
      });
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [saveToStorage]);

  // 2. Debounced Cloud Save to Firebase
  useEffect(() => {
    if (!isCloudLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(save
