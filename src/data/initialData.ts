import rawData from './djiData.json';
import { DjiDataset } from '../types';

export const DJI_DATA: DjiDataset = rawData as unknown as DjiDataset;

export const MAIN_PUSH_TARGETS: [name: string, sold: number, target: number][] = [
  ['Mini 5 Pro', 6, 9],
  ['NEO Series', 10, 18],
  ['Lito X1', 7, 15],
  ['OA Series', 25, 54],
  ['Pocket Series', 13, 45],
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
