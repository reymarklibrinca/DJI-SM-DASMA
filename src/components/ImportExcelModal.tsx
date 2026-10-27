import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  Upload,
  Check,
  AlertCircle,
  Download,
  CheckCircle2,
  HelpCircle,
  Search,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { SaleTuple, UnitTuple } from '../types';
import { DJI_DATA } from '../data/initialData';
import {
  dateToDayOffset,
  dayOffsetToDate,
  formatCurrency,
  formatDate,
  formatISODate,
} from '../utils/calculations';

interface ParsedExcelSaleRow {
  rowNumber: number;
  ean?: string;
  rawDate: any;
  dateOffset: number;
  dateStr: string;
  rawStaff: string;
  staffIndex: number;
  staffName: string;
  serialNumber: string;
  productName: string;
  seriesName: string;
  seriesIndex: number;
  price: number;
  units: number;
  statusText?: string;
  rawLeadType: string;
  leadType: 0 | 1 | 2 | 3;
  leadTypeName: string;
  status: 'valid' | 'warning' | 'invalid';
  statusNote: string;
}

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: string[];
  todayOffset: number;
  onImportOverride: (
    sales: SaleTuple[],
    populateFormItem?: {
      staffIndex: number;
      dateISO: string;
      serialNumber: string;
      productName: string;
      price: number;
      leadType: 0 | 1 | 2;
    }
  ) => void;
  onImportAppend: (
    sales: SaleTuple[],
    populateFormItem?: {
      staffIndex: number;
      dateISO: string;
      serialNumber: string;
      productName: string;
      price: number;
      leadType: 0 | 1 | 2;
    }
  ) => void;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  staffList,
  todayOffset,
  onImportOverride,
  onImportAppend,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedExcelSaleRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'override' | 'append'>('override');
  const [populateForm, setPopulateForm] = useState<boolean>(true);
  const [defaultStaff, setDefaultStaff] = useState<number>(0);
  const [defaultDateISO, setDefaultDateISO] = useState<string>(formatISODate(todayOffset));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fast units map for quick SN lookup
  const unitsMap = useMemo(() => {
    const map = new Map<string, UnitTuple>();
    DJI_DATA.units.forEach((u) => {
      map.set(u[0].toUpperCase(), u);
    });
    return map;
  }, []);

  // Stock lookup map by product name
  const stockMap = useMemo(() => {
    const map = new Map<string, { series: string; price: number }>();
    DJI_DATA.stock.forEach((s) => {
      map.set(s[1].toUpperCase(), { series: s[0], price: s[2] });
    });
    return map;
  }, []);

  // Reset state when closing or re-opening
  const handleReset = () => {
    setFile(null);
    setWorkbook(null);
    setSheets([]);
    setSelectedSheet('');
    setParsedRows([]);
    setParseError(null);
    setSearchQuery('');
  };

  // Helper to parse date from string or Excel serial number
  const resolveDayOffset = (val: any, fallbackOffset: number): { offset: number; dateStr: string } => {
    if (val === undefined || val === null || val === '') {
      return { offset: fallbackOffset, dateStr: formatISODate(fallbackOffset) };
    }

    // Excel numerical date serial
    if (typeof val === 'number') {
      if (val > 20000 && val < 60000) {
        // Excel serial date formula
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        const offset = dateToDayOffset(date);
        return { offset, dateStr: formatISODate(offset) };
      }
      if (val >= 0 && val <= 300) {
        return { offset: Math.round(val), dateStr: formatISODate(Math.round(val)) };
      }
    }

    const str = String(val).trim();
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const offset = dateToDayOffset(d);
      return { offset, dateStr: formatISODate(offset) };
    }

    return { offset: fallbackOffset, dateStr: formatISODate(fallbackOffset) };
  };

  // Helper to resolve staff index
  const resolveStaff = (val: any, fallbackIndex: number): { index: number; name: string } => {
    if (val === undefined || val === null || val === '') {
      return { index: fallbackIndex, name: staffList[fallbackIndex] || 'Christian' };
    }

    const str = String(val).trim().toLowerCase();
    const idx = staffList.findIndex((st) => st.toLowerCase() === str);
    if (idx >= 0) {
      return { index: idx, name: staffList[idx] };
    }

    // Try partial or numeric
    if (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) < staffList.length) {
      const numIdx = Number(val);
      return { index: numIdx, name: staffList[numIdx] };
    }

    return { index: fallbackIndex, name: staffList[fallbackIndex] || 'Christian' };
  };

  // Helper to resolve lead type
  const resolveLeadType = (val: any): { type: 0 | 1 | 2 | 3; name: string } => {
    if (val === undefined || val === null || val === '') {
      return { type: 0, name: 'Walk-in' };
    }

    const str = String(val).trim().toLowerCase();
    if (str.includes('walk') || str === '0') return { type: 0, name: 'Walk-in' };
    if (str.includes('revisit') || str.includes('repeat') || str === '1') return { type: 1, name: 'Revisit' };
    if (str.includes('online') || str.includes('web') || str.includes('social') || str === '2')
      return { type: 2, name: 'Online' };

    return { type: 0, name: 'Walk-in' };
  };

  // Process selected sheet from workbook
  const processSheet = (
    wb: XLSX.WorkBook,
    sheetName: string,
    overrideStaff?: number,
    overrideDateISO?: string
  ) => {
    try {
      setIsProcessing(true);
      setParseError(null);

      const staffToUse = overrideStaff !== undefined ? overrideStaff : defaultStaff;
      const dateToUse = overrideDateISO !== undefined ? overrideDateISO : defaultDateISO;

      const ws = wb.Sheets[sheetName];
      if (!ws) {
        throw new Error(`Sheet "${sheetName}" not found in workbook.`);
      }

      // Convert sheet to array of rows
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('The selected sheet is empty.');
      }

      // Locate header row or use first row
      let headerRowIndex = -1;
      let colMap: Record<string, number> = {};

      for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
        const row = rawRows[r].map((cell) => String(cell || '').trim().toLowerCase());
        const hasSN = row.some((c) => c.includes('sn') || c.includes('serial'));
        const hasEAN = row.some((c) => c.includes('ean') || c.includes('barcode') || c.includes('upc'));
        const hasProduct = row.some((c) => c.includes('product') || c.includes('item') || c.includes('desc') || c.includes('model') || c.includes('name'));
        const hasPrice = row.some((c) => c.includes('price') || c.includes('amount') || c.includes('srp') || c.includes('total'));
        const hasDate = row.some((c) => c.includes('date'));
        const hasStaff = row.some((c) => c.includes('staff') || c.includes('promoter') || c.includes('agent'));

        if ((hasSN || hasEAN || hasProduct) && (hasPrice || hasDate || hasStaff || row.some((c) => c.includes('series') || c.includes('status')))) {
          headerRowIndex = r;
          row.forEach((cell, colIdx) => {
            if (cell.includes('ean') || cell.includes('upc') || (cell.includes('barcode') && !cell.includes('sn') && !cell.includes('serial'))) {
              colMap['ean'] = colIdx;
            }
            if (cell.includes('sn') || cell.includes('serial') || cell.includes('imei') || (cell.includes('barcode') && colMap['ean'] === undefined)) {
              if (!cell.includes('ean')) colMap['sn'] = colIdx;
            }
            if (cell.includes('product') || cell.includes('item') || cell.includes('desc') || cell.includes('model') || cell.includes('name')) colMap['product'] = colIdx;
            if (cell.includes('series') || cell.includes('category') || cell.includes('line')) colMap['series'] = colIdx;
            if (cell.includes('price') || cell.includes('amount') || cell.includes('srp') || cell.includes('total') || cell.includes('cost')) colMap['price'] = colIdx;
            if (cell.includes('status') || cell.includes('state')) colMap['status'] = colIdx;
            if (cell.includes('date') || cell.includes('day') || cell.includes('time')) colMap['date'] = colIdx;
            if (cell.includes('staff') || cell.includes('promoter') || cell.includes('agent') || cell.includes('cashier') || cell.includes('seller') || cell.includes('by')) colMap['staff'] = colIdx;
            if (cell.includes('lead') || cell.includes('channel') || cell.includes('source') || cell.includes('type')) colMap['lead'] = colIdx;
            if (cell.includes('unit') || cell.includes('qty') || cell.includes('quantity')) colMap['units'] = colIdx;
          });
          break;
        }
      }

      // Fallback if no header row found: guess columns
      if (headerRowIndex === -1) {
        headerRowIndex = 0;
        const firstData = rawRows[0] || [];
        firstData.forEach((val, idx) => {
          const s = String(val).trim();
          if (unitsMap.has(s.toUpperCase())) colMap['sn'] = idx;
          if (staffList.some((st) => st.toLowerCase() === s.toLowerCase())) colMap['staff'] = idx;
          if (!isNaN(Date.parse(s)) && s.includes('-')) colMap['date'] = idx;
          if (!isNaN(Number(s.replace(/[^0-9.]/g, ''))) && Number(s.replace(/[^0-9.]/g, '')) > 500) colMap['price'] = idx;
        });
      }

      const fallbackOffset = dateToDayOffset(dateToUse);
      const parsed: ParsedExcelSaleRow[] = [];

      for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0 || row.every((c) => c === '')) continue;

        const rawEan = colMap['ean'] !== undefined ? String(row[colMap['ean']] || '').trim() : '';
        const rawDate = colMap['date'] !== undefined ? row[colMap['date']] : '';
        const rawStaff = colMap['staff'] !== undefined ? row[colMap['staff']] : '';
        const rawSN = colMap['sn'] !== undefined ? String(row[colMap['sn']] || '').trim() : '';
        const rawProduct = colMap['product'] !== undefined ? String(row[colMap['product']] || '').trim() : '';
        const rawSeries = colMap['series'] !== undefined ? String(row[colMap['series']] || '').trim() : '';
        const rawPrice = colMap['price'] !== undefined ? row[colMap['price']] : '';
        const rawStatus = colMap['status'] !== undefined ? String(row[colMap['status']] || '').trim() : '';
        const rawLead = colMap['lead'] !== undefined ? row[colMap['lead']] : '';
        const rawUnits = colMap['units'] !== undefined ? Number(row[colMap['units']]) || 1 : 1;

        // Skip completely empty rows
        if (!rawSN && !rawProduct && !rawPrice && !rawEan) continue;

        const dateResolved = resolveDayOffset(rawDate, fallbackOffset);
        const staffResolved = resolveStaff(rawStaff, staffToUse);
        const leadResolved = resolveLeadType(rawLead);

        // Resolve Product & Series via SN, EAN, or Product name
        let snClean = rawSN.toUpperCase();
        let eanClean = rawEan;
        let productName = rawProduct;
        let seriesName = rawSeries;
        let price = Number(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
        let seriesIndex = 0;
        let status: 'valid' | 'warning' | 'invalid' = 'valid';
        let statusNote = 'Ready';

        if (snClean && unitsMap.has(snClean)) {
          const unit = unitsMap.get(snClean)!;
          productName = unit[1];
          seriesName = unit[3];
          if (!price) price = unit[2];
          if (!eanClean && unit[5]) eanClean = unit[5];
          status = 'valid';
          statusNote = 'Verified SN Match';
        } else if (!snClean && rawEan) {
          // Look up matching unit by EAN in store dataset
          const unitByEan = DJI_DATA.units.find((u) => u[5] === rawEan);
          if (unitByEan) {
            snClean = unitByEan[0];
            if (!productName) productName = unitByEan[1];
            if (!seriesName) seriesName = unitByEan[3];
            if (!price) price = unitByEan[2];
            status = 'valid';
            statusNote = 'Matched via EAN Barcode';
          }
        } else if (rawProduct) {
          const stock = stockMap.get(rawProduct.toUpperCase());
          if (stock) {
            seriesName = stock.series;
            if (!price) price = stock.price;
            status = 'valid';
            statusNote = 'Matched from Stock Catalog';
          } else {
            status = 'warning';
            statusNote = 'Custom Product Name';
          }
        } else if (snClean) {
          status = 'warning';
          statusNote = 'SN not in pre-catalog; will log with custom SN';
        }

        // Determine seriesIndex
        if (seriesName) {
          const sIdx = DJI_DATA.ser.findIndex(
            (s) => s.toLowerCase() === seriesName.toLowerCase()
          );
          seriesIndex = sIdx >= 0 ? sIdx : 0;
        }

        if (!productName && !snClean && !eanClean) {
          status = 'invalid';
          statusNote = 'Missing Product Name, SN, and EAN';
        }

        parsed.push({
          rowNumber: i + 1,
          ean: eanClean,
          rawDate,
          dateOffset: dateResolved.offset,
          dateStr: dateResolved.dateStr,
          rawStaff,
          staffIndex: staffResolved.index,
          staffName: staffResolved.name,
          serialNumber: snClean,
          productName: productName || 'DJI Product',
          seriesName: seriesName || (DJI_DATA.ser[seriesIndex] || 'GENERAL'),
          seriesIndex,
          price,
          units: rawUnits,
          statusText: rawStatus || 'SOLD',
          rawLeadType: rawLead,
          leadType: leadResolved.type,
          leadTypeName: leadResolved.name,
          status,
          statusNote,
        });
      }

      if (parsed.length === 0) {
        throw new Error('No transaction rows could be parsed from this sheet. Please check the sheet contents.');
      }

      setParsedRows(parsed);
    } catch (err: any) {
      console.error('Error processing Excel sheet:', err);
      setParseError(err.message || 'Failed to process Excel file.');
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (uploadedFile: File) => {
    setFile(uploadedFile);
    setParseError(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('File reading returned empty result.');

        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        setWorkbook(wb);
        setSheets(wb.SheetNames);

        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setSelectedSheet(firstSheet);
          processSheet(wb, firstSheet);
        }
      } catch (err: any) {
        console.error('Error reading Excel workbook:', err);
        setParseError('Failed to read Excel file: ' + (err.message || 'Invalid format'));
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
        handleFileUpload(dropped);
      } else {
        setParseError('Please upload an Excel file (.xlsx, .xls) or CSV file.');
      }
    }
  };

  // Download sample template following the official style
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        'EAN / Barcode',
        'Serial Number (SN)',
        'Product Name',
        'Price / SRP',
        'Category / Series',
        'Status',
        'Date',
        'Promoter',
        'Lead Type',
      ],
      ['6941565988113', '9KRXP3P00BV881', 'Osmo Action 6 Adventure Combo', 28990, 'OSMO ACTION 6 SERIES', 'SOLD', '2026-10-26', 'Christian', 'Walk-in'],
      ['6941565984429', 'ANGVP1J0020KTA', 'Osmo Pocket 4 Standard Combo', 28990, 'OSMO POCKET 4 SERIES', 'SOLD', '2026-10-26', 'Donna', 'Revisit'],
      ['6941565982104', '1581F9DEC25AL029CX61', 'DJI Mini 5 Pro', 38990, 'MINI 5 PRO SERIES', 'SOLD', '2026-10-26', 'Jobert', 'Online'],
      ['6941565981152', '1581FA6QC25B700CZ2QJ', 'DJI NEO 2', 11990, 'NEO 2 SERIES', 'SOLD', '2026-10-26', 'Christian', 'Walk-in'],
      ['6941565979814', '1581FB34C261T00396Z8', 'DJI Lito X1', 19990, 'LITO X1 SERIES', 'SOLD', '2026-10-26', 'Donna', 'Walk-in'],
      ['6941565983712', '1581F895C262401709R5', 'DJI Air 3S Fly More Combo (DJI RC-N3)', 69990, 'AIR 3S SERIES', 'SOLD', '2026-10-26', 'Christian', 'Walk-in'],
    ]);

    ws['!cols'] = [
      { wch: 18 }, // EAN / Barcode
      { wch: 24 }, // Serial Number (SN)
      { wch: 42 }, // Product Name
      { wch: 14 }, // Price / SRP
      { wch: 22 }, // Category / Series
      { wch: 12 }, // Status
      { wch: 14 }, // Date
      { wch: 16 }, // Promoter
      { wch: 14 }, // Lead Type
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Data');
    XLSX.writeFile(wb, 'dji_sales_pos_template.xlsx');
  };

  // Convert parsed rows to SaleTuple array and commit
  const handleCommitImport = () => {
    const validRows = parsedRows.filter((r) => r.status !== 'invalid');
    if (validRows.length === 0) {
      setParseError('No valid rows found to import.');
      return;
    }

    const salesToImport: SaleTuple[] = validRows.map((r) => [
      r.dateOffset,
      r.staffIndex,
      r.seriesIndex,
      r.price,
      r.units || 1,
      0, // isHold
      r.serialNumber || '',
      r.leadType,
    ]);

    // Optional form populate from first row
    let formPopulateData;
    if (populateForm && validRows.length > 0) {
      const first = validRows[0];
      formPopulateData = {
        staffIndex: first.staffIndex,
        dateISO: first.dateStr,
        serialNumber: first.serialNumber,
        productName: first.productName,
        price: first.price,
        leadType: (first.leadType === 3 ? 0 : first.leadType) as 0 | 1 | 2,
      };
    }

    if (importMode === 'override') {
      onImportOverride(salesToImport, formPopulateData);
    } else {
      onImportAppend(salesToImport, formPopulateData);
    }

    onClose();
  };

  // Summary Metrics
  const validCount = parsedRows.filter((r) => r.status !== 'invalid').length;
  const totalRevenue = parsedRows
    .filter((r) => r.status !== 'invalid')
    .reduce((sum, r) => sum + r.price * r.units, 0);

  // Filtered rows for preview search
  const filteredPreviewRows = useMemo(() => {
    if (!searchQuery.trim()) return parsedRows;
    const q = searchQuery.toLowerCase().trim();
    return parsedRows.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        r.serialNumber.toLowerCase().includes(q) ||
        (r.ean && r.ean.toLowerCase().includes(q)) ||
        r.staffName.toLowerCase().includes(q) ||
        r.seriesName.toLowerCase().includes(q) ||
        (r.statusText && r.statusText.toLowerCase().includes(q))
    );
  }, [parsedRows, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Import Excel Sales File
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Override / Append Input Data
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload any Excel (.xlsx, .xls) or CSV sheet to replace current POS Quick Log sales or append new rows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              title="Download sample Excel template"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Parse Error Box */}
          {parseError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs">Error Parsing File</div>
                  <div className="text-xs mt-0.5">{parseError}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setParseError(null)}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Upload Drop Zone (if no file loaded or if replacing) */}
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
                  : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30 bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Click to browse or drag & drop your Excel file here
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Supports Microsoft Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) and Comma-Separated Values (<strong>.csv</strong>).
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 text-[11px] text-slate-600">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 self-center">Standard Columns:</span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 font-mono font-bold text-emerald-900 shadow-2xs">
                  EAN / Barcode
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 font-mono font-bold text-emerald-900 shadow-2xs">
                  Serial Number (SN)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 font-mono font-bold text-emerald-900 shadow-2xs">
                  Product Name
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 font-mono font-bold text-emerald-900 shadow-2xs">
                  Price / SRP
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 font-mono font-bold text-emerald-900 shadow-2xs">
                  Category / Series
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 font-mono font-bold text-emerald-900 shadow-2xs">
                  Status
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mx-1 self-center">+ POS:</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-slate-700">
                  Date
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-slate-700">
                  Promoter
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-slate-700">
                  Lead Type
                </span>
              </div>
            </div>
          ) : (
            /* File Info Bar + Sheet Selector */
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>{file.name}</span>
                      <span className="text-[10px] font-normal text-slate-500 font-mono">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {parsedRows.length} total rows parsed · {validCount} valid transactions
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {sheets.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600">Sheet:</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => {
                          setSelectedSheet(e.target.value);
                          if (workbook) processSheet(workbook, e.target.value);
                        }}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                      >
                        {sheets.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Change File</span>
                  </button>
                </div>
              </div>

              {/* Import Mode Options (Explicitly Requested: Override Current Input Data) */}
              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setImportMode('override')}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none ${
                    importMode === 'override'
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'override'}
                    onChange={() => setImportMode('override')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <div className="font-black text-xs flex items-center gap-1.5">
                      <span>Override Current Input Data</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900 uppercase">
                        Requested
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Replaces all existing session sales in POS Quick Log with rows from this Excel file.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setImportMode('append')}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none ${
                    importMode === 'append'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-950 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <div className="font-bold text-xs">Append to Current Data</div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Keeps existing logged transactions and appends rows from this Excel file.
                    </p>
                  </div>
                </label>
              </div>

              {/* Fallback Defaults Bar for clean sheets with 6 standard columns */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Fallback Defaults</div>
                  <div className="text-[11px] text-slate-500">
                    Applied if Excel rows lack explicit Date or Promoter columns
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">Default Date:</span>
                    <input
                      type="date"
                      value={defaultDateISO}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setDefaultDateISO(newDate);
                        if (workbook && selectedSheet) {
                          processSheet(workbook, selectedSheet, defaultStaff, newDate);
                        }
                      }}
                      className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">Default Promoter:</span>
                    <select
                      value={defaultStaff}
                      onChange={(e) => {
                        const newStaff = Number(e.target.value);
                        setDefaultStaff(newStaff);
                        if (workbook && selectedSheet) {
                          processSheet(workbook, selectedSheet, newStaff, defaultDateISO);
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      {staffList.map((st, i) => (
                        <option key={st} value={i}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Form Autofill Option */}
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="populateForm"
                  checked={populateForm}
                  onChange={(e) => setPopulateForm(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label
                  htmlFor="populateForm"
                  className="text-xs text-slate-700 font-medium cursor-pointer"
                >
                  Also populate the POS Quick Log entry form with the first row from this file
                </label>
              </div>
            </div>
          )}

          {/* Parsed Preview Table & Metrics */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Metric Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Valid Rows
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {validCount}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      / {parsedRows.length}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Total Revenue
                  </div>
                  <div className="text-lg font-black text-emerald-700 mt-0.5 font-mono">
                    {formatCurrency(totalRevenue)}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Promoters
                  </div>
                  <div className="text-xs font-bold text-slate-800 mt-1 flex flex-wrap gap-1">
                    {staffList.map((st, i) => {
                      const c = parsedRows.filter((r) => r.staffIndex === i).length;
                      return (
                        <span key={st} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px]">
                          {st}: <strong>{c}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Import Mode
                  </div>
                  <div className="text-xs font-black text-slate-900 mt-1 uppercase">
                    {importMode === 'override' ? (
                      <span className="text-rose-700 font-bold">Override Current</span>
                    ) : (
                      <span className="text-blue-700 font-bold">Append to Current</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Search Preview */}
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search parsed preview (SN, product, staff)..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="text-[11px] text-slate-500">
                  Showing {filteredPreviewRows.length} of {parsedRows.length} rows
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center font-mono">#</th>
                      <th className="py-2.5 px-3 w-32">EAN / Barcode</th>
                      <th className="py-2.5 px-3 w-36">Serial Number (SN)</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Product Name</th>
                      <th className="py-2.5 px-3 w-28 text-right">Price / SRP</th>
                      <th className="py-2.5 px-3 w-32">Category / Series</th>
                      <th className="py-2.5 px-3 w-24 text-center">Status</th>
                      <th className="py-2.5 px-3 w-24">Date</th>
                      <th className="py-2.5 px-3 w-28">Promoter</th>
                      <th className="py-2.5 px-3 w-20">Lead Type</th>
                      <th className="py-2.5 px-3 w-24 text-center">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredPreviewRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={
                          row.status === 'invalid'
                            ? 'bg-rose-50/50 text-rose-900'
                            : row.status === 'warning'
                            ? 'bg-amber-50/40 text-slate-800'
                            : 'hover:bg-slate-50 text-slate-800'
                        }
                      >
                        <td className="py-2 px-3 text-center text-[10px] font-mono text-slate-400">
                          {row.rowNumber}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap">
                          {row.ean ? (
                            <span className="font-semibold text-slate-800">{row.ean}</span>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                          {row.serialNumber ? (
                            <span className="font-bold text-slate-900">{row.serialNumber}</span>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">No SN</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-medium">
                          <div className="font-bold text-slate-900">{row.productName}</div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(row.price)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold border border-slate-200">
                            {row.seriesName}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                            {row.statusText || 'SOLD'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap text-slate-600">
                          {row.dateStr}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {row.staffName}
                        </td>
                        <td className="py-2 px-3 text-[11px] whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200 text-[10px]">
                            {row.leadTypeName}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.status === 'valid'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : row.status === 'warning'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                            title={row.statusNote}
                          >
                            {row.statusNote}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 ? (
              <span>
                Ready to import <strong>{validCount}</strong> transactions via{' '}
                <strong className={importMode === 'override' ? 'text-rose-600 uppercase' : 'text-blue-600'}>
                  {importMode}
                </strong>{' '}
                mode.
              </span>
            ) : (
              <span>Upload an Excel file to preview and verify data.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={validCount === 0 || isProcessing}
              onClick={handleCommitImport}
              className={`flex items-center gap-2 px-5 py-2 text-white rounded-xl font-bold transition-all cursor-pointer shadow-md text-xs active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed ${
                importMode === 'override'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {importMode === 'override'
                  ? `Import & Override Current Data (${validCount})`
                  : `Import & Append (${validCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
