import { DJI_DATA, DAYS_OF_WEEK } from '../data/initialData';
import { AggregatedData, PeriodRange, SaleTuple, StockSeriesCover, UnitTuple, VariantBreakdown } from '../types';

export const START_DATE = new Date(DJI_DATA.start + 'T00:00:00');

export function dayOffsetToDate(offset: number): Date {
  return new Date(START_DATE.getTime() + offset * 86400000);
}

export function dateToDayOffset(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  d.setHours(0, 0, 0, 0);
  const s = new Date(START_DATE);
  s.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - s.getTime()) / 86400000);
}

export function formatDate(offset: number): string {
  const d = dayOffsetToDate(offset);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatFullDate(offset: number): string {
  const d = dayOffsetToDate(offset);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatISODate(offset: number): string {
  const d = dayOffsetToDate(offset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCurrency(num: number): string {
  return '₱' + Math.round(num).toLocaleString('en-PH');
}

export function formatNumber(num: number): string {
  return Math.round(num).toLocaleString('en-US');
}

export function calculatePercentChange(current: number, prev: number): number {
  if (!prev) return 0;
  return ((current - prev) / prev) * 100;
}

export const CARE_INDEX = DJI_DATA.ser.indexOf('CARE REFRESH');
export const ACCESSORIES_INDEX = DJI_DATA.ser.indexOf('ACCESSORIES');

export function aggregateSales(
  sales: SaleTuple[],
  a: number,
  b: number,
  staffList: string[] = DJI_DATA.staff
): AggregatedData {
  const o: AggregatedData = {
    sa: 0,
    un: 0,
    hw: 0,
    care: 0,
    day: Array(Math.max(0, b - a + 1)).fill(0),
    st: staffList.map(() => [0, 0, 0, 0]),
    ty: staffList.map(() => [[0, 0], [0, 0], [0, 0], [0, 0]]),
    se: {},
    dow: Array(7).fill(0),
    dn: Array(7).fill(0),
  };

  for (let i = a; i <= b; i++) {
    const d = dayOffsetToDate(i);
    o.dn[d.getDay()]++;
  }

  for (const s of sales) {
    const day = s[0];
    if (day < a || day > b) continue;
    if (s[5] && a === b) continue; // Skip hold/hidden on single-day view if flag is set

    const price = s[3];
    const units = s[4] ?? 1;
    const isCare = s[2] === CARE_INDEX;
    const isHardware = !isCare && s[2] !== ACCESSORIES_INDEX;

    o.sa += price;
    o.un += units;

    if (!s[5]) {
      const dayIdx = day - a;
      if (dayIdx >= 0 && dayIdx < o.day.length) {
        o.day[dayIdx] += price;
      }
      o.dow[dayOffsetToDate(day).getDay()] += price;
    }

    if (isCare) o.care += units;
    if (isHardware) o.hw += units;

    const staffIdx = s[1];
    if (staffIdx >= 0 && staffIdx < o.st.length) {
      const staffTotal = o.st[staffIdx];
      const leadTypeIdx = s[7] === undefined ? 3 : s[7];
      const leadItem = o.ty[staffIdx][leadTypeIdx] || (o.ty[staffIdx][leadTypeIdx] = [0, 0]);

      leadItem[0] += price;
      leadItem[1] += units;

      staffTotal[0] += price;
      staffTotal[1] += units;
      if (isCare) staffTotal[2] += units;
      if (isHardware) staffTotal[3] += units;
    }

    const seriesIdx = s[2];
    const seriesItem = o.se[seriesIdx] || (o.se[seriesIdx] = [0, 0]);
    seriesItem[0] += price;
    seriesItem[1] += units;
  }

  return o;
}

export function calculateAttachRate(careUnits: number, hardwareUnits: number): number {
  return hardwareUnits > 0 ? (careUnits / hardwareUnits) * 100 : 0;
}

export function calculatePeriodTarget(monthlyTarget: number, a: number, b: number): number {
  let s = 0;
  for (let i = a; i <= b; i++) {
    const d = dayOffsetToDate(i);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    s += monthlyTarget / daysInMonth;
  }
  return s;
}

export const getMonthKey = (offset: number) => {
  const d = dayOffsetToDate(offset);
  return d.getFullYear() * 12 + d.getMonth();
};

export const getMonthName = (monthKey: number) => {
  const year = Math.floor(monthKey / 12);
  const month = monthKey % 12;
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export function getPeriodRange(
  endOffset: number,
  daysCount: number = 14,
  selectedMonth: number | null = null
): PeriodRange {
  if (selectedMonth === null) {
    return {
      a: endOffset - daysCount + 1,
      b: endOffset,
      pa: endOffset - 2 * daysCount + 1,
      pb: endOffset - daysCount,
      lb: `last ${daysCount} days`,
      pl: `previous ${daysCount} days`,
      np: false,
    };
  }

  let a = 0;
  while (a < endOffset && getMonthKey(a) !== selectedMonth) a++;
  let b = a;
  while (b < endOffset && getMonthKey(b + 1) === selectedMonth) b++;
  const n = b - a + 1;
  let pa = 0;
  while (pa < a && getMonthKey(pa) !== selectedMonth - 1) pa++;
  const np = getMonthKey(pa) !== selectedMonth - 1;

  return {
    a,
    b,
    pa: np ? 0 : pa,
    pb: np ? -1 : Math.min(pa + n - 1, a - 1),
    lb: getMonthName(selectedMonth) + (getMonthKey(b + 1) === selectedMonth ? ` (to ${formatDate(b)})` : ''),
    pl: 'previous month',
    np,
  };
}

export const HARDCODED_LEADS: Record<number, [number, number, number]> = {};

export function getLeadsForDay(
  dayOffset: number,
  localLeads: Record<number, Record<string, [number, number, number]>> = {}
): Record<string, [number, number, number]> {
  const result: Record<string, [number, number, number]> = {};
  if (HARDCODED_LEADS[dayOffset]) {
    result.u = [...HARDCODED_LEADS[dayOffset]];
  }
  const dayLeads = localLeads[dayOffset] || {};
  for (const staffKey in dayLeads) {
    const existing = result[staffKey] || [0, 0, 0];
    const incoming = dayLeads[staffKey];
    result[staffKey] = [
      existing[0] + (incoming[0] || 0),
      existing[1] + (incoming[1] || 0),
      existing[2] + (incoming[2] || 0),
    ];
  }
  return result;
}

export function getDailyTotalLeads(
  dayOffset: number,
  localLeads: Record<number, Record<string, [number, number, number]>> = {}
): [number, number, number] {
  const dayMap = getLeadsForDay(dayOffset, localLeads);
  const totals: [number, number, number] = [0, 0, 0];
  Object.values(dayMap).forEach((counts) => {
    totals[0] += counts[0];
    totals[1] += counts[1];
    totals[2] += counts[2];
  });
  return totals;
}

export function aggregateLeadsOverRange(
  a: number,
  b: number,
  sales: SaleTuple[],
  localLeads: Record<number, Record<string, [number, number, number]>> = {}
) {
  const totals = [0, 0, 0];
  const perPromoter: Record<string, [number, number, number]> = {};
  let hwUnits = 0;
  let loggedDaysCount = 0;

  for (let i = a; i <= b; i++) {
    const dayTotals = getDailyTotalLeads(i, localLeads);
    const sum = dayTotals[0] + dayTotals[1] + dayTotals[2];
    if (sum > 0) {
      loggedDaysCount++;
      const breakdown = getLeadsForDay(i, localLeads);
      for (const k in breakdown) {
        const p = perPromoter[k] || (perPromoter[k] = [0, 0, 0]);
        p[0] += breakdown[k][0];
        p[1] += breakdown[k][1];
        p[2] += breakdown[k][2];
      }
      totals[0] += dayTotals[0];
      totals[1] += dayTotals[1];
      totals[2] += dayTotals[2];

      // Add device sales on days with leads
      sales.forEach((s) => {
        if (s[0] === i && s[2] !== CARE_INDEX && s[2] !== ACCESSORIES_INDEX) {
          hwUnits += s[4] ?? 1;
        }
      });
    }
  }

  const grandTotal = totals[0] + totals[1] + totals[2];
  return {
    walkIn: totals[0],
    revisit: totals[1],
    online: totals[2],
    total: grandTotal,
    hwUnits,
    loggedDaysCount,
    perPromoter,
    unitsPerLead: grandTotal > 0 ? (hwUnits / grandTotal).toFixed(2) : '–',
  };
}

export function calculateStockMetrics(
  sales: SaleTuple[],
  endOffset: number,
  localSales: SaleTuple[] = [],
  customUnits?: UnitTuple[]
): {
  rows: StockSeriesCover[];
  totalUnitsInStock: number;
  totalSrpValue: number;
} {
  const trailing30Agg = aggregateSales(sales, Math.max(0, endOffset - 29), endOffset);
  const seriesMap: Record<string, { in: number; sold: number }> = {};
  let totalUnitsInStock = 0;
  let totalSrpValue = 0;

  const effectiveUnits = customUnits && customUnits.length > 0 ? customUnits : DJI_DATA.units;

  if (customUnits && customUnits.length > 0) {
    // Tally stock directly from effectiveUnits
    effectiveUnits.forEach((u) => {
      const seriesName = u[3] || 'GENERAL';
      const q = seriesMap[seriesName] || (seriesMap[seriesName] = { in: 0, sold: 0 });
      if (u[4] === 'IN STOCK') {
        q.in += 1;
        totalUnitsInStock += 1;
        totalSrpValue += u[2] || 0;
      } else {
        q.sold += 1;
      }
    });
  } else {
    // Base stock from D.stock
    DJI_DATA.stock.forEach((item) => {
      const seriesName = item[0];
      const qty = item[3];
      const price = item[2];
      const q = seriesMap[seriesName] || (seriesMap[seriesName] = { in: 0, sold: 0 });
      q.in += qty;
      totalUnitsInStock += qty;
      totalSrpValue += qty * price;
    });
  }

  // Subtract locally recorded sales if they mapped to an in-stock unit
  const unitsMap = new Map<string, UnitTuple>();
  effectiveUnits.forEach((u) => unitsMap.set(u[0].toUpperCase(), u));

  localSales.forEach((s) => {
    const sn = s[6]?.toUpperCase();
    if (sn && unitsMap.has(sn)) {
      const unit = unitsMap.get(sn)!;
      if (unit[4] === 'IN STOCK' && seriesMap[unit[3]]) {
        seriesMap[unit[3]].in = Math.max(0, seriesMap[unit[3]].in - 1);
        totalUnitsInStock = Math.max(0, totalUnitsInStock - 1);
        totalSrpValue = Math.max(0, totalSrpValue - unit[2]);
      }
    }
  });

  const rows: StockSeriesCover[] = Object.keys(seriesMap).map((seriesName) => {
    const idx = DJI_DATA.ser.indexOf(seriesName);
    const sold30 = idx >= 0 && trailing30Agg.se[idx] ? trailing30Agg.se[idx][1] : 0;
    const inStock = seriesMap[seriesName].in;
    const daysCover = sold30 > 0 ? inStock / (sold30 / 30) : null;
    return {
      n: seriesName,
      in: inStock,
      m: sold30,
      cov: daysCover,
    };
  });

  return {
    rows,
    totalUnitsInStock,
    totalSrpValue,
  };
}

export function generateDailyReportText(
  dayOffset: number,
  sales: SaleTuple[],
  goal: number = 232258,
  staffList: string[] = DJI_DATA.staff
): string {
  const dayAgg = aggregateSales(sales, dayOffset, dayOffset);
  let monthStart = dayOffset;
  while (monthStart > 0 && getMonthKey(monthStart - 1) === getMonthKey(dayOffset)) {
    monthStart--;
  }
  const mtdAgg = aggregateSales(sales, monthStart, dayOffset);
  const achievement = goal > 0 ? (dayAgg.sa / goal) * 100 : 0;
  const dateStr = formatDate(dayOffset).toUpperCase();

  const lines: string[] = [
    `SM DASMA | ${dateStr}`,
    `① Sales & Main Push`,
    `STD: ${formatNumber(dayAgg.sa)}`,
    `MTD: ${formatNumber(mtdAgg.sa)}`,
    `Daily Target: ${formatNumber(goal)}`,
    `Units Sold: ${dayAgg.un}`,
    `ACH: ${achievement.toFixed(2)}%`,
    '',
  ];

  staffList.forEach((staffName, i) => {
    lines.push(staffName.toUpperCase());
    lines.push(`STD: ${formatNumber(dayAgg.st[i][0])}`);
    lines.push(`MTD: ${formatNumber(mtdAgg.st[i][0])}`);
    lines.push('');
  });

  const monthPush = calculateMainPushBreakdown(sales, staffList, dayOffsetToDate(dayOffset).getMonth());
  if (monthPush.categories.length > 0) {
    lines.push('Main Push Targets (October)');
    monthPush.categories.forEach((cat) => {
      lines.push(`${cat.name}: ${cat.storeSold}/${cat.storeTarget}`);
    });
    lines.push('');
  }

  return lines.join('\n').trim();
}

export interface PromoterModelTarget {
  staffIndex: number;
  name: string;
  target: number;
  sold: number;
  remaining: number;
  pct: number;
}

export interface MainPushCategoryBreakdown {
  name: string;
  storeTarget: number;
  storeSold: number;
  storeRemaining: number;
  storePct: number;
  targetPerPromoter: number;
  promoters: PromoterModelTarget[];
  variants: VariantBreakdown[];
}

export interface PromoterMonthlyPerformance {
  staffIndex: number;
  name: string;
  mtdRevenue: number;
  quotaTarget: number;
  remainingRevenue: number;
  quotaPct: number;
  unitsSold: number;
  hardwareUnits: number;
  careUnits: number;
  careAttachRate: number;
  avgTicket: number;
  mainPushUnits: number;
  mainPushTarget: number;
  mainPushRemaining: number;
  mainPushPct: number;
  daysRemaining: number;
  requiredDailyRunRate: number;
}

export interface SeriesVariantInfo {
  label: string;
  rawSerName: string;
}

export interface StockSubvariantItem {
  productName: string; // Subvariant = Unit name from stocks
  seriesName: string;  // Variant = Series name
  price: number;
  inStockCount: number;
  soldCount: number;
}

/**
 * Check if a product/series is an actual hardware unit (camera, drone, gimbal, power station combo),
 * strictly excluding accessories, mounts, cables, batteries, filters, and Care Refresh plans.
 */
export function isHardwareUnitItem(seriesName: string, productName?: string): boolean {
  if (!seriesName) return false;
  const sUpper = seriesName.trim().toUpperCase();
  if (sUpper === 'ACCESSORIES' || sUpper.includes('ACCESSOR')) return false;
  if (sUpper === 'CARE REFRESH' || sUpper.includes('CARE REFRESH')) return false;

  if (productName) {
    const pUpper = productName.trim().toUpperCase();
    if (pUpper.includes('CARE REFRESH')) return false;
    if (
      pUpper.includes('LENS COVER') ||
      pUpper.includes('WRIST STRAP') ||
      pUpper.includes('PROPELLER GUARD') ||
      pUpper.includes('PROPELLERS GUARD') ||
      pUpper.includes('CHARGING HUB') ||
      pUpper.includes('BIKE SEAT RAIL MOUNT') ||
      pUpper.includes('BITE MOUNT') ||
      pUpper.includes('FLEXIBLE MOUNT') ||
      pUpper.includes('HANGING NECK MOUNT') ||
      pUpper.includes('HANDLEBAR MOUNT') ||
      pUpper.includes('ACCESSORY KIT') ||
      pUpper.includes('BLACK MIST FILTER') ||
      pUpper.includes('BATTERY HANDLE') ||
      pUpper.includes('FILL LIGHT') ||
      pUpper.includes('INTELLIGENT FLIGHT BATTERY') ||
      pUpper.includes('EXTREME BATTERY')
    ) {
      return false;
    }
  }

  return true;
}

// Get all unique subvariants (hardware units only) from stock
export function getAllStockSubvariants(): StockSubvariantItem[] {
  return DJI_DATA.stock
    .filter((s) => isHardwareUnitItem(s[0], s[1]))
    .map((s) => ({
      seriesName: s[0],
      productName: s[1],
      price: s[2],
      inStockCount: s[3],
      soldCount: s[4],
    }))
    .sort((a, b) => {
      const sCmp = a.seriesName.localeCompare(b.seriesName);
      if (sCmp !== 0) return sCmp;
      return a.productName.localeCompare(b.productName);
    });
}

// Get all stock subvariants associated with a target focus series (hardware units only)
export function getStockSubvariantsForTarget(targetName: string): StockSubvariantItem[] {
  if (!isHardwareUnitItem(targetName)) {
    return [];
  }
  const upper = targetName.toUpperCase();
  const all = getAllStockSubvariants();

  if (upper.includes('OA') || upper.includes('ACTION')) {
    return all.filter(
      (s) =>
        s.seriesName.includes('ACTION') ||
        s.productName.toUpperCase().includes('ACTION') ||
        s.seriesName.includes('OA')
    );
  }
  if (upper.includes('POCKET')) {
    return all.filter(
      (s) =>
        s.seriesName.includes('POCKET') ||
        s.productName.toUpperCase().includes('POCKET')
    );
  }
  if (upper.includes('MINI 5') || upper.includes('MINI 5 PRO')) {
    return all.filter(
      (s) =>
        s.seriesName.includes('MINI 5') ||
        s.productName.toUpperCase().includes('MINI 5')
    );
  }
  if (upper.includes('MINI')) {
    return all.filter(
      (s) =>
        (s.seriesName.includes('MINI') || s.productName.toUpperCase().includes('MINI')) &&
        !s.seriesName.includes('MIC') &&
        !s.seriesName.includes('POWER')
    );
  }
  if (upper.includes('NEO')) {
    return all.filter(
      (s) =>
        s.seriesName.includes('NEO') ||
        s.productName.toUpperCase().includes('NEO')
    );
  }
  if (upper.includes('LITO')) {
    return all.filter(
      (s) =>
        s.seriesName.includes('LITO') ||
        s.productName.toUpperCase().includes('LITO')
    );
  }

  return all.filter(
    (s) =>
      s.seriesName.toUpperCase().includes(upper) ||
      upper.includes(s.seriesName.toUpperCase()) ||
      s.productName.toUpperCase().includes(upper)
  );
}

export const KNOWN_SERIES_VARIANTS: Record<string, SeriesVariantInfo[]> = {
  'OA Series': [
    { label: 'Osmo Action 6 Adventure Combo', rawSerName: 'ACTION 6' },
    { label: 'Osmo Action 6 Street Photography Gift Set', rawSerName: 'ACTION 6' },
    { label: 'Osmo Action 6 Standard Combo', rawSerName: 'ACTION 6' },
    { label: 'Osmo Action 5 PRO Adventure Combo', rawSerName: 'OSMO ACTION 5 PRO' },
    { label: 'Osmo Action 5 PRO Standard Combo', rawSerName: 'OSMO ACTION 5 PRO' },
    { label: 'Osmo Action 4 Adventure Combo', rawSerName: 'OSMO ACTION 4 SERIES' },
    { label: 'Osmo Action 4 Standard Combo', rawSerName: 'OSMO ACTION 4 SERIES' },
    { label: 'Action 6', rawSerName: 'ACTION 6' },
    { label: 'Action 5', rawSerName: 'OSMO ACTION 5 PRO' },
    { label: 'Action 4', rawSerName: 'OSMO ACTION 4 SERIES' },
  ],
  'ACTION SERIES': [
    { label: 'Osmo Action 6 Adventure Combo', rawSerName: 'ACTION 6' },
    { label: 'Osmo Action 6 Street Photography Gift Set', rawSerName: 'ACTION 6' },
    { label: 'Osmo Action 6 Standard Combo', rawSerName: 'ACTION 6' },
    { label: 'Osmo Action 5 PRO Adventure Combo', rawSerName: 'OSMO ACTION 5 PRO' },
    { label: 'Osmo Action 5 PRO Standard Combo', rawSerName: 'OSMO ACTION 5 PRO' },
    { label: 'Osmo Action 4 Adventure Combo', rawSerName: 'OSMO ACTION 4 SERIES' },
    { label: 'Osmo Action 4 Standard Combo', rawSerName: 'OSMO ACTION 4 SERIES' },
    { label: 'Action 6', rawSerName: 'ACTION 6' },
    { label: 'Action 5', rawSerName: 'OSMO ACTION 5 PRO' },
    { label: 'Action 4', rawSerName: 'OSMO ACTION 4 SERIES' },
  ],
  'Pocket Series': [
    { label: 'Osmo Pocket 4 Creator Combo', rawSerName: 'POCKET 4' },
    { label: 'Osmo Pocket 4 Standard Combo', rawSerName: 'POCKET 4' },
    { label: 'Osmo Pocket 4P Vlog Combo', rawSerName: 'POCKET 4P' },
    { label: 'Osmo Pocket 4P Standard Combo', rawSerName: 'POCKET 4P Standard' },
    { label: 'Osmo Pocket 3 Creator Combo', rawSerName: 'POCKET 3' },
    { label: 'Osmo Pocket 3', rawSerName: 'POCKET 3' },
    { label: 'Pocket 4', rawSerName: 'POCKET 4' },
    { label: 'Pocket 3', rawSerName: 'POCKET 3' },
  ],
  'POCKET 4 SERIES': [
    { label: 'Osmo Pocket 4 Creator Combo', rawSerName: 'POCKET 4' },
    { label: 'Osmo Pocket 4 Standard Combo', rawSerName: 'POCKET 4' },
    { label: 'Osmo Pocket 4P Vlog Combo', rawSerName: 'POCKET 4P' },
    { label: 'Osmo Pocket 4P Standard Combo', rawSerName: 'POCKET 4P Standard' },
    { label: 'Osmo Pocket 3 Creator Combo', rawSerName: 'POCKET 3' },
    { label: 'Osmo Pocket 3', rawSerName: 'POCKET 3' },
    { label: 'Pocket 4', rawSerName: 'POCKET 4' },
    { label: 'Pocket 3', rawSerName: 'POCKET 3' },
  ],
  'NEO Series': [
    { label: 'DJI Neo (GL)', rawSerName: 'DJI NEO 2' },
    { label: 'DJI Neo Fly More Combo', rawSerName: 'DJI NEO 2' },
    { label: 'DJI Neo 2', rawSerName: 'DJI NEO 2' },
  ],
  'Mini 5 Pro': [
    { label: 'DJI Mini 5 Pro', rawSerName: 'MINI 5 PRO SERIES' },
    { label: 'DJI Mini 5 Pro Fly More Combo', rawSerName: 'MINI 5 PRO SERIES' },
    { label: 'DJI Mini 5 Pro Fly More Combo (DJI RC 2)', rawSerName: 'MINI 5 PRO SERIES' },
    { label: 'Mini 5 Pro', rawSerName: 'MINI 5 PRO SERIES' },
  ],
  'Lito X1': [
    { label: 'Lito X1', rawSerName: 'LITO X1' },
    { label: 'Lito 1', rawSerName: 'LITO 1' },
  ],
};

export const DEFAULT_MAIN_PUSH_VARIANTS: Record<string, string[]> = {
  'OA Series': [
    'Osmo Action 6 Adventure Combo',
    'Osmo Action 6 Street Photography Gift Set',
    'Osmo Action 6 Standard Combo',
    'Osmo Action 5 PRO Adventure Combo',
    'Osmo Action 5 PRO Standard Combo',
    'Osmo Action 4 Adventure Combo',
    'Osmo Action 4 Standard Combo',
    'Action 6',
    'Action 5',
    'Action 4',
  ],
  'ACTION SERIES': [
    'Osmo Action 6 Adventure Combo',
    'Osmo Action 6 Street Photography Gift Set',
    'Osmo Action 6 Standard Combo',
    'Osmo Action 5 PRO Adventure Combo',
    'Osmo Action 5 PRO Standard Combo',
    'Osmo Action 4 Adventure Combo',
    'Osmo Action 4 Standard Combo',
    'Action 6',
    'Action 5',
    'Action 4',
  ],
  'Pocket Series': [
    'Osmo Pocket 4 Creator Combo',
    'Osmo Pocket 4 Standard Combo',
    'Osmo Pocket 4P Vlog Combo',
    'Osmo Pocket 4P Standard Combo',
    'Osmo Pocket 3 Creator Combo',
    'Osmo Pocket 3',
    'Pocket 4',
    'Pocket 3',
  ],
  'POCKET 4 SERIES': [
    'Osmo Pocket 4 Creator Combo',
    'Osmo Pocket 4 Standard Combo',
    'Osmo Pocket 4P Vlog Combo',
    'Osmo Pocket 4P Standard Combo',
    'Osmo Pocket 3 Creator Combo',
    'Osmo Pocket 3',
    'Pocket 4',
    'Pocket 3',
  ],
  'NEO Series': ['DJI Neo (GL)', 'DJI Neo Fly More Combo', 'DJI Neo 2'],
  'Mini 5 Pro': [
    'DJI Mini 5 Pro',
    'DJI Mini 5 Pro Fly More Combo',
    'DJI Mini 5 Pro Fly More Combo (DJI RC 2)',
    'Mini 5 Pro',
  ],
  'Lito X1': ['Lito X1', 'Lito 1'],
};

export function categorizeMainPushModel(s: SaleTuple): string | null {
  const serName = DJI_DATA.ser[s[2]] || '';
  if (serName.includes('MINI 5 PRO')) return 'Mini 5 Pro';
  if (serName.includes('NEO')) return 'NEO Series';
  if (serName.includes('LITO')) return 'Lito X1';
  if (serName.includes('ACTION')) return 'OA Series';
  if (serName.includes('POCKET')) return 'Pocket Series';
  return null;
}

export function calculateMainPushBreakdown(
  sales: SaleTuple[],
  staffList: string[] = DJI_DATA.staff,
  monthNum: number = 9, // 9 = October
  customTargets?: Record<string, number>,
  customVariants?: Record<string, string[]>
): {
  categories: MainPushCategoryBreakdown[];
  totalStoreTarget: number;
  totalStoreSold: number;
  totalStoreRemaining: number;
  totalStorePct: number;
  totalPerPromoter: {
    staffIndex: number;
    name: string;
    target: number;
    sold: number;
    remaining: number;
    pct: number;
  }[];
} {
  // Store targets from master specification or user custom targets
  // If customTargets is provided by user, respect exactly those keys (allowing targets to be deleted)
  const targetMap: Record<string, number> =
    customTargets !== undefined
      ? customTargets
      : {
          'Mini 5 Pro': 9,
          'NEO Series': 18,
          'Lito X1': 15,
          'OA Series': 54,
          'Pocket Series': 45,
        };

  const promoterCount = Math.max(staffList.length, 1);
  const octSales = sales.filter((s) => dayOffsetToDate(s[0]).getMonth() === monthNum);

  const categories: MainPushCategoryBreakdown[] = Object.entries(targetMap).map(
    ([name, storeTarget]) => {
      const targetPerPromoter = Math.round(storeTarget / promoterCount);
      const promoters: PromoterModelTarget[] = staffList.map((stName, idx) => ({
        staffIndex: idx,
        name: stName,
        target: targetPerPromoter,
        sold: 0,
        remaining: targetPerPromoter,
        pct: 0,
      }));

      // Determine candidate variants for this category
      const known = KNOWN_SERIES_VARIANTS[name];
      let candidateVariants: SeriesVariantInfo[] = [];
      if (known && known.length > 0) {
        candidateVariants = [...known];
      } else {
        const upper = name.toUpperCase();
        const matches = DJI_DATA.ser
          .filter((s) => isHardwareUnitItem(s))
          .filter((s) => s.includes(upper) || upper.includes(s));
        if (matches.length > 0) {
          candidateVariants = matches.map((m) => ({ label: m, rawSerName: m }));
        } else if (isHardwareUnitItem(name)) {
          candidateVariants = [{ label: name, rawSerName: name }];
        }
      }

      // Determine which variants are selected
      const selectedList = customVariants?.[name] ?? DEFAULT_MAIN_PUSH_VARIANTS[name];
      const variants: VariantBreakdown[] = candidateVariants
        .filter((v) => isHardwareUnitItem(v.rawSerName, v.label))
        .map((v) => ({
          label: v.label,
          rawSerName: v.rawSerName,
          selected: selectedList ? selectedList.includes(v.label) : true,
          sold: 0,
        }));

      return {
        name,
        storeTarget,
        storeSold: 0,
        storeRemaining: storeTarget,
        storePct: 0,
        targetPerPromoter,
        promoters,
        variants,
      };
    }
  );

  // Fast map of serial numbers to product names for accurate subvariant matching
  const unitsBySn = new Map<string, string>();
  DJI_DATA.units.forEach((u) => {
    unitsBySn.set(u[0].toUpperCase(), u[1]);
  });

  // Aggregate sales with variant matching (Hardware Units Only - accessories & care refresh strictly excluded)
  octSales.forEach((s) => {
    if (s[2] === ACCESSORIES_INDEX || s[2] === CARE_INDEX) return;
    const serName = DJI_DATA.ser[s[2]] || '';
    if (!isHardwareUnitItem(serName)) return;
    const u = s[4] ?? 1;
    const sn = s[6] ? s[6].trim().toUpperCase() : '';
    const unitProdName = sn ? (unitsBySn.get(sn) || '').toUpperCase() : '';

    for (const cat of categories) {
      let matched = false;

      // Check each variant in the category
      for (const variant of cat.variants) {
        const vRaw = variant.rawSerName.toUpperCase();
        const vLabel = variant.label.toUpperCase();
        const serUpper = serName.toUpperCase();

        const isMatch =
          (unitProdName && (unitProdName === vLabel || unitProdName.includes(vLabel) || vLabel.includes(unitProdName))) ||
          serUpper === vRaw ||
          serUpper === vLabel ||
          serUpper.includes(vRaw) ||
          serUpper.includes(vLabel) ||
          (vLabel.includes('ACTION 4') && serUpper.includes('ACTION 4')) ||
          (vLabel.includes('ACTION 5') && serUpper.includes('ACTION 5')) ||
          (vLabel.includes('ACTION 6') && serUpper.includes('ACTION 6')) ||
          (vLabel.includes('POCKET 3') && serUpper.includes('POCKET 3')) ||
          (vLabel.includes('POCKET 4') && serUpper.includes('POCKET 4')) ||
          (vLabel.includes('MINI 5') && serUpper.includes('MINI 5')) ||
          (vLabel.includes('NEO') && serUpper.includes('NEO')) ||
          (vLabel.includes('LITO') && serUpper.includes('LITO'));

        if (isMatch) {
          // Track sold count on the variant always
          variant.sold += u;

          // Only credit towards category and promoter target if this variant is selected!
          if (variant.selected) {
            cat.storeSold += u;
            const promoter = cat.promoters[s[1]];
            if (promoter) {
              promoter.sold += u;
            }
          }
          matched = true;
          break;
        }
      }

      if (matched) break;
    }
  });

  // Calculate remaining and percentages
  let totalStoreTarget = 0;
  let totalStoreSold = 0;

  const totalPerPromoter = staffList.map((stName, idx) => ({
    staffIndex: idx,
    name: stName,
    target: 0,
    sold: 0,
    remaining: 0,
    pct: 0,
  }));

  categories.forEach((cat) => {
    cat.storeRemaining = Math.max(0, cat.storeTarget - cat.storeSold);
    cat.storePct = cat.storeTarget > 0 ? (cat.storeSold / cat.storeTarget) * 100 : 0;
    totalStoreTarget += cat.storeTarget;
    totalStoreSold += cat.storeSold;

    cat.promoters.forEach((p) => {
      p.remaining = Math.max(0, p.target - p.sold);
      p.pct = p.target > 0 ? (p.sold / p.target) * 100 : 0;

      totalPerPromoter[p.staffIndex].target += p.target;
      totalPerPromoter[p.staffIndex].sold += p.sold;
    });
  });

  const totalStoreRemaining = Math.max(0, totalStoreTarget - totalStoreSold);
  const totalStorePct = totalStoreTarget > 0 ? (totalStoreSold / totalStoreTarget) * 100 : 0;

  totalPerPromoter.forEach((p) => {
    p.remaining = Math.max(0, p.target - p.sold);
    p.pct = p.target > 0 ? (p.sold / p.target) * 100 : 0;
  });

  return {
    categories,
    totalStoreTarget,
    totalStoreSold,
    totalStoreRemaining,
    totalStorePct,
    totalPerPromoter,
  };
}

export function calculatePromoterMonthPerformance(
  sales: SaleTuple[],
  staffList: string[] = DJI_DATA.staff,
  promoterMonthlyTargets: Record<number, number> = { 0: 2400000, 1: 2400000, 2: 2400000 },
  monthNum: number = 9,
  currentDayOffset: number = 83,
  customTargets?: Record<string, number>,
  customVariants?: Record<string, string[]>
): PromoterMonthlyPerformance[] {
  const octSales = sales.filter((s) => dayOffsetToDate(s[0]).getMonth() === monthNum);

  // October has 31 days
  const currentDate = dayOffsetToDate(currentDayOffset);
  const currentDayOfMonth = currentDate.getMonth() === monthNum ? currentDate.getDate() : 24;
  const daysRemainingInMonth = Math.max(1, 31 - currentDayOfMonth);

  // Get Main Push units per promoter
  const pushData = calculateMainPushBreakdown(sales, staffList, monthNum, customTargets, customVariants);

  return staffList.map((name, i) => {
    const quotaTarget = promoterMonthlyTargets[i] ?? 2400000;
    let mtdRevenue = 0;
    let unitsSold = 0;
    let hardwareUnits = 0;
    let careUnits = 0;

    octSales
      .filter((s) => s[1] === i)
      .forEach((s) => {
        mtdRevenue += s[3];
        const u = s[4] ?? 1;
        unitsSold += u;
        if (s[2] === CARE_INDEX) {
          careUnits += u;
        } else if (s[2] !== ACCESSORIES_INDEX) {
          hardwareUnits += u;
        }
      });

    const remainingRevenue = Math.max(0, quotaTarget - mtdRevenue);
    const quotaPct = quotaTarget > 0 ? (mtdRevenue / quotaTarget) * 100 : 0;
    const careAttachRate = calculateAttachRate(careUnits, hardwareUnits);
    const avgTicket = unitsSold > 0 ? mtdRevenue / unitsSold : 0;
    const requiredDailyRunRate = remainingRevenue / daysRemainingInMonth;

    const pushPromoter = pushData.totalPerPromoter[i];
    const mainPushUnits = pushPromoter ? pushPromoter.sold : 0;
    const mainPushTarget = pushPromoter ? pushPromoter.target : 47;
    const mainPushRemaining = pushPromoter ? pushPromoter.remaining : Math.max(0, 47 - mainPushUnits);
    const mainPushPct = mainPushTarget > 0 ? (mainPushUnits / mainPushTarget) * 100 : 0;

    return {
      staffIndex: i,
      name,
      mtdRevenue,
      quotaTarget,
      remainingRevenue,
      quotaPct,
      unitsSold,
      hardwareUnits,
      careUnits,
      careAttachRate,
      avgTicket,
      mainPushUnits,
      mainPushTarget,
      mainPushRemaining,
      mainPushPct,
      daysRemaining: daysRemainingInMonth,
      requiredDailyRunRate,
    };
  });
}

