import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Calendar, Target, Award, BarChart3, Layers } from 'lucide-react';
import { SaleTuple } from '../../types';
import { DAYS_OF_WEEK } from '../../data/initialData';
import {
  dayOffsetToDate,
  formatDate,
  formatCurrency,
  formatNumber,
  aggregateSales,
} from '../../utils/calculations';

interface SalesTrends7DaysChartProps {
  sales: SaleTuple[];
  endOffset: number;
  dailyGoal?: number;
  staffList?: string[];
}

export const SalesTrends7DaysChart: React.FC<SalesTrends7DaysChartProps> = ({
  sales,
  endOffset,
  dailyGoal = 232258,
  staffList = ['Lee, Christian Joseph', 'Barias, Donna Leah', 'Sarabia, Jobert'],
}) => {
  const [metricMode, setMetricMode] = useState<'both' | 'revenue' | 'units'>('both');

  // Compute 7 days data points from (endOffset - 6) to endOffset
  const chartData = useMemo(() => {
    const startDay = Math.max(0, endOffset - 6);
    const days: Array<{
      dayOffset: number;
      dayLabel: string;
      dayOfWeek: string;
      shortLabel: string;
      fullDateStr: string;
      revenue: number;
      units: number;
      hardware: number;
      care: number;
      accessories: number;
      goal: number;
      topPromoterName: string;
      topPromoterSales: number;
    }> = [];

    for (let offset = startDay; offset <= endOffset; offset++) {
      const agg = aggregateSales(sales, offset, offset, staffList);
      const d = dayOffsetToDate(offset);
      const dow = DAYS_OF_WEEK[d.getDay()];
      const dLabel = formatDate(offset);

      // Find top promoter of the day
      let topName = 'No Sales';
      let topSa = 0;
      agg.st.forEach((stRow, stIdx) => {
        if (stRow[0] > topSa) {
          topSa = stRow[0];
          topName = staffList[stIdx] || `Promoter #${stIdx + 1}`;
        }
      });

      const accessories = Math.max(0, agg.un - agg.hw - agg.care);

      days.push({
        dayOffset: offset,
        dayLabel: dLabel,
        dayOfWeek: dow,
        shortLabel: `${dow} ${d.getDate()}`,
        fullDateStr: `${dow}, ${dLabel}`,
        revenue: agg.sa,
        units: agg.un,
        hardware: agg.hw,
        care: agg.care,
        accessories,
        goal: dailyGoal,
        topPromoterName: topName,
        topPromoterSales: topSa,
      });
    }

    // If fewer than 7 days (e.g. at the very beginning of the dataset), pad with empty previous days
    while (days.length < 7) {
      const firstOffset = days[0]?.dayOffset ?? endOffset;
      const prevOffset = firstOffset - 1;
      const d = dayOffsetToDate(prevOffset);
      const dow = DAYS_OF_WEEK[d.getDay()];
      const dLabel = formatDate(prevOffset);
      days.unshift({
        dayOffset: prevOffset,
        dayLabel: dLabel,
        dayOfWeek: dow,
        shortLabel: `${dow} ${d.getDate()}`,
        fullDateStr: `${dow}, ${dLabel}`,
        revenue: 0,
        units: 0,
        hardware: 0,
        care: 0,
        accessories: 0,
        goal: dailyGoal,
        topPromoterName: '–',
        topPromoterSales: 0,
      });
    }

    return days;
  }, [sales, endOffset, dailyGoal, staffList]);

  // Aggregate 7-day headline metrics
  const totals = useMemo(() => {
    const totalRev = chartData.reduce((acc, d) => acc + d.revenue, 0);
    const totalUnits = chartData.reduce((acc, d) => acc + d.units, 0);
    const totalHw = chartData.reduce((acc, d) => acc + d.hardware, 0);
    const totalCare = chartData.reduce((acc, d) => acc + d.care, 0);
    const avgDailyRev = totalRev / chartData.length;
    const peakDay = [...chartData].sort((a, b) => b.revenue - a.revenue)[0];
    const target7Days = dailyGoal * chartData.length;
    const targetAchievedPct = target7Days > 0 ? (totalRev / target7Days) * 100 : 0;

    return {
      totalRev,
      totalUnits,
      totalHw,
      totalCare,
      avgDailyRev,
      peakDay,
      target7Days,
      targetAchievedPct,
    };
  }, [chartData, dailyGoal]);

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), dailyGoal, 100000);
  const maxUnits = Math.max(...chartData.map((d) => d.units), 5);

  const startDateStr = chartData[0]?.fullDateStr || '';
  const endDateStr = chartData[chartData.length - 1]?.fullDateStr || '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              7-Day Sales Trend & Trajectory
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {startDateStr} – {endDateStr} · Trailing 7 operational days
            </span>
          </p>
        </div>

        {/* View Segmented Control */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMetricMode('both')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              metricMode === 'both'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Combined
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('revenue')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              metricMode === 'revenue'
                ? 'bg-white text-blue-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Revenue (₱)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('units')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              metricMode === 'units'
                ? 'bg-white text-indigo-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Units Sold
          </button>
        </div>
      </div>

      {/* 7-Day Performance Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            7-Day Revenue
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {formatCurrency(totals.totalRev)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Avg {formatCurrency(totals.avgDailyRev)} / day
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            7-Day Units
          </div>
          <div className="text-xl font-black text-indigo-600 mt-1">
            {totals.totalUnits}{' '}
            <span className="text-xs font-normal text-slate-500">sold</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totals.totalHw} hardware · {totals.totalCare} Care
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Peak Day
          </div>
          <div className="text-xl font-black text-emerald-700 mt-1">
            {totals.peakDay ? formatCurrency(totals.peakDay.revenue) : '₱0'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {totals.peakDay ? `${totals.peakDay.fullDateStr} (${totals.peakDay.units} units)` : '–'}
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Goal Target Rate</span>
            <Target className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div
            className={`text-xl font-black mt-1 ${
              totals.targetAchievedPct >= 100
                ? 'text-emerald-700'
                : totals.targetAchievedPct >= 70
                ? 'text-blue-600'
                : 'text-amber-600'
            }`}
          >
            {totals.targetAchievedPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Daily Goal: {formatCurrency(dailyGoal)}
          </div>
        </div>
      </div>

      {/* Recharts Chart Visualization */}
      <div className="w-full h-72 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 15, right: 10, left: -15, bottom: 5 }}
          >
            <defs>
              <linearGradient id="revenueGradient7d" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="shortLabel"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
              dy={8}
            />

            {/* Left YAxis: Revenue (PHP) */}
            <YAxis
              yAxisId="left"
              orientation="left"
              domain={[0, Math.ceil(maxRevenue * 1.15)]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(val) => `₱${Math.round(val / 1000)}k`}
            />

            {/* Right YAxis: Units Sold (visible if 'both' or 'units') */}
            {(metricMode === 'both' || metricMode === 'units') && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, Math.max(8, Math.ceil(maxUnits * 1.25))]}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#818cf8', fontSize: 10 }}
                tickFormatter={(val) => `${val}u`}
              />
            )}

            {/* Reference line for Daily Target */}
            <ReferenceLine
              yAxisId="left"
              y={dailyGoal}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Goal: ₱${Math.round(dailyGoal / 1000)}k`,
                position: 'top',
                fill: '#d97706',
                fontSize: 10,
                fontWeight: 600,
              }}
            />

            {/* Custom Tooltip */}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload;
                const isOverGoal = data.revenue >= dailyGoal;

                return (
                  <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-slate-700 min-w-[200px]">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-slate-200">{data.fullDateStr}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isOverGoal
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {isOverGoal ? 'Goal Met' : 'Below Goal'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Revenue:</span>
                        <span className="font-extrabold text-blue-400 text-sm">
                          {formatCurrency(data.revenue)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Daily Target:</span>
                        <span className="text-slate-300 font-medium">
                          {formatCurrency(dailyGoal)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Total Units:</span>
                        <span className="font-bold text-indigo-300">{data.units} units</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pl-2">
                        <span>• Devices: {data.hardware}</span>
                        <span>• Care: {data.care}</span>
                        <span>• Acc: {data.accessories}</span>
                      </div>
                    </div>

                    {data.topPromoterSales > 0 && (
                      <div className="border-t border-slate-800 pt-1.5 text-[11px] text-slate-300 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-amber-400 font-semibold truncate">
                          <Award className="w-3 h-3 shrink-0" />
                          <span className="truncate">{data.topPromoterName}</span>
                        </div>
                        <span className="font-bold text-slate-100 shrink-0">
                          {formatCurrency(data.topPromoterSales)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Revenue Area (Combined or Revenue Mode) */}
            {(metricMode === 'both' || metricMode === 'revenue') && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Sales Revenue"
                stroke="#2563eb"
                strokeWidth={3}
                fill="url(#revenueGradient7d)"
                activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* Units Bars (Combined or Units Mode) */}
            {(metricMode === 'both' || metricMode === 'units') && (
              <Bar
                yAxisId="right"
                dataKey="units"
                name="Units Sold"
                fill="#818cf8"
                opacity={metricMode === 'both' ? 0.6 : 0.85}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            )}

            {/* Optional Hardware Units trend line in Units mode */}
            {metricMode === 'units' && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="hardware"
                name="Hardware Units"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={{ r: 3, fill: '#4f46e5' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Footnote */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-4">
          {(metricMode === 'both' || metricMode === 'revenue') && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-600"></span>
              <span className="font-medium text-slate-700">Revenue (₱)</span>
            </div>
          )}
          {(metricMode === 'both' || metricMode === 'units') && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-400"></span>
              <span className="font-medium text-slate-700">Units Sold</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-amber-500"></span>
            <span className="font-medium text-amber-700">Daily Target ({formatCurrency(dailyGoal)})</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          Powered by Recharts · Real-time floor transaction sync
        </div>
      </div>
    </div>
  );
};
