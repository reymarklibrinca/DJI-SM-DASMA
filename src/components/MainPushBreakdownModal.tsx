import React, { useState, useMemo } from 'react';
import {
  X,
  Target,
  Users,
  Award,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Filter,
  ArrowRight,
  Flame,
  Calendar,
  Sparkles,
  Edit2,
} from 'lucide-react';
import { SaleTuple } from '../types';
import { DJI_DATA, MAIN_PUSH_TARGETS } from '../data/initialData';
import {
  calculateMainPushBreakdown,
  calculatePromoterMonthPerformance,
  formatCurrency,
  formatNumber,
  formatDate,
  categorizeMainPushModel,
} from '../utils/calculations';
import { EditMainPushTargetsModal } from './EditMainPushTargetsModal';

interface MainPushBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: SaleTuple[];
  staffList: string[];
  promoterMonthlyTargets: Record<number, number>;
  endOffset: number;
  mainPushTargets?: Record<string, number>;
  onUpdateMainPushTargets?: (newTargets: Record<string, number>) => void;
  onResetMainPushTargets?: () => void;
}

export const MainPushBreakdownModal: React.FC<MainPushBreakdownModalProps> = ({
  isOpen,
  onClose,
  sales,
  staffList,
  promoterMonthlyTargets,
  endOffset,
  mainPushTargets,
  onUpdateMainPushTargets,
  onResetMainPushTargets,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'promoters' | 'units'>('matrix');
  const [selectedPromoterFilter, setSelectedPromoterFilter] = useState<number | 'all'>('all');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditTargetsOpen, setIsEditTargetsOpen] = useState(false);

  // Month = 9 is October (0-indexed)
  const pushData = useMemo(() => {
    return calculateMainPushBreakdown(sales, staffList, 9, mainPushTargets);
  }, [sales, staffList, mainPushTargets]);

  const promoterPerf = useMemo(() => {
    return calculatePromoterMonthPerformance(sales, staffList, promoterMonthlyTargets, 9, endOffset, mainPushTargets);
  }, [sales, staffList, promoterMonthlyTargets, endOffset, mainPushTargets]);

  const soldByModelMap = useMemo(() => {
    const map: Record<string, number> = {};
    pushData.categories.forEach((cat) => {
      map[cat.name] = cat.storeSold;
    });
    return map;
  }, [pushData]);

  // October Sales matching filters for the Units tab
  const octoberMainPushSales = useMemo(() => {
    return sales
      .map((s, idx) => ({ s, originalIdx: idx }))
      .filter(({ s }) => {
        // Month check: day >= 61 is October
        if (s[0] < 61) return false;

        const modelCat = categorizeMainPushModel(s);
        if (!modelCat) return false;

        if (selectedPromoterFilter !== 'all' && s[1] !== selectedPromoterFilter) return false;
        if (selectedModelFilter !== 'all' && modelCat !== selectedModelFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const sn = (s[6] || '').toLowerCase();
          const ser = (DJI_DATA.ser[s[2]] || '').toLowerCase();
          const staff = (staffList[s[1]] || '').toLowerCase();
          if (!sn.includes(q) && !ser.includes(q) && !staff.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => b.s[0] - a.s[0]);
  }, [sales, selectedPromoterFilter, selectedModelFilter, searchQuery, staffList]);

  // Store total MTD revenue and quota
  const storeMtdRevenue = promoterPerf.reduce((sum, p) => sum + p.mtdRevenue, 0);
  const storeQuotaTarget = promoterPerf.reduce((sum, p) => sum + p.quotaTarget, 0);
  const storeRemainingRevenue = Math.max(0, storeQuotaTarget - storeMtdRevenue);
  const storeQuotaPct = storeQuotaTarget > 0 ? (storeMtdRevenue / storeQuotaTarget) * 100 : 0;
  const daysRemaining = promoterPerf[0]?.daysRemaining ?? 8;

  // Copy Executive Report text
  const handleCopyReport = () => {
    const lines = [
      `📊 DJI STORE SM DASMARIÑAS | OCTOBER 2026 MAIN PUSH & PROMOTER PERFORMANCE`,
      `========================================================================`,
      `Store Quota: ${formatCurrency(storeMtdRevenue)} / ${formatCurrency(storeQuotaTarget)} (${storeQuotaPct.toFixed(1)}%)`,
      `Store Remaining Revenue: ${formatCurrency(storeRemainingRevenue)} (${daysRemaining} days left · Required: ${formatCurrency(storeRemainingRevenue / daysRemaining)}/day)`,
      `Main Push Progress: ${pushData.totalStoreSold}/${pushData.totalStoreTarget} units (${pushData.totalStorePct.toFixed(1)}%) · ${pushData.totalStoreRemaining} units remaining`,
      ``,
      `🎯 MAIN PUSH TARGET & REMAINING PER PROMOTER:`,
      `------------------------------------------------------------------------`,
    ];

    staffList.forEach((stName, idx) => {
      const p = pushData.totalPerPromoter[idx];
      lines.push(`${stName.toUpperCase()} Total Push: ${p.sold}/${p.target} units (${p.pct.toFixed(0)}%) | Remaining: ${p.remaining} units`);
      pushData.categories.forEach((cat) => {
        const pm = cat.promoters[idx];
        lines.push(`  • ${cat.name}: Target ${pm.target} | Sold ${pm.sold} | Remaining ${pm.remaining}`);
      });
      lines.push(``);
    });

    lines.push(`👤 PROMOTER OVERALL MONTH PERFORMANCE (OCTOBER 2026):`);
    lines.push(`------------------------------------------------------------------------`);
    promoterPerf.forEach((p) => {
      lines.push(`${p.name.toUpperCase()}:`);
      lines.push(`  • MTD Revenue: ${formatCurrency(p.mtdRevenue)} / ${formatCurrency(p.quotaTarget)} (${p.quotaPct.toFixed(1)}%)`);
      lines.push(`  • Remaining to Quota: ${formatCurrency(p.remainingRevenue)}`);
      lines.push(`  • Required Daily Pace: ${formatCurrency(p.requiredDailyRunRate)}/day (${p.daysRemaining} days remaining)`);
      lines.push(`  • Total Units Sold: ${p.unitsSold} units (Avg Ticket: ${formatCurrency(p.avgTicket)})`);
      lines.push(`  • Care Attach: ${p.careAttachRate.toFixed(1)}% (${p.careUnits} Care / ${p.hardwareUnits} Devices)`);
      lines.push(`  • Main Push: ${p.mainPushUnits}/${p.mainPushTarget} units (${p.mainPushPct.toFixed(0)}% · ${p.mainPushRemaining} rem)`);
      lines.push(``);
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-start justify-between border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                Store Targets & Quota
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Current Month: October 2026
              </span>
              <span className="text-xs text-slate-400">DJI SM Dasmariñas</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-400" />
              Main Push Targets & Promoter Breakdown
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Target vs. Achieved vs. Remaining per Promoter across focus models, plus full monthly sales run rate to quota.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onUpdateMainPushTargets && (
              <button
                type="button"
                onClick={() => setIsEditTargetsOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs cursor-pointer"
                title="Edit Main Push Targets"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Targets</span>
              </button>
            )}
            <button
              onClick={handleCopyReport}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-all border border-slate-700 cursor-pointer"
              title="Copy executive briefing to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              {copied ? 'Copied!' : 'Copy Summary'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick KPI Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-6 py-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs">
            <div>
              <div className="text-slate-500 font-medium">Store Revenue MTD</div>
              <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                {formatCurrency(storeMtdRevenue)}
              </div>
              <div className="text-[11px] text-slate-500">
                {storeQuotaPct.toFixed(1)}% of {formatCurrency(storeQuotaTarget)}
              </div>
            </div>

            <div>
              <div className="text-slate-500 font-medium">Revenue Remaining</div>
              <div className="text-base sm:text-lg font-black text-amber-700 mt-0.5">
                {formatCurrency(storeRemainingRevenue)}
              </div>
              <div className="text-[11px] text-slate-500">
                Pacing: {formatCurrency(storeRemainingRevenue / daysRemaining)} / day
              </div>
            </div>

            <div>
              <div className="text-slate-500 font-medium">Main Push Focus Units</div>
              <div className="text-base sm:text-lg font-black text-blue-700 mt-0.5">
                {pushData.totalStoreSold} / {pushData.totalStoreTarget}{' '}
                <span className="text-xs font-semibold text-slate-500">units</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold">
                {pushData.totalStorePct.toFixed(1)}% Achieved
              </div>
            </div>

            <div>
              <div className="text-slate-500 font-medium">Push Units Remaining</div>
              <div className="text-base sm:text-lg font-black text-rose-700 mt-0.5">
                {pushData.totalStoreRemaining} units
              </div>
              <div className="text-[11px] text-slate-500">
                Across {daysRemaining} days left in October
              </div>
            </div>
          </div>
        </div>

        {/* Modal Navigation Switcher */}
        <div className="px-5 sm:px-6 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              Target & Remaining Matrix
            </button>
            <button
              onClick={() => setActiveTab('promoters')}
              className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'promoters'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Promoter Month Performance
            </button>
            <button
              onClick={() => setActiveTab('units')}
              className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'units'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Logged Focus Units ({octoberMainPushSales.length})
            </button>
          </div>

          <div className="text-xs text-slate-500 pb-2 hidden sm:block">
            {activeTab === 'matrix' && 'Target divided evenly per promoter (multiple of 3)'}
            {activeTab === 'promoters' && 'Individual quota pacing to October 31'}
            {activeTab === 'units' && 'Verified October sales matching focus categories'}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: TARGET & REMAINING MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-6">
              {/* Main Matrix Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-500" />
                    Focus Models Breakdown: Store vs. Promoter Target & Remaining
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Target per promoter = Store Target ÷ {staffList.length}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-3">Focus Model</th>
                        <th className="py-2.5 px-3 text-center bg-slate-200/50">Store Target</th>
                        <th className="py-2.5 px-3 text-center bg-slate-200/50">Store Sold</th>
                        <th className="py-2.5 px-3 text-center bg-slate-200/50">Store Rem</th>
                        {staffList.map((st) => (
                          <th key={st} className="py-2.5 px-3 text-center border-l border-slate-200" colSpan={3}>
                            {st}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 text-[10px]">
                        <th className="py-1 px-3"></th>
                        <th className="py-1 px-3 text-center bg-slate-200/50">Total</th>
                        <th className="py-1 px-3 text-center bg-slate-200/50">Units</th>
                        <th className="py-1 px-3 text-center bg-slate-200/50">Gap</th>
                        {staffList.map((st) => (
                          <React.Fragment key={st}>
                            <th className="py-1 px-2 text-center border-l border-slate-200">Tgt</th>
                            <th className="py-1 px-2 text-center text-blue-700">Sold</th>
                            <th className="py-1 px-2 text-center text-rose-700">Rem</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {pushData.categories.map((cat) => {
                        const isStoreHit = cat.storeSold >= cat.storeTarget;
                        return (
                          <tr key={cat.name} className="hover:bg-slate-50">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{cat.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {cat.storePct.toFixed(0)}% store target met
                              </div>
                            </td>
                            {/* Store Columns */}
                            <td className="py-3 px-3 text-center font-bold text-slate-800 bg-slate-50/50">
                              {cat.storeTarget}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-blue-700 bg-slate-50/50">
                              {cat.storeSold}
                            </td>
                            <td className="py-3 px-3 text-center bg-slate-50/50">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                  isStoreHit
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {cat.storeRemaining === 0 ? '✓ Reached' : `${cat.storeRemaining} rem`}
                              </span>
                            </td>

                            {/* Promoter Columns */}
                            {cat.promoters.map((p) => {
                              const isPromoterHit = p.sold >= p.target;
                              return (
                                <React.Fragment key={p.staffIndex}>
                                  <td className="py-3 px-2 text-center text-slate-500 border-l border-slate-200">
                                    {p.target}
                                  </td>
                                  <td className="py-3 px-2 text-center font-bold text-slate-900">
                                    {p.sold}
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        isPromoterHit
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {p.remaining === 0 ? 'Hit!' : `${p.remaining} rem`}
                                    </span>
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Totals Footer */}
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-bold text-xs">
                        <td className="py-3 px-3 uppercase tracking-wider">
                          Total Push Focus Units
                        </td>
                        <td className="py-3 px-3 text-center bg-slate-800">
                          {pushData.totalStoreTarget}
                        </td>
                        <td className="py-3 px-3 text-center text-blue-300 bg-slate-800">
                          {pushData.totalStoreSold}
                        </td>
                        <td className="py-3 px-3 text-center text-rose-300 bg-slate-800">
                          {pushData.totalStoreRemaining} rem
                        </td>
                        {pushData.totalPerPromoter.map((tp) => (
                          <React.Fragment key={tp.staffIndex}>
                            <td className="py-3 px-2 text-center text-slate-300 border-l border-slate-700">
                              {tp.target}
                            </td>
                            <td className="py-3 px-2 text-center text-blue-300 font-extrabold">
                              {tp.sold}
                            </td>
                            <td className="py-3 px-2 text-center text-amber-300 font-extrabold">
                              {tp.remaining}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Per-Promoter Individual Progress Cards */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Promoter Main Push Progress Meters (October 2026)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {staffList.map((name, i) => {
                    const pTotal = pushData.totalPerPromoter[i];
                    return (
                      <div
                        key={name}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                              {name[0]}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{name}</span>
                          </div>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                              pTotal.pct >= 70
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {pTotal.pct.toFixed(0)}% Achieved
                          </span>
                        </div>

                        <div>
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-slate-500">Overall Focus Sold:</span>
                            <span className="font-extrabold text-slate-900">
                              {pTotal.sold} / {pTotal.target} units
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pTotal.pct >= 80 ? 'bg-emerald-500' : 'bg-blue-600'
                              }`}
                              style={{ width: `${Math.min(100, pTotal.pct)}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-[11px] mt-1 text-slate-500">
                            <span>Remaining gap:</span>
                            <span className="font-bold text-rose-600">
                              {pTotal.remaining} units to target
                            </span>
                          </div>
                        </div>

                        {/* Breakdown across models */}
                        <div className="space-y-1.5 pt-1 text-xs">
                          {pushData.categories.map((c) => {
                            const pm = c.promoters[i];
                            return (
                              <div
                                key={c.name}
                                className="flex items-center justify-between py-1 border-b border-slate-50 text-[11px]"
                              >
                                <span className="text-slate-600">{c.name}</span>
                                <div className="flex items-center gap-2 font-medium">
                                  <span>
                                    {pm.sold} / {pm.target}
                                  </span>
                                  {pm.remaining === 0 ? (
                                    <span className="text-emerald-600 font-bold text-[10px]">✓ Hit</span>
                                  ) : (
                                    <span className="text-amber-700 font-bold text-[10px]">
                                      {pm.remaining} rem
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
            </div>
          )}

          {/* TAB 2: PROMOTER MONTH PERFORMANCE */}
          {activeTab === 'promoters' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Promoter Performance Scorecard (October 2026 MTD)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tracking towards individual monthly revenue quotas (₱2,400,000 standard).
                  </p>
                </div>
                <div className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                  {daysRemaining} Days Left in Month
                </div>
              </div>

              {/* 3 Promoter Performance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {promoterPerf.map((p, rank) => {
                  const isTop = rank === 0;
                  return (
                    <div
                      key={p.name}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 relative overflow-hidden"
                    >
                      {/* Rank badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                              rank === 0
                                ? 'bg-amber-100 text-amber-800'
                                : rank === 1
                                ? 'bg-slate-200 text-slate-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{rank + 1}
                          </span>
                          <div>
                            <h4 className="font-extrabold text-base text-slate-900">{p.name}</h4>
                            <span className="text-[11px] text-slate-500">Promoter</span>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            p.quotaPct >= 70
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.quotaPct >= 50
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.quotaPct.toFixed(1)}% Quota
                        </span>
                      </div>

                      {/* Revenue & Target */}
                      <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11px] text-slate-500 uppercase font-semibold">
                            MTD Revenue
                          </span>
                          <span className="text-base font-black text-slate-900">
                            {formatCurrency(p.mtdRevenue)}
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden my-1.5">
                          <div
                            className={`h-full rounded-full ${
                              p.quotaPct >= 70 ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, p.quotaPct)}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-xs text-slate-600">
                          <span>Target: {formatCurrency(p.quotaTarget)}</span>
                          <span className="font-bold text-rose-600">
                            Gap: {formatCurrency(p.remainingRevenue)}
                          </span>
                        </div>
                      </div>

                      {/* Key Operational Metrics */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <span className="text-slate-500 block text-[10px] uppercase">
                            Total Units
                          </span>
                          <span className="font-black text-slate-900 text-sm mt-0.5 block">
                            {p.unitsSold} units
                          </span>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <span className="text-slate-500 block text-[10px] uppercase">
                            Avg Price / Unit
                          </span>
                          <span className="font-black text-slate-900 text-sm mt-0.5 block">
                            {formatCurrency(p.avgTicket)}
                          </span>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <span className="text-slate-500 block text-[10px] uppercase">
                            DJI Care Attach
                          </span>
                          <span className="font-black text-slate-900 text-sm mt-0.5 block">
                            {p.careAttachRate.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({p.careUnits} Care / {p.hardwareUnits} HW)
                          </span>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-lg">
                          <span className="text-slate-500 block text-[10px] uppercase">
                            Push Focus Sold
                          </span>
                          <span className="font-black text-blue-600 text-sm mt-0.5 block">
                            {p.mainPushUnits} / {p.mainPushTarget}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {p.mainPushRemaining} units remaining
                          </span>
                        </div>
                      </div>

                      {/* Required Pace for Remaining Days */}
                      <div className="pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Required Pace to 100%:</span>
                          <span className="font-black text-slate-900">
                            {formatCurrency(p.requiredDailyRunRate)} / day
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Calculated across remaining {p.daysRemaining} days of October.
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comparative Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700">
                  Detailed October Summary Table
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Promoter</th>
                      <th className="py-2.5 px-3">Monthly Target</th>
                      <th className="py-2.5 px-3">MTD Sales</th>
                      <th className="py-2.5 px-3 text-rose-700">Remaining to Target</th>
                      <th className="py-2.5 px-3 text-center">Quota Ach %</th>
                      <th className="py-2.5 px-3 text-center">Push Units (Sold/Rem)</th>
                      <th className="py-2.5 px-3 text-right">Req. Daily Pace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {promoterPerf.map((p) => (
                      <tr key={p.name} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold text-slate-900">{p.name}</td>
                        <td className="py-3 px-3 text-slate-600">{formatCurrency(p.quotaTarget)}</td>
                        <td className="py-3 px-3 font-extrabold text-blue-700">
                          {formatCurrency(p.mtdRevenue)}
                        </td>
                        <td className="py-3 px-3 font-bold text-rose-600">
                          {formatCurrency(p.remainingRevenue)}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">
                          {p.quotaPct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-slate-900">{p.mainPushUnits}</span>
                          <span className="text-slate-400"> / </span>
                          <span className="text-rose-600 font-semibold">{p.mainPushRemaining} rem</span>
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                          {formatCurrency(p.requiredDailyRunRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-bold">
                      <td className="py-3 px-3">Store Total</td>
                      <td className="py-3 px-3">{formatCurrency(storeQuotaTarget)}</td>
                      <td className="py-3 px-3 text-blue-300">{formatCurrency(storeMtdRevenue)}</td>
                      <td className="py-3 px-3 text-rose-300">
                        {formatCurrency(storeRemainingRevenue)}
                      </td>
                      <td className="py-3 px-3 text-center">{storeQuotaPct.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-center">
                        {pushData.totalStoreSold} / {pushData.totalStoreRemaining} rem
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-300">
                        {formatCurrency(storeRemainingRevenue / daysRemaining)}/day
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LOGGED FOCUS UNITS */}
          {activeTab === 'units' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Promoter Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Promoter:</span>
                    <select
                      value={selectedPromoterFilter}
                      onChange={(e) =>
                        setSelectedPromoterFilter(
                          e.target.value === 'all' ? 'all' : Number(e.target.value)
                        )
                      }
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="all">All Promoters</option>
                      {staffList.map((st, i) => (
                        <option key={st} value={i}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Category Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Model:</span>
                    <select
                      value={selectedModelFilter}
                      onChange={(e) => setSelectedModelFilter(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="all">All Focus Models</option>
                      {pushData.categories.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search SN, model..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Transactions Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Promoter</th>
                        <th className="py-2.5 px-3">Focus Category</th>
                        <th className="py-2.5 px-3">Series / Product</th>
                        <th className="py-2.5 px-3 font-mono">Serial / EAN</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {octoberMainPushSales.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                            No matching focus model sales found for this filter.
                          </td>
                        </tr>
                      ) : (
                        octoberMainPushSales.map(({ s, originalIdx }) => {
                          const catName = categorizeMainPushModel(s);
                          return (
                            <tr key={originalIdx} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {formatDate(s[0])}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                {staffList[s[1]]}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                                  {catName}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {DJI_DATA.ser[s[2]]}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-800">
                                {s[6] ? (
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                                    {s[6]}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">No SN</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                                {formatCurrency(s[3])}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Current tracking based on master October sales and newly recorded POS transactions.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Briefing'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {onUpdateMainPushTargets && (
        <EditMainPushTargetsModal
          isOpen={isEditTargetsOpen}
          onClose={() => setIsEditTargetsOpen(false)}
          currentTargets={mainPushTargets || {}}
          onSaveTargets={onUpdateMainPushTargets}
          onResetTargets={onResetMainPushTargets}
          soldByModel={soldByModelMap}
        />
      )}
    </div>
  );
};
