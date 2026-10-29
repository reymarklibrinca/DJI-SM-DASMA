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

type TabDef = { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> };

// Three work areas instead of one crowded row of twelve tabs
const GROUPS: { id: string; label: string; icon: React.FC<{ className?: string }>; tabs: TabDef[] }[] = [
  {
    id: 'sales',
    label: 'Sales',
    icon: LayoutDashboard,
    tabs: [
      { id: 'd', label: 'Dashboard', icon: LayoutDashboard },
      { id: 't', label: 'Today', icon: CalendarCheck },
      { id: 'y', label: 'Daily Report', icon: FileText },
      { id: 'b', label: 'Sales Breakdown', icon: Table },
      { id: 'r', label: 'Sales Rhythm', icon: Activity },
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    tabs: [
      { id: 's', label: 'Staff', icon: Users },
      { id: 'l', label: 'Leads', icon: UserCheck },
      { id: 'c', label: 'Retail Coach', icon: Lightbulb },
      { id: 'k', label: 'Routine Tasks', icon: CheckSquare },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: Layers,
    tabs: [
      { id: 'p', label: 'Products', icon: Box },
      { id: 'i', label: 'Stock & SN', icon: Layers },
      { id: 'inv', label: 'Import Inventory', icon: PackagePlus },
    ],
  },
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

  const activeGroup = GROUPS.find((g) => g.tabs.some((t) => t.id === activeTab)) || GROUPS[0];

  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Row 1: work area + period */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2.5">
          <div
            className="grid grid-cols-3 sm:inline-flex gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto"
            role="tablist"
            aria-label="Work areas"
          >
            {GROUPS.map((g) => {
              const Icon = g.icon;
              const isActive = g.id === activeGroup.id;
              return (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelectTab(isActive ? activeTab : g.tabs[0].id)}
                  className={`flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>

          {/* Period Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
              Period
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
              aria-label="Select month"
              className={`px-2.5 py-1 text-xs bg-white border rounded-md font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                selectedMonth !== null ? 'border-blue-600 text-blue-700' : 'border-slate-200 text-slate-700'
              }`}
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

        {/* Row 2: the pages inside the chosen work area */}
        <nav
          className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 mt-1"
          aria-label={`${activeGroup.label} pages`}
        >
          {activeGroup.tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
