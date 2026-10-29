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

export const CARE_INDEX = DJI_DATA.ser.findIndex(
  (s) => s === 'DJI CARE REFRESH SERVICES' || s.includes('CARE REFRESH')
);
export const ACCESSORIES_INDEX = DJI_DATA.ser.findIndex(
  (s) => s === 'ACCESSORIES' || s.includes('ACCESSORIES')
);

// The live promoter roster. The store keeps this in sync so every report indexes
// promoters the same way (reports used to assume the 3 default names and
// crashed or dropped sales once the roster was customised).
let ACTIVE_STAFF: string[] = DJI_DATA.staff;
export function setActiveStaff(list: string[]) {
  if (Array.isArray(list) && list.length > 0) ACTIVE_STAFF = list;
}
export function getActiveStaff(): string[] {
  return ACTIVE_STAFF;
}

// One definition of "hardware sale" shared by sales totals and lead-conversion maths
export function isHardwareSale(s: SaleTuple): boolean {
  const serName = DJI_DATA.ser[s[2]] || '';
  const isCare = s[2] === CARE_INDEX || serName.includes('CARE REFRESH') || serName.includes('SERVICES');
  const isAccessories = serName.includes('ACCESSOR') || s[2] === ACCESSORIES_INDEX;
  return !isCare && !isAccessories;
}

