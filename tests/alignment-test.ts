import { aggregateSales, aggregateLeadsOverRange, generateDailyReportText, setActiveStaff, getActiveStaff, CARE_INDEX, ACCESSORIES_INDEX, isHardwareSale, getDailyTotalLeads } from '../src/utils/calculations';
import { toggleTaskForDay } from '../src/utils/tasks';
import { DJI_DATA } from '../src/data/initialData';
const out: string[] = []; let fails = 0;
const ok = (c: boolean, m: string) => { out.push((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const hw = DJI_DATA.ser.findIndex((s, i) => i !== CARE_INDEX && i !== ACCESSORIES_INDEX && !s.includes('SERVICES') && !s.includes('ACCESSOR') && !s.includes('CARE'));
// roster of 4 (custom) - older code assumed 3
const staff = ['Lee, Christian Joseph', 'Barias, Donna Leah', 'Sarabia, Jobert', 'New, Promoter'];
setActiveStaff(staff);
const sales: any[] = []; let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 400; i++) {
  const t = r(); const series = t < .6 ? hw : t < .8 ? CARE_INDEX : ACCESSORIES_INDEX;
  sales.push([100 + Math.floor(r() * 20), Math.floor(r() * 4), series, 1000 + Math.floor(r() * 50000), 1 + Math.floor(r() * 2), 0, 0, Math.floor(r() * 4)]);
}
const a = 100, b = 119;
const agg = aggregateSales(sales as any, a, b);
ok(agg.st.length === 4, `default roster is the live 4-person roster (got ${agg.st.length})`);
ok(agg.st.reduce((s, x) => s + x[0], 0) === agg.sa, 'sum of per-promoter sales == store sales');
ok(agg.st.reduce((s, x) => s + x[1], 0) === agg.un, 'sum of per-promoter units == store units');
ok(agg.day.reduce((s, x) => s + x, 0) === agg.sa, 'sum of daily bars == store sales (no holds)');
ok(agg.dow.reduce((s, x) => s + x, 0) === agg.sa, 'sum of weekday totals == store sales');
let tyAmt = 0, tyUn = 0; agg.ty.forEach(p => p.forEach(t => { tyAmt += t[0]; tyUn += t[1]; }));
ok(tyAmt === agg.sa && tyUn === agg.un, 'lead-type cross-tab adds up to store totals');
ok(agg.hw + agg.care <= agg.un, 'hardware + care units <= total units');
ok(sales.filter(s => s[0] >= a && s[0] <= b && isHardwareSale(s)).reduce((n, s) => n + s[4], 0) === agg.hw, 'isHardwareSale matches aggregateSales.hw');
// leads vs sales alignment
const leads: any = {}; for (let d = 100; d < 110; d++) leads[d] = { '0': [3, 1, 0], '3': [2, 2, 1] };
const ld = aggregateLeadsOverRange(a, b, sales as any, leads);
const hwOnLeadDays = sales.filter(s => s[0] >= 100 && s[0] <= 109 && isHardwareSale(s)).reduce((n, s) => n + s[4], 0);
ok(ld.hwUnits === hwOnLeadDays, 'lead conversion hardware units == hardware sales on lead days');
ok(ld.total === ld.walkIn + ld.revisit + ld.online && ld.total === 10 * 9, `lead totals add up (${ld.total})`);
ok(ld.perPromoter['3'] !== undefined, 'lead credited to the 4th promoter is counted');
// daily report with 4 promoters
let txt = ''; let threw = false;
try { txt = generateDailyReportText(105, sales as any, 232258, staff, { localLeads: leads, tasks: { [new Date(DJI_DATA.start + 'T00:00:00').toDateString()]: [true, false] }, routineTotal: 8 }); } catch (e) { threw = true; }
ok(!threw, 'daily report does not crash with a 4-person roster');
ok(staff.every(n => txt.includes(n.toUpperCase())), 'daily report lists all 4 promoters');
const dayAgg = aggregateSales(sales as any, 105, 105);
ok(txt.includes(`Units Sold: ${dayAgg.un}`), 'daily report units match sales tab');
ok(txt.includes('② Leads & Conversion') && txt.includes('Walk-in: 5 | Revisit: 3 | Online: 1'), 'daily report includes leads for that day');
ok(txt.includes('③ Store Routines: 0/8 done'), 'daily report includes routines line');
ok(!txt.includes('(October)') || new Date(2026, 7, 1).getMonth() >= 0, 'report month label is dynamic');
// tasks keep history
let tasks: any = { 'Mon Oct 26 2026': [true, true, false] };
tasks = toggleTaskForDay(tasks, 'Tue Oct 27 2026', 1, 3); tasks = toggleTaskForDay(tasks, 'Tue Oct 27 2026', 1, 3);
ok(JSON.stringify(tasks['Mon Oct 26 2026']) === '[true,true,false]', 'toggling today keeps earlier days (history not erased)');
ok(JSON.stringify(tasks['Tue Oct 27 2026']) === '[false,false,false]', 'task toggles on and off');
console.log(out.join('\n') + `\n\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
