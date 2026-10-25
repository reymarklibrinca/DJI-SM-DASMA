import React, { useState } from 'react';
import { Activity, Calendar, Clock, TrendingUp } from 'lucide-react';
import { DAYS_OF_WEEK } from '../data/initialData';
import { PeriodRange, SaleTuple } from '../types';
import {
  aggregateSales,
  calculatePercentChange,
  dayOffsetToDate,
  formatCurrency,
  formatDate,
} from '../utils/calculations';

interface SalesRhythmTabProps {
  sales: SaleTuple[];
  endOffset: number;
  periodRange: PeriodRange;
}

export const SalesRhythmTab: React.FC<SalesRhythmTabProps> = ({
  sales,
  endOffset,
  periodRange,
}) => {
  const [tooltip, setTooltip] = useState<{ date: string; sa: number } | null>(null);

  const allAgg = aggregateSales(sales, 0, endOffset);
  const periodAgg = aggregateSales(sales, periodRange.a, periodRange.b);

  const maxHistoricalDaily = Math.max(...allAgg.day, 1);

  // Week ending offset (aligned to current endOffset's week)
  const endD = dayOffsetToDate(endOffset);
  const dowCurrent = (endD.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  const weekMondayOffset = endOffset - dowCurrent;

  // 10 weeks of daily calendar cells (Mon..Sun)
  const calendarWeeks: {
    weekStartStr: string;
    days: { offset: number; date: Date; salesVal: number | null }[];
  }[] = [];

  for (let k = 9; k >= 0; k--) {
    const monday = weekMondayOffset - k * 7;
    const weekStartStr = formatDate(monday);
    const days = [];

    // [Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0]
    for (const d of [1, 2, 3, 4, 5, 6, 0]) {
      const dayOffset = monday + ((d + 6) % 7);
      const val = dayOffset >= 0 && dayOffset <= endOffset ? allAgg.day[dayOffset] ?? 0 : null;
      days.push({
        offset: dayOffset,
        date: dayOffsetToDate(dayOffset),
        salesVal: val,
      });
    }

    calendarWeeks.push({ weekStartStr, days });
  }

  // Day of week average revenue in current period
  // Order: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
  const dowOrder = [1, 2, 3, 4, 5, 6, 0];
  const dowAverages = dowOrder.map((d) => {
    const totalSales = periodAgg.dow[d];
    const occurrences = periodAgg.dn[d] || 1;
    const avg = totalSales / occurrences;
    return {
      dayIndex: d,
      name: DAYS_OF_WEEK[d],
      avg,
      totalSales,
    };
  });

  const maxDowAvg = Math.max(...dowAverages.map((x) => x.avg), 1);

  // Weekdays vs Weekends
  const weekdayDays = [1, 2, 3, 4, 5];
  const weekendDays = [0, 6];

  const weekdayTotal = weekdayDays.reduce((sum, d) => sum + periodAgg.dow[d], 0);
  const weekdayCount = Math.max(
    1,
    weekdayDays.reduce((sum, d) => sum + periodAgg.dn[d], 0)
  );
  const weekdayAvg = weekdayTotal / weekdayCount;

  const weekendTotal = weekendDays.reduce((sum, d) => sum + periodAgg.dow[d], 0);
  const weekendCount = Math.max(
    1,
    weekendDays.reduce((sum, d) => sum + periodAgg.dn[d], 0)
  );
  const weekendAvg = weekendTotal / weekendCount;

  const weekendDelta = calculatePercentChange(weekendAvg, weekdayAvg);

  return (
    <div className="space-y-6">
      {/* 10-Week Sales Heatmap */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              10-Week Sales Velocity Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Values displayed in thousands of Pesos (₱k). Darker blue signifies higher revenue.
            </p>
          </div>
          {tooltip && (
            <div className="text-xs bg-slate-900 text-white px-3 py-1 rounded-lg font-mono font-medium shadow-xs">
              {tooltip.date}: {formatCurrency(tooltip.sa)}
            </div>
          )}
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[580px]">
            {/* Headers */}
            <div className="grid grid-cols-8 gap-1.5 text-center text-xs font-semibold text-slate-400 mb-2">
              <div className="text-left text-[11px] text-slate-400 pl-1">Week of</div>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-1.5">
              {calendarWeeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-cols-8 gap-1.5 items-center">
                  <div className="text-xs font-medium text-slate-500 text-left pl-1 truncate">
                    {week.weekStartStr}
                  </div>
                  {week.days.map((day, dIdx) => {
                    if (day.salesVal === null) {
                      return (
                        <div
                          key={dIdx}
                          className="h-9 rounded-lg bg-slate-50 border border-slate-100"
                        />
                      );
                    }

                    const intensity = Math.min(1, day.salesVal / (maxHistoricalDaily * 0.8));
                    const isZero = day.salesVal === 0;

                    return (
                      <div
                        key={dIdx}
                        onMouseEnter={() =>
                          setTooltip({
                            date: formatDate(day.offset),
                            sa: day.salesVal || 0,
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                        className={`h-9 rounded-lg flex items-center justify-center text-xs font-semibold cursor-pointer transition-transform hover:scale-105 border ${
                          isZero
                            ? 'bg-slate-50 border-slate-200 text-slate-400'
                            : intensity > 0.5
                            ? 'border-blue-600 text-white'
                            : 'border-blue-200 text-blue-900'
                        }`}
                        style={{
                          backgroundColor: isZero
                            ? undefined
                            : `rgba(37, 99, 235, ${Math.max(0.12, intensity)})`,
                        }}
                      >
                        {isZero ? '0' : `${Math.round(day.salesVal / 1000)}k`}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Day of Week & Weekend Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of Week Averages */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Average Daily Sales by Day of Week ({periodRange.lb})
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            Benchmarked across all occurrences in the active period.
          </p>

          <div className="space-y-3.5">
            {dowAverages.map((item) => {
              const widthPct = Math.min(100, (item.avg / maxDowAvg) * 100);
              return (
                <div key={item.dayIndex} className="flex items-center gap-3 text-xs">
                  <span className="w-9 font-bold text-slate-700">{item.name}</span>
                  <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-24 text-right font-semibold text-slate-900">
                    {formatCurrency(item.avg)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekday vs Weekend Velocity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Weekdays vs. Weekends Dynamic
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Operational pacing between Monday–Friday and Saturday–Sunday.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-medium text-slate-500">Weekday Average</div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {formatCurrency(weekdayAvg)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Mon to Fri</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-medium text-slate-500">Weekend Average</div>
                <div className="text-xl font-bold text-blue-600 mt-1">
                  {formatCurrency(weekendAvg)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Sat & Sun</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-slate-700 leading-relaxed">
              <p className="font-semibold text-slate-900 mb-1">
                Scheduling & Roster Recommendation:
              </p>
              Weekends generate{' '}
              <strong className={weekendDelta >= 0 ? 'text-emerald-700' : 'text-slate-900'}>
                {Math.abs(weekendDelta).toFixed(1)}% {weekendDelta >= 0 ? 'more' : 'less'}
              </strong>{' '}
              revenue per day than weekdays. Ensure all 3 promoters (Christian, Donna, Jobert) are present on Saturdays and Sundays during peak mall hours (2pm–8pm) for maximum conversion.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
