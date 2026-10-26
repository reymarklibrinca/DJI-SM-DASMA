import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ClearSystemDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClear: () => Promise<void> | void;
  currentSalesCount: number;
}

export const ClearSystemDataModal: React.FC<ClearSystemDataModalProps> = ({
  isOpen,
  onClose,
  onConfirmClear,
  currentSalesCount,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirmClear();
      setHasConfirmed(true);
      setTimeout(() => {
        setHasConfirmed(false);
        setIsDeleting(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Error clearing system data:', err);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-800">
            <div className="p-2 bg-rose-100 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <h3 className="font-bold text-base text-rose-950">Clear All System Data</h3>
              <p className="text-xs text-rose-700 font-medium">Permanent System Reset</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-rose-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {hasConfirmed ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-slate-900 text-lg">System Data Wiped</h4>
              <p className="text-xs text-slate-500">
                All sales records, leads, and store locks have been cleared. All 1,081 units are back in stock.
              </p>
            </div>
          ) : (
            <>
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Are you sure you want to delete all system data?</p>
                  <p className="text-amber-800 leading-relaxed">
                    This will permanently remove all sales records ({currentSalesCount} transactions), customer leads, daily finalized states, and routine task checkboxes from both your browser and Firebase cloud storage.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="font-semibold text-slate-800 mb-1">What happens:</div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Sales & Revenue reset to <strong>₱0.00 (0 units sold)</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Customer follow-up leads reset to <strong>0</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>All <strong>1,081 inventory units</strong> restored to <strong>IN STOCK</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>Catalog specifications and staff list (Christian, Donna, Jobert) are <strong>preserved</strong></span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                Use POS Quick Log or "Import Excel" afterwards to input fresh transactions.
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Clearing Data...' : 'Yes, Delete All Data'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
