import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sliders,
  Plus,
  X,
  Target,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  RotateCcw,
  Maximize2,
  FileSpreadsheet,
} from 'lucide-react';
import { SaleTuple } from '../types';
import { DJI_DATA } from '../data/initialData';
import {
  dayOffsetToDate,
  isHardwareUnitItem,
  normalizeSeriesKey,
  normalizeProductKey,
} from '../utils/calculations';

// Master Catalog definitions matching gemini-code-1793181090686_5f99336a.html
export interface CatalogEntry {
  u: 'Drone' | 'Handheld' | 'Audio' | string;
  p: string[];
}

export const MAIN_PUSH_CATALOG: Record<string, CatalogEntry> = {
  'MAVIC 4 PRO SERIES': {
    u: 'Drone',
    p: [
      'DJI Mavic 4 Pro 512GB Creator Combo',
      'DJI Mavic 4 Pro Fly More Combo',
      'DJI Mavic 4 Pro',
    ],
  },
  'MINI 5 PRO SERIES': {
    u: 'Drone',
    p: [
      'DJI Mini 5 Pro Fly More Combo Plus (DJI RC2)',
      'DJI Mini 5 Pro Fly More Combo (DJI RC2)',
      'DJI Mini 5 Pro Fly More Combo (DJI RC-N3)',
      'DJI Mini 5 Pro',
    ],
  },
  'MINI 4 PRO SERIES': {
    u: 'Drone',
    p: [
      'DJI Mini 4 Pro Fly More Combo Plus (DJI RC 2)',
      'DJI Mini 4 Pro Fly More Combo',
      'DJI Mini 4 Pro',
    ],
  },
  'NEO SERIES': {
    u: 'Drone',
    p: [
      'DJI NEO MOTION FLY MORE COMBO',
      'DJI NEO FLY MORE COMBO',
      'DJI NEO',
      'DJI NEO COMBO (GLOBAL)',
    ],
  },
  'LITO X1 SERIES': {
    u: 'Drone',
    p: [
      'DJI Lito X1 Fly More Combo Plus (DJI RC 2)',
      'DJI Lito X1 Fly More Combo (DJI RC 2)',
      'DJI Lito X1 Fly More Combo (DJI RC-N3)',
      'DJI Lito X1',
    ],
  },
  'OSMO ACTION 6 SERIES': {
    u: 'Handheld',
    p: [
      'Osmo Action 6 Adventure Combo',
      'Osmo Action 6 Street Photography Gift Set',
      'Osmo Action 6 Standard Combo',
    ],
  },
  'OSMO ACTION 5 PRO SERIES': {
    u: 'Handheld',
    p: [
      'Osmo Action 5 PRO Adventure Combo',
      'Osmo Action 5 PRO Standard Combo',
    ],
  },
  'OSMO ACTION 4 SERIES': {
    u: 'Handheld',
    p: [
      'Osmo Action 4 Adventure Combo',
      'Osmo Action 4 Standard Combo',
    ],
  },
  'OSMO POCKET 4 SERIES': {
    u: 'Handheld',
    p: [
      'Osmo Pocket 4 Creator Combo',
      'Osmo Pocket 4 Standard Combo',
    ],
  },
  'OSMO POCKET 4P SERIES': {
    u: 'Handheld',
    p: [
      'Osmo Pocket 4P Vlog Combo',
      'Osmo Pocket 4P Standard Combo',
      'Osmo Pocket 4P Standard Combo (Pearl White)',
    ],
  },
  'OSMO POCKET 3 SERIES': {
    u: 'Handheld',
    p: ['Osmo Pocket 3 Creator Combo', 'Osmo Pocket 3'],
  },
  'DJI MIC 2 SERIES': {
    u: 'Audio',
    p: [
      'DJI Mic 2 (2 TX + 1 RX + Charging Case)',
      'DJI Mic 2 (1 TX + 1 RX)',
      'DJI Mic 2 Transmitter',
    ],
  },
  'DJI MIC MINI SERIES': {
    u: 'Audio',
    p: [
      'DJI Mic Mini (2 TX + 1 RX + Charging Case)',
      'DJI Mic Mini (1 TX + 1 RX)',
    ],
  },
};

// Fast product-to-series lookup
export const PRODUCT_TO_SERIES_MAP: Record<string, string> = {};
Object.keys(MAIN_PUSH_CATALOG).forEach((ser) => {
  MAIN_PUSH_CATALOG[ser].p.forEach((prod) => {
    if (!PRODUCT_TO_SERIES_MAP[prod]) PRODUCT_TO_SERIES_MAP[prod] = ser;
  });
});

export interface SourceSeriesItem {
  name: string;
  unit: string;
  target_mode: 'total_split_equally' | 'each' | string;
  store_target: number;
  persons: number;
  target_per_person: number;
  sold_per_person: Record<string, number>;
  total_sold: number;
  remaining: number;
  catalog_series: string[];
  products: string[];
}

