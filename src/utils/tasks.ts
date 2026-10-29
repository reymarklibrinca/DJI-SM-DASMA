/**
 * Toggle one routine task for one day WITHOUT touching any other day.
 * (The old store code replaced the whole tasks object with only today's key,
 * which erased every earlier day's checklist history on each tap.)
 */
export function toggleTaskForDay(
  tasks: Record<string, boolean[]> = {},
  dateKey: string,
  index: number,
  total: number
): Record<string, boolean[]> {
  const day = [...(tasks[dateKey] || [])];
  while (day.length < total) day.push(false);
  day[index] = !day[index];
  return { ...tasks, [dateKey]: day };
}

export function countDoneTasks(tasks: Record<string, boolean[]> = {}, dateKey: string): number {
  return (tasks[dateKey] || []).filter(Boolean).length;
}
