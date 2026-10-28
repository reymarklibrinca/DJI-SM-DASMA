import { LocalStorageState, SaleTuple, UnitTuple } from '../types';
import { DEFAULT_MAIN_PUSH_VARIANTS } from './calculations';

/**
 * Generate a deterministic unique key for a sale tuple to deduplicate across
 * local and cloud storage without losing entries.
 */
export function getSaleUniqueKey(sale: SaleTuple): string {
  const sn = sale[6]?.trim().toUpperCase();
  if (sn) {
    return `SN:${sn}`;
  }
  // Composite key: [dayOffset, staffIndex, seriesIndex, amount, units, hold, sn, leadType]
  const day = sale[0];
  const staff = sale[1];
  const series = sale[2];
  const amount = Math.round(sale[3]);
  const units = sale[4] ?? 1;
  const leadType = sale[7] ?? 3;
  return `SALE:${day}_${staff}_${series}_${amount}_${units}_${leadType}`;
}

/**
 * Reconciles sales non-destructively:
 * - Local sales are NEVER removed.
 * - Remote sales not yet present locally are merged in.
 * - Duplicates (same serial number or exact tuple) are cleanly deduplicated.
 */
export function reconcileSales(
  localSales: SaleTuple[] = [],
  remoteSales: SaleTuple[] = []
): { merged: SaleTuple[]; changed: boolean } {
  const localMap = new Map<string, SaleTuple>();
  const merged: SaleTuple[] = [];

  for (const sale of localSales) {
    if (!sale || !Array.isArray(sale)) continue;
    const key = getSaleUniqueKey(sale);
    if (!localMap.has(key)) {
      localMap.set(key, sale);
      merged.push(sale);
    }
  }

  let changed = false;
  for (const remote of remoteSales) {
    if (!remote || !Array.isArray(remote)) continue;
    const key = getSaleUniqueKey(remote);
    if (!localMap.has(key)) {
      localMap.set(key, remote);
      merged.push(remote);
      changed = true;
    }
  }

  return { merged, changed };
}

/**
 * Reconciles routine tasks non-destructively (union of checked items):
 * Record<string, boolean[]> where key is dateKey and value is boolean array.
 */
export function reconcileTasks(
  localTasks: Record<string, boolean[]> = {},
  remoteTasks: Record<string, boolean[]> = {}
): Record<string, boolean[]> {
  const result: Record<string, boolean[]> = {};
  const allDateKeys = new Set([
    ...Object.keys(remoteTasks || {}),
    ...Object.keys(localTasks || {}),
  ]);

  for (const dateKey of allDateKeys) {
    const localArr = localTasks?.[dateKey] || [];
    const remoteArr = remoteTasks?.[dateKey] || [];
    const maxLen = Math.max(localArr.length, remoteArr.length);
    const mergedArr: boolean[] = [];

    for (let i = 0; i < maxLen; i++) {
      mergedArr.push(Boolean(localArr[i] || remoteArr[i]));
    }
    result[dateKey] = mergedArr;
  }

  return result;
}

/**
 * Reconciles lead entries:
 * Record<number, Record<string, [number, number, number]>>
 * For each day offset and promoter/staff key, preserves the maximum count
 * so entered leads are never decremented or erased.
 */
export function reconcileLeads(
  localLeads: Record<number, Record<string, [number, number, number]>> = {},
  remoteLeads: Record<number, Record<string, [number, number, number]>> = {}
): Record<number, Record<string, [number, number, number]>> {
  const result: Record<number, Record<string, [number, number, number]>> = {};

  const allDayOffsets = new Set<number>([
    ...Object.keys(remoteLeads || {}).map(Number),
    ...Object.keys(localLeads || {}).map(Number),
  ]);

  for (const day of allDayOffsets) {
    result[day] = {};
    const localDay = localLeads?.[day] || {};
    const remoteDay = remoteLeads?.[day] || {};
    const allStaffKeys = new Set([...Object.keys(remoteDay), ...Object.keys(localDay)]);

    for (const sKey of allStaffKeys) {
      const l = localDay[sKey] || [0, 0, 0];
      const r = remoteDay[sKey] || [0, 0, 0];
      result[day][sKey] = [
        Math.max(l[0] || 0, r[0] || 0),
        Math.max(l[1] || 0, r[1] || 0),
        Math.max(l[2] || 0, r[2] || 0),
      ];
    }
  }

  return result;
}

/**
 * Reconciles Main Push Targets:
 * Preserves user custom targets while incorporating any remote updates.
 */
/**
 * Reconciles Main Push Dividers (how many persons divide the target):
 */
export function reconcileMainPushDividers(
  localDividers: Record<string, number> = {},
  remoteDividers: Record<string, number> = {},
  preferLocal: boolean = true
): Record<string, number> {
  if (preferLocal) {
    return {
      ...(remoteDividers || {}),
      ...(localDividers || {}),
    };
  }
  return {
    ...(localDividers || {}),
    ...(remoteDividers || {}),
  };
}

export function reconcileMainPushTargets(
  localTargets: Record<string, number> = {},
  remoteTargets: Record<string, number> = {},
  preferLocal: boolean = true
): Record<string, number> {
  if (preferLocal) {
    return {
      ...(remoteTargets || {}),
      ...(localTargets || {}),
    };
  }
  return {
    ...(localTargets || {}),
    ...(remoteTargets || {}),
  };
}

/**
 * Reconciles Main Push Variants:
 * Unions all subvariants so newly added subvariants are NEVER lost on sync.
 */
