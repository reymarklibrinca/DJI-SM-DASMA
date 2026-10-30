import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Barcode,
  Layers,
  Box,
  RotateCcw,
  Tag,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  ArrowRight,
  Sparkles,
  Wrench,
  Edit2,
  X,
} from 'lucide-react';
import { UnitTuple, StockTuple } from '../types';
import { DJI_DATA } from '../data/initialData';
import { formatCurrency } from '../utils/calculations';

interface ImportInventoryTabProps {
  units: UnitTuple[];
  onImportAppend: (newUnits: UnitTuple[]) => void;
  onImportOverride: (allUnits: UnitTuple[]) => void;
  onAddUnit: (unit: UnitTuple) => void;
  onDeleteUnit: (serialNumber: string) => void;
  onResetToMaster: () => void;
  onDeleteAllInventory?: () => void;
}

interface ParsedInventoryRow {
  rowNumber: number;
  ean: string;
  serialNumber: string;
  productName: string;
  seriesName: string;
  price: number;
  status: 'IN STOCK' | 'SOLD';
  isValid: boolean;
  isDuplicateInFile?: boolean;
  isExistingInStore?: boolean;
  statusNote: string;
}

export const ImportInventoryTab: React.FC<ImportInventoryTabProps> = ({
  units,
  onImportAppend,
  onImportOverride,
  onAddUnit,
  onDeleteUnit,
  onResetToMaster,
  onDeleteAllInventory,
}) => {
  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedInventoryRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'override'>('append');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'issues'>('all');
  const [editingInvRow, setEditingInvRow] = useState<ParsedInventoryRow | null>(null);

  // Quick Single-Unit Input Form
  const [manualEan, setManualEan] = useState('');
  const [manualSn, setManualSn] = useState('');
  const [selectedProductIdx, setSelectedProductIdx] = useState<number>(0);
  const [manualPrice, setManualPrice] = useState<number>(0);
  const [manualSeries, setManualSeries] = useState<string>('');
  const [manualStatus, setManualStatus] = useState<'IN STOCK' | 'SOLD'>('IN STOCK');

  // Search & Registry Filters
  const [registrySearch, setRegistrySearch] = useState('');
  const [registrySeriesFilter, setRegistrySeriesFilter] = useState('');
  const [registryStatusFilter, setRegistryStatusFilter] = useState<'ALL' | 'IN STOCK' | 'SOLD'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Confirm reset and delete all modals
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isConfirmingDeleteAll, setIsConfirmingDeleteAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fast set of existing serial numbers in active inventory
  const existingSnSet = useMemo(() => {
    const set = new Set<string>();
    units.forEach((u) => set.add(u[0].toUpperCase()));
    return set;
  }, [units]);

  // Master product catalog lookup
  const productCatalog = useMemo(() => {
    return [...DJI_DATA.stock].sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const productLookupMap = useMemo(() => {
    const map = new Map<string, { series: string; price: number }>();
    DJI_DATA.stock.forEach((s) => {
      map.set(s[1].toUpperCase(), { series: s[0], price: s[2] });
    });
    return map;
  }, []);

  // Sync price & series when user changes product dropdown in quick manual form
  const handleProductSelect = (idx: number) => {
    setSelectedProductIdx(idx);
    const prod = productCatalog[idx];
    if (prod) {
      setManualPrice(prod[2]);
      setManualSeries(prod[0]);
    }
  };

  // 1-Click Download Official Excel Template
  const handleDownloadTemplate = () => {
    try {
      const templateRows = [
        ['EAN / Barcode', 'Serial Number (SN)', 'Product Name', 'Category / Series', 'Status'],
        ['6941565983712', '1581F895C262401709R5', 'DJI Air 3S Fly More Combo (DJI RC-N3)', 'AIR 3S SERIES', 'IN STOCK'],
        ['6941565988113', '9KRXP3P00BV881', 'Osmo Action 6 Adventure Combo', 'OSMO ACTION 6 SERIES', 'IN STOCK'],
        ['6941565984429', 'ANGVP1J0020KTA', 'Osmo Pocket 4 Standard Combo', 'OSMO POCKET 4 SERIES', 'IN STOCK'],
        ['6941565982104', '1581F9DEC25AL029CX61', 'DJI Mini 5 Pro', 'MINI 5 PRO SERIES', 'IN STOCK'],
        ['6941565981152', '1581FA6QC25B700CZ2QJ', 'DJI NEO 2', 'NEO 2 SERIES', 'IN STOCK'],
        ['6941565980025', 'B3QTP4M0014J87', 'DJI Mic Mini 2 (1 TX + 1 Mobile RX + Charging Case)', 'DJI MIC MINI 2 SERIES', 'IN STOCK'],
        ['6941565979814', '1581FB34C261T00396Z8', 'DJI Lito X1', 'LITO X1 SERIES', 'IN STOCK'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateRows);
      ws['!cols'] = [
        { wch: 18 }, // EAN
        { wch: 24 }, // SN
        { wch: 44 }, // Product Name
        { wch: 22 }, // Series
        { wch: 14 }, // Status
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory Import');
      XLSX.writeFile(wb, 'dji_inventory_import_template.xlsx');
    } catch (err: any) {
      console.error('Error downloading inventory template:', err);
      setParseError('Failed to generate template: ' + err.message);
    }
  };

  // Export entire active inventory to Excel
  const handleExportActiveInventory = () => {
    try {
      const rows = [
        ['EAN / Barcode', 'Serial Number (SN)', 'Product Name', 'Category / Series', 'Status'],
      ];

      units.forEach((u) => {
        rows.push([
          u[5] || '',
          u[0],
          u[1],
          u[3],
          u[4] || 'IN STOCK',
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 18 },
        { wch: 24 },
        { wch: 44 },
        { wch: 22 },
        { wch: 14 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Active Store Inventory');
      XLSX.writeFile(wb, `dji_store_inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      console.error('Error exporting inventory:', err);
      setParseError('Failed to export inventory: ' + err.message);
    }
  };

  // Parse Uploaded Excel File
  const processExcelFile = (uploadedFile: File) => {
    setFile(uploadedFile);
    setParseError(null);
    setFeedback(null);
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
          throw new Error('The uploaded sheet contains no data.');
        }

        // Locate header row or use column heuristics
        let headerRowIndex = -1;
        let colEan = -1;
        let colSn = -1;
        let colProduct = -1;
        let colPrice = -1;
        let colSeries = -1;
        let colStatus = -1;

        for (let r = 0; r < Math.min(rawRows.length, 6); r++) {
          const row = rawRows[r].map((cell) => String(cell || '').trim().toLowerCase());
          const hasEan = row.some((c) => c.includes('ean') || c.includes('barcode') || c.includes('upc'));
          const hasSn = row.some((c) => c.includes('sn') || c.includes('serial') || c.includes('imei'));
          const hasProd = row.some((c) => c.includes('product') || c.includes('item') || c.includes('desc') || c.includes('model') || c.includes('name'));

          if (hasSn || hasEan || hasProd) {
            headerRowIndex = r;
            row.forEach((cell, idx) => {
              if (cell.includes('ean') || cell.includes('barcode') || cell.includes('upc')) colEan = idx;
              if (cell.includes('sn') || cell.includes('serial') || cell.includes('imei')) colSn = idx;
              if (cell.includes('product') || cell.includes('item') || cell.includes('desc') || cell.includes('model') || cell.includes('name')) colProduct = idx;
              if (cell.includes('price') || cell.includes('srp') || cell.includes('amount') || cell.includes('cost')) colPrice = idx;
              if (cell.includes('series') || cell.includes('category') || cell.includes('line')) colSeries = idx;
              if (cell.includes('status') || cell.includes('state')) colStatus = idx;
            });
            break;
          }
        }

        // Fallbacks if no header row detected
        if (headerRowIndex === -1) {
          headerRowIndex = 0;
          colEan = 0;
          colSn = 1;
          colProduct = 2;
          colPrice = 3;
          colSeries = 4;
          colStatus = 5;
        }

        const parsed: ParsedInventoryRow[] = [];
        const seenSnInFile = new Set<string>();

        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0 || row.every((c) => String(c).trim() === '')) continue;

          const rawEan = colEan >= 0 ? String(row[colEan] || '').trim() : '';
          const rawSn = colSn >= 0 ? String(row[colSn] || '').trim().toUpperCase() : '';
          const rawProduct = colProduct >= 0 ? String(row[colProduct] || '').trim() : '';
          const rawPrice = colPrice >= 0 ? row[colPrice] : '';
          const rawSeries = colSeries >= 0 ? String(row[colSeries] || '').trim() : '';
          const rawStatus = colStatus >= 0 ? String(row[colStatus] || '').trim().toUpperCase() : '';

          if (!rawSn && !rawProduct && !rawEan) continue;

          // Resolve product info from catalog if missing price or series
          let resolvedProduct = rawProduct;
          let resolvedSeries = rawSeries;
          let resolvedPrice = Number(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

          if (rawProduct) {
            const catalogMatch = productLookupMap.get(rawProduct.toUpperCase());
            if (catalogMatch) {
              if (!resolvedSeries) resolvedSeries = catalogMatch.series;
              if (!resolvedPrice) resolvedPrice = catalogMatch.price;
            }
          }

          if (!resolvedSeries) resolvedSeries = 'GENERAL';

          // Determine status
          const resolvedStatus: 'IN STOCK' | 'SOLD' = rawStatus.includes('SOLD') ? 'SOLD' : 'IN STOCK';

          // Validate SN and duplicates
          const isDuplicateInFile = Boolean(rawSn && seenSnInFile.has(rawSn));
          if (rawSn) seenSnInFile.add(rawSn);

          const isExistingInStore = Boolean(rawSn && existingSnSet.has(rawSn));

          const isValid = rawSn.length >= 3 && resolvedProduct.length > 0;
          let statusNote = 'Ready to import';
          if (!rawSn) statusNote = 'Missing Serial Number';
          else if (!resolvedProduct) statusNote = 'Missing Product Name';
          else if (isDuplicateInFile) statusNote = 'Duplicate SN in this file';
          else if (isExistingInStore) statusNote = 'Already exists in store inventory (will update)';

          parsed.push({
            rowNumber: i + 1,
            ean: rawEan,
            serialNumber: rawSn,
            productName: resolvedProduct,
            seriesName: resolvedSeries,
            price: resolvedPrice,
            status: resolvedStatus,
            isValid,
            isDuplicateInFile,
            isExistingInStore,
            statusNote,
          });
        }

        if (parsed.length === 0) {
          throw new Error('No valid inventory rows could be extracted. Please check file format.');
        }

        setParsedRows(parsed);
      } catch (err: any) {
        console.error('Error parsing inventory Excel:', err);
        setParseError(err.message || 'Failed to read Excel file.');
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
        processExcelFile(dropped);
      } else {
        setParseError('Please upload an Excel file (.xlsx, .xls) or CSV.');
      }
    }
  };

  // Commit Parsed Rows
  const handleCommitParsedRows = () => {
    const validRows = parsedRows.filter((r) => r.isValid && !r.isDuplicateInFile);
    if (validRows.length === 0) {
      setParseError('No valid rows available to import.');
      return;
    }

    const newUnits: UnitTuple[] = validRows.map((r) => [
      r.serialNumber,
      r.productName,
      r.price,
      r.seriesName,
      r.status,
      r.ean || '',
    ]);

    if (importMode === 'override') {
      onImportOverride(newUnits);
      setFeedback({
        type: 'success',
        message: `Inventory successfully replaced with ${newUnits.length} units from Excel!`,
      });
    } else {
      onImportAppend(newUnits);
      setFeedback({
        type: 'success',
        message: `Successfully imported ${newUnits.length} incoming units into active inventory!`,
      });
    }

    // Reset upload preview
    setFile(null);
    setParsedRows([]);
    setEditingInvRow(null);
  };

  // Auto-Fix All Inventory Rows with Errors or Missing Data
  const handleAutoFixAllInventory = () => {
    let fixCount = 0;
    const seenSn = new Set<string>();

    const updated = parsedRows.map((r) => {
      let isChanged = false;
      let newSn = (r.serialNumber || '').trim().toUpperCase();
      let newEan = (r.ean || '').trim();
      let newProduct = r.productName.trim();
      let newSeries = r.seriesName.trim();
      let newPrice = r.price;

      // 1. Resolve missing product by EAN
      if ((!newProduct || newProduct === 'DJI Unit') && newEan) {
        const u = DJI_DATA.units.find((unit) => unit[5] === newEan);
        if (u) {
          newProduct = u[1];
          newSeries = u[3];
          if (!newPrice) newPrice = u[2];
          isChanged = true;
        }
      }

      // 2. Resolve missing series and price from catalog
      if (newProduct) {
        const catItem = productLookupMap.get(newProduct.toUpperCase());
        if (catItem) {
          if (!newSeries || newSeries === 'GENERAL') {
            newSeries = catItem.series;
            isChanged = true;
          }
          if (!newPrice || newPrice <= 0) {
            newPrice = catItem.price;
            isChanged = true;
          }
        }
      }

      if (!newSeries) newSeries = 'GENERAL';

      // 3. Resolve missing SN
      if (!newSn || newSn.length < 3) {
        newSn = `GEN-${Date.now().toString().slice(-6)}-${r.rowNumber.toString().padStart(3, '0')}`;
        isChanged = true;
      }

      // 4. Resolve duplicates in file
      if (seenSn.has(newSn)) {
        newSn = `${newSn}-D${r.rowNumber}`;
        isChanged = true;
      }
      seenSn.add(newSn);

      const isExistingInStore = existingSnSet.has(newSn);
      const isValid = newSn.length >= 3 && Boolean(newProduct);
      if (isChanged || !r.isValid) fixCount++;

      return {
        ...r,
        serialNumber: newSn,
        ean: newEan,
        productName: newProduct,
        seriesName: newSeries,
        price: newPrice,
        isValid,
        isDuplicateInFile: false,
        isExistingInStore,
        statusNote: isValid
          ? isChanged
            ? 'Auto-Fixed & Validated'
            : isExistingInStore
            ? 'Already in store (will update)'
            : 'Ready to import'
          : 'Missing product or SN',
      };
    });

    setParsedRows(updated);
    setFeedback({
      type: 'success',
      message: `Auto-repair complete! Corrected and validated ${fixCount} inventory item(s).`,
    });
  };

  const handleSaveInvRowEdit = (updated: ParsedInventoryRow) => {
    const isValid = updated.serialNumber.trim().length >= 3 && updated.productName.trim().length > 0;
    const finalRow: ParsedInventoryRow = {
      ...updated,
      serialNumber: updated.serialNumber.trim().toUpperCase(),
      productName: updated.productName.trim(),
      isValid,
      statusNote: isValid ? 'Manually Fixed & Verified' : 'Missing SN or Product Name',
    };
    setParsedRows((prev) =>
      prev.map((r) => (r.rowNumber === updated.rowNumber ? finalRow : r))
    );
    setEditingInvRow(null);
  };

  const handleDeleteInvRow = (rowNumber: number) => {
    setParsedRows((prev) => prev.filter((r) => r.rowNumber !== rowNumber));
    if (editingInvRow?.rowNumber === rowNumber) {
      setEditingInvRow(null);
    }
  };

  // Quick Manual Add Unit
  const handleAddManualUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const sn = manualSn.trim().toUpperCase();
    if (!sn) {
      setFeedback({ type: 'error', message: 'Serial Number (SN) is required.' });
      return;
    }

    const prod = productCatalog[selectedProductIdx];
    const productName = prod ? prod[1] : 'DJI Unit';
    const series = manualSeries || (prod ? prod[0] : 'GENERAL');
    const price = manualPrice || (prod ? prod[2] : 0);

    const newUnit: UnitTuple = [
      sn,
      productName,
      price,
      series,
      manualStatus,
      manualEan.trim(),
    ];

    onAddUnit(newUnit);
    setFeedback({
      type: 'success',
      message: `Unit ${sn} (${productName}) added to inventory!`,
    });

    // Reset fields
    setManualSn('');
    setManualEan('');
  };

  // Summary Metrics
  const totalUnitsCount = units.length;
  const inStockUnitsCount = useMemo(() => units.filter((u) => u[4] === 'IN STOCK').length, [units]);
  const soldUnitsCount = useMemo(() => units.filter((u) => u[4] === 'SOLD').length, [units]);
  const totalValuation = useMemo(
    () => units.filter((u) => u[4] === 'IN STOCK').reduce((sum, u) => sum + (u[2] || 0), 0),
    [units]
  );
  const uniqueSkusCount = useMemo(() => {
    const s = new Set<string>();
    units.forEach((u) => s.add(u[1]));
    return s.size;
  }, [units]);

  // Registry Filtered & Paginated
  const filteredRegistryUnits = useMemo(() => {
    const q = registrySearch.trim().toUpperCase();
    return units.filter((u) => {
      if (registryStatusFilter !== 'ALL' && u[4] !== registryStatusFilter) return false;
      if (registrySeriesFilter && u[3] !== registrySeriesFilter) return false;
      if (!q) return true;

      const sn = u[0].toUpperCase();
      const name = u[1].toUpperCase();
      const ean = (u[5] || '').toUpperCase();
      const ser = u[3].toUpperCase();
      return sn.includes(q) || name.includes(q) || ean.includes(q) || ser.includes(q);
    });
  }, [units, registrySearch, registrySeriesFilter, registryStatusFilter]);

  const totalRegistryPages = Math.ceil(filteredRegistryUnits.length / pageSize) || 1;
  const paginatedRegistryUnits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistryUnits.slice(start, start + pageSize);
  }, [filteredRegistryUnits, currentPage]);

  const availableSeries = useMemo(() => {
    const set = new Set<string>();
    units.forEach((u) => {
      if (u[3]) set.add(u[3]);
    });
    DJI_DATA.ser.forEach((s) => set.add(s));
    return Array.from(set).sort();
  }, [units]);

  return (
    <div className="space-y-6">
      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-blue-600" />
            <span>Total Registry</span>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {totalUnitsCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Across {uniqueSkusCount} unique products</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>In Stock</span>
          </div>
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            {inStockUnitsCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">Available for sale</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            <span>Recorded Sold</span>
          </div>
          <div className="text-2xl font-black text-slate-700 tracking-tight">
            {soldUnitsCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Deducted from stock</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Valuation at SRP (In Stock)</span>
          </div>
          <div className="text-2xl font-black text-blue-700 tracking-tight">
            {formatCurrency(totalValuation)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Total retail asset valuation on floor & backroom</div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-800 font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MAIN IMPORT SECTION (Excel Template & Drag-and-Drop) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Bulk Inventory Import (EAN, SN, Product Name)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Excel / CSV
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload new stock shipments or warehouse deliveries. System verifies Serial Numbers and EAN barcodes.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all cursor-pointer shadow-2xs"
              title="Download pre-formatted Excel template with EAN, SN, Product Name columns"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download Excel Template</span>
            </button>
            <button
              type="button"
              onClick={handleExportActiveInventory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              title="Export all current active units to Excel spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export Stock (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {parseError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Error reading file: </span>
                <span>{parseError}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setParseError(null)}
              className="font-bold text-rose-600 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dropzone if no file chosen */}
        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all ${
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
                  processExcelFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3 shadow-xs">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              Click to browse or drag & drop your Inventory file here
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Accepts <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> with columns for{' '}
              <strong>EAN / Barcode</strong>, <strong>Serial Number (SN)</strong>, and <strong>Product Name</strong>.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-slate-600">
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold">
                EAN / Barcode
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold text-blue-700">
                Serial Number (SN)
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold">
                Product Name
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-slate-400">
                Price (Optional)
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-slate-400">
                Series (Optional)
              </span>
            </div>
          </div>
        ) : (
          /* File Uploaded & Parsed Preview Card */
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>{file.name}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {parsedRows.filter((r) => r.isValid).length} valid serialized units found in sheet
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsedRows([]);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Choose Another File</span>
                </button>
              </div>
            </div>

            {/* Import Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label
                onClick={() => setImportMode('append')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  importMode === 'append'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="inventoryImportMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>Append to Current Inventory</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900 uppercase font-extrabold">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Add newly delivered serialized boxes to current in-store stock without deleting existing units.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setImportMode('override')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  importMode === 'override'
                    ? 'border-rose-600 bg-rose-50/50 text-rose-950 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="inventoryImportMode"
                  checked={importMode === 'override'}
                  onChange={() => setImportMode('override')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="font-bold text-rose-900">Replace / Override All Inventory</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Completely resets the active inventory list and sets only the rows from this Excel file as store stock.
                  </p>
                </div>
              </label>
            </div>

            {/* Auto-Repair Issues Banner */}
            {parsedRows.some((r) => !r.isValid || r.isDuplicateInFile) && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                      <span>
                        Data Cleaning Required: {parsedRows.filter((r) => !r.isValid || r.isDuplicateInFile).length} item(s) need attention
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Missing serial numbers, unmatched barcodes, or duplicates detected. Auto-repair matches products to catalog and generates clean tracking SNs.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAutoFixAllInventory}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-200 animate-pulse" />
                    <span>Auto-Fix File Data ({parsedRows.filter((r) => !r.isValid || r.isDuplicateInFile).length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter Pills */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    previewFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({parsedRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('valid')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    previewFilter === 'valid'
                      ? 'bg-white text-emerald-800 shadow-2xs'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  Ready ({parsedRows.filter((r) => r.isValid && !r.isDuplicateInFile).length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('issues')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    previewFilter === 'issues'
                      ? 'bg-white text-amber-900 shadow-2xs'
                      : 'text-amber-700 hover:text-amber-900'
                  }`}
                >
                  <span>Needs Fix</span>
                  {parsedRows.some((r) => !r.isValid || r.isDuplicateInFile) && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                      {parsedRows.filter((r) => !r.isValid || r.isDuplicateInFile).length}
                    </span>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                Showing {previewFilter === 'all' ? parsedRows.length : previewFilter === 'valid' ? parsedRows.filter((r) => r.isValid && !r.isDuplicateInFile).length : parsedRows.filter((r) => !r.isValid || r.isDuplicateInFile).length} rows
              </div>
            </div>

            {/* Parsed Rows Preview Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>File Preview ({parsedRows.length} rows)</span>
                <span className="text-emerald-700">
                  {parsedRows.filter((r) => r.isValid).length} Ready to Import
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                {(previewFilter === 'valid'
                  ? parsedRows.filter((r) => r.isValid && !r.isDuplicateInFile)
                  : previewFilter === 'issues'
                  ? parsedRows.filter((r) => !r.isValid || r.isDuplicateInFile)
                  : parsedRows
                )
                  .slice(0, 50)
                  .map((r, idx) => (
                    <div
                      key={idx}
                      className={`px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        !r.isValid ? 'bg-rose-50/60' : r.isDuplicateInFile ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 font-mono w-6">#{r.rowNumber}</span>
                        <div>
                          <div className="font-mono font-bold text-slate-900 flex items-center gap-2">
                            <span>{r.serialNumber || '–'}</span>
                            {r.ean && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                                EAN: {r.ean}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {r.productName}{' '}
                            <span className="text-slate-400">({r.seriesName})</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right shrink-0">
                        <div className="text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              r.status === 'IN STOCK' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            r.isValid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.statusNote}
                        </span>

                        <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                          <button
                            type="button"
                            onClick={() => setEditingInvRow(r)}
                            className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Edit & fix this item"
                          >
                            <Wrench className="w-3 h-3 text-blue-600" />
                            <span>Fix</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvRow(r.rowNumber)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Discard this row"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              {parsedRows.length > 50 && (
                <div className="p-2.5 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
                  Showing first 50 rows of {parsedRows.length} total. All valid rows will be committed.
                </div>
              )}
            </div>

            {/* Commit Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setParsedRows([]);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitParsedRows}
                disabled={isProcessing || parsedRows.filter((r) => r.isValid).length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  Confirm & Import {parsedRows.filter((r) => r.isValid).length} Units (
                  {importMode === 'append' ? 'Append' : 'Replace All'})
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QUICK SINGLE UNIT RECEIVING FORM (Barcode Scanner Friendly) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Barcode className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Quick Barcode Scanner & Single Unit Entry
            </h3>
            <p className="text-xs text-slate-500">
              Rapidly scan incoming boxed units directly to inventory with handheld barcode gun or manual entry.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddManualUnit} className="grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs">
          {/* EAN / Barcode */}
          <div className="sm:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">EAN / Barcode</label>
            <input
              type="text"
              placeholder="e.g. 6941565983712"
              value={manualEan}
              onChange={(e) => setManualEan(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Serial Number (SN) */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Serial Number (SN) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1581F895C262401709R5"
              value={manualSn}
              onChange={(e) => setManualSn(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 uppercase"
            />
          </div>

          {/* Product Name Autocomplete Dropdown */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Product Model</label>
            <select
              value={selectedProductIdx}
              onChange={(e) => handleProductSelect(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold"
            >
              {productCatalog.map((prod, idx) => (
                <option key={idx} value={idx}>
                  {prod[1]}
                </option>
              ))}
            </select>
          </div>

          {/* Add Button */}
          <div className="sm:col-span-1 flex items-end">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Stock</span>
            </button>
          </div>
        </form>
      </div>

      {/* ACTIVE INVENTORY REGISTRY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Active Store Inventory Registry ({units.length.toLocaleString()} Units)
            </h3>
            <p className="text-xs text-slate-500">
              Search by EAN, Serial Number, Product Name, or Series category.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Delete All Inventory Button */}
            {isConfirmingDeleteAll ? (
              <div className="flex items-center gap-1.5 p-1 bg-rose-50 border border-rose-300 rounded-xl animate-in fade-in">
                <span className="text-[11px] text-rose-800 font-bold px-1.5">Delete all {units.length} units?</span>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteAllInventory) {
                      onDeleteAllInventory();
                    } else {
                      onImportOverride([]);
                    }
                    setIsConfirmingDeleteAll(false);
                    setFeedback({ type: 'info', message: 'All inventory data has been deleted (0 items in stock).' });
                  }}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Yes, Wipe All
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDeleteAll(false)}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsConfirmingDeleteAll(true);
                  setIsConfirmingReset(false);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition-all cursor-pointer shadow-2xs"
                title="Wipe and clear all inventory records to 0 units"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All Inventory</span>
              </button>
            )}

            {/* Reset to Master Stock Button */}
            {isConfirmingReset ? (
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-300 rounded-xl animate-in fade-in">
                <span className="text-[11px] text-slate-700 font-bold px-1.5">Reset back to master baseline?</span>
                <button
                  type="button"
                  onClick={() => {
                    onResetToMaster();
                    setIsConfirmingReset(false);
                    setFeedback({ type: 'info', message: 'Inventory reset to master stock baseline.' });
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Yes, Reset
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingReset(false)}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsConfirmingReset(true);
                  setIsConfirmingDeleteAll(false);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Reset active inventory back to original baseline (1,081 units)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Master Stock</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by EAN, Serial Number, or Product Name..."
              value={registrySearch}
              onChange={(e) => {
                setRegistrySearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Series Category Filter */}
          <select
            value={registrySeriesFilter}
            onChange={(e) => {
              setRegistrySeriesFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800"
          >
            <option value="">All Categories ({availableSeries.length})</option>
            {availableSeries.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
            {(['ALL', 'IN STOCK', 'SOLD'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setRegistryStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  registryStatusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Units Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">EAN / Barcode</th>
                <th className="py-2.5 px-3">Serial Number (SN)</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Category / Series</th>
                <th className="py-2.5 px-3 text-right">Price (SRP)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedRegistryUnits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    {units.length === 0 ? (
                      <div className="space-y-2">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">All Inventory Data Cleared (0 Units)</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Your active inventory has 0 units. You can import new stock via Excel/CSV using the dropzone above, add individual units, or restore master baseline.
                        </p>
                      </div>
                    ) : (
                      <span>No units matching search criteria.</span>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedRegistryUnits.map((u, idx) => (
                  <tr key={`${u[0]}_${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {u[5] ? (
                        <span className="font-semibold text-slate-700">{u[5]}</span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {u[0]}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 font-semibold max-w-[260px] truncate">
                      {u[1]}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-[10px]">
                        {u[3]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                      {formatCurrency(u[2])}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          u[4] === 'IN STOCK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {u[4]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteUnit(u[0]);
                          setFeedback({
                            type: 'info',
                            message: `Unit ${u[0]} removed from inventory.`,
                          });
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="Delete unit from active inventory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 pt-1">
          <div>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * pageSize, filteredRegistryUnits.length)}</strong> of{' '}
            <strong>{filteredRegistryUnits.length.toLocaleString()}</strong> units
          </div>

          <div className="flex items-center gap-1.5 self-center">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold text-slate-700">
              Page {currentPage} of {totalRegistryPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalRegistryPages}
              onClick={() => setCurrentPage((p) => Math.min(totalRegistryPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      {/* Fix Single Inventory Item Modal */}
      {editingInvRow && (
        <FixInventoryRowDialog
          row={editingInvRow}
          productCatalog={productCatalog}
          onSave={handleSaveInvRowEdit}
          onDelete={handleDeleteInvRow}
          onClose={() => setEditingInvRow(null)}
          allRows={parsedRows}
          onSelectNext={(nextRow) => setEditingInvRow(nextRow)}
        />
      )}
    </div>
  );
};

interface FixInventoryRowDialogProps {
  row: ParsedInventoryRow;
  productCatalog: StockTuple[];
  onSave: (updated: ParsedInventoryRow) => void;
  onDelete: (rowNumber: number) => void;
  onClose: () => void;
  allRows: ParsedInventoryRow[];
  onSelectNext: (next: ParsedInventoryRow) => void;
}

const FixInventoryRowDialog: React.FC<FixInventoryRowDialogProps> = ({
  row,
  productCatalog,
  onSave,
  onDelete,
  onClose,
  allRows,
  onSelectNext,
}) => {
  const [sn, setSn] = useState(row.serialNumber);
  const [productName, setProductName] = useState(row.productName);
  const [seriesName, setSeriesName] = useState(row.seriesName);
  const [price, setPrice] = useState(row.price);
  const [status, setStatus] = useState<'IN STOCK' | 'SOLD'>(row.status);
  const [ean, setEan] = useState(row.ean || '');
  const [catalogSearch, setCatalogSearch] = useState('');

  const otherIssues = useMemo(() => {
    return allRows.filter(
      (r) => r.rowNumber !== row.rowNumber && (!r.isValid || r.isDuplicateInFile)
    );
  }, [allRows, row.rowNumber]);

  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return productCatalog.slice(0, 15);
    const q = catalogSearch.toLowerCase().trim();
    return productCatalog
      .filter((p) => p[1].toLowerCase().includes(q) || p[0].toLowerCase().includes(q))
      .slice(0, 20);
  }, [catalogSearch, productCatalog]);

  const handleSelectProduct = (prod: StockTuple) => {
    setProductName(prod[1]);
    setSeriesName(prod[0]);
    setPrice(prod[2]);
    setCatalogSearch('');
  };

  const handleAutoGenerateSn = () => {
    setSn(`DJI-${Date.now().toString().slice(-6)}-${row.rowNumber.toString().padStart(3, '0')}`);
  };

  const handleSaveAndClose = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated: ParsedInventoryRow = {
      ...row,
      serialNumber: sn.trim().toUpperCase(),
      productName: productName.trim() || 'DJI Unit',
      seriesName: seriesName || 'GENERAL',
      price: Number(price) || 0,
      status,
      ean: ean.trim(),
    };
    onSave(updated);
  };

  const handleSaveAndNext = () => {
    const updated: ParsedInventoryRow = {
      ...row,
      serialNumber: sn.trim().toUpperCase(),
      productName: productName.trim() || 'DJI Unit',
      seriesName: seriesName || 'GENERAL',
      price: Number(price) || 0,
      status,
      ean: ean.trim(),
    };
    onSave(updated);
    if (otherIssues.length > 0) {
      onSelectNext(otherIssues[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  Fix Inventory Item - Row #{row.rowNumber}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    row.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {row.statusNote}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ensure accurate serial number and product mapping before receiving into store
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSaveAndClose} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Quick Product Matcher from Catalog */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Select from Official DJI Catalog</span>
              </span>
              <span className="text-[10px] text-slate-500">Auto-sets category & SRP</span>
            </div>
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search DJI Catalog (e.g., Action 5, Pocket 3, Neo, Mini 4 Pro, Mic 2)..."
                className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
            {filteredCatalog.length > 0 && (
              <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg text-[11px]">
                {filteredCatalog.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectProduct(item)}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{item[1]}</div>
                      <div className="text-[10px] text-slate-500">{item[0]}</div>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 ml-2">
                      {formatCurrency(item[2])}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Serial Number & Auto-Gen */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700">
                Serial Number (SN) *
              </label>
              <button
                type="button"
                onClick={handleAutoGenerateSn}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
              >
                Auto-Generate Serial Code
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. 1581F5GBA247A0001"
              value={sn}
              onChange={(e) => setSn(e.target.value.toUpperCase())}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 uppercase focus:ring-1 focus:ring-emerald-500 text-sm"
            />
          </div>

          {/* Product Name & Series */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Product SKU / Name *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Series / Category
              </label>
              <input
                type="text"
                value={seriesName}
                onChange={(e) => setSeriesName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 text-xs"
              />
            </div>
          </div>

          {/* EAN, Price, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                EAN / Barcode
              </label>
              <input
                type="text"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                placeholder="694..."
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Price (SRP ₱)
              </label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Stock Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'IN STOCK' | 'SOLD')}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs"
              >
                <option value="IN STOCK">IN STOCK</option>
                <option value="SOLD">SOLD</option>
              </select>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => onDelete(row.rowNumber)}
            className="px-3 py-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard Item</span>
          </button>

          <div className="flex items-center gap-2">
            {otherIssues.length > 0 && (
              <button
                type="button"
                onClick={handleSaveAndNext}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-bold transition-colors cursor-pointer"
              >
                Save & Fix Next ({otherIssues.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSaveAndClose()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Validate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
