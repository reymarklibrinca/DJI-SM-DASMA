import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Calendar,
  Lock,
  Unlock,
  Users,
  ShoppingBag,
  Target,
  Share2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { DAYS_OF_WEEK, DJI_DATA, MAIN_PUSH_TARGETS, LEAD_TYPE_NAMES } from '../data/initialData';
import { SaleTuple } from '../types';
import {
  aggregateSales,
  calculatePercentChange,
  calculatePeriodTarget,
  dayOffsetToDate,
  formatCurrency,
  formatDate,
  formatISODate,
  formatNumber,
  getLeadsForDay,
  getMonthKey,
  generateDailyReportText,
} from '../utils/calculations';
import { MainPushBreakdownModal } from './MainPushBreakdownModal';

interface DailyReportTabProps {
  isTodayMode: boolean;
  selectedDayOffset: number;
  onSelectDayOffset: (offset: number) => void;
  sales: SaleTuple[];
  staffList: string[];
  finalizedDays: Record<number, { at: string; sa: number; un: number }>;
  dailyGoal: number;
  promoterMonthlyTargets: Record<number, number>;
  localLeads: Record<number, Record<string, [number, number, number]>>;
  onToggleFinalize: (dayOffset: number) => void;
  onResetLeads?: (dayOffset: number) => void;
}