export const SOURCE_DATA: {
  title: string;
  team: string[];
  series: SourceSeriesItem[];
} = {
  title: 'Main Push Targets',
  team: ['Lee, Christian Joseph', 'Barias, Donna Leah', 'Sarabia, Jobert'],
  series: [
    {
      name: 'MINI 5 PRO SERIES',
      unit: 'Drone',
      target_mode: 'total_split_equally',
      store_target: 9,
      persons: 3,
      target_per_person: 3,
      sold_per_person: {
        'Lee, Christian Joseph': 2,
        'Barias, Donna Leah': 0,
        'Sarabia, Jobert': 4,
      },
      total_sold: 6,
      remaining: 3,
      catalog_series: ['MINI 5 PRO SERIES'],
      products: [
        'DJI Mini 5 Pro Fly More Combo Plus (DJI RC2)',
        'DJI Mini 5 Pro Fly More Combo (DJI RC2)',
        'DJI Mini 5 Pro Fly More Combo (DJI RC-N3)',
        'DJI Mini 5 Pro',
      ],
    },
    {
      name: 'NEO SERIES',
      unit: 'Drone',
      target_mode: 'total_split_equally',
      store_target: 18,
      persons: 3,
      target_per_person: 6,
      sold_per_person: {
        'Lee, Christian Joseph': 4,
        'Barias, Donna Leah': 4,
        'Sarabia, Jobert': 6,
      },
      total_sold: 14,
      remaining: 4,
      catalog_series: ['NEO SERIES'],
      products: [
        'DJI NEO MOTION FLY MORE COMBO',
        'DJI NEO FLY MORE COMBO',
        'DJI NEO',
        'DJI NEO COMBO (GLOBAL)',
      ],
    },
    {
      name: 'LITO X1 SERIES',
      unit: 'Drone',
      target_mode: 'total_split_equally',
      store_target: 15,
      persons: 3,
      target_per_person: 5,
      sold_per_person: {
        'Lee, Christian Joseph': 5,
        'Barias, Donna Leah': 0,
        'Sarabia, Jobert': 6,
      },
      total_sold: 11,
      remaining: 4,
      catalog_series: ['LITO X1 SERIES'],
      products: [
        'DJI Lito X1 Fly More Combo Plus (DJI RC 2)',
        'DJI Lito X1 Fly More Combo (DJI RC 2)',
        'DJI Lito X1 Fly More Combo (DJI RC-N3)',
        'DJI Lito X1',
      ],
    },
    {
      name: 'OA SERIES',
      unit: 'Handheld',
      target_mode: 'total_split_equally',
      store_target: 54,
      persons: 3,
      target_per_person: 18,
      sold_per_person: {
        'Lee, Christian Joseph': 13,
        'Barias, Donna Leah': 6,
        'Sarabia, Jobert': 15,
      },
      total_sold: 34,
      remaining: 20,
      catalog_series: [
        'OSMO ACTION 6 SERIES',
        'OSMO ACTION 5 PRO SERIES',
        'OSMO ACTION 4 SERIES',
      ],
      products: [
        'Osmo Action 6 Adventure Combo',
        'Osmo Action 6 Street Photography Gift Set',
        'Osmo Action 6 Standard Combo',
        'Osmo Action 5 PRO Adventure Combo',
        'Osmo Action 5 PRO Standard Combo',
        'Osmo Action 4 Adventure Combo',
        'Osmo Action 4 Standard Combo',
      ],
    },
    {
      name: 'POCKET 4 SERIES',
      unit: 'Handheld',
      target_mode: 'total_split_equally',
      store_target: 45,
      persons: 3,
      target_per_person: 15,
      sold_per_person: {
        'Lee, Christian Joseph': 4,
        'Barias, Donna Leah': 12,
        'Sarabia, Jobert': 8,
      },
      total_sold: 24,
      remaining: 21,
      catalog_series: ['OSMO POCKET 4 SERIES', 'OSMO POCKET 4P SERIES'],
      products: [
        'Osmo Pocket 4 Creator Combo',
        'Osmo Pocket 4 Standard Combo',
        'Osmo Pocket 4P Vlog Combo',
        'Osmo Pocket 4P Standard Combo',
        'Osmo Pocket 4P Standard Combo (Pearl White)',
      ],
    },
  ],
};

export interface SeriesConfigItem {
  u: string; // unit e.g. 'Drone', 'Handheld', 'Audio'
  n: string; // series name
  t: number; // target number
  m: 'total' | 'each'; // mode: 'total' = total split equally, 'each' = target each
  div: number; // persons divider / multiplier
  s: number[]; // units sold per staff index
  p: string[]; // products in this series
  c?: boolean; // custom series flag
}

interface MainPushCardProps {
  sales: SaleTuple[];
  staffList: string[];
  endOffset: number;
  mainPushTargets?: Record<string, number>;
  mainPushVariants?: Record<string, string[]>;
  mainPushDividers?: Record<string, number>;
  onUpdateMainPushTargets?: (
    newTargets: Record<string, number>,
    newVariants?: Record<string, string[]>,
    newDividers?: Record<string, number>
  ) => void;
  onResetMainPushTargets?: () => void;
  onDeleteTarget?: (modelName: string) => void;
  onAddSale?: (
    dayOffset: number,
    staffIndex: number,
    seriesIndex: number,
    amount: number,
    units?: number,
    serialNumber?: string,
    leadType?: number
  ) => { success: boolean; message: string };
  onOpenExcelImport?: () => void;
  onOpenFullModal?: () => void;
}

