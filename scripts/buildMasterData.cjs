const fs = require('fs');
const path = require('path');

const masterPath = path.resolve('public/assets/aistudio/dji_product_inventory_with_unit_series__1__a9e24475.json');
const djiDataPath = path.resolve('src/data/djiData.json');

const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const current = JSON.parse(fs.readFileSync(djiDataPath, 'utf8'));

// Build existing price dictionary
const priceMap = new Map();
current.stock.forEach(s => priceMap.set(s[1].trim().toUpperCase(), s[2]));
current.units.forEach(u => {
  if (u[2] && !priceMap.has(u[1].trim().toUpperCase())) {
    priceMap.set(u[1].trim().toUpperCase(), u[2]);
  }
});
if (fs.existsSync('src/data/octoberSales.json')) {
  const oct = JSON.parse(fs.readFileSync('src/data/octoberSales.json', 'utf8'));
  oct.forEach(row => {
    const p = row['PRODUCT NAME'];
    const pr = row['PRICE'];
    if (p && pr && !priceMap.has(p.trim().toUpperCase())) {
      priceMap.set(p.trim().toUpperCase(), pr);
    }
  });
}

// Known standard prices for any remaining products
const knownSRP = {
  // Mavic 3 & 4
  'DJI MAVIC 3 PRO CINE PREMIUM COMBO': 269990,
  'DJI MAVIC 3 PRO FLY MORE COMBO (RC PRO)': 219990,
  'DJI MAVIC 3 PRO FLY MORE COMBO (DJI RC)': 169990,
  'DJI MAVIC 3 PRO (DJI RC)': 129990,
  'DJI Mavic 4 Pro 512GB Greator Combo(DJI RC Pro2)': 149990,
  'DJI Mavic 4 Pro Fly More Combo(DJI RC 2)': 119990,
  'DJI Mavic 4 Pro': 89990,

  // Air 3S
  'DJI Air 3S Fly More Combo (DJI RC 2)': 84990,
  'DJI Air 3S Fly More Combo (DJI RC-N3)': 69990,
  'DJI Air 3S (DJI RC-N3)': 56990,

  // Mini 5 Pro
  'DJI Mini 5 Pro Fly More Combo Plus (DJI RC2)': 59990,
  'DJI Mini 5 Pro Fly More Combo (DJI RC2)': 52990,
  'DJI Mini 5 Pro Fly More Combo (DJI RC-N3)': 44990,
  'DJI Mini 5 Pro': 38990,

  // Mini 4 Pro
  'DJI Mini 4 Pro Fly More Combo Plus (DJI RC 2) (GL)': 57990,
  'DJI Mini 4 Pro Fly More Combo (DJI RC 2) (GL)': 52990,
  'DJI Mini 4 Pro (DJI RC 2) (GL)': 46990,
  'DJI Mini 4 Pro (GL)': 39990,

  // Lito X1 & Lito 1
  'DJI Lito X1 Fly More Combo Plus (DJI RC 2)': 32990,
  'DJI Lito X1 Fly More Combo (DJI RC 2)': 28990,
  'DJI Lito X1 Fly More Combo (DJI RC-N3)': 24990,
  'DJI Lito X1': 19990,
  'DJI Lito 1 Fly More Combo (DJI RC-N3)': 18990,
  'DJI Lito 1': 14990,

  // Mini 4K & Mini 3 & Mini 2 SE
  'DJI Mini 4k Fly More Combo (GL)': 24990,
  'DJI Mini 4K (GL)': 17990,
  'DJI MINI 3 FLY MORE COMBO (DJI RC GL)': 36990,
  'DJI MINI 3 (DJI RC) (GL)': 29990,
  'DJI MINI 3 (GL)': 23990,
  'DJI MINI 2 SE': 18990,

  // Avata 360 & Avata 2 & Avata
  'DJI Avata 360 (DJI RC 2)': 56990,
  'DJI Avata 360 Fly More Combo (DJI RC 2)': 68990,
  'DJI Avata 360 Motion Fly More Combo (DJI Goggles N3)': 64990,
  'DJI Avata 2 Fly More Combo (Single Battery)': 52990,
  'DJI Avata 2 Fly More Combo (Three Batteries)': 61990,
  'DJI Avata 2 Fly Smart Combo (Single Battery)': 46990,
  'DJI Avata 2 Fly Smart Combo (Three Batteries)': 54990,
  'DJI AVATA EXPLORER COMBO': 54990,
  'DJI AVATA PRO-VIEW COMBO (DJI RC MOTION 2)': 67990,
  'DJI AVATA PRO-VIEW COMBO (DJI GOGGLES 2)': 72990,
  'DJI AVATA FLY SMART COMBO (DJI FPV GOGGLES V2)': 48990,

  // Neo 2 & Neo
  'DJI NEO 2 MOTION FLY MORE COMBO': 28990,
  'DJI NEO 2 FLY MORE COMBO': 20590,
  'DJI Neo 2 Fly More Combo (Drone Only)': 16990,
  'DJI NEO 2': 11990,
  'DJI NEO MOTION FLY MORE COMBO': 26990,
  'DJI NEO FLY MORE COMBO': 19990,
  'DJI NEO': 10790,
  'DJI NEO COMBO (GLOBAL)': 14990,

  // Flip
  'DJI Flip Fly More Combo (DJI RC 2) (GL)': 32990,
  'DJI FLIP (No RC, Two Batteries)': 23990,
  'DJI Flip (DJI RC 2) (GL)': 28990,
  'DJI Flip (GL)': 19990,

  // Robomaster
  'DJI Robomaster S1': 32990,

  // Power
  'DJI POWER 1000 Mini (PHI)': 32990,
  'POWER 1000': 52990,
  'DJI Power 1000 V2 (CN)': 54990,
  'DJI Power 2000 (CN)': 98990,
  'DJI POWER 1000V2 (CN)(RB)': 48990,
  'IBCPOWER 200W Foldable Solar Panel (Non-CN)': 19990,
  'IBCPOWER 100W Foldable Solar Panel': 11990,
  'DJI Power Car Battery Charging Cable': 2490,
  'DJI Power 140W GaN Charging Combo (NA&JP)': 5990,
  'DJI Power 140W GaN Charger (NA&JP)': 4990,
  'DJI Power Car Power Charging Cable': 2490,
  'DJI Power MC4 Solar Power Charging Cable': 2990,

  // Handheld
  'DJI Focus Pro All-in-One Combo': 99990,
  'DJI Focus Pro Creator Combo': 52990,
  'DJI RONIN 4D 6K COMBO': 369900,
  'RS 5 Combo': 49990,
  'RS 5': 39990,
  'DJI RS 4 Pro Combo 2026': 53990,
  'DJI RS 4 Pro Combo': 53990,
  'DJI RS 4 Pro': 43990,
  'DJI RS 4 Combo': 33990,
  'DJI RS 4': 27990,
  'DJI RS 4 (PROMOTION Oct. 6-12)': 25990,
  'DJI RS 4 MINI': 19990,
  'DJI RS 4 MINI COMBO': 23990,
  'DJI RS 3 PRO COMBO': 51990,
  'DJI RS 3 PRO': 41990,
  'DJI RS 3 MINI': 16990,

  // Pocket
  'Osmo Pocket 4P Vlog Combo': 36990,
  'Osmo Pocket 4P Standard Combo': 31990,
  'Osmo Pocket 4P Standard Combo (Pearl White)': 31990,
  'Osmo Pocket 4 Creator Combo': 34990,
  'Osmo Pocket 4 Standard Combo': 28990,
  'Osmo Pocket 3 Creator Combo': 32990,
  'Osmo Pocket 3': 26990,

  // Osmo 360
  'Osmo 360 II Adventure Combo': 32990,
  'Osmo 360 II Limitless Riding Combo': 36990,
  'Osmo 360 II Standard Combo': 26990,
  'Osmo 360 II Soft Combo': 24990,
  'Osmo 360 Adventure Combo': 29990,
  'Osmo 360 Standard Combo': 24990,

  // Action
  'Osmo Action 6 Adventure Combo': 28990,
  'Osmo Action 6 Street Photography Gift Set': 26990,
  'Osmo Action 6 Standard Combo': 22990,
  'Osmo Action 5 PRO Adventure Combo': 25990,
  'Osmo Action 5 PRO Standard Combo': 20990,
  'Osmo Action 4 Adventure Combo': 22990,
  'Osmo Action 4 Standard Combo': 17990,

  // Nano & Mobile
  'DJI OSMO NANO (128GB)': 18990,
  'DJI OSMO NANO (64GB)': 14990,
  'Osmo Mobile 8P Standard Combo': 9990,
  'Osmo Mobile 8P AdvancedTracking Combo': 12990,
  'Osmo Mobile 8P Creator Combo': 14990,
  'DJI OSMO MOBILE 8': 8490,
  'DJI OSMO MOBILE 8 (Device Only)': 7490,
  'DJI Osmo Mobile 7P': 8990,
  'DJI OSMO MOBILE 7': 7490,

  // Mic
  'DJI Mic 2 (2 TX + 1 RX + Charging Case)（CE）': 19990,
  'DJI Mic 2 (1 TX + 1 RX)（CE）': 12990,
  'DJI Mic 2 Transmitter (Pearl White)': 5990,
  'DJI Mic 2 Transmitter (Shadow Black)': 5990,
  'DJI Mic 3 (2 TX + 1 RX + Charging Case)': 20990,
  'DJI Mic 3 (1 TX + 1 RX)': 14990,
  'DJI Mic 3 Transmitter': 6490,
  'DJI Mic 3 Receiver': 7490,
  'DJI Mic 3 Charging Case': 4990,
  'DJI MIC (2TX & 1 RX)': 17990,
  'DJI MIC (1TX & 1 RX)': 11990,
  'DJI Mic Mini 2 (2 TX + 1 RX + Charging Case)': 11990,
  'DJI Mic Mini 2 (2 TX + 1 Mobile RX + Charging Case)': 10990,
  'DJI Mic Mini 2 (1 TX + 1 Mobile RX + Charging Case)': 8490,
  'DJI Mic Mini 2 (1 TX + 1 RX)': 6990,
  'DJI Mic Mini 2 Transmitter': 3490,
  'DJI Mic Mini 2S (2 TX + 1 RX + Charging Case)': 12990,
  'DJI Mic Mini 2S (1 TX + 1 RX)': 7490,
  'DJI Mic Mini 2S (1 TX + 1 Mobile RX + Charging Case)': 8990,
  'DJI Mic Mini 2S Transmitter': 3790,
  'DJI Mic Mini (2 TX + 1 RX + Charging Case)': 9990,
  'DJI Mic Mini (1 TX + 1 RX)': 5990,
  'DJI Mic Mini Transmitter (Arctic White)': 2990,
  'DJI Mic Mini Transmitter (Infinity Black)': 2990,
  'DJI SDR Transmission 2': 23990,
  'DJI SDR Transmission 2 Combo': 34990,

  // Remote Controllers
  'DJI RC': 15990,
  'DJI RC Pro': 49990,
  'DJI RC 2': 18990,

  // Others
  'DJI MAVIC 3 CINE PREMIUM COMBO': 269990,
  'DJI SDR TRANSMISSION COMBO': 32990,
  'DJI SDR TRANSMISSION RECEIVER': 19990,
  'DJI SDR TRANSMISSION TRANSMITTER': 19990,
  'DJI - Robomaster S1 Part9 Gel Beads': 590,
  'DJI RS L-Shaped Multi-Camera Control Cable (USB-C, 30 cm)': 990
};

