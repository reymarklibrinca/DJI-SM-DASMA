import React, { useState } from 'react';
import {
  Users,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Edit3,
  Plus,
  Trash2,
  Check,
  X,
  RotateCcw,
  UserPlus,
  Sparkles,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { PeriodRange, SaleTuple } from '../types';
import { DEFAULT_STAFF } from '../data/initialData';
import {
  aggregateSales,
  calculateAttachRate,
  calculatePercentChange,
  calculatePeriodTarget,
  formatCurrency,
  aggregateLeadsOverRange,
  getPromoterShortName,
} from '../utils/calculations';

interface StaffTabProps {
  sales: SaleTuple[];
  periodRange: PeriodRange;
  staffList: string[];
  promoterMonthlyTargets: Record<number, number>;
  onUpdatePromoterTarget: (staffIndex: number, target: number) => void;
  localLeads: Record<number, Record<string, [number, number, number]>>;
  onUpdateStaff?: (newStaff: string[]) => void;
  onUpdatePromoterName?: (index: number, newName: string) => void;
  onAddPromoter?: (name: string) => void;
  onRemovePromoter?: (index: number) => void;
  archivedStaff?: number[];
  onArchivePromoter?: (index: number) => void;
  onRestorePromoter?: (index: number) => void;
  onResetStaffToDefault?: () => void;
}

export const StaffTab: React.FC<StaffTabProps> = ({
  sales,
  periodRange,
  staffList,
  promoterMonthlyTargets,
  onUpdatePromoterTarget,
  localLeads,
  onUpdateStaff,
  onUpdatePromoterName,
  onAddPromoter,
  onRemovePromoter,
  archivedStaff = [],
  onArchivePromoter,
  onRestorePromoter,
  onResetStaffToDefault,
}) => {
  // Modal & inline edit states
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingStaffIdx, setEditingStaffIdx] = useState<number | null>(null);
  const [editingStaffName, setEditingStaffName] = useState('');
  const [newPromoterName, setNewPromoterName] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const currentAgg = aggregateSales(sales, periodRange.a, periodRange.b, staffList);
  const prevAgg = aggregateSales(sales, periodRange.pa, periodRange.pb, staffList);

  const maxStaffSales = Math.max(...currentAgg.st.map((s) => s[0]), 1);

  // Leaderboard data
  const staffLeaderboard = staffList
    .map((name, i) => {
      const sa = currentAgg.st[i]?.[0] ?? 0;
      const un = currentAgg.st[i]?.[1] ?? 0;
      const care = currentAgg.st[i]?.[2] ?? 0;
      const hw = currentAgg.st[i]?.[3] ?? 0;
      const prevSa = prevAgg.st[i]?.[0] ?? 0;
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
    currentAgg.ty.reduce((acc, staffRow) => acc + (staffRow[typeIdx]?.[1] ?? 0), 0);
  const totalAmountByLeadType = (typeIdx: number) =>
    currentAgg.ty.reduce((acc, staffRow) => acc + (staffRow[typeIdx]?.[0] ?? 0), 0);

  // Save inline promoter name
  const handleSaveInlineName = (idx: number) => {
    const trimmed = editingStaffName.trim();
    if (trimmed && onUpdatePromoterName) {
      onUpdatePromoterName(idx, trimmed);
      setFeedbackToast(`Promoter #${idx + 1} renamed to "${trimmed}" across the system!`);
      setTimeout(() => setFeedbackToast(null), 3500);
    }
    setEditingStaffIdx(null);
  };

  // Add new promoter
  const handleAddPromoter = () => {
    const trimmed = newPromoterName.trim();
    if (trimmed && onAddPromoter) {
      onAddPromoter(trimmed);
      setNewPromoterName('');
      setFeedbackToast(`Added "${trimmed}" to the promoter roster!`);
      setTimeout(() => setFeedbackToast(null), 3500);
    }
  };

  // Archive a promoter (keeps all history; hides them from new sale entry)
  const activeCount = staffList.length - archivedStaff.length;
  const handleArchivePromoter = (idx: number) => {
    if (activeCount <= 1) return;
    const pName = staffList[idx];
    if (window.confirm(`Archive "${pName}"? Their past sales, leads and reports stay exactly as they are. They just won't appear when logging new sales. You can restore them any time.`)) {
      onArchivePromoter?.(idx);
      setFeedbackToast(`Archived "${pName}".`);
      setTimeout(() => setFeedbackToast(null), 3500);
    }
  };
  const handleRestorePromoter = (idx: number) => {
    onRestorePromoter?.(idx);
    setFeedbackToast(`Restored "${staffList[idx]}".`);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Reset to default
  const handleResetToDefault = () => {
    if (
      window.confirm(
        `Reset promoter roster back to default:\n- Lee, Christian Joseph\n- Barias, Donna Leah\n- Sarabia, Jobert\n\nContinue?`
      )
    ) {
      onResetStaffToDefault?.();
      setFeedbackToast('Promoter roster reset to default (Lee, Christian Joseph; Barias, Donna Leah; Sarabia, Jobert)');
      setTimeout(() => setFeedbackToast(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Staff Leaderboard */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Promoter Performance & Quotas ({periodRange.lb})
            </h3>
            <p className="text-xs text-slate-500">
              Ranked by revenue contribution. Names and targets update dynamically across the entire store system.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 rounded-lg transition-all cursor-pointer shadow-xs"
              title="Customize promoter names and team roster"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customize Promoters ({staffList.length})</span>
            </button>
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              Store Total: <strong className="text-slate-900">{formatCurrency(currentAgg.sa)}</strong> ({currentAgg.un} units)
            </div>
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
                const isEditing = editingStaffIdx === staff.index;

                return (
                  <tr key={staff.name + staff.index} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            rank === 0
                              ? 'bg-amber-100 text-amber-800'
                              : rank === 1
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rank + 1}
                        </span>

                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingStaffName}
                              onChange={(e) => setEditingStaffName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInlineName(staff.index);
                                if (e.key === 'Escape') setEditingStaffIdx(null);
                              }}
                              autoFocus
                              className="px-2 py-1 text-xs border border-blue-400 bg-white rounded-lg text-slate-900 font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-44"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInlineName(staff.index)}
                              className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStaffIdx(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="font-bold text-sm text-slate-900">{staff.name}</span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                              {getPromoterShortName(staff.name)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStaffIdx(staff.index);
                                setEditingStaffName(staff.name);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all cursor-pointer"
                              title="Rename promoter"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Monthly Targets & Quota Pacing
            </h3>
            <p className="text-xs text-slate-500">
              Set monthly quota targets per promoter (default: ₱2,400,000 each = ₱7.2M monthly store target).
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsManageModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-all cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
            <span>Manage Promoters</span>
          </button>
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
                const salesVal = currentAgg.st[i]?.[0] ?? 0;
                const achPct = periodTarget > 0 ? (salesVal / periodTarget) * 100 : 0;
                const isEditing = editingStaffIdx === i;

                return (
                  <tr key={name + i} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingStaffName}
                            onChange={(e) => setEditingStaffName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineName(i);
                              if (e.key === 'Escape') setEditingStaffIdx(null);
                            }}
                            autoFocus
                            className="px-2 py-1 text-xs border border-blue-400 bg-white rounded-lg text-slate-900 font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-44"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInlineName(i)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStaffIdx(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span className="font-bold text-slate-900">{name}</span>
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {getPromoterShortName(name)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStaffIdx(i);
                              setEditingStaffName(name);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                            title="Rename promoter"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
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
              {staffList.map((name, i) => {
                const staffRow = currentAgg.ty[i] || [];
                const staffTotal = currentAgg.st[i]?.[0] ?? 0;
                return (
                  <tr key={name + i} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {name}
                      <span className="ml-1.5 text-[10px] font-semibold text-slate-400">
                        ({getPromoterShortName(name)})
                      </span>
                    </td>
                    {[0, 1, 2, 3].map((typeIdx) => {
                      const item = staffRow[typeIdx] || [0, 0];
                      const val = item[0];
                      const un = item[1];
                      return (
                        <td key={typeIdx} className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {val > 0 ? formatCurrency(val) : '–'}
                          </div>
                          {un > 0 && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {un} unit{un === 1 ? '' : 's'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 font-extrabold text-slate-900 text-right">
                      {formatCurrency(staffTotal)}
                    </td>
                  </tr>
                );
              })}

              {/* Total Row */}
              <tr className="bg-slate-50 font-bold text-slate-900">
                <td className="py-3 px-3">Store Total</td>
                {[0, 1, 2, 3].map((typeIdx) => {
                  const val = totalAmountByLeadType(typeIdx);
                  const un = totalUnitsByLeadType(typeIdx);
                  return (
                    <td key={typeIdx} className="py-3 px-3">
                      <div>{val > 0 ? formatCurrency(val) : '–'}</div>
                      {un > 0 && (
                        <span className="text-[10px] text-slate-500 block font-medium">
                          {un} unit{un === 1 ? '' : 's'}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 px-3 text-right font-black text-blue-700">
                  {formatCurrency(currentAgg.sa)}
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

      {/* Customizable Promoters Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Customize Promoters Roster
                  </h3>
                  <p className="text-xs text-slate-500">
                    Edit promoter names, add new staff, or update individual quotas. Changes synchronize across the entire store.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Active Promoters ({staffList.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 font-semibold cursor-pointer"
                    title="Reset to default promoters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Default</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {staffList.map((name, idx) => {
                    const short = getPromoterShortName(name);
                    const quota = promoterMonthlyTargets[idx] ?? 2400000;
                    const isArchived = archivedStaff.includes(idx);

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isArchived ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {name.charAt(0) || idx + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold uppercase text-slate-400">
                                Promoter #{idx + 1}
                              </span>
                              {isArchived && (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
                                  Archived
                                </span>
                              )}
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                Short: {short}
                              </span>
                            </div>

                            <input
                              type="text"
                              value={name}
                              onChange={(e) => onUpdatePromoterName?.(idx, e.target.value)}
                              placeholder="Full Name (e.g. Lee, Christian Joseph)"
                              className="w-full px-2.5 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        {/* Quota input and delete */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              Monthly Quota
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={quota}
                              onChange={(e) => onUpdatePromoterTarget(idx, Number(e.target.value))}
                              className="w-28 px-2 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg"
                            />
                          </div>

                          {isArchived ? (
                            <button
                              type="button"
                              onClick={() => handleRestorePromoter(idx)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer mt-3"
                              title="Restore promoter"
                            >
                              <ArchiveRestore className="w-4 h-4" />
                            </button>
                          ) : (
                            activeCount > 1 && (
                              <button
                                type="button"
                                onClick={() => handleArchivePromoter(idx)}
                                className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer mt-3"
                                title="Archive promoter (keeps all history)"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Promoter Card */}
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                  Add New Promoter
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPromoterName}
                    onChange={(e) => setNewPromoterName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddPromoter();
                    }}
                    placeholder="Enter full name (e.g. Santos, Maria or Juan Dela Cruz)"
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddPromoter}
                    disabled={!newPromoterName.trim()}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Default Reference Note */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-900">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Default System Promoters:
                </div>
                <div className="text-slate-600 space-y-0.5 pl-5">
                  <div>1. <strong>Lee, Christian Joseph</strong> (Short: Christian)</div>
                  <div>2. <strong>Barias, Donna Leah</strong> (Short: Donna)</div>
                  <div>3. <strong>Sarabia, Jobert</strong> (Short: Jobert)</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {staffList.length} promoter{staffList.length === 1 ? '' : 's'} currently configured
              </span>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
