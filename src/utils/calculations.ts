import { DJI_DATA, DAYS_OF_WEEK } from '../data/initialData';
import { AggregatedData, PeriodRange, SaleTuple, StockSeriesCover, UnitTuple } from '../types';

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

export const HARDCODED_LEADS: Record<number, [number, number, number]> = {
  83: [5, 0, 1], // Oct 23 report: 5 walk-in, 0 revisit, 1 online
};

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
  localSales: SaleTuple[] = []
): {
  rows: StockSeriesCover[];
  totalUnitsInStock: number;
  totalSrpValue: number;
} {
  const trailing30Agg = aggregateSales(sales, Math.max(0, endOffset - 29), endOffset);
  const seriesMap: Record<string, { in: number; sold: number }> = {};
  let totalUnitsInStock = 0;
  let totalSrpValue = 0;

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

  // Subtract locally recorded sales if they mapped to an in-stock unit
  const unitsMap = new Map<string, UnitTuple>();
  DJI_DATA.units.forEach((u) => unitsMap.set(u[0].toUpperCase(), u));

  localSales.forEach((s) => {
    const sn = s[6]?.toUpperCase();
    if (sn && unitsMap.has(sn)) {
      const unit = unitsMap.get(sn)!;
      if (unit[4] === 'IN STOCK' && seriesMap[unit[3]]) {
        seriesMap[unit[3]].in = Math.max(0, seriesMap[unit[3]].in - 1);
        totalUnitsInStock--;
        totalSrpValue -= unit[2];
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

  if (dayOffset === 83) {
    lines.push('Main Push');
    lines.push('Mini 5 Pro: 6/9');
    lines.push('NEO Series: 10/18');
    lines.push('Lito X1: 7/15');
    lines.push('OA Series: 25/54');
    lines.push('Pocket Series: 13/45');
    lines.push('');
    lines.push('Gap reason: lost sales due to no credit card payment.');
    lines.push('Low or out of stock: OM8, Lito X1 FMC PLUS, Lito X1 FMC RC2.');
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
  monthNum: number = 9 // 9 = October
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
  // Store targets from master specification
  const targetMap: Record<string, number> = {
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

      return {
        name,
        storeTarget,
        storeSold: 0,
        storeRemaining: storeTarget,
        storePct: 0,
        targetPerPromoter,
        promoters,
      };
    }
  );

  // Aggregate sales
  octSales.forEach((s) => {
    const catName = categorizeMainPushModel(s);
    if (!catName) return;
    const cat = categories.find((c) => c.name === catName);
    if (!cat) return;

    const u = s[4] ?? 1;
    cat.storeSold += u;
    const promoter = cat.promoters[s[1]];
    if (promoter) {
      promoter.sold += u;
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
  currentDayOffset: number = 83
): PromoterMonthlyPerformance[] {
  const octSales = sales.filter((s) => dayOffsetToDate(s[0]).getMonth() === monthNum);

  // October has 31 days
  const currentDate = dayOffsetToDate(currentDayOffset);
  const currentDayOfMonth = currentDate.getMonth() === monthNum ? currentDate.getDate() : 24;
  const daysRemainingInMonth = Math.max(1, 31 - currentDayOfMonth);

  // Get Main Push units per promoter
  const pushData = calculateMainPushBreakdown(sales, staffList, monthNum);

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

