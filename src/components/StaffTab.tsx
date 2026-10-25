import React from 'react';
import { Users, Target, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';
import { PeriodRange, SaleTuple } from '../types';
import {
  aggregateSales,
  calculateAttachRate,
  calculatePercentChange,
  calculatePeriodTarget,
  formatCurrency,
  aggregateLeadsOverRange,
} from '../utils/calculations';

interface StaffTabProps {
  sales: SaleTuple[];
  periodRange: PeriodRange;
  staffList: string[];
  promoterMonthlyTargets: Record<number, number>;
  onUpdatePromoterTarget: (staffIndex: number, target: number) => void;
  localLeads: Record<number, Record<string, [number, number, number]>>;
}

export const StaffTab: React.FC<StaffTabProps> = ({
  sales,
  periodRange,
  staffList,
  promoterMonthlyTargets,
  onUpdatePromoterTarget,
  localLeads,
}) => {
  const currentAgg = aggregateSales(sales, periodRange.a, periodRange.b, staffList);
  const prevAgg = aggregateSales(sales, periodRange.pa, periodRange.pb, staffList);

  const maxStaffSales = Math.max(...currentAgg.st.map((s) => s[0]), 1);

  // Leaderboard data
  const staffLeaderboard = staffList
    .map((name, i) => {
      const sa = currentAgg.st[i][0];
      const un = currentAgg.st[i][1];
      const care = currentAgg.st[i][2];
      const hw = currentAgg.st[i][3];
      const prevSa = prevAgg.st[i][0];
      const change = calculatePercentChange(sa, prevSa);
      const careAttach = calculateAttachRate(care, hw);

      const monthlyQuota = promoterMonthlyTargets[i] ?? 2400000;
      const periodTarget = calculatePeriodTarget(monthlyQuota, periodRange.a, periodRange.b);
      const quotaAch = periodTarget > 0 ? (sa / periodTarget) * 100 : 0;

      return {
        index: i,
        name,
        sa,
        un,
        care,
        hw,
        change,
        careAttach,
        monthlyQuota,
        periodTarget,
        quotaAch,
      };
    })
    .sort((a, b) => b.sa - a.sa);

  // Leads aggregate for the period
  const leadsData = aggregateLeadsOverRange(periodRange.a, periodRange.b, sales, localLeads);
  const leadCounts = [leadsData.walkIn, leadsData.revisit, leadsData.online];

  // Helper for lead type totals
  const totalUnitsByLeadType = (typeIdx: number) =>
    currentAgg.ty.reduce((acc, staffRow) => acc + staffRow[typeIdx][1], 0);
  const totalAmountByLeadType = (typeIdx: number) =>
    currentAgg.ty.reduce((acc, staffRow) => acc + staffRow[typeIdx][0], 0);

  return (
    <div className="space-y-6">
      {/* Staff Leaderboard */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Promoter Performance & Quotas ({periodRange.lb})
            </h3>
            <p className="text-xs text-slate-500">
              Ranked by revenue contribution. DJI Care attach measures warranty attachment on device sales.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Store Total: <strong className="text-slate-900">{formatCurrency(currentAgg.sa)}</strong> ({currentAgg.un} units)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Rank & Promoter</th>
                <th className="py-3 px-4">Sales Revenue</th>
                <th className="py-3 px-4 w-32">Share</th>
                <th className="py-3 px-4 text-center">Units</th>
                <th className="py-3 px-4 text-center">Care Attach</th>
                <th className="py-3 px-4">vs {periodRange.pl}</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {staffLeaderboard.map((staff, rank) => {
                const sharePct = (staff.sa / maxStaffSales) * 100;
                const isGrowth = staff.change >= 0;

                return (
                  <tr key={staff.name} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            rank === 0
                              ? 'bg-amber-100 text-amber-800'
                              : rank === 1
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rank + 1}
                        </span>
                        <span className="font-bold text-sm text-slate-900">{staff.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">
                      {formatCurrency(staff.sa)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${sharePct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold">{staff.un}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-slate-900">
                        {staff.careAttach.toFixed(0)}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ({staff.care}/{staff.hw})
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {periodRange.np ? (
                        <span className="text-slate-400">–</span>
                      ) : (
                        <span
                          className={`font-bold flex items-center gap-0.5 ${
                            isGrowth ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isGrowth ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {Math.abs(staff.change).toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isGrowth
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {isGrowth ? 'Expanding' : 'Slowing'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Target Achievement Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Monthly Targets & Quota Pacing
            </h3>
            <p className="text-xs text-slate-500">
              Set monthly quota targets per promoter (default: ₱2,400,000 each = ₱7.2M monthly store target).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Promoter</th>
                <th className="py-2.5 px-3">Monthly Target ₱</th>
                <th className="py-2.5 px-3">Target for Period</th>
                <th className="py-2.5 px-3">Actual Sales</th>
                <th className="py-2.5 px-3">Achievement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {staffList.map((name, i) => {
                const target = promoterMonthlyTargets[i] ?? 2400000;
                const periodTarget = calculatePeriodTarget(target, periodRange.a, periodRange.b);
                const salesVal = currentAgg.st[i][0];
                const achPct = periodTarget > 0 ? (salesVal / periodTarget) * 100 : 0;

                return (
                  <tr key={name} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{name}</td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        value={target}
                        onChange={(e) => onUpdatePromoterTarget(i, Number(e.target.value))}
                        className="w-32 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                      {formatCurrency(periodTarget)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {formatCurrency(salesVal)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              achPct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, achPct)}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-900 text-xs">
                          {achPct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales by Lead Type Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="border-b border-slate-100 pb-4 mb-4">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Sales by Lead Source Breakdown ({periodRange.lb})
          </h3>
          <p className="text-xs text-slate-500">
            Cross-tabulation of revenues and units by customer acquisition channel. Older untagged transactions categorized under 'Not tagged'.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Promoter</th>
                <th className="py-3 px-3">Walk-in</th>
                <th className="py-3 px-3">Revisit</th>
                <th className="py-3 px-3">Online</th>
                <th className="py-3 px-3">Not Tagged</th>
                <th className="py-3 px-3 font-bold text-slate-900 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {staffList.map((promoter, i) => (
                <tr key={promoter} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{promoter}</td>
                  {currentAgg.ty[i].map((q, tIdx) => (
                    <td key={tIdx} className="py-2.5 px-3">
                      {q[1] > 0 ? (
                        <span>
                          {formatCurrency(q[0])}{' '}
                          <span className="text-slate-400 text-[11px]">({q[1]})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 font-extrabold text-slate-900 text-right">
                    {formatCurrency(currentAgg.st[i][0])}
                  </td>
                </tr>
              ))}

              {/* Store Total */}
              <tr className="bg-slate-50/70 font-bold border-t-2 border-slate-200">
                <td className="py-3 px-3 text-slate-900">Store Total</td>
                {[0, 1, 2, 3].map((k) => {
                  const amt = totalAmountByLeadType(k);
                  const u = totalUnitsByLeadType(k);
                  return (
                    <td key={k} className="py-3 px-3">
                      {u > 0 ? (
                        <span>
                          {formatCurrency(amt)}{' '}
                          <span className="text-slate-400 text-[11px]">({u})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 px-3 text-right text-blue-700 font-extrabold">
                  {formatCurrency(currentAgg.sa)}
                </td>
              </tr>

              {/* Leads Logged */}
              <tr className="text-slate-500 font-semibold bg-slate-50/30">
                <td className="py-2.5 px-3 text-slate-500">Leads Logged</td>
                {[0, 1, 2].map((k) => (
                  <td key={k} className="py-2.5 px-3 font-bold text-slate-800">
                    {leadCounts[k]}
                  </td>
                ))}
                <td className="py-2.5 px-3">–</td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                  {leadCounts[0] + leadCounts[1] + leadCounts[2]} leads
                </td>
              </tr>

              {/* Units per Lead */}
              <tr className="text-slate-500 font-semibold bg-slate-50/30">
                <td className="py-2.5 px-3 text-slate-500">Units / Lead</td>
                {[0, 1, 2].map((k) => {
                  const leadTotal = leadCounts[k];
                  const unitsTotal = totalUnitsByLeadType(k);
                  return (
                    <td key={k} className="py-2.5 px-3 font-bold text-blue-700">
                      {leadTotal > 0 ? (unitsTotal / leadTotal).toFixed(2) : '–'}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3">–</td>
                <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                  {leadsData.unitsPerLead} avg
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
