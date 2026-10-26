import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Trash2,
  Target,
  ArrowRight,
} from 'lucide-react';
import { DEFAULT_MAIN_PUSH_TARGETS } from '../hooks/useDjiStore';

interface ParsedTargetRow {
  modelName: string;
  target: number;
  note?: string;
  status: 'valid' | 'invalid';
  statusNote?: string;
}

interface ImportMainPushTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTargets: Record<string, number>;
  onUpdateTargets: (newTargets: Record<string, number>) => void;
  onResetTargets?: () => void;
}

export const ImportMainPushTargetsModal: React.FC<ImportMainPushTargetsModalProps> = ({
  isOpen,
  onClose,
  currentTargets,
  onUpdateTargets,
  onResetTargets,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTargetRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleResetState = () => {
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    setSuccessMessage(null);
  };

  // 1-Click Download Excel Template
  const handleDownloadTemplate = () => {
    try {
      const activeTargets =
        Object.keys(currentTargets).length > 0
          ? currentTargets
          : DEFAULT_MAIN_PUSH_TARGETS;

      const rows: any[][] = [
        ['Focus Model / Series', 'Monthly Target (Units)', 'Notes'],
      ];

      Object.entries(activeTargets).forEach(([model, target]) => {
        let note = 'Hardware Focus Unit';
        if (model.includes('Mini')) note = 'Sub-249g Ultralight Drone';
        else if (model.includes('NEO')) note = 'Palm Takeoff Vlog Drone';
        else if (model.includes('Lito')) note = 'Pocket Cine Drone';
        else if (model.includes('OA') || model.includes('Action')) note = 'Action 5 Pro & Action 4';
        else if (model.includes('Pocket')) note = 'Pocket 3 & Pocket 4';

        rows.push([model, target, note]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Auto width for columns
      ws['!cols'] = [{ wch: 25 }, { wch: 22 }, { wch: 30 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Main Push Targets');
      XLSX.writeFile(wb, 'dji_main_push_targets_template.xlsx');
    } catch (err: any) {
      console.error('Failed to export Excel template:', err);
      setParseError('Failed to generate template: ' + err.message);
    }
  };

  // Process uploaded Excel / CSV file
  const processFile = (uploadedFile: File) => {
    setFile(uploadedFile);
    setParseError(null);
    setSuccessMessage(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('File reading returned empty result.');

        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          throw new Error('No sheets found in Excel file.');
        }

        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!rawRows || rawRows.length === 0) {
          throw new Error('The uploaded sheet is empty.');
        }

        // Find header row
        let headerRowIndex = -1;
        let modelCol = 0;
        let targetCol = 1;
        let noteCol = -1;

        for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
          const row = rawRows[r].map((cell) => String(cell || '').trim().toLowerCase());
          const hasModel = row.some((c) => c.includes('model') || c.includes('series') || c.includes('name') || c.includes('focus') || c.includes('item'));
          const hasTarget = row.some((c) => c.includes('target') || c.includes('quota') || c.includes('unit') || c.includes('qty') || c.includes('goal'));

          if (hasModel || hasTarget) {
            headerRowIndex = r;
            row.forEach((cell, idx) => {
              if (cell.includes('model') || cell.includes('series') || cell.includes('name') || cell.includes('focus') || cell.includes('item')) {
                modelCol = idx;
              }
              if (cell.includes('target') || cell.includes('quota') || cell.includes('unit') || cell.includes('qty') || cell.includes('goal')) {
                targetCol = idx;
              }
              if (cell.includes('note') || cell.includes('desc') || cell.includes('remark')) {
                noteCol = idx;
              }
            });
            break;
          }
        }

        const startIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
        const parsed: ParsedTargetRow[] = [];

        for (let i = startIndex; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0 || row.every((c) => c === '')) continue;

          const rawModel = String(row[modelCol] || '').trim();
          const rawTarget = row[targetCol];
          const rawNote = noteCol >= 0 ? String(row[noteCol] || '').trim() : '';

          if (!rawModel && (rawTarget === '' || rawTarget === undefined)) continue;

          const numTarget = Number(String(rawTarget).replace(/[^0-9.]/g, ''));
          const isValidTarget = !isNaN(numTarget) && numTarget >= 0;
          const isValidModel = rawModel.length > 0;

          if (isValidModel && isValidTarget) {
            parsed.push({
              modelName: rawModel,
              target: Math.round(numTarget),
              note: rawNote,
              status: 'valid',
            });
          } else {
            parsed.push({
              modelName: rawModel || 'Unknown Model',
              target: isNaN(numTarget) ? 0 : Math.round(numTarget),
              note: rawNote,
              status: 'invalid',
              statusNote: !isValidModel ? 'Missing model name' : 'Invalid target number',
            });
          }
        }

        if (parsed.length === 0) {
          throw new Error('No valid model target rows could be parsed from the file.');
        }

        setParsedRows(parsed);
      } catch (err: any) {
        console.error('Error parsing targets Excel:', err);
        setParseError(err.message || 'Failed to parse Excel file.');
        setParsedRows([]);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setParseError('Failed to read file from disk.');
      setIsProcessing(false);
    };

    reader.readAsBinaryString(uploadedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      if (
        dropped.name.endsWith('.xlsx') ||
        dropped.name.endsWith('.xls') ||
        dropped.name.endsWith('.csv')
      ) {
        processFile(dropped);
      } else {
        setParseError('Please upload an Excel file (.xlsx, .xls) or CSV file.');
      }
    }
  };

  // Commit valid targets
  const handleApplyTargets = () => {
    const valid = parsedRows.filter((r) => r.status === 'valid');
    if (valid.length === 0) {
      setParseError('No valid targets found to apply.');
      return;
    }

    const newTargetsRecord: Record<string, number> = {};
    valid.forEach((r) => {
      newTargetsRecord[r.modelName] = r.target;
    });

    onUpdateTargets(newTargetsRecord);
    setSuccessMessage(`Successfully applied ${valid.length} Main Push targets!`);

    setTimeout(() => {
      handleResetState();
      onClose();
    }, 1100);
  };

  const totalMonthlyTarget = useMemo(() => {
    return parsedRows
      .filter((r) => r.status === 'valid')
      .reduce((sum, r) => sum + r.target, 0);
  }, [parsedRows]);

  const validCount = parsedRows.filter((r) => r.status === 'valid').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Import Main Push Targets
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Excel Template
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Set store focus models and monthly unit quotas using an Excel spreadsheet.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              title="Download clean Excel template pre-populated with current models"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download Template</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Error Banner */}
          {parseError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Error Processing File</div>
                  <div>{parseError}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setParseError(null)}
                className="text-xs font-bold text-rose-600 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="font-bold text-xs">{successMessage}</div>
            </div>
          )}

          {/* Upload Dropzone */}
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Click to browse or drag & drop your Excel targets file
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Upload <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> with your Focus Models and Monthly Targets.
              </p>

              <div className="mt-4 pt-3 border-t border-slate-200/80 inline-flex items-center gap-2 text-slate-600 text-[11px]">
                <span>Need the official format?</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadTemplate();
                  }}
                  className="font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Excel Template (.xlsx)</span>
                </button>
              </div>
            </div>
          ) : (
            /* File Loaded & Parsed Preview */
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span>{file.name}</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {validCount} valid focus models · Total monthly target: <strong>{totalMonthlyTarget} units</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetState}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Change File</span>
                </button>
              </div>

              {/* Targets Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span>Detected Focus Models</span>
                  <span>Target Units</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {parsedRows.map((row, idx) => (
                    <div
                      key={idx}
                      className={`px-3.5 py-2.5 flex items-center justify-between text-xs ${
                        row.status === 'invalid' ? 'bg-rose-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{row.modelName}</span>
                          {row.status === 'invalid' && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded font-semibold">
                              {row.statusNote}
                            </span>
                          )}
                        </div>
                        {row.note && (
                          <div className="text-[11px] text-slate-500">{row.note}</div>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900">
                          {row.target}{' '}
                          <span className="text-[11px] font-normal text-slate-500">units</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Store Total Target</span>
                  <span className="text-emerald-700 text-sm font-black">{totalMonthlyTarget} units</span>
                </div>
              </div>
            </div>
          )}

          {/* Current Active Targets Reference */}
          {!file && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Currently Active Targets:</span>
                {onResetTargets && (
                  <button
                    type="button"
                    onClick={onResetTargets}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Defaults</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(currentTargets).map(([name, tgt]) => (
                  <div
                    key={name}
                    className="bg-white p-2 rounded-lg border border-slate-200 text-xs flex justify-between items-center"
                  >
                    <span className="font-medium text-slate-700 truncate pr-1">{name}</span>
                    <span className="font-bold text-slate-900 shrink-0">{tgt} u</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {file && validCount > 0 && (
              <button
                type="button"
                onClick={handleApplyTargets}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply Targets ({validCount} models)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
