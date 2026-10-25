import React from 'react';
import { CheckSquare, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { ROUTINE_TASKS } from '../data/initialData';

interface TasksTabProps {
  localTasks: Record<string, boolean[]>;
  onToggleTask: (taskIndex: number) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  localTasks,
  onToggleTask,
}) => {
  const todayKey = new Date().toDateString();
  const todayTasks = localTasks[todayKey] || Array(ROUTINE_TASKS.length).fill(false);
  const completedCount = todayTasks.filter(Boolean).length;
  const isAllDone = completedCount === ROUTINE_TASKS.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Routine Tasks Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Daily Store Routines & Operating Procedures
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Checklist resets automatically each day at midnight · {todayKey}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xs font-semibold text-slate-600">
              <span className="font-extrabold text-blue-600 text-sm">{completedCount}</span> /{' '}
              {ROUTINE_TASKS.length} Completed
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-6">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isAllDone ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
            style={{ width: `${(completedCount / ROUTINE_TASKS.length) * 100}%` }}
          />
        </div>

        {/* All done celebratory notice */}
        {isAllDone && (
          <div className="p-4 mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              All store operational routines for today are completed! Great job team SM Dasmariñas.
            </span>
          </div>
        )}

        {/* Task Items */}
        <div className="space-y-3">
          {ROUTINE_TASKS.map((taskText, idx) => {
            const isDone = Boolean(todayTasks[idx]);
            return (
              <label
                key={idx}
                className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
                  isDone
                    ? 'bg-slate-50/70 border-slate-200 text-slate-500'
                    : 'bg-white border-slate-200 hover:border-blue-300 text-slate-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => onToggleTask(idx)}
                  className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <div className="flex-1">
                  <div className={`text-xs font-semibold leading-relaxed ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {taskText}
                  </div>
                </div>
                {isDone && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};
