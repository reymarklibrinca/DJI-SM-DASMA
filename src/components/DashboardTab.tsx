import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Sliders,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  ShieldCheck,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Info,
  Target,
  Users,
  ArrowRight,
  ArrowLeft,
  Maximize2,
  Radio,
  Megaphone,
  Bell,
  Search,
  Filter,
  Plus,
  Trash2,
  CheckCircle2,
  CreditCard,
  Truck,
  Sparkles,
  X,
  Cloud,
  Sun,
  Wind,
  Compass,
  Droplets,
  Eye,
  Gauge,
  RefreshCw,
  Thermometer,
  Plane,
  CloudRain,
  ShieldAlert,
  RotateCcw,
  Edit2,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { MAIN_PUSH_TARGETS, DJI_DATA } from '../data/initialData';
import { PeriodRange, SaleTuple, StockSeriesCover } from '../types';
import {
  aggregateSales,
  calculateAttachRate,
  calculatePercentChange,
  dayOffsetToDate,
  formatCurrency,
  formatDate,
  aggregateLeadsOverRange,
  calculateMainPushBreakdown,
} from '../utils/calculations';
import { MainPushBreakdownModal } from './MainPushBreakdownModal';
import { ImportMainPushTargetsModal } from './ImportMainPushTargetsModal';
import { EditMainPushTargetsModal } from './EditMainPushTargetsModal';
import { MainPushCard } from './MainPushCard';

import { SwipeableCard } from './dashboard/SwipeableCard';
import { DEFAULT_INVENTORY_ITEMS, DEFAULT_DASMARINAS_WEATHER } from './dashboard/dashboardData';
import type { InventoryWatchItem, WeatherData } from './dashboard/dashboardData';
export { DEFAULT_DASMARINAS_WEATHER };
export type { InventoryWatchItem, WeatherData };