export const DailyReportTab: React.FC<DailyReportTabProps> = ({
  isTodayMode,
  selectedDayOffset,
  onSelectDayOffset,
  sales,
  staffList,
  finalizedDays,
  dailyGoal,
  promoterMonthlyTargets,
  localLeads,
  onToggleFinalize,
  onResetLeads,
}) => {
  const [copied, setCopied] = useState(false);
  const [isMainPushModalOpen, setIsMainPushModalOpen] = useState(false);
  const [isConfirmingResetLeads, setIsConfirmingResetLeads] = useState(false);

  const targetDate = dayOffsetToDate(selectedDayOffset);
  const dayOfWeekName = DAYS_OF_WEEK[targetDate.getDay()];
  const isoDateStr = formatISODate(selectedDayOffset);

  // Computations for this day
  const dayAgg = aggregateSales(sales, selectedDayOffset, selectedDayOffset);
  const prevDayAgg = aggregateSales(
    sales,
    Math.max(0, selectedDayOffset - 1),
    Math.max(0, selectedDayOffset - 1)
  );

  // Month to date
  let monthStart = selectedDayOffset;
  while (monthStart > 0 && getMonthKey(monthStart - 1) === getMonthKey(selectedDayOffset)) {
    monthStart--;
  }
  const mtdAgg = aggregateSales(sales, monthStart, selectedDayOffset);

  const achievementPct = dailyGoal > 0 ? (dayAgg.sa / dailyGoal) * 100 : 0;
  const salesChange = calculatePercentChange(dayAgg.sa, prevDayAgg.sa);
  const unitsChange = calculatePercentChange(dayAgg.un, prevDayAgg.un);

  // Target Pace
  const totalStoreMonthlyQuota = staffList.reduce(
    (acc, _, idx) => acc + (promoterMonthlyTargets[idx] ?? 2400000),
    0
  );
  const mtdExpectedPace = staffList.reduce(
    (acc, _, idx) =>
      acc + calculatePeriodTarget(promoterMonthlyTargets[idx] ?? 2400000, monthStart, selectedDayOffset),
    0
  );
  const pacePct = mtdExpectedPace > 0 ? (mtdAgg.sa / mtdExpectedPace) * 100 : 0;
  const quotaPct = totalStoreMonthlyQuota > 0 ? (mtdAgg.sa / totalStoreMonthlyQuota) * 100 : 0;

  // Leads for this day
  const dayLeadsMap = getLeadsForDay(selectedDayOffset, localLeads);
  const totalDayLeads: [number, number, number] = [0, 0, 0];
  Object.values(dayLeadsMap).forEach((counts) => {
    totalDayLeads[0] += counts[0];
    totalDayLeads[1] += counts[1];
    totalDayLeads[2] += counts[2];
  });

  // Items sold on this day
  const itemsSoldToday = sales.filter((s) => s[0] === selectedDayOffset && !s[5]);

  // Share report text
  const shareText = generateDailyReportText(selectedDayOffset, sales, dailyGoal, staffList);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isFinalized = Boolean(finalizedDays[selectedDayOffset]);

  const unitsMap = useMemo(() => {
    const map = new Map<string, string>();
    DJI_DATA.units.forEach((u) => {
      map.set(u[0].toUpperCase(), u[1]);
    });
    return map;
  }, []);

  const getProductName = (sale: SaleTuple) => {
    const sn = sale[6]?.toUpperCase();
    if (sn && unitsMap.has(sn)) {
      return unitsMap.get(sn)!;
    }
    const series = DJI_DATA.ser[sale[2]];
    const stockMatch = DJI_DATA.stock.find((st) => st[0] === series && st[2] === sale[3]);
    return stockMatch ? stockMatch[1] : series;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {isTodayMode ? "Today's Operations" : 'Daily Report Review'}
                </h2>
                {isFinalized ? (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Finalized at {finalizedDays[selectedDayOffset].at}
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                    <Unlock className="w-3 h-3" />
                    Draft / Open
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatDate(selectedDayOffset)} ({dayOfWeekName}) · Day #{selectedDayOffset}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isTodayMode && (
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => onSelectDayOffset(Math.max(0, selectedDayOffset - 1))}
                  className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={isoDateStr}
                  onChange={(e) => onSelectDayOffset(Math.max(0, new Date(e.target.value).getTime()))}
                  className="px-2 py-1 bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                />
                <button
                  onClick={() => onSelectDayOffset(selectedDayOffset + 1)}
                  className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => onToggleFinalize(selectedDayOffset)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                isFinalized
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isFinalized ? 'Reopen Day' : 'Finalize Day'}
            </button>
          </div>
        </div>
      </div>

      {/* Day Performance Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* STD */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Sales to Date (STD)
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(dayAgg.sa)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <span
              className={`font-bold ${salesChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              {salesChange >= 0 ? `▲ +${salesChange.toFixed(1)}%` : `▼ ${salesChange.toFixed(1)}%`}
            </span>
            <span>vs previous day</span>
          </div>
        </div>

        {/* Units Sold */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Units Sold Today
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {dayAgg.un} <span className="text-sm font-normal text-slate-500">units</span>
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <span
              className={`font-bold ${unitsChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              {unitsChange >= 0 ? `▲ +${unitsChange.toFixed(0)}` : `▼ ${unitsChange.toFixed(0)}`}
            </span>
            <span>vs previous day</span>
          </div>
        </div>

        {/* Daily Quota Achievement */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Daily Target Achievement
          </div>
          <div className="text-2xl font-black text-blue-600 tracking-tight">
            {achievementPct.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Target: <strong>{formatCurrency(dailyGoal)}</strong>
          </div>
        </div>

        {/* Month to Date */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Month to Date (MTD)
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(mtdAgg.sa)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            <strong>{pacePct.toFixed(0)}%</strong> of pace · <strong>{quotaPct.toFixed(0)}%</strong> of month
          </div>
        </div>
      </div>

      {/* Promoters & Items Sold Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Promoters Performance Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">
                Promoter Performance for {formatDate(selectedDayOffset)}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsMainPushModalOpen(true)}
              className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Main Push Targets & Remaining ➔</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Promoter</th>
                  <th className="py-2.5 px-3">Today STD</th>
                  <th className="py-2.5 px-3 text-center">Units</th>
                  <th className="py-2.5 px-3">Month to Date</th>
                  <th className="py-2.5 px-3 text-right">Quota ACH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {staffList.map((staffName, i) => {
                  const std = dayAgg.st[i][0];
                  const units = dayAgg.st[i][1];
                  const mtd = mtdAgg.st[i][0];
                  const monthlyQuota = promoterMonthlyTargets[i] ?? 2400000;
                  const ach = monthlyQuota > 0 ? (mtd / monthlyQuota) * 100 : 0;

                  return (
                    <tr key={staffName} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{staffName}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{formatCurrency(std)}</td>
                      <td className="py-2.5 px-3 text-center">{units}</td>
                      <td className="py-2.5 px-3 font-semibold text-blue-700">{formatCurrency(mtd)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                        {ach.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Items Sold Today */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Items Logged ({itemsSoldToday.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Total: {formatCurrency(dayAgg.sa)}
            </span>
          </div>

          {itemsSoldToday.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No sales recorded for this date yet. Use the Quick Log card to register transactions.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Promoter</th>
                    <th className="py-2 px-3">Item Series</th>
                    <th className="py-2 px-3">Lead Type</th>
                    <th className="py-2 px-3 text-center">Units</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {itemsSoldToday.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-900">{staffList[s[1]]}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{getProductName(s)}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{DJI_DATA.ser[s[2]]}</span>
                          {s[6] && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                SN: {s[6]}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {s[7] !== undefined ? LEAD_TYPE_NAMES[s[7] as 0 | 1 | 2] : '–'}
                      </td>
                      <td className="py-2 px-3 text-center">{s[4] ?? 1}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{formatCurrency(s[3])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Leads & Share-Ready Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads for Day */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-slate-900">
              Customer Leads for {formatDate(selectedDayOffset)}
            </h3>
            {onResetLeads && (
              <div>
                {!isConfirmingResetLeads ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingResetLeads(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                    title="Reset leads for this day"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Leads</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        onResetLeads(selectedDayOffset);
                        setIsConfirmingResetLeads(false);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Confirm Reset?
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingResetLeads(false)}
                      className="px-2 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Foot traffic qualification and digital inquiries.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <div className="text-xs text-slate-500 font-medium">Walk-in</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{totalDayLeads[0]}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <div className="text-xs text-slate-500 font-medium">Revisit</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{totalDayLeads[1]}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <div className="text-xs text-slate-500 font-medium">Online</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{totalDayLeads[2]}</div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-slate-600">
            {Object.entries(dayLeadsMap).map(([staffKey, counts]) => {
              const pName = staffKey === 'u' ? 'Not tagged' : staffList[Number(staffKey)] || `Staff #${staffKey}`;
              return (
                <div key={staffKey} className="flex justify-between py-1 border-b border-slate-100">
                  <span className="font-semibold text-slate-800">{pName}</span>
                  <span>
                    {counts[0]} walk-in · {counts[1]} revisit · {counts[2]} online
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Share-Ready Textarea */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Share-Ready Store Report
                </h3>
                <p className="text-xs text-slate-500">
                  Formatted for management, Telegram, Viber, or SMS group chats.
                </p>
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Report'}</span>
              </button>
            </div>

            <textarea
              readOnly
              rows={11}
              value={shareText}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden leading-relaxed resize-none"
            />
          </div>
        </div>
      </div>

      {/* Main Push Breakdown Modal */}
      <MainPushBreakdownModal
        isOpen={isMainPushModalOpen}
        onClose={() => setIsMainPushModalOpen(false)}
        sales={sales}
        staffList={staffList}
        promoterMonthlyTargets={promoterMonthlyTargets}
        endOffset={selectedDayOffset}
      />
    </div>
  );
};
