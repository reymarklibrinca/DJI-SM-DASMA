import React, { useState, useEffect } from 'react';
import { X, Target, Plus, Trash2, RotateCcw, Check } from 'lucide-react';
import { DEFAULT_MAIN_PUSH_TARGETS } from '../hooks/useDjiStore';

interface EditMainPushTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTargets: Record<string, number>;
  onSaveTargets: (newTargets: Record<string, number>) => void;
  onResetTargets?: () => void;
  soldByModel?: Record<string, number>;
}

export const EditMainPushTargetsModal: React.FC<EditMainPushTargetsModalProps> = ({
  isOpen,
  onClose,
  currentTargets,
  onSaveTargets,
  onResetTargets,
  soldByModel = {},
}) => {
  const [draftTargets, setDraftTargets] = useState<Record<string, number>>({});
  const [newModelName, setNewModelName] = useState('');
  const [newModelTarget, setNewModelTarget] = useState(10);
  const [isAddingNew, setIsAddingNew] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftTargets({
        ...DEFAULT_MAIN_PUSH_TARGETS,
        ...currentTargets,
      });
      setIsAddingNew(false);
      setNewModelName('');
      setNewModelTarget(10);
    }
  }, [isOpen, currentTargets]);

  if (!isOpen) return null;

  const handleTargetChange = (modelName: string, value: number) => {
    setDraftTargets((prev) => ({
      ...prev,
      [modelName]: Math.max(0, value),
    }));
  };

  const handleStep = (modelName: string, step: number) => {
    setDraftTargets((prev) => {
      const current = prev[modelName] ?? 0;
      return {
        ...prev,
        [modelName]: Math.max(0, current + step),
      };
    });
  };

  const handleRemoveModel = (modelName: string) => {
    setDraftTargets((prev) => {
      const next = { ...prev };
      delete next[modelName];
      return next;
    });
  };

  const handleAddNewModel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newModelName.trim();
    if (!trimmed) return;
    setDraftTargets((prev) => ({
      ...prev,
      [trimmed]: Math.max(1, Number(newModelTarget) || 1),
    }));
    setNewModelName('');
    setNewModelTarget(10);
    setIsAddingNew(false);
  };

  const handleReset = () => {
    setDraftTargets({ ...DEFAULT_MAIN_PUSH_TARGETS });
    if (onResetTargets) {
      onResetTargets();
    }
  };

  const handleSave = () => {
    onSaveTargets(draftTargets);
    onClose();
  };

  // Compute total store target
  const totalTargetUnits = Object.values(draftTargets).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const totalSoldUnits = Object.keys(draftTargets).reduce((sum, key) => sum + (soldByModel[key] || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Edit Main Push Targets
              </h2>
              <p className="text-xs text-slate-500">
                Set monthly unit targets for key focus models (synced to cloud)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Summary Box */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-blue-900">Total Main Push Targets</div>
              <div className="text-sm text-blue-700 mt-0.5">
                Current MTD Sold: <span className="font-bold">{totalSoldUnits}</span> units
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-blue-900">{totalTargetUnits} units</div>
              <div className="text-[10px] font-semibold text-blue-700">
                {Math.max(0, totalTargetUnits - totalSoldUnits)} units remaining
              </div>
            </div>
          </div>

          {/* Model Target Rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
              <span>Focus Model</span>
              <span>Target Units</span>
            </div>

            {Object.entries(draftTargets).map(([modelName, targetVal]) => {
              const sold = soldByModel[modelName] || 0;
              const remaining = Math.max(0, targetVal - sold);
              const pct = targetVal > 0 ? (sold / targetVal) * 100 : 0;
              const isDefault = modelName in DEFAULT_MAIN_PUSH_TARGETS;

              return (
                <div
                  key={modelName}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{modelName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span>Sold: <strong className="text-slate-800">{sold}</strong></span>
                      <span>·</span>
                      <span className={remaining === 0 ? 'text-emerald-600 font-bold' : 'text-amber-700 font-medium'}>
                        {remaining === 0 ? 'Target Reached!' : `${remaining} remaining`}
                      </span>
                      <span>·</span>
                      <span className="text-slate-600">({pct.toFixed(0)}%)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStep(modelName, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center transition-colors cursor-pointer"
                      title="Decrease by 1"
                    >
                      -
                    </button>

                    <input
                      type="number"
                      min={0}
                      value={targetVal}
                      onChange={(e) => handleTargetChange(modelName, Number(e.target.value) || 0)}
                      className="w-14 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-center font-black text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                      type="button"
                      onClick={() => handleStep(modelName, 1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center transition-colors cursor-pointer"
                      title="Increase by 1"
                    >
                      +
                    </button>

                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleRemoveModel(modelName)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors ml-1 cursor-pointer"
                        title="Remove custom model"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add New Model Form */}
          {isAddingNew ? (
            <form
              onSubmit={handleAddNewModel}
              className="p-3 bg-slate-50 border border-slate-300 rounded-xl space-y-2 animate-in fade-in duration-150"
            >
              <div className="font-bold text-slate-800 text-xs">Add New Focus Model Target</div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. Air 3S Series"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="col-span-2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min={1}
                  required
                  value={newModelTarget}
                  onChange={(e) => setNewModelTarget(Number(e.target.value) || 1)}
                  className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-md text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-600 text-white font-bold rounded-md text-xs hover:bg-blue-700 cursor-pointer"
                >
                  Add Model
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="w-full py-2 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl text-blue-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Focus Model</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 font-medium cursor-pointer"
            title="Reset to store default targets"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Targets</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