export function aggregateSales(
  sales: SaleTuple[],
  a: number,
  b: number,
  staffList: string[] = getActiveStaff()
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
    if (s[5]) continue; // Held items are not sales yet: excluded from every total, bar and breakdown alike

    const price = s[3];
    const units = s[4] ?? 1;
    const serName = DJI_DATA.ser[s[2]] || '';
    const isCare = s[2] === CARE_INDEX || serName.includes('CARE REFRESH') || serName.includes('SERVICES');
    const isAccessories = serName.includes('ACCESSOR') || s[2] === ACCESSORIES_INDEX;
    const isHardware = !isCare && !isAccessories;

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
        if (s[0] === i && !s[5] && isHardwareSale(s)) {
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

  const effectiveUnits = customUnits !== undefined ? customUnits : DJI_DATA.units;

  if (customUnits !== undefined) {
    // Initialize standard series with 0 so breakdown shows categories even when stock is 0 or empty
    DJI_DATA.ser.forEach((s) => {
      seriesMap[s] = { in: 0, sold: 0 };
    });
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
  staffList: string[] = getActiveStaff(),
  extras: {
    localLeads?: Record<number, Record<string, [number, number, number]>>;
    tasks?: Record<string, boolean[]>;
    routineTotal?: number;
  } = {}
): string {
  const dayAgg = aggregateSales(sales, dayOffset, dayOffset, staffList);
  let monthStart = dayOffset;
  while (monthStart > 0 && getMonthKey(monthStart - 1) === getMonthKey(dayOffset)) {
    monthStart--;
  }
  const mtdAgg = aggregateSales(sales, monthStart, dayOffset, staffList);
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
    lines.push(`STD: ${formatNumber(dayAgg.st[i]?.[0] ?? 0)}`);
    lines.push(`MTD: ${formatNumber(mtdAgg.st[i]?.[0] ?? 0)}`);
    lines.push('');
  });

  const monthPush = calculateMainPushBreakdown(sales, staffList, dayOffsetToDate(dayOffset).getMonth());
  if (monthPush.categories.length > 0) {
    lines.push(`Main Push Targets (${dayOffsetToDate(dayOffset).toLocaleString('en-US', { month: 'long' })})`);
    monthPush.categories.forEach((cat) => {
      lines.push(`${cat.name}: ${cat.storeSold}/${cat.storeTarget}`);
    });
    lines.push('');
  }

  // Leads and routines for the same day, so the report matches what the sales tabs show
  if (extras.localLeads) {
    const [w, r, o] = getDailyTotalLeads(dayOffset, extras.localLeads);
    const total = w + r + o;
    if (total > 0) {
      lines.push('② Leads & Conversion');
      lines.push(`Walk-in: ${w} | Revisit: ${r} | Online: ${o}`);
      lines.push(`Hardware units per lead: ${(dayAgg.hw / total).toFixed(2)}`);
      lines.push('');
    }
  }
  if (extras.tasks && extras.routineTotal) {
    const done = (extras.tasks[dayOffsetToDate(dayOffset).toDateString()] || []).filter(Boolean).length;
    lines.push(`③ Store Routines: ${done}/${extras.routineTotal} done`);
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
  personDivider: number;
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
  'OSMO ACTION 6 SERIES': [
    { label: 'Osmo Action 6 Adventure Combo', rawSerName: 'OSMO ACTION 6 SERIES' },
    { label: 'Osmo Action 6 Street Photography Gift Set', rawSerName: 'OSMO ACTION 6 SERIES' },
    { label: 'Osmo Action 6 Standard Combo', rawSerName: 'OSMO ACTION 6 SERIES' },
    { label: 'Osmo Action 5 PRO Adventure Combo', rawSerName: 'OSMO ACTION 5 PRO SERIES' },
    { label: 'Osmo Action 5 PRO Standard Combo', rawSerName: 'OSMO ACTION 5 PRO SERIES' },
    { label: 'Osmo Action 4 Adventure Combo', rawSerName: 'OSMO ACTION 4 SERIES' },
    { label: 'Osmo Action 4 Standard Combo', rawSerName: 'OSMO ACTION 4 SERIES' },
  ],
  'OSMO POCKET 4 SERIES': [
    { label: 'Osmo Pocket 4 Creator Combo', rawSerName: 'OSMO POCKET 4 SERIES' },
    { label: 'Osmo Pocket 4 Standard Combo', rawSerName: 'OSMO POCKET 4 SERIES' },
    { label: 'Osmo Pocket 4P Vlog Combo', rawSerName: 'OSMO POCKET 4P SERIES' },
    { label: 'Osmo Pocket 4P Standard Combo', rawSerName: 'OSMO POCKET 4P SERIES' },
    { label: 'Osmo Pocket 4P Standard Combo (Pearl White)', rawSerName: 'OSMO POCKET 4P SERIES' },
    { label: 'Osmo Pocket 3 Creator Combo', rawSerName: 'OSMO POCKET 3 SERIES' },
    { label: 'Osmo Pocket 3', rawSerName: 'OSMO POCKET 3 SERIES' },
  ],
  'NEO 2 SERIES': [
    { label: 'DJI NEO 2 MOTION FLY MORE COMBO', rawSerName: 'NEO 2 SERIES' },
    { label: 'DJI NEO 2 FLY MORE COMBO', rawSerName: 'NEO 2 SERIES' },
    { label: 'DJI Neo 2 Fly More Combo (Drone Only)', rawSerName: 'NEO 2 SERIES' },
    { label: 'DJI NEO 2', rawSerName: 'NEO 2 SERIES' },
    { label: 'DJI NEO MOTION FLY MORE COMBO', rawSerName: 'NEO SERIES' },
    { label: 'DJI NEO FLY MORE COMBO', rawSerName: 'NEO SERIES' },
    { label: 'DJI NEO', rawSerName: 'NEO SERIES' },
    { label: 'DJI NEO COMBO (GLOBAL)', rawSerName: 'NEO SERIES' },
  ],
  'MINI 5 PRO SERIES': [
    { label: 'DJI Mini 5 Pro Fly More Combo Plus (DJI RC2)', rawSerName: 'MINI 5 PRO SERIES' },
    { label: 'DJI Mini 5 Pro Fly More Combo (DJI RC2)', rawSerName: 'MINI 5 PRO SERIES' },
    { label: 'DJI Mini 5 Pro Fly More Combo (DJI RC-N3)', rawSerName: 'MINI 5 PRO SERIES' },
    { label: 'DJI Mini 5 Pro', rawSerName: 'MINI 5 PRO SERIES' },
  ],
  'LITO X1 SERIES': [
    { label: 'DJI Lito X1 Fly More Combo Plus (DJI RC 2)', rawSerName: 'LITO X1 SERIES' },
    { label: 'DJI Lito X1 Fly More Combo (DJI RC 2)', rawSerName: 'LITO X1 SERIES' },
    { label: 'DJI Lito X1 Fly More Combo (DJI RC-N3)', rawSerName: 'LITO X1 SERIES' },
    { label: 'DJI Lito X1', rawSerName: 'LITO X1 SERIES' },
    { label: 'DJI Lito 1 Fly More Combo (DJI RC-N3)', rawSerName: 'LITO 1 SERIES' },
    { label: 'DJI Lito 1', rawSerName: 'LITO 1 SERIES' },
  ],
  'AIR 3S SERIES': [
    { label: 'DJI Air 3S Fly More Combo (DJI RC 2)', rawSerName: 'AIR 3S SERIES' },
    { label: 'DJI Air 3S Fly More Combo (DJI RC-N3)', rawSerName: 'AIR 3S SERIES' },
    { label: 'DJI Air 3S (DJI RC-N3)', rawSerName: 'AIR 3S SERIES' },
  ],
  'MAVIC 4 PRO SERIES': [
    { label: 'DJI Mavic 4 Pro 512GB Greator Combo(DJI RC Pro2)', rawSerName: 'MAVIC 4 PRO SERIES' },
    { label: 'DJI Mavic 4 Pro Fly More Combo(DJI RC 2)', rawSerName: 'MAVIC 4 PRO SERIES' },
    { label: 'DJI Mavic 4 Pro', rawSerName: 'MAVIC 4 PRO SERIES' },
  ],
  'AVATA 360 SERIES': [
    { label: 'DJI Avata 360 (DJI RC 2)', rawSerName: 'AVATA 360 SERIES' },
    { label: 'DJI Avata 360 Fly More Combo (DJI RC 2)', rawSerName: 'AVATA 360 SERIES' },
    { label: 'DJI Avata 360 Motion Fly More Combo (DJI Goggles N3)', rawSerName: 'AVATA 360 SERIES' },
  ],
  'OA Series': [
    { label: 'Osmo Action 6 Adventure Combo', rawSerName: 'OSMO ACTION 6 SERIES' },
    { label: 'Osmo Action 6 Street Photography Gift Set', rawSerName: 'OSMO ACTION 6 SERIES' },
    { label: 'Osmo Action 6 Standard Combo', rawSerName: 'OSMO ACTION 6 SERIES' },
    { label: 'Osmo Action 5 PRO Adventure Combo', rawSerName: 'OSMO ACTION 5 PRO SERIES' },
    { label: 'Osmo Action 5 PRO Standard Combo', rawSerName: 'OSMO ACTION 5 PRO SERIES' },
    { label: 'Osmo Action 4 Adventure Combo', rawSerName: 'OSMO ACTION 4 SERIES' },
    { label: 'Osmo Action 4 Standard Combo', rawSerName: 'OSMO ACTION 4 SERIES' },
  ],
  'Pocket Series': [
    { label: 'Osmo Pocket 4 Creator Combo', rawSerName: 'OSMO POCKET 4 SERIES' },
    { label: 'Osmo Pocket 4 Standard Combo', rawSerName: 'OSMO POCKET 4 SERIES' },
    { label: 'Osmo Pocket 4P Vlog Combo', rawSerName: 'OSMO POCKET 4P SERIES' },
    { label: 'Osmo Pocket 4P Standard Combo', rawSerName: 'OSMO POCKET 4P SERIES' },
    { label: 'Osmo Pocket 4P Standard Combo (Pearl White)', rawSerName: 'OSMO POCKET 4P SERIES' },
    { label: 'Osmo Pocket 3 Creator Combo', rawSerName: 'OSMO POCKET 3 SERIES' },
    { label: 'Osmo Pocket 3', rawSerName: 'OSMO POCKET 3 SERIES' },
  ],
  'NEO Series': [
    { label: 'DJI NEO 2 MOTION FLY MORE COMBO', rawSerName: 'NEO 2 SERIES' },
    { label: 'DJI NEO 2 FLY MORE COMBO', rawSerName: 'NEO 2 SERIES' },
    { label: 'DJI Neo 2 Fly More Combo (Drone Only)', rawSerName: 'NEO 2 SERIES' },
    { label: 'DJI NEO 2', rawSerName: 'NEO 2 SERIES' },
  ],
  'Mini 5 Pro': [
    { label: 'DJI Mini 5 Pro Fly More Combo Plus (DJI RC2)', rawSerName: 'MINI 5 PRO SERIES' },
    { label: 'DJI Mini 5 Pro Fly More Combo (DJI RC2)', rawSerName: 'MINI 5 PRO SERIES' },
    { label: 'DJI Mini 5 Pro Fly More Combo (DJI RC-N3)', rawSerName: 'MINI 5 PRO SERIES' },
    { label: 'DJI Mini 5 Pro', rawSerName: 'MINI 5 PRO SERIES' },
  ],
  'Lito X1': [
    { label: 'DJI Lito X1 Fly More Combo Plus (DJI RC 2)', rawSerName: 'LITO X1 SERIES' },
    { label: 'DJI Lito X1 Fly More Combo (DJI RC 2)', rawSerName: 'LITO X1 SERIES' },
    { label: 'DJI Lito X1 Fly More Combo (DJI RC-N3)', rawSerName: 'LITO X1 SERIES' },
    { label: 'DJI Lito X1', rawSerName: 'LITO X1 SERIES' },
    { label: 'DJI Lito 1 Fly More Combo (DJI RC-N3)', rawSerName: 'LITO 1 SERIES' },
    { label: 'DJI Lito 1', rawSerName: 'LITO 1 SERIES' },
  ],
};

export const DEFAULT_MAIN_PUSH_VARIANTS: Record<string, string[]> = {
  'OSMO ACTION 6 SERIES': [
    'Osmo Action 6 Adventure Combo',
    'Osmo Action 6 Street Photography Gift Set',
    'Osmo Action 6 Standard Combo',
  ],
  'OSMO POCKET 4 SERIES': [
    'Osmo Pocket 4 Creator Combo',
    'Osmo Pocket 4 Standard Combo',
    'Osmo Pocket 4P Vlog Combo',
    'Osmo Pocket 4P Standard Combo',
    'Osmo Pocket 4P Standard Combo (Pearl White)',
    'Osmo Pocket 3 Creator Combo',
    'Osmo Pocket 3',
  ],
  'NEO 2 SERIES': [
    'DJI NEO 2 MOTION FLY MORE COMBO',
    'DJI NEO 2 FLY MORE COMBO',
    'DJI Neo 2 Fly More Combo (Drone Only)',
    'DJI NEO 2',
    'DJI NEO MOTION FLY MORE COMBO',
    'DJI NEO FLY MORE COMBO',
    'DJI NEO',
    'DJI NEO COMBO (GLOBAL)',
  ],
  'MINI 5 PRO SERIES': [
    'DJI Mini 5 Pro Fly More Combo Plus (DJI RC2)',
    'DJI Mini 5 Pro Fly More Combo (DJI RC2)',
    'DJI Mini 5 Pro Fly More Combo (DJI RC-N3)',
    'DJI Mini 5 Pro',
  ],
  'LITO X1 SERIES': [
    'DJI Lito X1 Fly More Combo Plus (DJI RC 2)',
    'DJI Lito X1 Fly More Combo (DJI RC 2)',
    'DJI Lito X1 Fly More Combo (DJI RC-N3)',
    'DJI Lito X1',
    'DJI Lito 1 Fly More Combo (DJI RC-N3)',
    'DJI Lito 1',
  ],
  'AIR 3S SERIES': [
    'DJI Air 3S Fly More Combo (DJI RC 2)',
    'DJI Air 3S Fly More Combo (DJI RC-N3)',
    'DJI Air 3S (DJI RC-N3)',
  ],
  'MAVIC 4 PRO SERIES': [
    'DJI Mavic 4 Pro 512GB Greator Combo(DJI RC Pro2)',
    'DJI Mavic 4 Pro Fly More Combo(DJI RC 2)',
    'DJI Mavic 4 Pro',
  ],
  'AVATA 360 SERIES': [
    'DJI Avata 360 (DJI RC 2)',
    'DJI Avata 360 Fly More Combo (DJI RC 2)',
    'DJI Avata 360 Motion Fly More Combo (DJI Goggles N3)',
  ],
  'OA Series': [
    'Osmo Action 6 Adventure Combo',
    'Osmo Action 6 Street Photography Gift Set',
    'Osmo Action 6 Standard Combo',
  ],
  'Pocket Series': [
    'Osmo Pocket 4 Creator Combo',
    'Osmo Pocket 4 Standard Combo',
    'Osmo Pocket 4P Vlog Combo',
    'Osmo Pocket 4P Standard Combo',
  ],
  'NEO Series': [
    'DJI NEO 2 MOTION FLY MORE COMBO',
    'DJI NEO 2 FLY MORE COMBO',
    'DJI Neo 2 Fly More Combo (Drone Only)',
    'DJI NEO 2',
  ],
  'Mini 5 Pro': [
    'DJI Mini 5 Pro Fly More Combo Plus (DJI RC2)',
    'DJI Mini 5 Pro Fly More Combo (DJI RC2)',
    'DJI Mini 5 Pro Fly More Combo (DJI RC-N3)',
    'DJI Mini 5 Pro',
  ],
  'Lito X1': [
    'DJI Lito X1 Fly More Combo Plus (DJI RC 2)',
    'DJI Lito X1 Fly More Combo (DJI RC 2)',
    'DJI Lito X1 Fly More Combo (DJI RC-N3)',
    'DJI Lito X1',
  ],
};

/**
 * Clean normalized series key: uppercase, alphanumeric only, with common brand prefixes and suffixes stripped.
 * e.g. "NEO 2 SERIES" -> "NEO2"
 *      "NEO SERIES"   -> "NEO"
 *      "OSMO POCKET 4P SERIES" -> "POCKET4P"
 *      "OSMO POCKET 4 SERIES"  -> "POCKET4"
 *      "LITO X1 SERIES" -> "LITOX1"
 *      "LITO 1 SERIES"  -> "LITO1"
 */
export function normalizeSeriesKey(seriesName: string): string {
  if (!seriesName) return '';
  return seriesName
    .toUpperCase()
    .replace(/^DJI\s*/, '')
    .replace(/^OSMO\s*/, '')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^DJI/, '')
    .replace(/^OSMO/, '')
    .replace(/SERIES$|SERIE$/, '');
}

