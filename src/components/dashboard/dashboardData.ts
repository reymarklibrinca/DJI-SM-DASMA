export interface InventoryWatchItem {
  id: string;
  type: 'out_of_stock' | 'low_stock' | 'fast_moving' | 'steady' | 'logistics' | 'audit';
  priority: 'critical' | 'warning' | 'notice';
  skuName: string;
  series: string;
  unitsOnHand: number;
  author: string;
  time: string;
  summary: string;
  actionGuidance: string;
  isCustom?: boolean;
  unitsSoldPastDays?: number;
  salesVelocityPerDay?: number;
  depletionDaysRemaining?: number | null;
  depletionForecastDate?: string;
  isFastMoving?: boolean;
  statusTier?: 'critical' | 'low_stock' | 'fast_moving' | 'steady' | 'out_of_stock';
  price?: number;
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

/**
 * Baseline Watchlist strictly limited to stocks that have recorded sales
 * in past days or are high-velocity fast moving units.
 */
export const DEFAULT_INVENTORY_ITEMS: InventoryWatchItem[] = [
  {
    id: 'inv_1',
    type: 'out_of_stock',
    priority: 'critical',
    statusTier: 'out_of_stock',
    skuName: 'Osmo 360 Adventure Combo (PROMOTION Oct. 6-16)',
    series: 'OSMO 360',
    unitsOnHand: 0,
    unitsSoldPastDays: 3,
    salesVelocityPerDay: 0.13,
    depletionDaysRemaining: 0,
    depletionForecastDate: 'Depleted (0 left)',
    isFastMoving: true,
    price: 34990,
    author: 'Depletion Watch',
    time: 'Confirmed Sold in Past Days',
    summary:
      'Completely depleted on sales floor and safe drawer (0 units on hand). Sold 3 units in recent promotion window. Active customer demand confirmed.',
    actionGuidance: 'Pivot walk-ins to Osmo 360 II Adventure Combo (19 in stock) or Osmo Action 6.',
  },
  {
    id: 'inv_2',
    type: 'low_stock',
    priority: 'critical',
    statusTier: 'critical',
    skuName: 'DJI Mic Mini 2 Transmitter',
    series: 'MIC MINI 2',
    unitsOnHand: 2,
    unitsSoldPastDays: 2,
    salesVelocityPerDay: 0.08,
    depletionDaysRemaining: 24.0,
    depletionForecastDate: '24 days cover at current pace',
    isFastMoving: false,
    price: 2990,
    author: 'Depletion Watch',
    time: 'Confirmed Sold in Past Days',
    summary:
      'Low on-hand stock: Only 2 units remaining on hand with confirmed recent sales. Fast depletion risk if attached to dual-channel quotes.',
    actionGuidance: 'Ration remaining units for standalone audio buyer inquiries; verify backroom inventory.',
  },
  {
    id: 'inv_3',
    type: 'low_stock',
    priority: 'warning',
    statusTier: 'low_stock',
    skuName: 'DJI Lito X1 Fly More Combo (DJI RC 2)',
    series: 'LITO X1',
    unitsOnHand: 4,
    unitsSoldPastDays: 4,
    salesVelocityPerDay: 0.17,
    depletionDaysRemaining: 24.0,
    depletionForecastDate: '24 days cover at current pace',
    isFastMoving: true,
    price: 32990,
    author: 'Depletion Watch',
    time: 'Confirmed Sold in Past Days',
    summary:
      'Fast-moving sub-249g travel drone: 4 units sold in past days, 4 units remaining in store stock. Depletion expected within 3-4 sales.',
    actionGuidance: 'Recommend Neo 2 Fly More Combo as compact alternative if customer requests lighter build.',
  },
  {
    id: 'inv_4',
    type: 'fast_moving',
    priority: 'warning',
    statusTier: 'fast_moving',
    skuName: 'Osmo Action 6 Adventure Combo',
    series: 'ACTION 6',
    unitsOnHand: 33,
    unitsSoldPastDays: 17,
    salesVelocityPerDay: 0.71,
    depletionDaysRemaining: 46.5,
    depletionForecastDate: '46 days cover (0.71 units/day)',
    isFastMoving: true,
    price: 31390,
    author: 'Depletion Watch',
    time: 'Top Store Velocity Mover',
    summary:
      'Store #1 Top Fast-Moving SKU: 17 units sold in past days at 0.71 units/day burn rate. 33 units currently on hand.',
    actionGuidance: 'Ensure demo camera is charged; pair every sale with DJI Care Refresh 1-Yr / 2-Yr plan.',
  },
  {
    id: 'inv_5',
    type: 'fast_moving',
    priority: 'warning',
    statusTier: 'fast_moving',
    skuName: 'DJI Mic Mini 2 (2 TX + 1 RX + Charging Case)',
    series: 'MIC MINI 2',
    unitsOnHand: 20,
    unitsSoldPastDays: 15,
    salesVelocityPerDay: 0.63,
    depletionDaysRemaining: 31.7,
    depletionForecastDate: '32 days cover (0.63 units/day)',
    isFastMoving: true,
    price: 4990,
    author: 'Depletion Watch',
    time: 'High Velocity Audio Mover',
    summary:
      'High-velocity wireless audio kit: 15 units sold in past days. High turnover pace across all 3 promoters.',
    actionGuidance: 'Actively bundle with Osmo Pocket 4 and Action 6 camera sales as wireless mic solution.',
  },
  {
    id: 'inv_6',
    type: 'fast_moving',
    priority: 'warning',
    statusTier: 'fast_moving',
    skuName: 'Osmo Pocket 4P Vlog Combo',
    series: 'POCKET 4P',
    unitsOnHand: 15,
    unitsSoldPastDays: 13,
    salesVelocityPerDay: 0.54,
    depletionDaysRemaining: 27.8,
    depletionForecastDate: '28 days cover (0.54 units/day)',
    isFastMoving: true,
    price: 42290,
    author: 'Depletion Watch',
    time: 'Flagship Fast Mover',
    summary:
      'High-velocity vlogging flagship: 13 units sold in past days at 0.54 units/day burn rate. 15 units remaining on hand.',
    actionGuidance: 'Flagship October push target (₱42,290 SRP). Verify serial scan before customer handoff.',
  },
  {
    id: 'inv_7',
    type: 'fast_moving',
    priority: 'warning',
    statusTier: 'fast_moving',
    skuName: 'DJI Neo 2 Fly More Combo',
    series: 'DJI NEO 2',
    unitsOnHand: 20,
    unitsSoldPastDays: 8,
    salesVelocityPerDay: 0.33,
    depletionDaysRemaining: 60.0,
    depletionForecastDate: '60 days cover (0.33 units/day)',
    isFastMoving: true,
    price: 20590,
    author: 'Depletion Watch',
    time: 'High Velocity Drone Mover',
    summary:
      'High-demand beginner drone: 8 units sold in past days. Primary driver of entry drone category.',
    actionGuidance: 'Keep flight cage ready for walk-in demos; pitch Neo 2 spare battery bundle.',
  },
  {
    id: 'inv_8',
    type: 'fast_moving',
    priority: 'warning',
    statusTier: 'fast_moving',
    skuName: 'Osmo Pocket 4 Creator Combo',
    series: 'POCKET 4',
    unitsOnHand: 42,
    unitsSoldPastDays: 9,
    salesVelocityPerDay: 0.38,
    depletionDaysRemaining: 110.5,
    depletionForecastDate: '110 days cover (0.38 units/day)',
    isFastMoving: true,
    price: 34990,
    author: 'Depletion Watch',
    time: 'Creator Series Fast Mover',
    summary:
      'High-demand compact gimbal camera: 9 units sold in past days at 0.38 units/day burn rate. 42 units in stock.',
    actionGuidance: 'Key October creator target. Attach DJI Care Refresh and wide-angle lens accessory.',
  },
];