interface DashboardTabProps {
  sales: SaleTuple[];
  periodRange: PeriodRange;
  stockMetrics: {
    rows: StockSeriesCover[];
    totalUnitsInStock: number;
    totalSrpValue: number;
  };
  endOffset: number;
  localLeads: Record<number, Record<string, [number, number, number]>>;
  staffList: string[];
  promoterMonthlyTargets?: Record<number, number>;
  mainPushTargets?: Record<string, number>;
  mainPushVariants?: Record<string, string[]>;
  mainPushDividers?: Record<string, number>;
  onUpdateMainPushTargets?: (newTargets: Record<string, number>, newVariants?: Record<string, string[]>, newDividers?: Record<string, number>) => void;
  onResetMainPushTargets?: () => void;
  onDeleteMainPushTarget?: (modelName: string) => void;
  onAddSale?: (
    dayOffset: number,
    staffIndex: number,
    seriesIndex: number,
    amount: number,
    units?: number,
    serialNumber?: string,
    leadType?: number
  ) => { success: boolean; message: string };
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  sales,
  periodRange,
  stockMetrics,
  endOffset,
  localLeads,
  staffList,
  promoterMonthlyTargets = { 0: 2400000, 1: 2400000, 2: 2400000 },
  mainPushTargets,
  mainPushVariants,
  mainPushDividers,
  onUpdateMainPushTargets,
  onResetMainPushTargets,
  onDeleteMainPushTarget,
  onAddSale,
}) => {
  const [isMainPushModalOpen, setIsMainPushModalOpen] = useState(false);
  const [isImportTargetsOpen, setIsImportTargetsOpen] = useState(false);
  const [isEditTargetsOpen, setIsEditTargetsOpen] = useState(false);
  const [mainPushCardMode, setMainPushCardMode] = useState<'store' | 'promoters'>('store');

  // Mode: 'inventory' (Inventory Watch Only) or 'weather' (Flight Weather & Flyability)
  const [watchMode, setWatchMode] = useState<'inventory' | 'weather'>(() => {
    try {
      return (localStorage.getItem('dji_watch_mode') as 'inventory' | 'weather') || 'inventory';
    } catch {
      return 'inventory';
    }
  });

  const handleSelectWatchMode = (mode: 'inventory' | 'weather') => {
    setWatchMode(mode);
    try {
      localStorage.setItem('dji_watch_mode', mode);
    } catch {
      // ignore storage errors
    }
  };

  // Inventory Watch state & persistence
  const [invFilter, setInvFilter] = useState<'all' | 'out_of_stock' | 'low_stock' | 'logistics'>('all');
  const [invSearch, setInvSearch] = useState('');
  const [customInvNotes, setCustomInvNotes] = useState<InventoryWatchItem[]>(() => {
    try {
      const saved = localStorage.getItem('dji_custom_inventory_notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAddingInvNote, setIsAddingInvNote] = useState(false);
  const [newInvSku, setNewInvSku] = useState('');
  const [newInvSeries, setNewInvSeries] = useState('ACCESSORIES');
  const [newInvUnits, setNewInvUnits] = useState(0);
  const [newInvType, setNewInvType] = useState<'out_of_stock' | 'low_stock' | 'logistics' | 'audit'>('low_stock');
  const [newInvPriority, setNewInvPriority] = useState<'critical' | 'warning' | 'notice'>('warning');
  const [newInvSummary, setNewInvSummary] = useState('');
  const [newInvAction, setNewInvAction] = useState('');

  const handleAddInvNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvSku.trim() || !newInvSummary.trim()) return;

    const newItem: InventoryWatchItem = {
      id: `custom_inv_${Date.now()}`,
      type: newInvType,
      priority: newInvPriority,
      skuName: newInvSku.trim(),
      series: newInvSeries.trim(),
      unitsOnHand: Number(newInvUnits) || 0,
      author: 'Floor Team Stock Log',
      time: `Today · ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      summary: newInvSummary.trim(),
      actionGuidance: newInvAction.trim() || 'Directive: Check safe drawer and verify serial barcode before release.',
      isCustom: true,
    };

    const updated = [newItem, ...customInvNotes];
    setCustomInvNotes(updated);
    try {
      localStorage.setItem('dji_custom_inventory_notes', JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }

    setNewInvSku('');
    setNewInvSummary('');
    setNewInvAction('');
    setNewInvUnits(0);
    setIsAddingInvNote(false);
  };

  // Dismissed item IDs (persisted to localStorage)
  const [dismissedItemIds, setDismissedItemIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dji_dismissed_inventory_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lastDeletedItem, setLastDeletedItem] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteItem = (id: string) => {
    const target = allInventoryItems.find((i) => i.id === id);
    if (target) {
      setLastDeletedItem({ id: target.id, name: target.skuName });
    }

    if (customInvNotes.some((i) => i.id === id)) {
      const nextCustom = customInvNotes.filter((i) => i.id !== id);
      setCustomInvNotes(nextCustom);
      try {
        localStorage.setItem('dji_custom_inventory_notes', JSON.stringify(nextCustom));
      } catch {
        // ignore storage errors
      }
    }

    setDismissedItemIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      try {
        localStorage.setItem('dji_dismissed_inventory_items', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  };

  const handleRestoreItem = (id: string) => {
    setDismissedItemIds((prev) => {
      const updated = prev.filter((item) => item !== id);
      try {
        localStorage.setItem('dji_dismissed_inventory_items', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
    if (lastDeletedItem?.id === id) {
      setLastDeletedItem(null);
    }
  };

  const handleRestoreAll = () => {
    setDismissedItemIds([]);
    try {
      localStorage.removeItem('dji_dismissed_inventory_items');
    } catch {
      // ignore storage errors
    }
    setLastDeletedItem(null);
  };

  const allInventoryItems = useMemo(() => {
    const combined = [...customInvNotes, ...DEFAULT_INVENTORY_ITEMS];
    return combined.filter((item) => !dismissedItemIds.includes(item.id));
  }, [customInvNotes, dismissedItemIds]);

  const invCounts = useMemo(() => {
    return {
      all: allInventoryItems.length,
      outOfStock: allInventoryItems.filter((i) => i.type === 'out_of_stock' || i.unitsOnHand === 0).length,
      lowStock: allInventoryItems.filter((i) => i.type === 'low_stock' && i.unitsOnHand > 0).length,
      logistics: allInventoryItems.filter((i) => i.type === 'logistics' || i.type === 'audit').length,
    };
  }, [allInventoryItems]);

  const filteredInventoryItems = useMemo(() => {
    return allInventoryItems.filter((item) => {
      if (invFilter === 'out_of_stock' && item.type !== 'out_of_stock' && item.unitsOnHand > 0) return false;
      if (invFilter === 'low_stock' && (item.type !== 'low_stock' || item.unitsOnHand === 0)) return false;
      if (invFilter === 'logistics' && item.type !== 'logistics' && item.type !== 'audit') return false;

      if (invSearch.trim()) {
        const query = invSearch.toLowerCase().trim();
        const inSku = item.skuName.toLowerCase().includes(query);
        const inSeries = item.series.toLowerCase().includes(query);
        const inSummary = item.summary.toLowerCase().includes(query);
        const inAction = item.actionGuidance.toLowerCase().includes(query);
        if (!inSku && !inSeries && !inSummary && !inAction) return false;
      }
      return true;
    });
  }, [allInventoryItems, invFilter, invSearch]);

  // Live Weather for SM City Dasmariñas, Cavite
  const [weatherData, setWeatherData] = useState<WeatherData>(DEFAULT_DASMARINAS_WEATHER);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  const fetchWeather = useCallback(async () => {
    setIsLoadingWeather(true);
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=14.3015&longitude=120.9575&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m&timezone=Asia%2FManila&forecast_days=1'
      );
      if (!res.ok) throw new Error('Weather fetch returned non-200');
      const data = await res.json();
      if (data && data.current) {
        const c = data.current;
        const speedKm = Number(c.wind_speed_10m ?? 8.5);
        const gustsKm = Number(c.wind_gusts_10m ?? 15.0);
        setWeatherData({
          temp: Math.round(Number(c.temperature_2m ?? 29)),
          apparentTemp: Math.round(Number(c.apparent_temperature ?? 32)),
          humidity: Math.round(Number(c.relative_humidity_2m ?? 75)),
          windSpeedKm: Math.round(speedKm * 10) / 10,
          windSpeedMs: Math.round((speedKm / 3.6) * 10) / 10,
          windGustsKm: Math.round(gustsKm * 10) / 10,
          windGustsMs: Math.round((gustsKm / 3.6) * 10) / 10,
          windDirection: Math.round(Number(c.wind_direction_10m ?? 210)),
          cloudCover: Math.round(Number(c.cloud_cover ?? 40)),
          precipitation: Number(c.precipitation ?? 0),
          weatherCode: Number(c.weather_code ?? 2),
          isDay: Boolean(c.is_day ?? 1),
          updatedAt: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        });
      }
    } catch {
      setWeatherData((prev) => ({
        ...prev,
        updatedAt: 'Live (SM Dasmariñas)',
      }));
    } finally {
      setIsLoadingWeather(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Flyability assessment for Dasmariñas
  const flyabilityVerdict = useMemo(() => {
    if (weatherData.precipitation > 0.5) {
      return {
        level: 'NO_FLY',
        title: 'Rain Detected — Outdoor Flights Grounded',
        badgeClass: 'bg-rose-600 text-white',
        cardBg: 'bg-rose-50 border-rose-300 text-rose-950',
        advice: 'Do not fly outdoors. Recommend indoor flight cage demo with propeller guards only.',
      };
    }
    if (weatherData.windGustsMs > 10.7 || weatherData.windSpeedMs > 8.0) {
      return {
        level: 'CAUTION',
        title: 'Caution: Moderate Gusts Observed',
        badgeClass: 'bg-amber-600 text-white',
        cardBg: 'bg-amber-50 border-amber-300 text-amber-950',
        advice: 'DJI Neo outdoor flights restricted. Mini 4 Pro and Air 3S permitted with active pilot vigilance.',
      };
    }
    return {
      level: 'OPTIMAL',
      title: 'Optimal UAV Flight Conditions',
      badgeClass: 'bg-emerald-600 text-white',
      cardBg: 'bg-emerald-50 border-emerald-300 text-emerald-950',
      advice: 'Mild wind, dry skies, and clear visibility. Ideal for outdoor customer demos and flight cage trials!',
    };
  }, [weatherData]);

  const currentAgg = aggregateSales(sales, periodRange.a, periodRange.b);
  const prevAgg = aggregateSales(sales, periodRange.pa, periodRange.pb);

  const saChange = calculatePercentChange(currentAgg.sa, prevAgg.sa);
  const unChange = calculatePercentChange(currentAgg.un, prevAgg.un);
  const currentAvgPrice = currentAgg.un ? currentAgg.sa / currentAgg.un : 0;
  const prevAvgPrice = prevAgg.un ? prevAgg.sa / prevAgg.un : 0;
  const avgPriceChange = calculatePercentChange(currentAvgPrice, prevAvgPrice);

  const currentCareAttach = calculateAttachRate(currentAgg.care, currentAgg.hw);
  const prevCareAttach = calculateAttachRate(prevAgg.care, prevAgg.hw);
  const careDelta = currentCareAttach - prevCareAttach;

  // Main Push calculation dynamically aligned with current sales of current month
  const currentMonthNum = dayOffsetToDate(endOffset).getMonth();
  const currentYear = dayOffsetToDate(endOffset).getFullYear();
  const pushData = useMemo(() => {
    return calculateMainPushBreakdown(sales, staffList, currentMonthNum, mainPushTargets, mainPushVariants, currentYear, mainPushDividers);
  }, [sales, staffList, currentMonthNum, currentYear, mainPushTargets, mainPushVariants, mainPushDividers]);

  const soldByModelMap = useMemo(() => {
    const map: Record<string, number> = {};
    pushData.categories.forEach((cat) => {
      map[cat.name] = cat.storeSold;
    });
    return map;
  }, [pushData]);

  // Chart computations
  const [hoveredDay, setHoveredDay] = useState<{ dayIdx: number; dayOffset: number; sa: number } | null>(null);

  const chartWidth = 800;
  const chartHeight = 220;
  const maxDaySales = Math.max(...currentAgg.day, 1);
  const dayCount = Math.max(currentAgg.day.length, 1);

  const chartPoints = currentAgg.day.map((val, idx) => {
    const x = dayCount === 1 ? chartWidth / 2 : (idx / (dayCount - 1)) * (chartWidth - 40) + 20;
    const y = chartHeight - 30 - (val / maxDaySales) * (chartHeight - 60);
    return { x, y, val, dayOffset: periodRange.a + idx };
  });

  const polylineCoords = chartPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const polygonCoords = `20,${chartHeight - 20} ${polylineCoords} ${chartWidth - 20},${chartHeight - 20}`;

  // Month-by-month table (August = 7, September = 8, October = 9)
  const monthData = [
    { monthNum: 7, name: 'August' },
    { monthNum: 8, name: 'September' },
    { monthNum: 9, name: 'October' },
  ].map(({ monthNum, name }) => {
    let sa = 0;
    let un = 0;
    let daysCountInMonth = 0;

    for (let i = 0; i <= endOffset; i++) {
      if (dayOffsetToDate(i).getMonth() === monthNum) {
        daysCountInMonth++;
      }
    }

    sales.forEach((s) => {
      if (dayOffsetToDate(s[0]).getMonth() === monthNum) {
        sa += s[3];
        un += s[4] ?? 1;
      }
    });

    return {
      name,
      sa,
      un,
      daysCount: daysCountInMonth,
      perDay: daysCountInMonth > 0 ? sa / daysCountInMonth : 0,
    };
  });

  // Leads aggregated over range
  const leadsSummary = aggregateLeadsOverRange(periodRange.a, periodRange.b, sales, localLeads);

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Revenue
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(currentAgg.sa)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            {periodRange.np ? (
              <span className="text-slate-400">Baseline</span>
            ) : saChange >= 0 ? (
              <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{saChange.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-700 font-bold flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {saChange.toFixed(1)}%
              </span>
            )}
            <span className="text-slate-500">vs {periodRange.pl}</span>
          </div>
        </div>

        {/* Units Sold */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Units Sold
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {currentAgg.un} <span className="text-sm font-normal text-slate-500">units</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            {periodRange.np ? (
              <span className="text-slate-400">Baseline</span>
            ) : unChange >= 0 ? (
              <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{unChange.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-700 font-bold flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {unChange.toFixed(1)}%
              </span>
            )}
            <span className="text-slate-500">vs {periodRange.pl}</span>
          </div>
        </div>

        {/* Average Transaction Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Avg Price / Unit
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(currentAvgPrice)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            {periodRange.np ? (
              <span className="text-slate-400">Baseline</span>
            ) : avgPriceChange >= 0 ? (
              <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{avgPriceChange.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-700 font-bold flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {avgPriceChange.toFixed(1)}%
              </span>
            )}
            <span className="text-slate-500">vs {periodRange.pl}</span>
          </div>
        </div>

        {/* DJI Care Attach */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            DJI Care Attach
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {currentCareAttach.toFixed(1)}%
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            {periodRange.np ? (
              <span className="text-slate-400">Baseline</span>
            ) : careDelta >= 0 ? (
              <span className="text-emerald-700 font-bold">
                ▲ +{careDelta.toFixed(1)} pts
              </span>
            ) : (
              <span className="text-rose-700 font-bold">
                ▼ {careDelta.toFixed(1)} pts
              </span>
            )}
            <span className="text-slate-500">
              ({currentAgg.care} Care / {currentAgg.hw} Devices)
            </span>
          </div>
        </div>

        {/* Stock On Hand */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Stock On Hand
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {stockMetrics.totalUnitsInStock}{' '}
            <span className="text-sm font-normal text-slate-500">units</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 font-semibold truncate">
            {formatCurrency(stockMetrics.totalSrpValue)} at SRP
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Sales Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Daily Sales Revenue ({periodRange.lb})
              </h3>
              <p className="text-xs text-slate-500">
                Peak day: <strong className="text-slate-800">{formatCurrency(maxDaySales)}</strong> · Hover points for details.
              </p>
            </div>
            {hoveredDay && (
              <div className="text-xs bg-slate-900 text-white px-3 py-1 rounded-lg font-medium shadow-xs">
                {formatDate(hoveredDay.dayOffset)}: {formatCurrency(hoveredDay.sa)}
              </div>
            )}
          </div>

          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible"
            >
              {/* Grid Lines */}
              {[0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = chartHeight - 30 - ratio * (chartHeight - 60);
                return (
                  <g key={ratio}>
                    <line
                      x1="20"
                      y1={y}
                      x2={chartWidth - 20}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x="25"
                      y={y - 4}
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="sans-serif"
                    >
                      {formatCurrency(maxDaySales * ratio)}
                    </text>
                  </g>
                );
              })}

              {/* Area Fill */}
              <polygon
                points={polygonCoords}
                fill="url(#blueGradient)"
                opacity="0.15"
              />

              {/* Line */}
              <polyline
                points={polylineCoords}
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Points */}
              {chartPoints.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredDay?.dayOffset === p.dayOffset ? 6 : 4}
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() =>
                      setHoveredDay({
                        dayIdx: idx,
                        dayOffset: p.dayOffset,
                        sa: p.val,
                      })
                    }
                    onMouseLeave={() => setHoveredDay(null)}
                  />
                  {/* Subtle date labels */}
                  {(idx % Math.ceil(chartPoints.length / 7) === 0 || idx === chartPoints.length - 1) && (
                    <text
                      x={p.x}
                      y={chartHeight - 8}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="sans-serif"
                    >
                      {formatDate(p.dayOffset)}
                    </text>
                  )}
                </g>
              ))}

              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Month-by-Month Run Rates */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Monthly Run Rates
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Historical pace across Q3 & Q4 2026.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                    <th className="pb-2">Month</th>
                    <th className="pb-2">Sales</th>
                    <th className="pb-2 text-center">Units</th>
                    <th className="pb-2 text-right">Per Day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {monthData.map((m) => (
                    <tr key={m.name} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-900">{m.name}</td>
                      <td className="py-2.5 text-blue-700 font-semibold">{formatCurrency(m.sa)}</td>
                      <td className="py-2.5 text-center">{m.un}</td>
                      <td className="py-2.5 text-right text-slate-600">{formatCurrency(m.perDay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>October data reflects active daily tracking up to Day #{endOffset}.</span>
          </div>
        </div>
      </div>

      {/* Main Push & Store Gaps Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Push Progress Card - Designed directly from Master Series & Gemini code */}
        <MainPushCard
          sales={sales}
          staffList={staffList}
          endOffset={endOffset}
          mainPushTargets={mainPushTargets}
          mainPushVariants={mainPushVariants}
          mainPushDividers={mainPushDividers}
          onUpdateMainPushTargets={onUpdateMainPushTargets}
          onResetMainPushTargets={onResetMainPushTargets}
          onDeleteTarget={onDeleteMainPushTarget}
          onAddSale={onAddSale}
          onOpenExcelImport={onUpdateMainPushTargets ? () => setIsImportTargetsOpen(true) : undefined}
          onOpenFullModal={() => setIsMainPushModalOpen(true)}
        />

        {/* Inventory Watch Only OR Flight Weather Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 flex flex-col justify-between">
          <div>
            {/* Top Mode Selector Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                {watchMode === 'inventory' ? (
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                    <Package className="w-4 h-4 text-amber-600" />
                  </div>
                ) : (
                  <div className="relative w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                    <Cloud className="w-4 h-4 text-blue-600 animate-pulse" />
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      {watchMode === 'inventory'
                        ? 'Inventory Watch & Stock Depletion'
                        : 'SM Dasmariñas Flight Weather & Flyability'}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    {watchMode === 'inventory'
                      ? 'Critical stock-outs, backroom low stock rationing & reorder thresholds'
                      : 'Live Cavite UAV flying conditions, wind resistance limits & pilot telemetry'}
                  </p>
                </div>
              </div>

              {/* Segmented Mode Toggle: Inventory Watch Only vs Weather */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectWatchMode('inventory')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    watchMode === 'inventory'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-amber-600" />
                  <span>Inventory Watch Only</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-extrabold ml-0.5">
                    {allInventoryItems.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectWatchMode('weather')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    watchMode === 'weather'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  <span>Weather</span>
                  <span className="flex h-2 w-2 relative ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </button>
              </div>
            </div>

            {/* VIEW 1: INVENTORY WATCH ONLY */}
            {watchMode === 'inventory' && (
              <div className="space-y-4">
                {/* Inventory Health Quick Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                    <div className="text-[11px] font-semibold text-rose-700">Out of Stock (0)</div>
                    <div className="text-lg font-black text-rose-950 mt-0.5">
                      {invCounts.outOfStock} SKUs
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="text-[11px] font-semibold text-amber-800">Low Stock (≤2)</div>
                    <div className="text-lg font-black text-amber-950 mt-0.5">
                      {invCounts.lowStock} SKUs
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-600">Total Units in Stock</div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">
                      {stockMetrics.totalUnitsInStock} units
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-600">Stock Valuation</div>
                    <div className="text-sm font-black text-blue-700 mt-1 truncate">
                      {formatCurrency(stockMetrics.totalSrpValue)}
                    </div>
                  </div>
                </div>

                {/* Filter Pills, Search Bar & Add Button */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInvFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          invFilter === 'all'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All Stock ({invCounts.all})
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvFilter('out_of_stock')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          invFilter === 'out_of_stock'
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                        }`}
                      >
                        Out of Stock ({invCounts.outOfStock})
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvFilter('low_stock')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          invFilter === 'low_stock'
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        Low Stock ({invCounts.lowStock})
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvFilter('logistics')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          invFilter === 'logistics'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                        }`}
                      >
                        Logistics ({invCounts.logistics})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddingInvNote(!isAddingInvNote)}
                      className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {isAddingInvNote ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      <span>{isAddingInvNote ? 'Cancel' : '+ Stock Note'}</span>
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search stock alerts (e.g., OM8, Pocket 3, Air 3S, Mic 2, battery)..."
                      value={invSearch}
                      onChange={(e) => setInvSearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                    {invSearch && (
                      <button
                        type="button"
                        onClick={() => setInvSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Add Stock Note Form */}
                {isAddingInvNote && (
                  <form
                    onSubmit={handleAddInvNote}
                    className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2.5 animate-in fade-in duration-150 text-xs"
                  >
                    <div className="font-bold text-amber-900 flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-700" />
                      <span>Record Floor Stock Memo / Customer Hold</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                          SKU / Product Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Osmo Action 5 Pro Standard Combo"
                          value={newInvSku}
                          onChange={(e) => setNewInvSku(e.target.value)}
                          className="w-full px-2.5 py-1 bg-white border border-amber-300 rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                          Units on Hand
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={newInvUnits}
                          onChange={(e) => setNewInvUnits(Number(e.target.value))}
                          className="w-full px-2.5 py-1 bg-white border border-amber-300 rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                        Stock Observation / Notes
                      </label>
                      <textarea
                        required
                        rows={2}
                        placeholder="e.g. Only 1 unit left on shelf. Customer reservation holds until 5:00 PM."
                        value={newInvSummary}
                        onChange={(e) => setNewInvSummary(e.target.value)}
                        className="w-full px-2.5 py-1 bg-white border border-amber-300 rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingInvNote(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold cursor-pointer"
                      >
                        Save Stock Note
                      </button>
                    </div>
                  </form>
                )}

                {/* Active Undo Banner */}
                {lastDeletedItem && (
                  <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
                    <span className="flex items-center gap-1.5 truncate">
                      <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="truncate">Dismissed "{lastDeletedItem.name}"</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRestoreItem(lastDeletedItem.id)}
                      className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white font-bold rounded text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0 ml-2"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                  </div>
                )}

                {/* Swipe Guidance & Restore Action Bar */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5 pt-0.5">
                  <span className="flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3 text-slate-400 animate-pulse" />
                    <span>Swipe left on any alert to delete</span>
                  </span>
                  {dismissedItemIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRestoreAll}
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore {dismissedItemIds.length} deleted</span>
                    </button>
                  )}
                </div>

                {/* Stock Watch List Feed with Swipe-to-Delete */}
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {filteredInventoryItems.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <Package className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                      <div className="text-xs font-bold text-slate-700">No matching stock items</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {dismissedItemIds.length > 0
                          ? 'Some alerts have been deleted. Click restore above to bring them back.'
                          : 'Try searching for another product name or reset filters.'}
                      </div>
                      {dismissedItemIds.length > 0 && (
                        <button
                          type="button"
                          onClick={handleRestoreAll}
                          className="mt-2.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-blue-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Restore All Deleted Alerts ({dismissedItemIds.length})
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredInventoryItems.map((item) => {
                      const isOutOfStock = item.type === 'out_of_stock' || item.unitsOnHand === 0;
                      const isLowStock = item.type === 'low_stock';

                      return (
                        <SwipeableCard
                          key={item.id}
                          id={item.id}
                          onDelete={handleDeleteItem}
                        >
                          <div
                            className={`p-3.5 rounded-xl border transition-all ${
                              isOutOfStock
                                ? 'bg-rose-50/60 border-rose-200 border-l-4 border-l-rose-600 text-rose-950'
                                : isLowStock
                                ? 'bg-amber-50/60 border-amber-200 border-l-4 border-l-amber-500 text-amber-950'
                                : 'bg-slate-50 border-slate-200 border-l-4 border-l-blue-600 text-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide ${
                                    isOutOfStock
                                      ? 'bg-rose-600 text-white'
                                      : isLowStock
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-blue-600 text-white'
                                  }`}
                                >
                                  {isOutOfStock
                                    ? 'OUT OF STOCK (0)'
                                    : isLowStock
                                    ? `LOW STOCK (${item.unitsOnHand} ON HAND)`
                                    : 'STOCK PROTOCOL'}
                                </span>

                                <span className="text-[10px] font-bold text-slate-600">
                                  {item.series}
                                </span>

                                <span className="text-[10px] text-slate-400">·</span>

                                <span className="text-[10px] text-slate-500">
                                  {item.time}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item.id);
                                }}
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md hover:bg-black/5 cursor-pointer shrink-0"
                                title="Swipe left or click to delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="font-bold text-xs text-slate-900 mb-1 leading-snug">
                              {item.skuName}
                            </div>

                            <div className="text-xs text-slate-700 leading-relaxed">
                              {item.summary}
                            </div>

                            {item.actionGuidance && (
                              <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-white/90 border border-slate-200/80 text-[11px] font-semibold text-slate-800 flex items-center gap-1.5 shadow-2xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>{item.actionGuidance}</span>
                              </div>
                            )}
                          </div>
                        </SwipeableCard>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: FLIGHT WEATHER & FLYABILITY */}
            {watchMode === 'weather' && (
              <div className="space-y-4">
                {/* Main Flyability Status Banner */}
                <div className={`p-4 rounded-xl border ${flyabilityVerdict.cardBg}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 pb-2.5 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wide ${flyabilityVerdict.badgeClass}`}
                      >
                        {flyabilityVerdict.level === 'OPTIMAL'
                          ? 'OPTIMAL FLIGHT CONDITIONS'
                          : flyabilityVerdict.level === 'CAUTION'
                          ? 'CAUTION: MODERATE GUSTS'
                          : 'FLIGHTS GROUNDED'}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        SM City Dasmariñas, Cavite
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        {weatherData.updatedAt}
                      </span>
                      <button
                        type="button"
                        onClick={fetchWeather}
                        disabled={isLoadingWeather}
                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-white/60 rounded-md transition-colors cursor-pointer"
                        title="Refresh live weather"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeather ? 'animate-spin text-blue-600' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs font-medium leading-relaxed">
                    {flyabilityVerdict.advice}
                  </p>
                </div>

                {/* 4-Stat Live Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-0.5">
                      <Wind className="w-3.5 h-3.5 text-blue-600" />
                      <span>Wind Speed</span>
                    </div>
                    <div className="text-lg font-black text-slate-900">
                      {weatherData.windSpeedMs} m/s
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {weatherData.windSpeedKm} km/h · Gusts {weatherData.windGustsMs} m/s
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-0.5">
                      <Thermometer className="w-3.5 h-3.5 text-rose-600" />
                      <span>Temperature</span>
                    </div>
                    <div className="text-lg font-black text-slate-900">
                      {weatherData.temp}°C
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Feels like {weatherData.apparentTemp}°C · {weatherData.humidity}% humidity
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-0.5">
                      <CloudRain className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Precipitation</span>
                    </div>
                    <div className="text-lg font-black text-slate-900">
                      {weatherData.precipitation.toFixed(1)} mm
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Cloud cover: {weatherData.cloudCover}%
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-0.5">
                      <Compass className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Pilot KP Index</span>
                    </div>
                    <div className="text-lg font-black text-emerald-700">
                      KP 1.8 Quiet
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      GPS Lock &lt; 40s (18-22 sats)
                    </div>
                  </div>
                </div>

                {/* DJI Model Wind Resistance Limit Checker */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5 text-blue-600" />
                      <span>DJI Fleet Wind Resistance Limits vs Current Wind ({weatherData.windSpeedMs} m/s)</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">Official DJI Specs</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* DJI Neo */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-slate-800">
                          DJI Neo <span className="text-slate-500 font-normal">(Max: 8.0 m/s · Level 4)</span>
                        </span>
                        <span className={`font-bold text-[11px] ${weatherData.windSpeedMs <= 6.0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {weatherData.windSpeedMs <= 8.0 ? '✓ SAFE' : '⚠ RESTRICT'} ({Math.min(100, Math.round((weatherData.windSpeedMs / 8.0) * 100))}% of limit)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            weatherData.windSpeedMs <= 6.0 ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, (weatherData.windSpeedMs / 8.0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* DJI Mini 4 Pro / Mini 4K */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-slate-800">
                          DJI Mini 4 Pro & Mini 4K <span className="text-slate-500 font-normal">(Max: 10.7 m/s · Level 5)</span>
                        </span>
                        <span className="font-bold text-[11px] text-emerald-700">
                          ✓ SAFE ({Math.min(100, Math.round((weatherData.windSpeedMs / 10.7) * 100))}% of limit)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, (weatherData.windSpeedMs / 10.7) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* DJI Air 3S / Mavic 3 Pro */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-slate-800">
                          DJI Air 3S & Mavic 3 Pro <span className="text-slate-500 font-normal">(Max: 12.0 m/s · Level 6)</span>
                        </span>
                        <span className="font-bold text-[11px] text-emerald-700">
                          ✓ ROCK SOLID ({Math.min(100, Math.round((weatherData.windSpeedMs / 12.0) * 100))}% of limit)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, (weatherData.windSpeedMs / 12.0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* DJI Avata 2 */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-slate-800">
                          DJI Avata 2 (FPV) <span className="text-slate-500 font-normal">(Max: 10.7 m/s · Level 5)</span>
                        </span>
                        <span className="font-bold text-[11px] text-emerald-700">
                          ✓ SAFE FOR NORMAL & ACRO ({Math.min(100, Math.round((weatherData.windSpeedMs / 10.7) * 100))}% of limit)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, (weatherData.windSpeedMs / 10.7) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Store Action & Flight Cage Readiness */}
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Store Flight Guidance: </span>
                    {weatherData.cloudCover < 40
                      ? 'Bright daylight over Cavite. Recommend pitching ND16 or ND32 filters for customers purchasing Mini 4 Pro, Air 3S, or Osmo Pocket 3.'
                      : 'Diffused sky conditions. Standard UV filter or ND8 recommended. Cyberzone Flight Cage Station 1 ready for walk-in test flights.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leads Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Customer Leads & Foot Traffic ({periodRange.lb})
            </h3>
            <p className="text-xs text-slate-500">
              Conversion efficiency: device units sold per qualified lead.
            </p>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
            {leadsSummary.loggedDaysCount} day(s) with logged leads
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Walk-in</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {leadsSummary.walkIn}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Revisit</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {leadsSummary.revisit}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Online</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {leadsSummary.online}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Units / Lead</div>
            <div className="text-xl font-bold text-blue-600 mt-1">
              {leadsSummary.unitsPerLead}
            </div>
          </div>
        </div>

        {leadsSummary.total > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-2 px-3">Promoter</th>
                  <th className="py-2 px-3">Walk-in</th>
                  <th className="py-2 px-3">Revisit</th>
                  <th className="py-2 px-3">Online</th>
                  <th className="py-2 px-3 font-bold text-slate-900">Total Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {Object.keys(leadsSummary.perPromoter)
                  .sort()
                  .map((k) => {
                    const row = leadsSummary.perPromoter[k];
                    const name = k === 'u' ? 'Not tagged' : staffList[Number(k)] || `Staff #${k}`;
                    return (
                      <tr key={k} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{name}</td>
                        <td className="py-2 px-3">{row[0]}</td>
                        <td className="py-2 px-3">{row[1]}</td>
                        <td className="py-2 px-3">{row[2]}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {row[0] + row[1] + row[2]}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Push Target & Promoter Performance Breakdown Modal */}
      <MainPushBreakdownModal
        isOpen={isMainPushModalOpen}
        onClose={() => setIsMainPushModalOpen(false)}
        sales={sales}
        staffList={staffList}
        promoterMonthlyTargets={promoterMonthlyTargets}
        endOffset={endOffset}
        mainPushTargets={mainPushTargets}
        mainPushVariants={mainPushVariants}
        mainPushDividers={mainPushDividers}
        onUpdateMainPushTargets={onUpdateMainPushTargets}
        onResetMainPushTargets={onResetMainPushTargets}
        onDeleteTarget={onDeleteMainPushTarget}
      />

      {/* Edit Main Push Targets & Subvariants Modal */}
      {onUpdateMainPushTargets && (
        <EditMainPushTargetsModal
          isOpen={isEditTargetsOpen}
          onClose={() => setIsEditTargetsOpen(false)}
          currentTargets={mainPushTargets || {}}
          currentVariants={mainPushVariants || {}}
          currentDividers={mainPushDividers || {}}
          onSaveTargets={onUpdateMainPushTargets}
          onResetTargets={onResetMainPushTargets}
          onDeleteTarget={onDeleteMainPushTarget}
          soldByModel={soldByModelMap}
          activeMonthName={`${monthData[monthData.length - 1]?.name || 'Current Month'} ${currentYear}`}
        />
      )}

      {/* Import Main Push Targets Modal (Excel Template) */}
      {onUpdateMainPushTargets && (
        <ImportMainPushTargetsModal
          isOpen={isImportTargetsOpen}
          onClose={() => setIsImportTargetsOpen(false)}
          currentTargets={mainPushTargets || {}}
          onUpdateTargets={onUpdateMainPushTargets}
          onResetTargets={onResetMainPushTargets}
        />
      )}
    </div>
  );
};