/**
 * Clean normalized product SKU key for exact variant comparisons.
 */
export function normalizeProductKey(prodName: string): string {
  if (!prodName) return '';
  return prodName
    .toUpperCase()
    .replace(/^DJI\s*/, '')
    .replace(/^OSMO\s*/, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Checks if two series names strictly match without partial cross-series bleeding.
 */
export function isSeriesStrictMatch(seriesA: string, seriesB: string): boolean {
  if (!seriesA || !seriesB) return false;
  const kA = normalizeSeriesKey(seriesA);
  const kB = normalizeSeriesKey(seriesB);
  return kA !== '' && kA === kB;
}

export function categorizeMainPushModel(s: SaleTuple, activeCategoryNames?: string[]): string | null {
  const serName = DJI_DATA.ser[s[2]] || '';
  if (!isHardwareUnitItem(serName)) return null;

  const saleSerKey = normalizeSeriesKey(serName);

  // If active targets are provided, strictly match against configured target series first
  if (activeCategoryNames && activeCategoryNames.length > 0) {
    const matched = activeCategoryNames.find((name) => normalizeSeriesKey(name) === saleSerKey);
    if (matched) return matched;
  }

  // Fallback to DJI_DATA.ser canonical series matching
  for (const catName of DJI_DATA.ser) {
    if (isHardwareUnitItem(catName) && normalizeSeriesKey(catName) === saleSerKey) {
      return catName;
    }
  }

  return serName;
}

export function calculateMainPushBreakdown(
  sales: SaleTuple[],
  staffList: string[] = getActiveStaff(),
  monthNum?: number,
  customTargets?: Record<string, number>,
  customVariants?: Record<string, string[]>,
  yearNum?: number,
  customDividers?: Record<string, number>
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
  activeMonthNum: number;
  activeYearNum: number;
} {
  const now = new Date();
  const activeMonthNum = monthNum !== undefined ? monthNum : now.getMonth();
  const activeYearNum = yearNum !== undefined ? yearNum : now.getFullYear();

  // Filter sales dynamically for the targeted month and year
  const currentMonthSales = sales.filter((s) => {
    const d = dayOffsetToDate(s[0]);
    if (yearNum !== undefined) {
      return d.getMonth() === activeMonthNum && d.getFullYear() === activeYearNum;
    }
    return d.getMonth() === activeMonthNum;
  });

  // Default target map following the master series
  const targetMap: Record<string, number> =
    customTargets !== undefined
      ? customTargets
      : {
          'OSMO ACTION 6 SERIES': 54,
          'OSMO POCKET 4 SERIES': 45,
          'NEO 2 SERIES': 18,
          'LITO X1 SERIES': 15,
          'MINI 5 PRO SERIES': 9,
        };

  const defaultPromoterCount = Math.max(staffList.length, 1);

  const categories: MainPushCategoryBreakdown[] = Object.entries(targetMap).map(
    ([name, storeTarget]) => {
      const personDivider = Math.max(1, (customDividers && customDividers[name]) ? customDividers[name] : defaultPromoterCount);
      const targetPerPromoter = Math.round(storeTarget / personDivider);
      const promoters: PromoterModelTarget[] = staffList.map((stName, idx) => ({
        staffIndex: idx,
        name: stName,
        target: targetPerPromoter,
        sold: 0,
        remaining: targetPerPromoter,
        pct: 0,
      }));

      // Candidate variants: lookup in KNOWN_SERIES_VARIANTS or match master products in stock
      const upper = name.toUpperCase();
      const known = KNOWN_SERIES_VARIANTS[name] || KNOWN_SERIES_VARIANTS[upper];
      let candidateVariants: SeriesVariantInfo[] = [];

      if (known && known.length > 0) {
        candidateVariants = [...known];
      } else {
        const stockMatches = DJI_DATA.stock.filter(
          (s) => isSeriesStrictMatch(s[0], name) && isHardwareUnitItem(s[0], s[1])
        );

        if (stockMatches.length > 0) {
          candidateVariants = stockMatches.map((m) => ({ label: m[1], rawSerName: m[0] }));
        } else {
          const matches = DJI_DATA.ser
            .filter((s) => isHardwareUnitItem(s))
            .filter((s) => isSeriesStrictMatch(s, name));
          if (matches.length > 0) {
            candidateVariants = matches.map((m) => ({ label: m, rawSerName: m }));
          } else if (isHardwareUnitItem(name)) {
            candidateVariants = [{ label: name, rawSerName: name }];
          }
        }
      }

      // Merge candidate variants with custom added subvariants
      const selectedList = customVariants?.[name] ?? DEFAULT_MAIN_PUSH_VARIANTS[name];
      const variantLabels = new Set<string>();
      candidateVariants.forEach((v) => variantLabels.add(v.label));
      if (selectedList) {
        selectedList.forEach((v) => variantLabels.add(v));
      }

      const variants: VariantBreakdown[] = Array.from(variantLabels).map((label) => {
        const matchedCandidate = candidateVariants.find((c) => c.label === label);
        return {
          label,
          rawSerName: matchedCandidate ? matchedCandidate.rawSerName : name,
          selected: selectedList ? selectedList.includes(label) : true,
          sold: 0,
        };
      });

      return {
        name,
        storeTarget,
        storeSold: 0,
        storeRemaining: storeTarget,
        storePct: 0,
        targetPerPromoter,
        personDivider,
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

  // Aggregate current month sales with variant matching
  // Aggregate current month sales with zero-overlap, best-match scoring
  currentMonthSales.forEach((s) => {
    if (s[2] === ACCESSORIES_INDEX || s[2] === CARE_INDEX) return;
    const serName = DJI_DATA.ser[s[2]] || '';
    if (!isHardwareUnitItem(serName)) return;

    const u = s[4] ?? 1;
    const sn = s[6] ? s[6].trim().toUpperCase() : '';
    const unitProdName = sn ? (unitsBySn.get(sn) || '') : '';
    const saleSerKey = normalizeSeriesKey(serName);
    const saleProdKey = normalizeProductKey(unitProdName);

    // Identify the single best-matching category and variant among all active target groups
    let bestCat: MainPushCategoryBreakdown | null = null;
    let bestVariant: VariantBreakdown | null = null;
    let bestScore = 0;

    for (const cat of categories) {
      const catKey = normalizeSeriesKey(cat.name);
      const isExactSeries = catKey === saleSerKey;

      for (const variant of cat.variants) {
        const vProdKey = normalizeProductKey(variant.label);
        const vRawKey = normalizeSeriesKey(variant.rawSerName);

        // Product SKU exact match from SN lookup gets highest score
        if (saleProdKey && vProdKey) {
          if (saleProdKey === vProdKey) {
            const score = 110;
            if (score > bestScore) {
              bestScore = score;
              bestCat = cat;
              bestVariant = variant;
            }
          } else if (saleProdKey.includes(vProdKey) || vProdKey.includes(saleProdKey)) {
            const score = 95;
            if (score > bestScore) {
              bestScore = score;
              bestCat = cat;
              bestVariant = variant;
            }
          }
        }

        // Strict series match with variant's source series
        if (isExactSeries && vRawKey === saleSerKey) {
          const score = 80;
          if (score > bestScore) {
            bestScore = score;
            bestCat = cat;
            bestVariant = variant;
          }
        }
      }

      // If category strictly matches the sale's series key
      if (isExactSeries && bestScore < 75) {
        bestScore = 75;
        bestCat = cat;
        bestVariant = cat.variants.find((v) => v.selected) || cat.variants[0] || null;
      }
    }

    // Apply the sale units ONLY to the single winning category (zero overlap or cross-bleeding)
    if (bestCat && bestScore >= 75) {
      if (bestVariant) {
        bestVariant.sold += u;
        if (bestVariant.selected) {
          bestCat.storeSold += u;
          const promoter = bestCat.promoters[s[1]];
          if (promoter) {
            promoter.sold += u;
          }
        }
      } else {
        bestCat.storeSold += u;
        const promoter = bestCat.promoters[s[1]];
        if (promoter) {
          promoter.sold += u;
        }
      }
    }
  });

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
    activeMonthNum,
    activeYearNum,
  };
}

export function calculatePromoterMonthPerformance(
  sales: SaleTuple[],
  staffList: string[] = getActiveStaff(),
  promoterMonthlyTargets: Record<number, number> = { 0: 2400000, 1: 2400000, 2: 2400000 },
  monthNum: number = 9,
  currentDayOffset: number = 83,
  customTargets?: Record<string, number>,
  customVariants?: Record<string, string[]>,
  customDividers?: Record<string, number>
): PromoterMonthlyPerformance[] {
  const octSales = sales.filter((s) => dayOffsetToDate(s[0]).getMonth() === monthNum);

  // October has 31 days
  const currentDate = dayOffsetToDate(currentDayOffset);
  const currentDayOfMonth = currentDate.getMonth() === monthNum ? currentDate.getDate() : 24;
  const daysRemainingInMonth = Math.max(1, 31 - currentDayOfMonth);

  // Get Main Push units per promoter
  const pushData = calculateMainPushBreakdown(sales, staffList, monthNum, customTargets, customVariants, undefined, customDividers);

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

/**
 * Extracts a friendly short / first name from a promoter's display name.
 * Handles "Lee, Christian Joseph" -> "Christian"
 * Handles "Christian Lee" -> "Christian"
 * Handles "Christian" -> "Christian"
 */
export function getPromoterShortName(fullName: string): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (trimmed.includes(',')) {
    const afterComma = trimmed.split(',')[1]?.trim();
    if (afterComma) {
      const firstWord = afterComma.split(/\s+/)[0];
      if (firstWord) return firstWord;
    }
  }
  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord || trimmed;
}