export const MainPushCard: React.FC<MainPushCardProps> = ({
  sales,
  staffList: initialStaffList,
  endOffset,
  mainPushTargets,
  mainPushVariants,
  mainPushDividers,
  onUpdateMainPushTargets,
  onResetMainPushTargets,
  onDeleteTarget,
  onAddSale,
  onOpenExcelImport,
  onOpenFullModal,
}) => {
  const [mode, setMode] = useState<'store' | 'promoters'>('store');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  // Current active staff list (defaults to SOURCE_DATA.team if empty)
  const staff = useMemo(() => {
    return initialStaffList && initialStaffList.length > 0
      ? initialStaffList
      : SOURCE_DATA.team;
  }, [initialStaffList]);

  const N = staff.length;

  // Active month calculation
  const activeDate = useMemo(() => dayOffsetToDate(endOffset), [endOffset]);
  const activeMonthNum = activeDate.getMonth();
  const activeYearNum = activeDate.getFullYear();

  // Current Month sales
  const currentMonthSales = useMemo(() => {
    return sales.filter((s) => {
      const d = dayOffsetToDate(s[0]);
      return d.getMonth() === activeMonthNum && d.getFullYear() === activeYearNum;
    });
  }, [sales, activeMonthNum, activeYearNum]);

  // Fast map of unit serial numbers to product names for accurate subvariant matching
  const unitsBySn = useMemo(() => {
    const map = new Map<string, string>();
    DJI_DATA.units.forEach((u) => {
      map.set(u[0].toUpperCase(), u[1]);
    });
    return map;
  }, []);

  // Initialize Series Configurations
  const [cfg, setCfg] = useState<SeriesConfigItem[]>(() => {
    return SOURCE_DATA.series.map((s) => ({
      u: s.unit,
      n: s.name,
      t: s.store_target,
      m: s.target_mode === 'each' ? 'each' : 'total',
      div: s.persons || N,
      s: staff.map((st) => s.sold_per_person[st] ?? 0),
      p: s.products.slice(),
    }));
  });

  // Keep cfg synced if external targets or variants change
  useEffect(() => {
    if (!mainPushTargets) return;
    setCfg((prev) => {
      // Build updated list based on mainPushTargets
      const next: SeriesConfigItem[] = [];
      const usedNames = new Set<string>();

      // Check items that exist in prev
      prev.forEach((item) => {
        const customTarget = mainPushTargets[item.n];
        if (customTarget !== undefined) {
          usedNames.add(item.n);
          const customVar = mainPushVariants?.[item.n];
          const customDiv = mainPushDividers?.[item.n];
          next.push({
            ...item,
            t: customTarget,
            div: customDiv !== undefined ? customDiv : item.div,
            p: customVar ? [...customVar] : item.p,
          });
        }
      });

      // Add any new targets from mainPushTargets not yet in prev
      Object.entries(mainPushTargets).forEach(([name, target]) => {
        if (!usedNames.has(name)) {
          const catalogItem = MAIN_PUSH_CATALOG[name];
          const unit = catalogItem ? catalogItem.u : 'Drone';
          const defaultProducts =
            mainPushVariants?.[name] || (catalogItem ? [...catalogItem.p] : []);
          const divider = mainPushDividers?.[name] || N;
          next.push({
            u: unit,
            n: name,
            t: target,
            m: 'total',
            div: divider,
            s: staff.map(() => 0),
            p: defaultProducts,
            c: !catalogItem,
          });
        }
      });

      return next.length > 0 ? next : prev;
    });
  }, [mainPushTargets, mainPushVariants, mainPushDividers, N, staff]);

  // Compute live sales per series and per promoter from currentMonthSales
  const computedCfg = useMemo(() => {
    const hasLiveMonthSales = currentMonthSales.length > 0;

    return cfg.map((item) => {
      // If we have real recorded sales for this month, aggregate them by promoter
      if (hasLiveMonthSales) {
        const staffSold = staff.map(() => 0);
        const itemCatKey = normalizeSeriesKey(item.n);
        const itemProdKeys = new Set(item.p.map((prod) => normalizeProductKey(prod)));

        currentMonthSales.forEach((s) => {
          const staffIdx = s[1];
          if (staffIdx < 0 || staffIdx >= staff.length) return;

          const serName = DJI_DATA.ser[s[2]] || '';
          if (!isHardwareUnitItem(serName)) return;

          const u = s[4] ?? 1;
          const sn = s[6] ? s[6].trim().toUpperCase() : '';
          const unitProdName = sn ? unitsBySn.get(sn) || '' : '';
          const saleSerKey = normalizeSeriesKey(serName);
          const saleProdKey = normalizeProductKey(unitProdName);

          let isMatch = false;

          // 1. Direct SKU match in item's products
          if (saleProdKey && itemProdKeys.has(saleProdKey)) {
            isMatch = true;
          }
          // 2. Series name match
          else if (saleSerKey && saleSerKey === itemCatKey) {
            isMatch = true;
          }
          // 3. Known Catalog series match
          else {
            const catItem = MAIN_PUSH_CATALOG[item.n];
            if (catItem) {
              const matchedInCat = catItem.p.some(
                (p) => normalizeProductKey(p) === saleProdKey
              );
              if (matchedInCat) isMatch = true;
            }
          }

          if (isMatch) {
            staffSold[staffIdx] += u;
          }
        });

        // Also incorporate any manually logged floor sales
        const combinedStaffSold = staff.map((_, i) => {
          return Math.max(staffSold[i], item.s[i] || 0);
        });

        return {
          ...item,
          s: combinedStaffSold,
        };
      }

      // If no current month sales recorded yet, use item.s or baseline
      return item;
    });
  }, [cfg, currentMonthSales, staff, unitsBySn]);

  // Calculations for a series item
  const calc = (d: SeriesConfigItem) => {
    const T = d.m === 'total' ? d.t : d.t * d.div;
    const S = d.s.reduce((a, b) => a + b, 0);
    return {
      T,
      S,
      R: Math.max(0, T - S),
      pct: T ? Math.min(100, (S / T) * 100) : 0,
    };
  };

  // Shares per promoter for a series
  const shares = (d: SeriesConfigItem) => {
    const dv = Math.max(1, Math.min(N, d.div));
    const tot = d.m === 'total';
    const b = tot ? Math.floor(d.t / dv) : d.t;
    const x = tot ? d.t % dv : 0;
    return staff.map((_, i) => (i < dv ? b + (i < x ? 1 : 0) : 0));
  };

  const eaText = (d: { m: string; t: number; div: number }) => {
    return d.m === 'total'
      ? '= ' +
          Math.floor(d.t / d.div) +
          (d.t % d.div ? '–' + Math.ceil(d.t / d.div) : '') +
          ' each'
      : '= ' + d.t * d.div + ' total';
  };

  const getColor = (p: number) => {
    return p >= 80 ? '#10b981' : p >= 50 ? '#2563eb' : '#f59e0b';
  };

  // Grand summary across all series
  const allSummary = useMemo(() => {
    return computedCfg.reduce(
      (a, d) => {
        const c = calc(d);
        return {
          T: a.T + c.T,
          S: a.S + c.S,
          R: a.R + c.R,
          hit: a.hit + (c.T > 0 && c.R === 0 ? 1 : 0),
          n: a.n + 1,
        };
      },
      { T: 0, S: 0, R: 0, hit: 0, n: 0 }
    );
  }, [computedCfg]);

  const allAchievedPct = allSummary.T
    ? Math.min(100, (allSummary.S / allSummary.T) * 100)
    : 0;

  // Group summary by unit type (Drone, Handheld, Audio, etc.)
  const gsum = (unitName: string) => {
    return computedCfg
      .filter((d) => d.u === unitName)
      .reduce(
        (a, d) => {
          const c = calc(d);
          return { T: a.T + c.T, S: a.S + c.S, R: a.R + c.R };
        },
        { T: 0, S: 0, R: 0 }
      );
  };

  const perPersonText = (d: SeriesConfigItem) => {
    const dv = Math.max(1, Math.min(N, d.div));
    const T = calc(d).T;
    return Math.floor(T / dv) + (T % dv ? '–' + Math.ceil(T / dv) : '');
  };

  // Promoter totals for footer
  const promoterTotals = useMemo(() => {
    return staff.map((_, i) => {
      return computedCfg.reduce((a, d) => a + (d.s[i] || 0), 0);
    });
  }, [computedCfg, staff]);

  const totalPerPersonTarget = useMemo(() => {
    let tpp = 0;
    computedCfg.forEach((d) => {
      tpp += Math.ceil(calc(d).T / Math.max(1, Math.min(N, d.div)));
    });
    return tpp;
  }, [computedCfg, N]);

  // Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // Quick Log Floor Sale form state
  const [logStaffIdx, setLogStaffIdx] = useState(0);
  const [logSeriesIdx, setLogSeriesIdx] = useState(0);
  const [logUnits, setLogUnits] = useState(1);
  const [logSuccessMsg, setLogSuccessMsg] = useState<string | null>(null);

  // Editor Modal Draft State
  const [draftN, setDraftN] = useState(N);
  const [draft, setDraft] = useState<SeriesConfigItem[]>([]);
  const [openSKUs, setOpenSKUs] = useState<Record<number, boolean>>({});
  const [searchSKUQueries, setSearchSKUQueries] = useState<Record<number, string>>({});
  const [customSeriesName, setCustomSeriesName] = useState('');
  const [selectedAddCatalog, setSelectedAddCatalog] = useState('');
  const [newSubvariantInputs, setNewSubvariantInputs] = useState<Record<number, string>>({});

  const handleAddCustomSubvariant = (idx: number) => {
    const input = (newSubvariantInputs[idx] || '').trim();
    if (!input) return;

    setDraft((prev) => {
      const nxt: SeriesConfigItem[] = JSON.parse(JSON.stringify(prev));
      if (!nxt[idx].p.includes(input)) {
        nxt[idx].p.push(input);
      }
      return nxt;
    });

    setNewSubvariantInputs((prev) => ({ ...prev, [idx]: '' }));
  };

  // Toggle Theme
  const handleToggleTheme = () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const nxt = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nxt);
    setIsDarkMode(nxt === 'dark');
  };

  // Open Edit Modal
  const handleOpenEdit = () => {
    setDraftN(N);
    setDraft(JSON.parse(JSON.stringify(cfg)));
    setOpenSKUs({});
    setSearchSKUQueries({});
    setNewSubvariantInputs({});
    setCustomSeriesName('');
    const firstAvail = Object.keys(MAIN_PUSH_CATALOG).find(
      (s) => !cfg.some((d) => d.n === s)
    );
    setSelectedAddCatalog(firstAvail || '');
    setIsEditOpen(true);
  };

  // Reset to Source
  const handleResetToSource = () => {
    const sourceCfg: SeriesConfigItem[] = SOURCE_DATA.series.map((s) => ({
      u: s.unit,
      n: s.name,
      t: s.store_target,
      m: s.target_mode === 'each' ? 'each' : 'total',
      div: s.persons || N,
      s: staff.map((st) => s.sold_per_person[st] ?? 0),
      p: s.products.slice(),
    }));
    setDraft(sourceCfg);
    setDraftN(SOURCE_DATA.team.length);
    if (onResetMainPushTargets) onResetMainPushTargets();
  };

  // Save Editor changes
  const handleSaveEditor = () => {
    setCfg(draft);

    if (onUpdateMainPushTargets) {
      const newTargets: Record<string, number> = {};
      const newVariants: Record<string, string[]> = {};
      const newDividers: Record<string, number> = {};

      draft.forEach((d) => {
        newTargets[d.n] = d.m === 'total' ? d.t : d.t * d.div;
        newVariants[d.n] = d.p;
        newDividers[d.n] = d.div;
      });

      onUpdateMainPushTargets(newTargets, newVariants, newDividers);
    }

    setIsEditOpen(false);
  };

  // Confirm Quick Floor Sale
  const handleConfirmFloorSale = () => {
    const chosenSeries = cfg[logSeriesIdx];
    if (!chosenSeries) return;

    const unitsCount = Math.max(1, logUnits);
    const staffName = staff[logStaffIdx] || 'Promoter';

    // 1. If onAddSale prop exists, record actual sale transaction into state & cloud
    if (onAddSale) {
      // Find series index in DJI_DATA.ser
      const rawSerIdx = DJI_DATA.ser.findIndex(
        (s) => normalizeSeriesKey(s) === normalizeSeriesKey(chosenSeries.n)
      );
      const finalSerIdx = rawSerIdx >= 0 ? rawSerIdx : 0;
      // Default amount estimated from catalog products
      const defaultPrice = 25000;

      onAddSale(
        endOffset,
        logStaffIdx,
        finalSerIdx,
        defaultPrice * unitsCount,
        unitsCount,
        '',
        0 // Walk-in
      );
    }

    // 2. Also update local series sold count immediately
    setCfg((prev) => {
      const next = [...prev];
      if (next[logSeriesIdx]) {
        const nextS = [...next[logSeriesIdx].s];
        nextS[logStaffIdx] = (nextS[logStaffIdx] || 0) + unitsCount;
        next[logSeriesIdx] = {
          ...next[logSeriesIdx],
          s: nextS,
        };
      }
      return next;
    });

    setLogSuccessMsg(`Logged ${unitsCount} unit(s) for ${staffName}!`);
    setTimeout(() => {
      setLogSuccessMsg(null);
      setIsLogOpen(false);
    }, 700);
  };

  // Catalog items available to add (not yet in draft)
  const availableCatalogToAdd = useMemo(() => {
    return Object.keys(MAIN_PUSH_CATALOG).filter(
      (s) => !draft.some((d) => d.n === s)
    );
  }, [draft]);

  // Group items by unit for Store Total view
  const groupedSeriesByUnit = useMemo(() => {
    const groups: { unit: string; items: SeriesConfigItem[] }[] = [];
    const seen = new Set<string>();

    computedCfg.forEach((item) => {
      if (!seen.has(item.u)) {
        seen.add(item.u);
        groups.push({
          unit: item.u,
          items: computedCfg.filter((x) => x.u === item.u),
        });
      }
    });

    return groups;
  }, [computedCfg]);

  return (
    <div className="w-full">
      {/* Main Push Target Card Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm transition-all hover:border-blue-300">
        {/* Card Header */}
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 m-0">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              <span>Main Push Targets</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0">
              Focus models vs. monthly quota · SM City Dasmariñas
            </p>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1">
            {onOpenExcelImport && (
              <button
                type="button"
                onClick={onOpenExcelImport}
                className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Import Main Push Targets using Excel template"
                aria-label="Import Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleTheme}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Toggle color theme"
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setLogStaffIdx(0);
                setLogSeriesIdx(0);
                setLogUnits(1);
                setIsLogOpen(true);
              }}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Quick log sale"
              aria-label="Quick log sale"
            >
              <Plus className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
            <button
              type="button"
              onClick={handleOpenEdit}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Edit targets and series allocation"
              aria-label="Edit targets"
            >
              <Sliders className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
          </div>
        </div>

        {/* Segmented Mode Selector */}
        <div className="inline-flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-4">
          <button
            type="button"
            onClick={() => setMode('store')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              mode === 'store'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Store Total
          </button>
          <button
            type="button"
            onClick={() => setMode('promoters')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              mode === 'promoters'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Per Promoter
          </button>
        </div>

        {/* View Mode 1: Store Total */}
        {mode === 'store' && (
          <div>
            {/* Top Stat Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 mb-4 border border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div>
                  <small className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Total target
                  </small>
                  <b className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    {allSummary.T}
                  </b>
                </div>
                <div>
                  <small className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Sold
                  </small>
                  <b className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                    {allSummary.S}
                  </b>
                </div>
                <div>
                  <small className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Remaining
                  </small>
                  <b className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                    {allSummary.R}
                  </b>
                </div>
                <div>
                  <small className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Series hit
                  </small>
                  <b className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    {allSummary.hit}/{allSummary.n}
                  </b>
                </div>
              </div>

              {/* Master Progress Bar */}
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${allAchievedPct}%`,
                    backgroundColor: getColor(allAchievedPct),
                  }}
                />
              </div>

              {/* Master Meta */}
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>{allSummary.n} series · all models combined</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {allAchievedPct.toFixed(0)}% achieved
                </span>
              </div>
            </div>

            {/* Series rows grouped by unit */}
            <div className="space-y-4">
              {groupedSeriesByUnit.map((group) => {
                const gs = gsum(group.unit);
                return (
                  <div key={group.unit} className="space-y-2">
                    {/* Unit Section Header */}
                    <div className="flex justify-between items-center text-[10px] font-extrabold tracking-wider uppercase text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 first:border-0 first:pt-0">
                      <span>{group.unit}</span>
                      <span>
                        {gs.S} / {gs.T} units
                      </span>
                    </div>

                    {/* Series Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {group.items.map((d) => {
                        const c = calc(d);
                        return (
                          <div key={d.n} className="py-2.5 first:pt-1 last:pb-1">
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                {d.n}
                              </span>
                              <span className="font-extrabold text-sm whitespace-nowrap text-slate-900 dark:text-slate-100">
                                {c.S}{' '}
                                <i className="not-italic font-normal text-slate-400">
                                  / {c.T}
                                </i>
                                <b className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                                  {c.pct.toFixed(0)}%
                                </b>
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden my-2">
                              <div
                                className="h-full rounded-full transition-all duration-400"
                                style={{
                                  width: `${c.pct}%`,
                                  backgroundColor: getColor(c.pct),
                                }}
                              />
                            </div>

                            {/* Meta info */}
                            <div className="flex justify-between items-center text-[11px] text-slate-400">
                              <span>
                                {d.p.length} active SKUs ·{' '}
                                {d.m === 'total'
                                  ? `${d.t} total ÷ `
                                  : `${d.t} each × `}
                                {d.div} persons
                              </span>
                              {c.R === 0 ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  ✓ Target hit
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                  {c.R} to go
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View Mode 2: Per Promoter Table */}
        {mode === 'promoters' && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Units sold per promoter. Green values indicate individual quota share achieved.
            </p>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500 dark:text-slate-400">
                    <th className="text-left py-2 px-2.5 font-bold min-w-[140px]">
                      Series
                    </th>
                    <th className="text-center py-2 px-2 font-bold whitespace-nowrap">
                      Target
                    </th>
                    <th className="text-center py-2 px-2 font-bold whitespace-nowrap">
                      Per person
                    </th>
                    {staff.map((st) => (
                      <th
                        key={st}
                        className="text-center py-2 px-2 font-bold border-l border-slate-200 dark:border-slate-800 whitespace-nowrap"
                      >
                        {st}
                      </th>
                    ))}
                    <th className="text-center py-2 px-2 font-bold border-l border-slate-200 dark:border-slate-800 whitespace-nowrap">
                      Total sold
                    </th>
                    <th className="text-center py-2 px-2 font-bold border-l border-slate-200 dark:border-slate-800 whitespace-nowrap">
                      Remaining
                    </th>
                    <th className="text-center py-2 px-2 font-bold border-l border-slate-200 dark:border-slate-800 whitespace-nowrap">
                      % Achieved
                    </th>
                    <th className="text-right py-2 px-2.5 font-bold whitespace-nowrap">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {computedCfg.map((d) => {
                    const c = calc(d);
                    const sh = shares(d);
                    return (
                      <tr
                        key={d.n}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-2.5 font-bold text-slate-900 dark:text-slate-100 min-w-[140px]">
                          {d.n}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-900 dark:text-slate-100">
                          {c.T}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-300">
                          {perPersonText(d)}
                        </td>
                        {staff.map((_, i) => {
                          const s = d.s[i] || 0;
                          const isDone = sh[i] > 0 && s >= sh[i];
                          return (
                            <td
                              key={i}
                              className={`py-2.5 px-2 text-center border-l border-slate-100 dark:border-slate-800 font-medium ${
                                isDone
                                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {s}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-2 text-center font-bold border-l border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                          {c.S}
                        </td>
                        <td className="py-2.5 px-2 text-center border-l border-slate-100 dark:border-slate-800 font-bold text-amber-600 dark:text-amber-400">
                          {c.R}
                        </td>
                        <td className="py-2.5 px-2 text-center border-l border-slate-100 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                          {Math.round(c.T ? (c.S / c.T) * 100 : 0)}%
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">
                          {c.R === 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              Achieved
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-extrabold text-slate-900 dark:text-slate-100 bg-amber-500/15 dark:bg-amber-400/10 border-t border-slate-200 dark:border-slate-700">
                    <td className="py-2.5 px-2.5">Total</td>
                    <td className="py-2.5 px-2 text-center">{allSummary.T}</td>
                    <td className="py-2.5 px-2 text-center">{totalPerPersonTarget}</td>
                    {promoterTotals.map((tot, idx) => (
                      <td
                        key={idx}
                        className="py-2.5 px-2 text-center border-l border-slate-200 dark:border-slate-700"
                      >
                        {tot}
                      </td>
                    ))}
                    <td className="py-2.5 px-2 text-center border-l border-slate-200 dark:border-slate-700 font-black">
                      {allSummary.S}
                    </td>
                    <td className="py-2.5 px-2 text-center border-l border-slate-200 dark:border-slate-700 font-black text-amber-600 dark:text-amber-400">
                      {allSummary.R}
                    </td>
                    <td className="py-2.5 px-2 text-center border-l border-slate-200 dark:border-slate-700">
                      {allAchievedPct.toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-black">
                      {allSummary.R === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          Achieved
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Card Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (mode === 'store') {
                setMode('promoters');
              } else if (onOpenFullModal) {
                onOpenFullModal();
              }
            }}
            className="border-0 bg-transparent text-blue-600 dark:text-blue-400 font-bold text-xs cursor-pointer flex items-center gap-1.5 p-0 hover:underline"
          >
            <span>
              {mode === 'store'
                ? 'View full breakdown per promoter'
                : 'Open detailed monthly performance & quota modal'}
            </span>
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
          <span className="text-[11px] text-slate-400">
            {N} Promoters on floor
          </span>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-3 mb-0">
          Direct sync with active inventory & sales quotas (DJI Store Dasma).
        </p>
      </div>

      {/* Target Editor Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit Main Push targets"
            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-2xl max-h-[92vh] sm:max-h-[86vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <b className="text-base font-bold">Edit Main Push Targets</b>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
                  Set targets per promoter, total distribution modes, and associated catalog items.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-4 sm:p-5 flex-1 space-y-4">
              {/* Active Promoters Row */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">Active Promoters</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={draftN}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
                      setDraftN(val);
                      setDraft((prev) =>
                        prev.map((x) => ({ ...x, div: Math.min(x.div, val) }))
                      );
                    }}
                    className="w-16 px-2.5 py-1 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center"
                  />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Quotas are split across these promoters
                </span>
              </div>

              {/* Series Configurations List */}
              <div className="space-y-3">
                {draft.map((d, i) => (
                  <div
                    key={i}
                    className="p-3.5 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    {/* Header Row: Title, Unit Badge, Mode, Delete */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {d.c ? (
                          <input
                            type="text"
                            value={d.n}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((prev) => {
                                const nxt = [...prev];
                                nxt[i] = { ...nxt[i], n: val };
                                return nxt;
                              });
                            }}
                            className="flex-1 min-w-[140px] px-2.5 py-1 text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                            maxLength={40}
                            placeholder="Series Name"
                          />
                        ) : (
                          <b className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">{d.n}</b>
                        )}

                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                          {d.u}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={d.m}
                          onChange={(e) => {
                            const val = e.target.value as 'total' | 'each';
                            setDraft((prev) => {
                              const nxt = [...prev];
                              nxt[i] = { ...nxt[i], m: val };
                              return nxt;
                            });
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                        >
                          <option value="total">Total split equally</option>
                          <option value="each">Target each</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            setDraft((prev) => prev.filter((_, idx) => idx !== i));
                            setOpenSKUs({});
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Numeric Controls Row */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/60 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-semibold">
                          <span>Target:</span>
                          <input
                            type="number"
                            min="0"
                            max="999"
                            value={d.t}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setDraft((prev) => {
                                const nxt = [...prev];
                                nxt[i] = { ...nxt[i], t: val };
                                return nxt;
                              });
                            }}
                            className="w-16 px-2 py-1 text-xs font-bold text-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                          />
                        </label>

                        <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-semibold">
                          <span>{d.m === 'total' ? '÷' : '×'} persons:</span>
                          <input
                            type="number"
                            min="1"
                            max={draftN}
                            value={d.div}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(draftN, parseInt(e.target.value, 10) || 1));
                              setDraft((prev) => {
                                const nxt = [...prev];
                                nxt[i] = { ...nxt[i], div: val };
                                return nxt;
                              });
                            }}
                            className="w-12 px-1.5 py-1 text-xs font-bold text-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                          />
                        </label>

                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {eaText(d)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenSKUs((prev) => ({ ...prev, [i]: !prev[i] }))
                        }
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors cursor-pointer shrink-0"
                      >
                        {d.p.length} SKUs {openSKUs[i] ? '▴' : '▾'}
                      </button>
                    </div>

                    {/* Products selector panel if open */}
                    {openSKUs[i] && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        {/* Option to add custom subvariant SKU directly */}
                        <div className="flex gap-2 items-center bg-slate-50 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <input
                            type="text"
                            placeholder={`Type subvariant name to add to ${d.n}...`}
                            value={newSubvariantInputs[i] || ''}
                            onChange={(e) =>
                              setNewSubvariantInputs((prev) => ({ ...prev, [i]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomSubvariant(i);
                              }
                            }}
                            className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCustomSubvariant(i)}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shrink-0"
                          >
                            + Add Subvariant
                          </button>
                        </div>

                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="search"
                            placeholder="Search catalog SKUs…"
                            value={searchSKUQueries[i] || ''}
                            onChange={(e) => {
                              const q = e.target.value;
                              setSearchSKUQueries((prev) => ({ ...prev, [i]: q }));
                            }}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>

                        {/* List of Catalog SKUs */}
                        <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/50">
                          {(() => {
                            const term = (searchSKUQueries[i] || '').toLowerCase();
                            const items: string[] = [];
                            const seen: Record<string, boolean> = {};

                            const addProduct = (p: string) => {
                              if (!seen[p]) {
                                seen[p] = true;
                                items.push(p);
                              }
                            };

                            if (term) {
                              Object.keys(PRODUCT_TO_SERIES_MAP).forEach((p) => {
                                if (
                                  items.length < 60 &&
                                  (p.toLowerCase().includes(term) ||
                                    (PRODUCT_TO_SERIES_MAP[p] || '')
                                      .toLowerCase()
                                      .includes(term))
                                ) {
                                  addProduct(p);
                                }
                              });
                            } else {
                              const catP = MAIN_PUSH_CATALOG[d.n]?.p || [];
                              catP.forEach(addProduct);
                              d.p.forEach(addProduct);
                            }

                            if (items.length === 0) {
                              return (
                                <p className="text-xs text-slate-400 p-2 text-center">
                                  {term ? 'No products matching search.' : 'No SKUs mapped yet.'}
                                </p>
                              );
                            }

                            return items.map((prod) => {
                              const isChecked = d.p.includes(prod);
                              // Check if currently assigned to another series in draft
                              const otherIdx = draft.findIndex(
                                (x, j) => j !== i && x.p.includes(prod)
                              );
                              const otherSeriesName =
                                otherIdx >= 0 ? draft[otherIdx].n : null;

                              return (
                                <label
                                  key={prod}
                                  className="flex items-start gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-xs cursor-pointer select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setDraft((prev) => {
                                        const nxt = JSON.parse(JSON.stringify(prev));
                                        if (checked) {
                                          // Remove from all other series to avoid overlap
                                          nxt.forEach((x: SeriesConfigItem, j: number) => {
                                            if (j !== i) {
                                              x.p = x.p.filter((p) => p !== prod);
                                            }
                                          });
                                          if (!nxt[i].p.includes(prod)) {
                                            nxt[i].p.push(prod);
                                          }
                                        } else {
                                          nxt[i].p = nxt[i].p.filter((p: string) => p !== prod);
                                        }
                                        return nxt;
                                      });
                                    }}
                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {prod}
                                    </span>
                                    <small className="block text-[10px] text-slate-400">
                                      {PRODUCT_TO_SERIES_MAP[prod] || 'Standard'}
                                      {otherSeriesName && (
                                        <span className="text-amber-600 dark:text-amber-400 ml-1">
                                          · currently in {otherSeriesName}
                                        </span>
                                      )}
                                    </small>
                                  </div>
                                </label>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Series from Catalog */}
              {availableCatalogToAdd.length > 0 && (
                <div className="flex gap-2 items-center pt-2">
                  <select
                    value={selectedAddCatalog}
                    onChange={(e) => setSelectedAddCatalog(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                  >
                    <option value="" disabled>
                      Select catalog series to add…
                    </option>
                    {availableCatalogToAdd.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedAddCatalog) return;
                      const cat = MAIN_PUSH_CATALOG[selectedAddCatalog];
                      setDraft((prev) => [
                        ...prev,
                        {
                          u: cat ? cat.u : 'Handheld',
                          n: selectedAddCatalog,
                          t: 6,
                          m: 'total',
                          div: draftN,
                          s: staff.map(() => 0),
                          p: cat ? [...cat.p] : [],
                        },
                      ]);
                      setOpenSKUs({ [draft.length]: true });
                      const remaining = availableCatalogToAdd.filter(
                        (s) => s !== selectedAddCatalog
                      );
                      setSelectedAddCatalog(remaining[0] || '');
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 cursor-pointer"
                  >
                    Add series
                  </button>
                </div>
              )}

              {/* Add Custom Series */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Custom series name…"
                  value={customSeriesName}
                  onChange={(e) => setCustomSeriesName(e.target.value)}
                  maxLength={40}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nm = customSeriesName.trim();
                    if (!nm) return;
                    setDraft((prev) => [
                      ...prev,
                      {
                        u: 'Handheld',
                        c: true,
                        n: nm,
                        t: 6,
                        m: 'total',
                        div: draftN,
                        s: staff.map(() => 0),
                        p: [],
                      },
                    ]);
                    setCustomSeriesName('');
                    setOpenSKUs({ [draft.length]: true });
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 cursor-pointer"
                >
                  Add custom
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={handleResetToSource}
                className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Reset to Source
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditor}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Log Floor Sale Modal */}
      {isLogOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Log Floor Sale"
            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <b className="text-base font-bold">Log Floor Sale</b>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
                  Record a completed unit sale directly to a promoter's tally.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLogOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-4 sm:p-5 space-y-4">
              {logSuccessMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{logSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                  Promoter
                </label>
                <select
                  value={logStaffIdx}
                  onChange={(e) => setLogStaffIdx(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold"
                >
                  {staff.map((st, i) => (
                    <option key={st} value={i}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                  Product Series
                </label>
                <select
                  value={logSeriesIdx}
                  onChange={(e) => setLogSeriesIdx(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold"
                >
                  {cfg.map((c, i) => (
                    <option key={c.n} value={i}>
                      {c.n} ({c.u})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Promoter Quota Status for Selected Series */}
              {(() => {
                const chosenSeries = cfg[logSeriesIdx];
                if (!chosenSeries) return null;
                const promoterShare = shares(chosenSeries)[logStaffIdx] || 0;
                const promoterSold = chosenSeries.s[logStaffIdx] || 0;
                const promoterRemaining = Math.max(0, promoterShare - promoterSold);
                return (
                  <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-200/60 dark:border-blue-900/40 text-xs">
                    <div className="flex justify-between items-center font-bold text-blue-900 dark:text-blue-200 mb-1">
                      <span>{staff[logStaffIdx]} · Current Status</span>
                      <span className="font-extrabold text-blue-700 dark:text-blue-300">
                        {promoterSold} / {promoterShare} units
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-blue-700 dark:text-blue-300">
                      <span>Personal quota: {promoterShare} units</span>
                      <span className="font-semibold">
                        {promoterRemaining === 0 ? '✓ Target achieved!' : `${promoterRemaining} units remaining`}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                    Units Sold
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 5].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setLogUnits(qty)}
                        className={`px-2 py-0.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                          logUnits === qty
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        +{qty}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={logUnits}
                  onChange={(e) =>
                    setLogUnits(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLogOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFloorSale}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm"
              >
                Confirm Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
