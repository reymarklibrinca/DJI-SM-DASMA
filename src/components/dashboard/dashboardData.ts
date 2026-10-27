export interface InventoryWatchItem {
  id: string;
  type: 'out_of_stock' | 'low_stock' | 'logistics' | 'audit';
  priority: 'critical' | 'warning' | 'notice';
  skuName: string;
  series: string;
  unitsOnHand: number;
  author: string;
  time: string;
  summary: string;
  actionGuidance: string;
  isCustom?: boolean;
}

export interface WeatherData {
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeedKm: number;
  windSpeedMs: number;
  windGustsKm: number;
  windGustsMs: number;
  windDirection: number;
  cloudCover: number;
  precipitation: number;
  weatherCode: number;
  isDay: boolean;
  updatedAt: string;
}

export const DEFAULT_DASMARINAS_WEATHER: WeatherData = {
  temp: 29.5,
  apparentTemp: 33.2,
  humidity: 78,
  windSpeedKm: 9.4,
  windSpeedMs: 2.6,
  windGustsKm: 16.2,
  windGustsMs: 4.5,
  windDirection: 210,
  cloudCover: 45,
  precipitation: 0.0,
  weatherCode: 2,
  isDay: true,
  updatedAt: 'Live (SM Dasmariñas)',
};

export const DEFAULT_INVENTORY_ITEMS: InventoryWatchItem[] = [
  {
    id: 'inv_1',
    type: 'out_of_stock',
    priority: 'critical',
    skuName: 'Osmo Mobile 8 (OM8)',
    series: 'OM Series',
    unitsOnHand: 0,
    author: 'Stockroom Audit',
    time: 'Live Floor Stock',
    summary:
      'Completely out of stock on sales floor and backroom (0 units on hand). Do not accept reservations without verifying distributor delivery timeline. Actively pitch Osmo Mobile 6 as in-stock solution or demo the Osmo Pocket 3.',
    actionGuidance: 'Pivot to Osmo Mobile 6 (4 in stock) or Osmo Pocket 3 Creator Combo.',
  },
  {
    id: 'inv_2',
    type: 'out_of_stock',
    priority: 'critical',
    skuName: 'Lito X1 FMC PLUS & Lito X1 FMC RC2',
    series: 'Lito Series',
    unitsOnHand: 0,
    author: 'Inventory Control',
    time: 'Live Floor Stock',
    summary:
      'Lito X1 series Fly More Combos are depleted. Customers inquiring about ultra-light travel drone setups must be introduced to the DJI Neo Fly More Combo (₱19,990) or Mini 4K in the demo showcase.',
    actionGuidance: 'Demo DJI Neo Fly More Combo or Mini 4K as compact alternatives.',
  },
  {
    id: 'inv_3',
    type: 'low_stock',
    priority: 'warning',
    skuName: 'Osmo Pocket 3 Battery Handle',
    series: 'ACCESSORIES',
    unitsOnHand: 2,
    author: 'Floor Supervisor',
    time: 'Stock Allocation',
    summary:
      'Critical depletion: Only 2 units remaining on hand. Strictly rationed for customers purchasing the Osmo Pocket 3 base unit. Do not sell as standalone loose accessory.',
    actionGuidance: 'Policy: Bundle with Osmo Pocket 3 hardware unit only. No standalone sales.',
  },
  {
    id: 'inv_4',
    type: 'low_stock',
    priority: 'warning',
    skuName: 'DJI Mic 2 Clip-On Transmitter (Shadow Black)',
    series: 'ACCESSORIES',
    unitsOnHand: 2,
    author: 'Stockroom Lead',
    time: 'Stock Allocation',
    summary:
      'Only 2 transmitter units in stock drawer. Reserve exclusively for Osmo Action 5 Pro and Pocket 3 creator bundle upsells.',
    actionGuidance: 'Keep attached to Action 5 / Pocket 3 audio bundle quotes.',
  },
  {
    id: 'inv_5',
    type: 'low_stock',
    priority: 'warning',
    skuName: 'DJI Air 3S Fly More Combo (DJI RC 2)',
    series: 'Air Series',
    unitsOnHand: 1,
    author: 'Floor Display Lead',
    time: 'High-Value Stock',
    summary:
      'Only 1 sealed unit remaining plus 1 glass display dummy. Flagged as key October push target (₱81,000 SRP). Confirm customer financing or cash availability before breaking seal.',
    actionGuidance: 'Verify cash / card pre-authorization before retrieving box from safe.',
  },
  {
    id: 'inv_6',
    type: 'low_stock',
    priority: 'warning',
    skuName: 'DJI Mini 4 Pro Fly More Combo Plus (RC 2)',
    series: 'Mini Series',
    unitsOnHand: 2,
    author: 'Stockroom Audit',
    time: 'Live Floor Stock',
    summary:
      'Fast-moving SKU down to 2 sealed boxes. Sub-249g high-demand drone. Ensure every unit sold includes DJI Care Refresh 1-Year or 2-Year plan.',
    actionGuidance: 'Mandatory Care Refresh pitch; check battery seal before handoff.',
  },
  {
    id: 'inv_7',
    type: 'logistics',
    priority: 'notice',
    skuName: 'Inbound Logistics Transfer (Batch #DJI-OCT-24)',
    series: 'Mall Logistics',
    unitsOnHand: 0,
    author: 'SM Mall Compliance',
    time: 'Gate 4 Protocol',
    summary:
      'SM City Dasmariñas security enforces 3:00 PM loading bay cutoff at Gate 4. Inbound transfer containing replenishment Air 3S and Neo accessories will arrive early afternoon. Receiving promoter must cross-check carton barcodes against airway bill.',
    actionGuidance: 'Inspect exterior tamper-evident tape before signing carrier receipt.',
  },
  {
    id: 'inv_8',
    type: 'audit',
    priority: 'notice',
    skuName: 'Serialized Barcode Scan & Warranty Integrity',
    series: 'Quality Control',
    unitsOnHand: 0,
    author: 'Store Audit & Warranty',
    time: 'Quality Standard',
    summary:
      'All October unit sales must be recorded with valid SN or EAN barcode. Promoters must scan the box barcode before bagging unit to ensure official DJI Philippines local warranty activation.',
    actionGuidance: 'Rule: Verify green checkmark in POS Quick Log before card swipe.',
  },
];