for (const [k, v] of Object.entries(knownSRP)) {
  priceMap.set(k.trim().toUpperCase(), v);
}

// Compute prices for all products
function getPriceForProduct(p) {
  const norm = p.product_name.trim().toUpperCase();
  if (priceMap.has(norm)) return priceMap.get(norm);

  if (p.unit === 'Services' || p.series.includes('CARE REFRESH')) {
    const is2Yr = p.product_name.includes('2 Year');
    let base = 3490;
    if (p.product_name.includes('Mavic 4')) base = is2Yr ? 15990 : 8990;
    else if (p.product_name.includes('Air 3S')) base = is2Yr ? 12990 : 6990;
    else if (p.product_name.includes('Mini 5 Pro')) base = is2Yr ? 8990 : 4990;
    else if (p.product_name.includes('Avata 360')) base = is2Yr ? 9990 : 5490;
    else if (p.product_name.includes('Lito')) base = is2Yr ? 5990 : 3490;
    else if (p.product_name.includes('Neo')) base = is2Yr ? 3990 : 2190;
    else if (p.product_name.includes('Pocket 4')) base = is2Yr ? 6490 : 3690;
    else if (p.product_name.includes('Pocket 3')) base = is2Yr ? 5990 : 3290;
    else if (p.product_name.includes('Action 6')) base = is2Yr ? 5490 : 2990;
    else if (p.product_name.includes('Action 5')) base = is2Yr ? 4990 : 2690;
    else if (p.product_name.includes('360')) base = is2Yr ? 5990 : 3290;
    else if (p.product_name.includes('Nano')) base = is2Yr ? 3990 : 2190;
    else if (p.product_name.includes('Flip')) base = is2Yr ? 5490 : 2990;
    return base;
  }

  if (p.unit === 'Accessories' || p.series.includes('ACCESSORIES')) {
    let base = 2990;
    if (norm.includes('BATTERY')) base = 4990;
    if (norm.includes('PROPELLER') && !norm.includes('GUARD')) base = 990;
    if (norm.includes('GUARD')) base = 1490;
    if (norm.includes('CHARGING HUB')) base = 3490;
    if (norm.includes('FILTER')) base = 2990;
    if (norm.includes('CASE')) base = 3490;
    if (norm.includes('LENS')) base = 2490;
    if (norm.includes('GOGGLES 3')) base = 32990;
    if (norm.includes('GOGGLES 2')) base = 28990;
    if (norm.includes('MOTION 3')) base = 7490;
    if (norm.includes('MOTION 2')) base = 6490;
    if (norm.includes('CONTROLLER 3')) base = 9990;
    if (norm.includes('CONTROLLER 2')) base = 8990;
    if (norm.includes('RC PRO 2')) base = 49990;
    if (norm.includes('240W POWER ADAPTER')) base = 5990;
    return base;
  }

  return 9990;
}

