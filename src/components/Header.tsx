import { getLastCloudError } from '../cloudStorage';
import React, { useState } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Calendar,
  Target,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/calculations';

interface HeaderProps {
  todayOffset: number;
  cloudSyncStatus?: 'connected' | 'syncing' | 'offline' | 'loading';
  onSyncNow?: () => Promise<any>;
  syncFeedback?: string | null;
  pulseMetrics: {
    score: number;
    statusText: string;
    statusColor: string;
    todayRevenue: number;
    todayUnits: number;
    todayAchievementPct: number;
    dailyTarget: number;
  };
  onUpdateDailyGoal: (goal: number) => void;
  onExport: () => void;
  onImportClick: () => void;
  onReset: () => void;
  onJumpToQuickLog: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  todayOffset,
  cloudSyncStatus = 'connected',
  onSyncNow,
  syncFeedback,
  pulseMetrics,
  onUpdateDailyGoal,
  onExport,
  onImportClick,
  onReset,
  onJumpToQuickLog,
}) => {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(pulseMetrics.dailyTarget));

  const handleSaveGoal = () => {
    const val = Number(goalInput.replace(/[^0-9]/g, ''));
    if (val > 0) {
      onUpdateDailyGoal(val);
    }
    setIsEditingGoal(false);
  };

  const todayDate = new Date();
  const dateStr = todayDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const hour = todayDate.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Brand & Greeting */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black tracking-wider text-sm shadow-sm shrink-0">
              DJI
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Store Sales
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  SM Dasmariñas
                </span>
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={cloudSyncStatus === 'syncing'}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all shadow-xs cursor-pointer active:scale-95 border disabled:opacity-70"
                  title="Click to sync with Firebase. Non-destructive sync preserves all your entries!"
                >
                  {cloudSyncStatus === 'connected' && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>Firebase Live</span>
                      <RefreshCw className="w-3 h-3 text-emerald-600 group-hover:rotate-180 transition-transform duration-300 ml-0.5" />
                    </span>
                  )}
                  {cloudSyncStatus === 'syncing' && (
                    <span className="inline-flex items-center gap-1.5 text-blue-700">
                      <span className="animate-spin h-2 w-2 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                      <span>Syncing...</span>
                    </span>
                  )}
                  {cloudSyncStatus === 'loading' && (
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse"></span>
                      <span>Connecting...</span>
                    </span>
                  )}
                  {cloudSyncStatus === 'offline' && (
                    <span className="inline-flex items-center gap-1 text-amber-800">
                      <span>
                        {getLastCloudError()?.code === 'permission-denied'
                          ? '⚠️ Cloud rules rejected the save: republish firestore.rules'
                          : '⚠️ Local Mode (Retry Sync)'}
                      </span>
                      <RefreshCw className="w-3 h-3 text-amber-700 ml-0.5 group-hover:rotate-180 transition-transform duration-300" />
                    </span>
                  )}
                </button>
                {syncFeedback && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 animate-fadeIn">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{syncFeedback}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{greeting}</span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {dateStr}
                </span>
                <span aria-hidden="true">·</span>
                <span>Day #{todayOffset}</span>
              </div>
            </div>
          </div>

          {/* Key Quick Pulse Stats */}
          <div className="flex flex-wrap items-center gap-3 lg:gap-5">
            {/* Store Pulse Indicator */}
            <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="relative flex items-center justify-center">
                <svg className="w-10 h-10 transform -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    className="stroke-slate-200"
                    strokeWidth="3.5"
                    fill="transparent"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    className="stroke-blue-600 transition-all duration-700"
                    strokeWidth="3.5"
                    strokeDasharray={100}
                    strokeDashoffset={100 - pulseMetrics.score}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute text-xs font-bold text-slate-800">
                  {pulseMetrics.score}
                </span>
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Store Pulse
                </div>
                <div className={`text-xs font-bold ${pulseMetrics.statusColor}`}>
                  {pulseMetrics.statusText}
                </div>
              </div>
            </div>

            {/* Daily Target Progress */}
            <div className="flex flex-col min-w-[170px] px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Target className="w-3 h-3 text-slate-400" />
                  Today's Target
                </span>
                {isEditingGoal ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      className="w-20 px-1 py-0.5 text-xs bg-white border border-slate-300 rounded font-semibold text-slate-800"
                    />
                    <button
                      onClick={handleSaveGoal}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingGoal(true)}
                    className="text-[11px] font-semibold text-slate-700 hover:text-blue-600 underline"
                  >
                    {formatCurrency(pulseMetrics.dailyTarget)}
                  </button>
                )}
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${pulseMetrics.todayAchievementPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                <span className="font-semibold text-slate-800">
                  {formatCurrency(pulseMetrics.todayRevenue)}
                </span>
                <span className="font-medium">
                  {pulseMetrics.todayAchievementPct.toFixed(0)}% reached
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onJumpToQuickLog}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Open Quick Log"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>+ Log Sale</span>
              </button>
              <button
                onClick={onExport}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Backup Data (Download JSON)"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={onImportClick}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Restore Data (Import JSON)"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={onReset}
                className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Reset to Fresh Store State"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
