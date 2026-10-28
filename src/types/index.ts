export type StaffName = 'Christian' | 'Donna' | 'Jobert' | string;

export type LeadType = 0 | 1 | 2; // 0: Walk-in, 1: Revisit, 2: Online

export type SaleTuple = [
  dayOffset: number,      // 0
  staffIndex: number,     // 1
  seriesIndex: number,    // 2
  amount: number,         // 3
  units?: number,         // 4 (default 1)
  isHold?: number,        // 5 (default 0)
  serialNumber?: string,  // 6
  leadType?: number       // 7 (0: Walk-in, 1: Revisit, 2: Online, 3: Not tagged)
];

export type StockTuple = [
  seriesName: string,
  productName: string,
  price: number,
  inStockCount: number,
  soldCount: number
];

export type UnitTuple = [
  serialNumber: string,
  productName: string,
  price: number,
  seriesName: string,
  status: 'IN STOCK' | 'SOLD',
  eanBarcode?: string
];

export type StaleTuple = [
  serialNumber: string,
  productName: string,
  seriesName: string,
  soldDayOffset: number
];

export interface DjiDataset {
  staff: string[];
  ser: string[];
  sales: SaleTuple[];
  stock: StockTuple[];
  start: string;
  units: UnitTuple[];
  sold: Record<string, [dayOffset: number, staffIndex: number]>;
  stale: StaleTuple[];
}

export interface LocalStorageState {
  sales: SaleTuple[];
  tasks: Record<string, boolean[]>; // dateKey (e.g. "Sat Oct 24 2026") -> [task0, task1, ...]
  leads: Record<number, Record<string, [number, number, number]>>; // dayOffset -> { staffIdxOrKey: [walkIn, revisit, online] }
  final: Record<number, { at: string; sa: number; un: number }>; // dayOffset -> finalized summary
  goal?: number; // daily target, default 232258
  pm?: Record<number, number>; // promoter monthly targets (default 2400000 each)
  mainPushTargets?: Record<string, number>; // categoryName -> target units (e.g. 'Mini 5 Pro': 9)
  mainPushVariants?: Record<string, string[]>; // categoryName -> array of selected variant labels (e.g. 'OA Series': ['Action 4', 'Action 5', 'Action 6'])
  mainPushDividers?: Record<string, number>; // categoryName -> number of persons to divide target by (e.g. 3)
  inventoryUnits?: UnitTuple[]; // Custom imported or edited serialized inventory
  hasCustomInventory?: boolean; // When true, inventoryUnits (even if empty []) is authoritative and will not revert to initial seed
  staff?: string[]; // Customizable list of store promoter names
}

export interface VariantBreakdown {
  label: string;
  rawSerName: string;
  selected: boolean;
  sold: number;
}

export interface PeriodRange {
  a: number; // start day offset
  b: number; // end day offset
  pa: number; // previous start
  pb: number; // previous end
  lb: string; // label (e.g. "last 14 days")
  pl: string; // previous label (e.g. "previous 14 days")
  np: boolean; // no previous
}

export interface AggregatedData {
  sa: number; // total sales amount
  un: number; // total units
  hw: number; // hardware units (excluding accessories and care refresh)
  care: number; // care refresh units
  day: number[]; // sales amount per day in period
  st: [sa: number, un: number, care: number, hw: number][]; // per staff
  ty: [number, number][][]; // staffIndex -> leadType(0..3) -> [amount, units]
  se: Record<number, [number, number]>; // seriesIndex -> [amount, units]
  dow: number[]; // day of week total sales [Sun, Mon, ...]
  dn: number[];  // day of week occurrences in period
}

export interface StockSeriesCover {
  n: string;
  in: number;
  m: number; // sold last 30 days
  cov: number | null; // days of cover
}