export function reconcileMainPushVariants(
  localVariants: Record<string, string[]> = {},
  remoteVariants: Record<string, string[]> = {}
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  const allSeries = new Set([
    ...Object.keys(DEFAULT_MAIN_PUSH_VARIANTS),
    ...Object.keys(remoteVariants || {}),
    ...Object.keys(localVariants || {}),
  ]);

  for (const series of allSeries) {
    const defaultList = DEFAULT_MAIN_PUSH_VARIANTS[series] || [];
    const remoteList = remoteVariants?.[series] || [];
    const localList = localVariants?.[series] || [];

    // Combine uniquely while maintaining order
    const combined = Array.from(new Set([...defaultList, ...remoteList, ...localList]));
    if (combined.length > 0) {
      merged[series] = combined;
    }
  }

  return merged;
}

/**
 * Reconciles inventory units without dropping locally imported/added items.
 */
export function reconcileInventoryUnits(
  localUnits?: UnitTuple[],
  remoteUnits?: UnitTuple[],
  hasCustomLocal: boolean = false,
  hasCustomRemote: boolean = false
): { units?: UnitTuple[]; hasCustom: boolean } {
  const hasCustom = hasCustomLocal || hasCustomRemote;
  if (!hasCustom && !localUnits && !remoteUnits) {
    return { units: undefined, hasCustom: false };
  }

  const map = new Map<string, UnitTuple>();

  // Add remote units first
  if (Array.isArray(remoteUnits)) {
    for (const u of remoteUnits) {
      if (u && u[0]) {
        map.set(u[0].trim().toUpperCase(), u);
      }
    }
  }

  // Local units override or add
  if (Array.isArray(localUnits)) {
    for (const u of localUnits) {
      if (u && u[0]) {
        map.set(u[0].trim().toUpperCase(), u);
      }
    }
  }

  return {
    units: Array.from(map.values()),
    hasCustom: true,
  };
}

/**
 * Master non-destructive state reconciler.
 * Protects all user inputs (sales, tasks, leads, targets, subvariants, inventory)
 * so that syncing with Firebase Firestore NEVER destroys or rolls back local data.
 */
export function reconcileStoreState(
  local: LocalStorageState,
  remote: any,
  options: { preferLocal?: boolean } = {}
): { reconciled: LocalStorageState; hadAdditionsFromRemote: boolean; hadAdditionsFromLocal: boolean } {
  if (!remote || typeof remote !== 'object') {
    return {
      reconciled: local,
      hadAdditionsFromRemote: false,
      hadAdditionsFromLocal: true,
    };
  }

  const preferLocal = options.preferLocal !== false;

  // 1. Sales Reconcile
  const { merged: mergedSales, changed: remoteHadNewSales } = reconcileSales(
    local.sales || [],
    Array.isArray(remote.sales) ? remote.sales : []
  );

  const remoteSalesCount = Array.isArray(remote.sales) ? remote.sales.length : 0;
  const localHadNewSales = mergedSales.length > remoteSalesCount;

  // 2. Tasks Reconcile
  const mergedTasks = reconcileTasks(local.tasks, remote.tasks);

  // 3. Leads Reconcile
  const mergedLeads = reconcileLeads(local.leads, remote.leads);

  // 4. Finalized Days Reconcile (union)
  const mergedFinal = {
    ...(remote.final || {}),
    ...(local.final || {}),
  };

  // 5. Main Push Targets Reconcile
  const mergedTargets = reconcileMainPushTargets(
    local.mainPushTargets,
    remote.mainPushTargets,
    preferLocal
  );

  // 5b. Main Push Dividers Reconcile
  const mergedDividers = reconcileMainPushDividers(
    local.mainPushDividers,
    remote.mainPushDividers,
    preferLocal
  );

  // 6. Main Push Variants Reconcile (preserves subvariants)
  const mergedVariants = reconcileMainPushVariants(
    local.mainPushVariants,
    remote.mainPushVariants
  );

  // 7. Inventory Units Reconcile
  const { units: mergedInventoryUnits, hasCustom } = reconcileInventoryUnits(
    local.inventoryUnits,
    remote.inventoryUnits,
    Boolean(local.hasCustomInventory),
    Boolean(remote.hasCustomInventory)
  );

  // 8. Goal & Promoter Targets
  const goal =
    preferLocal && typeof local.goal === 'number' && local.goal > 0
      ? local.goal
      : typeof remote.goal === 'number'
      ? remote.goal
      : local.goal || 232258;

  const pm =
    preferLocal && local.pm
      ? { ...(remote.pm || {}), ...local.pm }
      : { ...(local.pm || {}), ...(remote.pm || {}) };

  // 9. Staff / Promoters Reconcile
  const staff =
    preferLocal && Array.isArray(local.staff) && local.staff.length > 0
      ? local.staff
      : Array.isArray(remote.staff) && remote.staff.length > 0
      ? remote.staff
      : local.staff;

  const reconciled: LocalStorageState = {
    sales: mergedSales,
    tasks: mergedTasks,
    leads: mergedLeads,
    final: mergedFinal,
    goal,
    pm,
    mainPushTargets: mergedTargets,
    mainPushVariants: mergedVariants,
    mainPushDividers: mergedDividers,
    inventoryUnits: mergedInventoryUnits,
    hasCustomInventory: hasCustom,
    staff,
  };

  return {
    reconciled,
    hadAdditionsFromRemote: remoteHadNewSales,
    hadAdditionsFromLocal:
      localHadNewSales ||
      Object.keys(local.tasks || {}).length > Object.keys(remote.tasks || {}).length,
  };
}