// 1. Unique Series in order of appearance
const seriesList = [];
const seriesSet = new Set();
for (const p of master.products) {
  if (!seriesSet.has(p.series)) {
    seriesSet.add(p.series);
    seriesList.push(p.series);
  }
}

// 2. Product map from master
const prodMap = new Map();
master.products.forEach(p => {
  prodMap.set(p.product_name.trim().toUpperCase(), p);
});

// 3. Update existing units with new series
const updatedUnits = current.units.map(u => {
  const norm = (u[1] || '').trim().toUpperCase();
  const m = prodMap.get(norm);
  const seriesName = m ? m.series : u[3];
  const price = u[2] > 0 ? u[2] : (m ? getPriceForProduct(m) : 9990);
  return [u[0], u[1], price, seriesName, u[4], u[5]];
});

// 4. Calculate inStockCount and soldCount for each master product
const inStockCounts = new Map();
const soldCounts = new Map();
updatedUnits.forEach(u => {
  const norm = (u[1] || '').trim().toUpperCase();
  if (u[4] === 'IN STOCK') {
    inStockCounts.set(norm, (inStockCounts.get(norm) || 0) + 1);
  } else if (u[4] === 'SOLD') {
    soldCounts.set(norm, (soldCounts.get(norm) || 0) + 1);
  }
});

