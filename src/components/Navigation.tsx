import React from 'react';
import {
  LayoutDashboard,
  Table,
  CalendarCheck,
  FileText,
  Activity,
  Users,
  Box,
  UserCheck,
  Layers,
  Lightbulb,
  CheckSquare,
  PackagePlus,
} from 'lucide-react';
import { ActiveTab } from '../hooks/useDjiStore';
import { getMonthKey, getMonthName } from '../utils/calculations';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  daysCount: number;
  onSelectDaysCount: (n: number) => void;
  selectedMonth: number | null;
  onSelectMonth: (m: number | null) => void;
  endOffset: number;
}

const TABS: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'd', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'b', label: 'Sales Breakdown', icon: Table },
  { id: 't', label: 'Today', icon: CalendarCheck },
  { id: 'y', label: 'Daily Report', icon: FileText },
  { id: 'r', label: 'Sales Rhythm', icon: Activity },
  { id: 's', label: 'Staff', icon: Users },
  { id: 'p', label: 'Products', icon: Box },
  { id: 'l', label: 'Leads', icon: UserCheck },
  { id: 'i', label: 'Stock & SN', icon: Layers },
  { id: 'inv', label: 'Import Inventory', icon: PackagePlus },
  { id: 'c', label: 'Retail Coach', icon: Lightbulb },
  { id: 'k', label: 'Routine Tasks', icon: CheckSquare },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  daysCount,
  onSelectDaysCount,
  selectedMonth,
  onSelectMonth,
  endOffset,
}) => {
  // Collect all unique month keys in the dataset
  const availableMonths: number[] = [];
  for (let i = 0; i <= endOffset; i++) {
    const mk = getMonthKey(i);
    if (!availableMonths.includes(mk)) {
      availableMonths.push(mk);
    }
  }

  return (
    <div className="bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* All Visible Tabs (Wrapping so all are visible simultaneously) */}
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="Store navigation tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Period Selector */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
              Period:
            </span>
            {[7, 14, 30].map((n) => {
              const isActive = selectedMonth === null && daysCount === n;
              return (
                <button
                  key={n}
                  onClick={() => {
                    onSelectDaysCount(n);
                    onSelectMonth(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {n}d
                </button>
              );
            })}

            <select
              value={selectedMonth ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? null : Number(e.target.value);
                onSelectMonth(val);
              }}
              className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">By Month...</option>
              {availableMonths.map((mk) => (
                <option key={mk} value={mk}>
                  {getMonthName(mk)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
