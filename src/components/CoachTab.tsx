import React from 'react';
import {
  Lightbulb,
  Sparkles,
  Award,
  Users,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Clock,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { DAYS_OF_WEEK, DJI_DATA } from '../data/initialData';
import { PeriodRange, SaleTuple, StockSeriesCover } from '../types';
import {
  aggregateSales,
  calculateAttachRate,
  calculatePercentChange,
  CARE_INDEX,
  ACCESSORIES_INDEX,
} from '../utils/calculations';

interface CoachTabProps {
  sales: SaleTuple[];
  periodRange: PeriodRange;
  staffList: string[];
  stockMetrics: {
    rows: StockSeriesCover[];
    totalUnitsInStock: number;
    totalSrpValue: number;
  };
}

export const CoachTab: React.FC<CoachTabProps> = ({
  sales,
  periodRange,
  staffList,
  stockMetrics,
}) => {
  const currentAgg = aggregateSales(sales, periodRange.a, periodRange.b, staffList);
  const prevAgg = aggregateSales(sales, periodRange.pa, periodRange.pb, staffList);

  // Staff growth ranking
  const staffByGrowth = staffList
    .map((name, i) => {
      const sa = currentAgg.st[i][0];
      const prevSa = prevAgg.st[i][0];
      const change = calculatePercentChange(sa, prevSa);
      const un = currentAgg.st[i][1];
      const care = currentAgg.st[i][2];
      const hw = currentAgg.st[i][3];
      const attach = calculateAttachRate(care, hw);
      return { index: i, name, sa, prevSa, change, un, care, hw, attach };
    })
    .sort((a, b) => b.change - a.change);

  const starStaff = staffByGrowth[0];
  const supportStaff = staffByGrowth[staffByGrowth.length - 1];

  // Lowest care attach with at least 3 hardware sales
  const eligibleForCareCoach = staffByGrowth
    .filter((s) => s.hw >= 3)
    .sort((a, b) => a.attach - b.attach);
  const lowestCareStaff = eligibleForCareCoach.length > 0 ? eligibleForCareCoach[0] : null;
  const storeCareAttach = calculateAttachRate(currentAgg.care, currentAgg.hw);

  // Product moves: rising and slipping series (excluding accessories and care refresh)
  const productGrowthList = Object.keys(currentAgg.se)
    .map((k) => {
      const idx = Number(k);
      const sa = currentAgg.se[idx][0];
      const prevSa = (prevAgg.se[idx] || [0, 0])[0];
      const change = calculatePercentChange(sa, prevSa);
      return { idx, name: DJI_DATA.ser[idx], sa, prevSa, change };
    })
    .filter(
      (p) =>
        p.prevSa > 0 &&
        p.idx !== CARE_INDEX &&
        p.idx !== ACCESSORIES_INDEX
    )
    .sort((a, b) => b.change - a.change);

  const risingProduct = productGrowthList[0];
  const slippingProduct = productGrowthList[productGrowthList.length - 1];

  // Fast-depleting stock (<14 days cover)
  const lowStockSeries = stockMetrics.rows
    .filter((x) => x.cov !== null && x.cov < 14)
    .sort((a, b) => b.m - a.m)
    .slice(0, 3);

  // Slow stock (5+ units, 0 sales in 30 days)
  const slowStockSeries = stockMetrics.rows
    .filter((x) => x.m === 0 && x.in >= 5)
    .sort((a, b) => b.in - a.in)
    .slice(0, 3);

  // Best day to staff
  const dowAverages = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const total = currentAgg.dow[d];
    const days = currentAgg.dn[d] || 1;
    return { dayIndex: d, name: DAYS_OF_WEEK[d], avg: total / days };
  });
  const bestDay = [...dowAverages].sort((a, b) => b.avg - a.avg)[0];

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Retail Operations Coach
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic operational directives generated from sales velocity, stock cover, and conversion ratios.
            </p>
          </div>
        </div>
      </div>

      {/* Advisory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Star of the Period */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
              <Award className="w-4 h-4" />
              Star of the Period
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-2">
              {starStaff.name} is leading sales growth
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sales revenue grew{' '}
              <strong className={starStaff.change >= 0 ? 'text-emerald-700' : 'text-slate-900'}>
                {Math.abs(starStaff.change).toFixed(1)}%
              </strong>{' '}
              over the previous period. Invite {starStaff.name} to share their closing techniques and customer engagement approach during the Monday 10:00 AM team briefing.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
            Action: 10-minute briefing leadership slot
          </div>
        </div>

        {/* Needs Support */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
              <Users className="w-4 h-4" />
              Target Support & Pairing
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-2">
              Pair {supportStaff.name} for closing roleplay
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Revenue pace changed by{' '}
              <strong className="text-rose-700">
                {supportStaff.change.toFixed(1)}%
              </strong>
              . Pair {supportStaff.name} with {starStaff.name} for 15 minutes of structured handling of price objections and demo-to-close transitions on Osmo Pocket 4 and Action 6.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
            Action: 1-on-1 closing roleplay before noon shift
          </div>
        </div>

        {/* DJI Care Attach */}
        {lowestCareStaff && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                <ShieldCheck className="w-4 h-4" />
                DJI Care Attachment Pitch
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">
                Coaching Opportunity for {lowestCareStaff.name}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Currently attaching DJI Care on{' '}
                <strong className="text-slate-900">
                  {lowestCareStaff.attach.toFixed(0)}%
                </strong>{' '}
                of device sales, compared to the store average of{' '}
                <strong>{storeCareAttach.toFixed(0)}%</strong>. Reinforce the checkout pitch: present accidental flyaway & crash replacement before completing invoice.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
              Action: Practice the 2-sentence Care pitch at point of sale
            </div>
          </div>
        )}

        {/* Product Merchandising Moves */}
        {risingProduct && slippingProduct && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
                <TrendingUp className="w-4 h-4" />
                Floor Merchandising Shifts
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-2">
                Feature {risingProduct.name} on entrance display
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>{risingProduct.name}</strong> is trending up (+{risingProduct.change.toFixed(0)}%): allocate front showcase placement with live demo units on. Conversely,{' '}
                <strong>{slippingProduct.name}</strong> ({slippingProduct.change.toFixed(0)}%) should be bundled with starter kits or promotional accessories.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
              Action: Reorganize display counters for weekend foot traffic
            </div>
          </div>
        )}

        {/* Restock Watch */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 uppercase tracking-wider mb-2">
              <AlertTriangle className="w-4 h-4" />
              Priority Restock Requisition
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-2">
              Critical low-cover series (&lt;14 Days)
            </h4>
            {lowStockSeries.length > 0 ? (
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                {lowStockSeries.map((s) => (
                  <li key={s.n}>
                    <strong className="text-slate-900">{s.n}</strong>: {s.in} units remaining, approx.{' '}
                    <strong>{Math.round(s.cov!)} days</strong> of cover at current run-rate.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600">
                All fast-selling series have healthy buffer stock exceeding 14 days.
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
            Action: Submit replenishment order to DJI distributor warehouse
          </div>
        </div>

        {/* Slow Stock Activation */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <Clock className="w-4 h-4" />
              Slow Inventory Activation
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-2">
              Items with 0 sales in past 30 days
            </h4>
            {slowStockSeries.length > 0 ? (
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                {slowStockSeries.map((s) => (
                  <li key={s.n}>
                    <strong className="text-slate-900">{s.n}</strong>: {s.in} units sitting idle. Set up hands-on demonstration or attach freebie accessory.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600">
                Healthy turnover across all stocked series.
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
            Action: Introduce bundle discount or floor demonstration
          </div>
        </div>

        {/* Best Day to Staff */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">
              <Calendar className="w-4 h-4" />
              Peak Roster Optimization
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-2">
              {bestDay?.name} has the highest average volume
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Historical records show <strong>{bestDay?.name}</strong> averages the highest sales volume per shift. Keep your highest-converting closers rostered on this day and schedule stock counting on slower weekdays (e.g. Tuesdays/Wednesdays).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
            Action: Align shift schedules with foot-traffic peaks
          </div>
        </div>

        {/* Card Terminal Payment Audit */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 uppercase tracking-wider mb-2">
              <CreditCard className="w-4 h-4" />
              Payment Friction Prevention
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-2">
              POS Card Terminal & Installment Check
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              The Oct 23 report specifically documented sales lost due to lack of working credit card terminal connectivity. All promoters must perform a test connection with Maya / BDO terminals and verify 0% installment tiers at 10:00 AM opening.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
            Action: Add terminal test to morning routine checklist
          </div>
        </div>
      </div>
    </div>
  );
};