// 5. Build full stock array of 315 products
const newStock = master.products.map(p => {
  const norm = p.product_name.trim().toUpperCase();
  const price = getPriceForProduct(p);
  const inStock = inStockCounts.get(norm) || 0;
  const sold = soldCounts.get(norm) || 0;
  return [p.series, p.product_name, price, inStock, sold];
});

// 6. Save updated djiData.json
const updatedDjiData = {
  ...current,
  ser: seriesList,
  stock: newStock,
  units: updatedUnits,
};

fs.writeFileSync(djiDataPath, JSON.stringify(updatedDjiData, null, 2), 'utf8');
console.log('Successfully updated djiData.json:');
console.log('  Series count:', seriesList.length);
console.log('  Stock products count:', newStock.length);
console.log('  Units count:', updatedUnits.length);

// 7. Write masterCatalog.ts
const catalogTsContent = `// Authoritative Master Catalog generated from dji_product_inventory_with_unit_series__1__a9e24475.json
export interface MasterProductItem {
  unit: string;
  series: string;
  productName: string;
  price: number;
}

export const MASTER_SERIES_LIST: string[] = ${JSON.stringify(seriesList, null, 2)};

export const MASTER_UNITS_LIST: string[] = [
  'Drone',
  'Handheld',
  'Audio',
  'Power & Accessories',
  'Accessories',
  'Remote Controller',
  'Others',
  'Services',
];

export const MASTER_PRODUCTS: MasterProductItem[] = ${JSON.stringify(
  master.products.map(p => ({
    unit: p.unit,
    series: p.series,
    productName: p.product_name,
    price: getPriceForProduct(p),
  })),
  null,
  2
)};

// Fast normalized lookup maps
const norm = (s: string) => String(s || '').trim().toUpperCase();

export const PRODUCT_TO_SERIES_MAP: Record<string, string> = Object.fromEntries(
  MASTER_PRODUCTS.map((p) => [norm(p.productName), p.series])
);

export const PRODUCT_TO_UNIT_MAP: Record<string, string> = Object.fromEntries(
  MASTER_PRODUCTS.map((p) => [norm(p.productName), p.unit])
);

export const PRODUCT_TO_PRICE_MAP: Record<string, number> = Object.fromEntries(
  MASTER_PRODUCTS.map((p) => [norm(p.productName), p.price])
);

export const SERIES_TO_UNIT_MAP: Record<string, string> = Object.fromEntries(
  MASTER_PRODUCTS.map((p) => [p.series, p.unit])
);

export function getMasterSeries(productName: string): string {
  return PRODUCT_TO_SERIES_MAP[norm(productName)] || 'OTHERS';
}

export function getMasterUnit(productName: string): string {
  return PRODUCT_TO_UNIT_MAP[norm(productName)] || 'Others';
}

export function getMasterPrice(productName: string): number {
  return PRODUCT_TO_PRICE_MAP[norm(productName)] || 0;
}

export function isAccessoryProduct(productName: string, seriesName?: string): boolean {
  const u = getMasterUnit(productName);
  if (u === 'Accessories') return true;
  if (seriesName && (seriesName.toUpperCase().includes('ACCESSOR') || seriesName.toUpperCase() === 'ACCESSORIES')) return true;
  return false;
}

export function isCareRefreshProduct(productName: string, seriesName?: string): boolean {
  const u = getMasterUnit(productName);
  if (u === 'Services') return true;
  if (seriesName && (seriesName.toUpperCase().includes('CARE REFRESH') || seriesName.toUpperCase().includes('SERVICES'))) return true;
  return norm(productName).includes('CARE REFRESH');
}
`;

fs.writeFileSync(path.resolve('src/data/masterCatalog.ts'), catalogTsContent, 'utf8');
console.log('Successfully wrote src/data/masterCatalog.ts');
