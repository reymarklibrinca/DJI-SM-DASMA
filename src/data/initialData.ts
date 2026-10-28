import rawData from './djiData.json';
import { DjiDataset } from '../types';

export const DEFAULT_STAFF: string[] = [
  'Lee, Christian Joseph',
  'Barias, Donna Leah',
  'Sarabia, Jobert',
];

export const DJI_DATA: DjiDataset = {
  ...(rawData as unknown as DjiDataset),
  staff: DEFAULT_STAFF,
};
export * from './masterCatalog';

export const MAIN_PUSH_TARGETS: [name: string, sold: number, target: number][] = [
  ['MINI 5 PRO SERIES', 0, 9],
  ['NEO 2 SERIES', 0, 18],
  ['LITO X1 SERIES', 0, 15],
  ['OSMO ACTION 6 SERIES', 0, 54],
  ['OSMO POCKET 4 SERIES', 0, 45],
];

export const ROUTINE_TASKS: string[] = [
  'Opening inventory count and serial verification',
  'Collect at least 3 follow-up leads per promoter',
  'Active demo of Osmo Action series and Pocket 4 to walk-in guests',
  'Post the daily sales report: sales, main push, leads, stock gaps, next actions',
  'Monday 10am: role play on closing and product briefing',
];

export const LEAD_TYPE_NAMES = ['Walk-in', 'Revisit', 'Online', 'Not tagged'] as const;

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
