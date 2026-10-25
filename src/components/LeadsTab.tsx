import React, { useState } from 'react';
import { UserCheck, Users, TrendingUp, RotateCcw } from 'lucide-react';
import { PeriodRange, SaleTuple } from '../types';
import {
  aggregateSales,
  aggregateLeadsOverRange,
  formatCurrency,
  formatDate,
  getLeadsForDay,
} from '../utils/calculations';

interface LeadsTabProps {
  sales: SaleTuple[];
  periodRange: PeriodRange;
  staffList: string[];
  localLeads: Record<number, Record<string, [number, number, number]>>;
  onResetAllLeads?: () => void;
}

export const LeadsTab: React.FC<LeadsTabProps> = ({
  sales,
  periodRange,
  staffList,
  localLeads,
  onResetAllLeads,
}) => {
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const currentAgg = aggregateSales(sales, periodRange.a, periodRange.b, staffList);
  const leadsData = aggregateLeadsOverRange(periodRange.a, periodRange.b, sales, localLeads);

  // Daily leads log list (up to last 25 records within range)
  const dailyLeadRows: {
    dayOffset: number;
    promoter: string;
    walkIn: number;
    revisit: number;
    online: number;
  }[] = [];

  for (let i = periodRange.b; i >= periodRange.a && dailyLeadRows.length < 30; i--) {
    const lk = getLeadsForDay(i, localLeads);
    for (const k in lk) {
      const counts = lk[k];
      if (counts[0] > 0 || counts[1] > 0 || counts[2] > 0) {
        dailyLeadRows.push({
          dayOffset: i,
          promoter: k === 'u' ? 'Not tagged' : staffList[Number(k)] || `Staff #${k}`,
          walkIn: counts[0],
          revisit: counts[1],
          online: counts[2],
        });
      }
    }
  }

  // Cross tab helper
  const totalUnitsByLeadType = (typeIdx: number) =>
    currentAgg.ty.reduce((acc, staffRow) => acc + staffRow[typeIdx][1], 0);
  const totalAmountByLeadType = (typeIdx: number) =>
    currentAgg.ty.reduce((acc, staffRow) => acc + staffRow[typeIdx][0], 0);

  const leadCounts = [leadsData.walkIn, leadsData.revisit, leadsData.online];

  return (
    <div className="space-y-6">
      {/* Leads Summary Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              Customer Inquiries & Foot-Traffic Leads ({periodRange.lb})
            </h3>
            <p className="text-xs text-slate-500">
              Tracking customer acquisition channels and device sales conversion rates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {leadsData.loggedDaysCount} Day(s) with logged leads
            </div>
            {onResetAllLeads && (
              <div>
                {!isConfirmingReset ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingReset(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                    title="Clear all recorded leads across the entire store"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset All Leads</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        onResetAllLeads();
                        setIsConfirmingReset(false);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Confirm Reset All?
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingReset(false)}
                      className="px-2 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Walk-in Leads</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {leadsData.walkIn}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Mall walk-ins</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Revisit Inquiries</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {leadsData.revisit}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Returning customers</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Online Channels</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {leadsData.online}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">FB / Viber / Web</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Conversion Efficiency</div>
            <div className="text-2xl font-black text-blue-600 mt-1">
              {leadsData.unitsPerLead}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Hardware units / lead</div>
          </div>
        </div>

        {leadsData.total > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Promoter</th>
                  <th className="py-2.5 px-3">Walk-in</th>
                  <th className="py-2.5 px-3">Revisit</th>
                  <th className="py-2.5 px-3">Online</th>
                  <th className="py-2.5 px-3 font-bold text-slate-900">Total Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {Object.keys(leadsData.perPromoter)
                  .sort()
                  .map((k) => {
                    const row = leadsData.perPromoter[k];
                    const name = k === 'u' ? 'Not tagged' : staffList[Number(k)] || `Staff #${k}`;
                    return (
                      <tr key={k} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{name}</td>
                        <td className="py-2.5 px-3">{row[0]}</td>
                        <td className="py-2.5 px-3">{row[1]}</td>
                        <td className="py-2.5 px-3">{row[2]}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
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

      {/* Sales by Lead Source Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="border-b border-slate-100 pb-4 mb-4">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Sales & Revenue by Lead Channel ({periodRange.lb})
          </h3>
          <p className="text-xs text-slate-500">
            Revenues in Pesos with units in brackets.
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
                <th className="py-3 px-3 font-bold text-slate-900 text-right">Total Sales</th>
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

              <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                <td className="py-2.5 px-3 text-slate-900">Store</td>
                {[0, 1, 2, 3].map((k) => {
                  const amt = totalAmountByLeadType(k);
                  const u = totalUnitsByLeadType(k);
                  return (
                    <td key={k} className="py-2.5 px-3">
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
                <td className="py-2.5 px-3 text-right text-blue-700 font-extrabold">
                  {formatCurrency(currentAgg.sa)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Lead Log History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Historical Daily Lead Log Entries
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Includes standard report entries (e.g., Oct 23 report: 5 walk-in, 1 online) and any custom leads recorded via Quick Log.
        </p>

        {dailyLeadRows.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No leads recorded for this active period. Use the Quick Log card to log walk-in, revisit, or online leads.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Promoter</th>
                  <th className="py-2.5 px-3 text-center">Walk-in</th>
                  <th className="py-2.5 px-3 text-center">Revisit</th>
                  <th className="py-2.5 px-3 text-center">Online</th>
                  <th className="py-2.5 px-3 text-right">Day Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {dailyLeadRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {formatDate(row.dayOffset)}
                    </td>
                    <td className="py-2 px-3">{row.promoter}</td>
                    <td className="py-2 px-3 text-center">{row.walkIn}</td>
                    <td className="py-2 px-3 text-center">{row.revisit}</td>
                    <td className="py-2 px-3 text-center">{row.online}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {row.walkIn + row.revisit + row.online}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
