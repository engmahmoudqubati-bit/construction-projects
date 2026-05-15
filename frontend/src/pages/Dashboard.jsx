import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '../api/client';

const TABS = [
  { key: 'boq', label: 'BOQ Progress' },
  { key: 'delivery', label: 'Delivery Progress' },
  { key: 'installation', label: 'Installation Progress' },
  { key: 'compare', label: 'Delivery vs Installation' },
  { key: 'weekly', label: 'Weekly Analysis' },
  { key: 'classification', label: 'Classification Analysis' },
  { key: 'risks', label: 'Risk & Delays' },
];

const BLUE = '#2563eb';
const GREEN = '#22c55e';
const ORANGE = '#f97316';
const RED = '#ef4444';
const PURPLE = '#7c3aed';
const SLATE = '#0f172a';

const QUARTERS = [
  { value: 'all', label: 'All Quarters' },
  { value: 'Q1', label: 'Q1' },
  { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' },
  { value: 'Q4', label: 'Q4' },
];

const MONTHS = [
  { value: 'all', label: 'All Months' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: new Date(2024, i, 1).toLocaleString(undefined, { month: 'long' }),
  })),
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value, digits = 0) {
  return num(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function pct(value, digits = 1) {
  return `${num(value).toFixed(digits)}%`;
}

function safePct(part, total) {
  const p = num(part);
  const t = num(total);
  if (!t) return 0;
  return Math.max(0, Math.min(100, (p / t) * 100));
}

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

function projectLabel(project) {
  return [project.project_name_en, project.project_name_ar, project.project_name, project.name]
    .filter(Boolean)
    .join(' / ') || `Project ${project.id}`;
}

function dateKey(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatDate(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function startOfIsoWeek(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(dateValue, days) {
  const d = new Date(dateValue);
  d.setDate(d.getDate() + days);
  return d;
}

function weekNumber(dateValue) {
  const d = new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getQuarter(dateValue) {
  const month = new Date(dateValue).getMonth();
  return `Q${Math.floor(month / 3) + 1}`;
}

function makeContinuousWeeks(minDate, maxDate) {
  const start = startOfIsoWeek(minDate || new Date());
  const end = startOfIsoWeek(maxDate || new Date());
  if (!start || !end) return [];
  const weeks = [];
  let cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 520) {
    const weekStart = new Date(cursor);
    const weekEnd = addDays(weekStart, 6);
    const wk = weekNumber(weekStart);
    weeks.push({
      key: dateKey(weekStart),
      weekNo: wk,
      year: weekStart.getFullYear(),
      quarter: getQuarter(weekStart),
      month: weekStart.getMonth(),
      start: weekStart,
      end: weekEnd,
      label: `W${wk} ${weekStart.getFullYear()}`,
      range: `${formatDate(weekStart)} - ${formatDate(weekEnd)}`,
    });
    cursor = addDays(cursor, 7);
    guard += 1;
  }
  return weeks;
}

function classifyTrend(actualPct, plannedPct) {
  const diff = num(actualPct) - num(plannedPct);
  if (diff >= 5) return { label: 'Ahead', color: GREEN, note: `+${pct(diff)} vs planned` };
  if (diff <= -5) return { label: 'Behind', color: RED, note: `${pct(diff)} vs planned` };
  return { label: 'On Track', color: GREEN, note: `${pct(diff)} vs planned` };
}

function getRangeStartDate(range, weeks) {
  if (!weeks.length || range === 'full') return null;
  const last = weeks[weeks.length - 1]?.end;
  if (!last) return null;
  const d = new Date(last);
  if (range === '4w') d.setDate(d.getDate() - 7 * 4);
  if (range === '3m') d.setMonth(d.getMonth() - 3);
  if (range === '6m') d.setMonth(d.getMonth() - 6);
  if (range === '12m') d.setFullYear(d.getFullYear() - 1);
  return d;
}

function buildMergedRows(details) {
  const deliveryMap = new Map();
  const installMap = new Map();

  (details.deliveries || []).forEach((row) => {
    const key = `${row.project_id}:${row.item_id}`;
    deliveryMap.set(key, num(deliveryMap.get(key)) + num(row.qty_delivered));
  });

  (details.installations || []).forEach((row) => {
    const key = `${row.project_id}:${row.item_id}`;
    installMap.set(key, num(installMap.get(key)) + num(row.qty_installed));
  });

  return (details.boq || []).map((row) => {
    const key = `${row.project_id}:${row.item_id}`;
    const planned = num(row.planned_qty);
    const delivered = num(deliveryMap.get(key));
    const installed = num(installMap.get(key));
    const classification = row.classification_name || row.parent_classification_name || 'Uncategorized';
    const parentClassification = row.parent_classification_name || row.classification_name || 'General';
    return {
      key,
      project_id: row.project_id,
      item_id: row.item_id,
      item_code: row.item_code || '',
      item_name: row.item_name || 'Unnamed Item',
      unit_of_measure: row.unit_of_measure || '',
      classification_name: classification,
      parent_classification_name: parentClassification,
      planned_qty: planned,
      delivered_qty: delivered,
      installed_qty: installed,
      remaining_installation_qty: Math.max(0, planned - installed),
      delivered_not_installed_qty: Math.max(0, delivered - installed),
      delivery_pct: safePct(delivered, planned),
      installation_pct: safePct(installed, planned),
      efficiency_pct: safePct(installed, delivered),
      gap_pct: Math.max(0, safePct(delivered, planned) - safePct(installed, planned)),
    };
  });
}

function groupByClassification(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = clean(row.classification_name) || 'uncategorized';
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: row.classification_name || 'Uncategorized',
        parent: row.parent_classification_name || 'General',
        planned_qty: 0,
        delivered_qty: 0,
        installed_qty: 0,
        items: [],
      });
    }
    const group = map.get(key);
    group.planned_qty += num(row.planned_qty);
    group.delivered_qty += num(row.delivered_qty);
    group.installed_qty += num(row.installed_qty);
    group.items.push(row);
  });

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      delivery_pct: safePct(group.delivered_qty, group.planned_qty),
      installation_pct: safePct(group.installed_qty, group.planned_qty),
      remaining_qty: Math.max(0, group.planned_qty - group.installed_qty),
      delivered_not_installed_qty: Math.max(0, group.delivered_qty - group.installed_qty),
      gap_pct: Math.max(0, safePct(group.delivered_qty, group.planned_qty) - safePct(group.installed_qty, group.planned_qty)),
      items: [...group.items].sort((a, b) => b.planned_qty - a.planned_qty),
    }))
    .sort((a, b) => b.planned_qty - a.planned_qty);
}

function filterRows(rows, filters) {
  const q = clean(filters.search);
  return rows.filter((row) => {
    const classificationMatch = filters.classification === 'all' || row.classification_name === filters.classification;
    const itemMatch = filters.item === 'all' || row.key === filters.item;
    const searchMatch = !q || [row.item_code, row.item_name, row.classification_name, row.parent_classification_name, row.unit_of_measure]
      .join(' ')
      .toLowerCase()
      .includes(q);
    return classificationMatch && itemMatch && searchMatch;
  });
}

function buildWeeklyAnalytics(details, filteredRows, weeklyFilters) {
  const allowedKeys = new Set(filteredRows.map((row) => `${row.project_id}:${row.item_id}`));
  const totalBoq = filteredRows.reduce((sum, row) => sum + num(row.planned_qty), 0);

  const txDates = [
    ...(details.deliveries || []).filter((row) => allowedKeys.has(`${row.project_id}:${row.item_id}`)).map((row) => row.transaction_date),
    ...(details.installations || []).filter((row) => allowedKeys.has(`${row.project_id}:${row.item_id}`)).map((row) => row.transaction_date),
  ].filter(Boolean);

  if (!txDates.length || !totalBoq) {
    return { allWeeks: [], displayWeeks: [], kpis: null, trend: classifyTrend(0, 0) };
  }

  const minDate = txDates.reduce((min, d) => (new Date(d) < new Date(min) ? d : min), txDates[0]);
  const maxDate = txDates.reduce((max, d) => (new Date(d) > new Date(max) ? d : max), txDates[0]);
  const weeks = makeContinuousWeeks(minDate, maxDate);
  const weekMap = new Map(weeks.map((week) => [week.key, {
    ...week,
    delivered_qty: 0,
    installed_qty: 0,
    weekly_installed_pct: 0,
    weekly_delivery_pct: 0,
    weekly_growth_pct: 0,
    cumulative_delivered_qty: 0,
    cumulative_installed_qty: 0,
    actual_delivery_pct: 0,
    actual_installation_pct: 0,
    planned_progress_pct: 0,
    forecast_progress_pct: null,
    productivity_trend: 0,
  }]));

  const addTx = (row, qtyKey, targetKey) => {
    const rowKey = `${row.project_id}:${row.item_id}`;
    if (!allowedKeys.has(rowKey)) return;
    const start = startOfIsoWeek(row.transaction_date);
    if (!start) return;
    const wk = weekMap.get(dateKey(start));
    if (!wk) return;
    wk[targetKey] += num(row[qtyKey]);
  };

  (details.deliveries || []).forEach((row) => addTx(row, 'qty_delivered', 'delivered_qty'));
  (details.installations || []).forEach((row) => addTx(row, 'qty_installed', 'installed_qty'));

  let cumulativeDelivered = 0;
  let cumulativeInstalled = 0;
  let previousInstallPct = 0;
  const allWeeks = Array.from(weekMap.values()).map((week, index, arr) => {
    cumulativeDelivered += week.delivered_qty;
    cumulativeInstalled += week.installed_qty;
    const actualInstallPct = safePct(cumulativeInstalled, totalBoq);
    const actualDeliveryPct = safePct(cumulativeDelivered, totalBoq);
    const plannedProgress = arr.length > 1 ? ((index + 1) / arr.length) * 100 : 100;
    const growth = actualInstallPct - previousInstallPct;
    previousInstallPct = actualInstallPct;
    const trendWindow = arr.slice(Math.max(0, index - 3), index + 1);
    const movingAvg = trendWindow.reduce((sum, row) => sum + num(row.installed_qty), 0) / Math.max(1, trendWindow.length);

    return {
      ...week,
      delivered_qty: +week.delivered_qty.toFixed(3),
      installed_qty: +week.installed_qty.toFixed(3),
      weekly_installed_pct: safePct(week.installed_qty, totalBoq),
      weekly_delivery_pct: safePct(week.delivered_qty, totalBoq),
      weekly_growth_pct: growth,
      cumulative_delivered_qty: cumulativeDelivered,
      cumulative_installed_qty: cumulativeInstalled,
      actual_delivery_pct: actualDeliveryPct,
      actual_installation_pct: actualInstallPct,
      planned_progress_pct: plannedProgress,
      productivity_trend: movingAvg,
      status: growth > 1 ? 'spike' : growth < -0.5 ? 'drop' : 'stable',
    };
  });

  const positiveWeeks = allWeeks.filter((week) => week.installed_qty > 0);
  const best = positiveWeeks.reduce((bestRow, row) => (!bestRow || row.installed_qty > bestRow.installed_qty ? row : bestRow), null);
  const lowest = positiveWeeks.reduce((lowRow, row) => (!lowRow || row.installed_qty < lowRow.installed_qty ? row : lowRow), null);
  const avgInstalled = positiveWeeks.length
    ? positiveWeeks.reduce((sum, row) => sum + row.installed_qty, 0) / positiveWeeks.length
    : 0;
  const latest = allWeeks[allWeeks.length - 1];
  const recent = allWeeks.slice(Math.max(0, allWeeks.length - 4));
  const recentAvgGrowth = recent.length
    ? recent.reduce((sum, row) => sum + Math.max(0, row.weekly_growth_pct), 0) / recent.length
    : 0;
  const remainingPct = Math.max(0, 100 - num(latest?.actual_installation_pct));
  const weeksToComplete = recentAvgGrowth > 0 ? Math.ceil(remainingPct / recentAvgGrowth) : null;
  const forecastDate = weeksToComplete ? addDays(latest.end, weeksToComplete * 7) : null;
  const trend = classifyTrend(latest?.actual_installation_pct || 0, latest?.planned_progress_pct || 0);

  const forecastWeeks = allWeeks.map((week, index) => {
    if (index < allWeeks.length - 1) return { ...week, forecast_progress_pct: null };
    return { ...week, forecast_progress_pct: week.actual_installation_pct };
  });
  if (latest && recentAvgGrowth > 0) {
    for (let i = 1; i <= Math.min(16, weeksToComplete || 0); i += 1) {
      const start = addDays(latest.start, i * 7);
      const end = addDays(start, 6);
      const wk = weekNumber(start);
      const forecastPct = Math.min(100, latest.actual_installation_pct + recentAvgGrowth * i);
      forecastWeeks.push({
        key: `forecast-${dateKey(start)}`,
        weekNo: wk,
        year: start.getFullYear(),
        quarter: getQuarter(start),
        month: start.getMonth(),
        start,
        end,
        label: `W${wk} ${start.getFullYear()}`,
        range: `${formatDate(start)} - ${formatDate(end)}`,
        delivered_qty: null,
        installed_qty: null,
        weekly_installed_pct: null,
        weekly_delivery_pct: null,
        weekly_growth_pct: null,
        cumulative_delivered_qty: null,
        cumulative_installed_qty: null,
        actual_delivery_pct: null,
        actual_installation_pct: null,
        planned_progress_pct: null,
        forecast_progress_pct: forecastPct,
        productivity_trend: null,
        status: 'forecast',
      });
    }
  }

  const rangeStart = getRangeStartDate(weeklyFilters.range, allWeeks);
  const displayWeeks = forecastWeeks.filter((week) => {
    if (rangeStart && new Date(week.end) < rangeStart) return false;
    if (weeklyFilters.year !== 'all' && String(week.year) !== String(weeklyFilters.year)) return false;
    if (weeklyFilters.quarter !== 'all' && week.quarter !== weeklyFilters.quarter) return false;
    if (weeklyFilters.month !== 'all' && String(week.month) !== String(weeklyFilters.month)) return false;
    return true;
  });

  return {
    allWeeks: forecastWeeks,
    displayWeeks,
    kpis: {
      totalBoq,
      best,
      lowest,
      avgInstalled,
      latest,
      trend,
      weeksToComplete,
      forecastDate,
      recentAvgGrowth,
      positiveWeeks: positiveWeeks.length,
    },
    trend,
  };
}

function AnimatedNumber({ value, formatter = fmt, duration = 650 }) {
  const [display, setDisplay] = useState(num(value));
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = display;
    const to = num(value);
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return <>{formatter(display)}</>;
}

function Icon({ type }) {
  const paths = {
    boq: 'M4 7l8-4 8 4-8 4-8-4zm0 4l8 4 8-4M4 15l8 4 8-4',
    truck: 'M3 7h10v8H3V7zm10 3h4l3 3v2h-7v-5zM6 18a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z',
    install: 'M14 4l6 6-3 3-2-2-6 6-3-3 6-6-2-2 4-2zM4 20l5-5',
    trend: 'M4 16l5-5 4 4 7-8M15 7h5v5',
    calendar: 'M7 3v4M17 3v4M4 8h16M5 5h14v16H5z',
    risk: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    refresh: 'M20 6v6h-6M4 18v-6h6M18 9a7 7 0 00-12-3M6 15a7 7 0 0012 3',
  };
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[type] || paths.boq} />
    </svg>
  );
}

function KpiCard({ title, value, subtitle, color = BLUE, icon = 'boq', formatter = fmt, badge }) {
  return (
    <div className="dash-kpi-card" style={{ '--kpi-color': color }}>
      <div className="dash-kpi-icon"><Icon type={icon} /></div>
      <div className="dash-kpi-content">
        <span>{title}</span>
        <strong><AnimatedNumber value={value} formatter={formatter} /></strong>
        {subtitle && <small>{subtitle}</small>}
      </div>
      {badge && <em className="dash-kpi-badge">{badge}</em>}
    </div>
  );
}

function MiniProgress({ value, color = GREEN }) {
  return (
    <div className="dash-mini-progress">
      <div style={{ width: `${Math.max(0, Math.min(100, num(value)))}%`, background: color }} />
    </div>
  );
}

function SolidBar3D({ value, label, color = GREEN, track = false, tooltip }) {
  const bounded = Math.max(0, Math.min(100, num(value)));
  const baseY = 154;
  const maxH = 110;
  const h = Math.max(bounded > 0 ? 6 : 3, (bounded / 100) * maxH);
  const y = baseY - h;
  const x = 56;
  const w = 34;
  const dx = 12;
  const dy = -8;
  const topY = y + dy;
  const trackTop = baseY - maxH;
  const valueText = pct(bounded, bounded < 10 && bounded > 0 ? 1 : 0);
  const id = `${String(label || 'bar').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}${Math.round(bounded * 10)}${String(color).replace('#', '')}`;

  return (
    <div className="solid-bar3d" title={tooltip || `${label}: ${valueText}`}>
      <div className="solid-bar3d-value" style={{ color, borderColor: color }}>{valueText}</div>
      <svg viewBox="0 0 146 184" className="solid-bar3d-svg" aria-label={`${label}: ${valueText}`}>
        <defs>
          <linearGradient id={`${id}front`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.70" />
            <stop offset="55%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
          <linearGradient id={`${id}side`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={`${id}top`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
            <stop offset="100%" stopColor={color} stopOpacity="0.75" />
          </linearGradient>
          <filter id={`${id}shadow`} x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor={color} floodOpacity="0.16" />
          </filter>
        </defs>

        {[0, 20, 40, 60, 80, 100].map((tick) => {
          const yy = baseY - (tick / 100) * maxH;
          return <line key={tick} x1="24" x2="124" y1={yy} y2={yy} stroke="#e2eaf4" strokeWidth="1" strokeDasharray="3 3" />;
        })}

        {track && (
          <g className="bar-track-cube">
            <rect x={x} y={trackTop} width={w} height={maxH} rx="8" fill="#e8eef6" />
            <polygon points={`${x + w},${trackTop} ${x + w + dx},${trackTop + dy} ${x + w + dx},${baseY + dy} ${x + w},${baseY}`} fill="#d8e1ec" />
            <polygon points={`${x},${trackTop} ${x + w},${trackTop} ${x + w + dx},${trackTop + dy} ${x + dx},${trackTop + dy}`} fill="#f2f6fb" />
            <polygon points={`${x - 4},${baseY + 9} ${x + w + 26},${baseY + 9} ${x + w + 44},${baseY} ${x + 14},${baseY}`} fill="#eef3f8" />
          </g>
        )}

        <g filter={`url(#${id}shadow)`}>
          <rect x={x} y={y} width={w} height={h} rx="7" fill={`url(#${id}front)`} />
          <polygon points={`${x + w},${y} ${x + w + dx},${topY} ${x + w + dx},${baseY + dy} ${x + w},${baseY}`} fill={`url(#${id}side)`} />
          <polygon points={`${x},${y} ${x + w},${y} ${x + w + dx},${topY} ${x + dx},${topY}`} fill={`url(#${id}top)`} />
        </g>
      </svg>
      <div className="solid-bar3d-label">{label}</div>
    </div>
  );
}

function Chart3D({ title, subtitle, data, valueKey, color = GREEN, track = false, maxItems = 12 }) {
  return (
    <div className="dash-card chart-card">
      <CardHeader title={title} subtitle={subtitle} />
      <div className="solid-bars-grid">
        {data.length ? data.slice(0, maxItems).map((row) => (
          <SolidBar3D
            key={row.key || row.item_code || row.name || row.item_name}
            value={row[valueKey]}
            label={row.item_name || row.name || 'Item'}
            color={color}
            track={track}
            tooltip={`BOQ: ${fmt(row.planned_qty)} | Delivered: ${fmt(row.delivered_qty)} | Installed: ${fmt(row.installed_qty)} | Delivery: ${pct(row.delivery_pct)} | Installation: ${pct(row.installation_pct)}`}
          />
        )) : <EmptyState message="No chart data available for selected filters." />}
      </div>
    </div>
  );
}

function ComparisonCards({ data }) {
  return (
    <div className="comparison-grid">
      {data.length ? data.map((row) => {
        const gap = Math.max(0, num(row.delivery_pct) - num(row.installation_pct));
        const highGap = gap >= 25;
        return (
          <article key={row.key || row.name || row.item_name} className="comparison-card" title={`Delivery: ${pct(row.delivery_pct)} | Installation: ${pct(row.installation_pct)} | GAP: ${pct(gap)}`}>
            <div className="comparison-card-head">
              <div>
                <h3>{row.name || row.item_name}</h3>
                <p>{row.parent || row.classification_name || row.parent_classification_name || 'General'}</p>
              </div>
              <span className={`gap-badge ${highGap ? 'high' : ''}`}>⚠ GAP {pct(gap, gap < 10 && gap > 0 ? 1 : 0)}</span>
            </div>
            <div className="comparison-bars">
              <div className="comparison-y-axis">{[100, 80, 60, 40, 20, 0].map((v) => <span key={v}>{v}%</span>)}</div>
              <div className="comparison-plot">
                {[20, 40, 60, 80, 100].map((tick) => <i key={tick} style={{ bottom: `${tick}%` }} />)}
                <SolidBar3D value={row.delivery_pct} label="Delivery %" color={BLUE} />
                <SolidBar3D value={row.installation_pct} label="Installation %" color={GREEN} />
              </div>
            </div>
          </article>
        );
      }) : <EmptyState message="No comparison data available." />}
    </div>
  );
}

function ProgressClassificationCards({ groups }) {
  return (
    <div className="progress-classification-grid">
      {groups.length ? groups.map((group) => (
        <article key={group.key || group.name} className="progress-class-card">
          <div className="progress-class-head">
            <div>
              <h3>{group.name}</h3>
              <p>{group.parent || 'General'} · BOQ {fmt(group.planned_qty)}</p>
            </div>
            <span>{pct(group.installation_pct)}</span>
          </div>
          <div className="progress-class-bars">
            <div className="progress-y-axis">{[100, 80, 60, 40, 20, 0].map((v) => <span key={v}>{v}%</span>)}</div>
            <div className="progress-bar-area">
              {(group.items || []).slice(0, 5).map((item) => (
                <SolidBar3D key={item.key} value={item.installation_pct} label={item.item_name} color={GREEN} track />
              ))}
            </div>
          </div>
        </article>
      )) : <EmptyState message="No classification progress available." />}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="dash-card-header">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function DataTable({ columns, rows, highlightRisk = false }) {
  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead><tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.key || index} className={highlightRisk && row.risk_level ? `risk-${row.risk_level}` : ''}>
              {columns.map((col) => <td key={col.key}>{col.render ? col.render(row, index) : row[col.key]}</td>)}
            </tr>
          )) : <tr><td colSpan={columns.length}><EmptyState compact message="No rows match the selected filters." /></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message, compact = false }) {
  return <div className={compact ? 'dash-empty compact' : 'dash-empty'}>{message}</div>;
}

function WeeklyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="weekly-tooltip">
      <strong>{label}</strong>
      <span>{row.range}</span>
      <div>Installed Qty: <b>{fmt(row.installed_qty)}</b></div>
      <div>Installation %: <b>{pct(row.actual_installation_pct)}</b></div>
      <div>Weekly Growth %: <b>{pct(row.weekly_growth_pct)}</b></div>
      <div>Cumulative Progress %: <b>{pct(row.actual_installation_pct)}</b></div>
      <div>Delivery %: <b>{pct(row.actual_delivery_pct)}</b></div>
    </div>
  );
}

function WeeklyAnalysis({ data, weeklyFilters, setWeeklyFilters }) {
  const years = useMemo(() => {
    const set = new Set(data.allWeeks.map((week) => week.year).filter(Boolean));
    return Array.from(set).sort((a, b) => a - b);
  }, [data.allWeeks]);

  const k = data.kpis;
  const latest = k?.latest;
  const trend = k?.trend || { label: 'No Data', color: SLATE, note: 'No weekly records' };

  return (
    <section className="weekly-module">
      <div className="weekly-hero">
        <div>
          <span className="module-eyebrow">Weekly Analysis</span>
          <h2>Project Performance Analytics</h2>
          <p>Weekly progress evolution, productivity behavior, growth movement, and construction S-curve tracking.</p>
        </div>
        <div className="weekly-range-buttons">
          {[
            ['4w', 'Last 4 Weeks'],
            ['3m', 'Last 3 Months'],
            ['6m', 'Last 6 Months'],
            ['12m', 'Last 12 Months'],
            ['full', 'Full Timeline'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={weeklyFilters.range === value ? 'active' : ''} onClick={() => setWeeklyFilters((prev) => ({ ...prev, range: value }))}>{label}</button>
          ))}
        </div>
      </div>

      <div className="weekly-filter-row">
        <div className="filter-field"><label>Year</label><select value={weeklyFilters.year} onChange={(e) => setWeeklyFilters((p) => ({ ...p, year: e.target.value }))}><option value="all">All Years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
        <div className="filter-field"><label>Quarter</label><select value={weeklyFilters.quarter} onChange={(e) => setWeeklyFilters((p) => ({ ...p, quarter: e.target.value }))}>{QUARTERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}</select></div>
        <div className="filter-field"><label>Month</label><select value={weeklyFilters.month} onChange={(e) => setWeeklyFilters((p) => ({ ...p, month: e.target.value }))}>{MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
      </div>

      <div className="kpi-grid weekly-kpis">
        <KpiCard title="Best Productivity Week" value={k?.best?.installed_qty || 0} subtitle={k?.best ? `${k.best.label} · ${k.best.range}` : 'No installed quantity'} color={GREEN} icon="trend" />
        <KpiCard title="Lowest Productivity Week" value={k?.lowest?.installed_qty || 0} subtitle={k?.lowest ? `${k.lowest.label} · ${k.lowest.range}` : 'No installed quantity'} color={RED} icon="risk" />
        <KpiCard title="Average Weekly Installation" value={k?.avgInstalled || 0} subtitle="Installed Qty / productive weeks" color={BLUE} icon="install" />
        <KpiCard title="Current Project Trend" value={latest?.actual_installation_pct || 0} formatter={(v) => pct(v)} subtitle={trend.note} color={trend.color} icon="trend" badge={trend.label} />
        <KpiCard title="Forecast Completion" value={k?.weeksToComplete || 0} formatter={(v) => k?.forecastDate ? `${Math.round(v)} wks` : 'N/A'} subtitle={k?.forecastDate ? `Around ${formatDate(k.forecastDate)}` : 'Insufficient weekly trend'} color={PURPLE} icon="calendar" />
      </div>

      <div className="weekly-grid">
        <div className="dash-card weekly-main-chart">
          <CardHeader title="Weekly Progress Evolution" subtitle="Installed quantity, cumulative installation %, weekly growth %, and productivity trend." />
          <div className="chart-box large">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.displayWeeks} margin={{ top: 10, right: 18, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e5edf6" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" minTickGap={26} />
                <YAxis yAxisId="qty" tick={{ fontSize: 10, fill: '#64748b' }} width={56} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} width={46} domain={[-20, 100]} />
                <Tooltip content={<WeeklyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="qty" dataKey="installed_qty" name="Weekly Installed Quantity" fill={GREEN} radius={[7, 7, 0, 0]} maxBarSize={28} />
                <Line yAxisId="pct" type="monotone" dataKey="actual_installation_pct" name="Cumulative Installation %" stroke={GREEN} strokeWidth={3} dot={false} />
                <Line yAxisId="pct" type="monotone" dataKey="weekly_growth_pct" name="Weekly Growth %" stroke={ORANGE} strokeWidth={2.6} dot={{ r: 2 }} />
                <Line yAxisId="qty" type="monotone" dataKey="productivity_trend" name="Productivity Trend" stroke={BLUE} strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card weekly-side-card">
          <CardHeader title="Weekly Growth Analysis" subtitle="Current week installation % minus previous week installation %." />
          <div className="growth-list">
            {data.displayWeeks.filter((week) => week.weekly_growth_pct !== null).slice(-8).reverse().map((week) => (
              <div key={week.key} className={`growth-item ${week.weekly_growth_pct > 0 ? 'positive' : week.weekly_growth_pct < 0 ? 'negative' : 'neutral'}`}>
                <div><strong>{week.label}</strong><span>{week.range}</span></div>
                <b>{pct(week.weekly_growth_pct)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-card weekly-scurve-card">
        <CardHeader title="Construction S-Curve Analysis" subtitle="Planned cumulative curve vs actual delivery curve vs actual installation curve with forecast trend." />
        <div className="chart-box scurve">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.displayWeeks} margin={{ top: 10, right: 22, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e5edf6" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" minTickGap={26} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip content={<WeeklyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="planned_progress_pct" name="Planned Progress %" stroke={BLUE} strokeWidth={3} dot={false} connectNulls />
              <Line type="monotone" dataKey="actual_delivery_pct" name="Actual Delivery %" stroke={ORANGE} strokeWidth={3} dot={false} connectNulls />
              <Line type="monotone" dataKey="actual_installation_pct" name="Actual Installation %" stroke={GREEN} strokeWidth={3.4} dot={false} connectNulls />
              <Line type="monotone" dataKey="forecast_progress_pct" name="Forecast Progress %" stroke={PURPLE} strokeWidth={3} strokeDasharray="6 5" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');
  const [activeTab, setActiveTab] = useState('boq');
  const [details, setDetails] = useState({ boq: [], deliveries: [], installations: [] });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ classification: 'all', item: 'all', search: '' });
  const [weeklyFilters, setWeeklyFilters] = useState({ range: '6m', year: 'all', quarter: 'all', month: 'all' });

  useEffect(() => {
    api.getProjects().then((rows) => setProjects(rows || [])).catch(() => setProjects([]));
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getOverviewDetails(selectedProject);
      setDetails({
        boq: Array.isArray(data?.boq) ? data.boq : [],
        deliveries: Array.isArray(data?.deliveries) ? data.deliveries : [],
        installations: Array.isArray(data?.installations) ? data.installations : [],
      });
    } catch (err) {
      console.error('Dashboard load failed:', err);
      setDetails({ boq: [], deliveries: [], installations: [] });
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const mergedRows = useMemo(() => buildMergedRows(details), [details]);
  const classifications = useMemo(() => groupByClassification(mergedRows), [mergedRows]);
  const filteredRows = useMemo(() => filterRows(mergedRows, filters), [mergedRows, filters]);
  const filteredClassifications = useMemo(() => groupByClassification(filteredRows), [filteredRows]);

  const itemOptions = useMemo(() => filteredRows.map((row) => ({ value: row.key, label: row.item_name })), [filteredRows]);
  const weeklyAnalytics = useMemo(() => buildWeeklyAnalytics(details, filteredRows, weeklyFilters), [details, filteredRows, weeklyFilters]);

  const totals = useMemo(() => {
    const planned = filteredRows.reduce((sum, row) => sum + num(row.planned_qty), 0);
    const delivered = filteredRows.reduce((sum, row) => sum + num(row.delivered_qty), 0);
    const installed = filteredRows.reduce((sum, row) => sum + num(row.installed_qty), 0);
    const deliveredNotInstalled = Math.max(0, delivered - installed);
    const remainingInstallation = Math.max(0, planned - installed);
    return {
      planned,
      delivered,
      installed,
      deliveredNotInstalled,
      remainingInstallation,
      deliveryPct: safePct(delivered, planned),
      installationPct: safePct(installed, planned),
      efficiencyPct: safePct(installed, delivered),
      gapPct: Math.max(0, safePct(delivered, planned) - safePct(installed, planned)),
    };
  }, [filteredRows]);

  const topInstalled = useMemo(() => [...filteredRows].sort((a, b) => num(b.installation_pct) - num(a.installation_pct)), [filteredRows]);
  const topDelivery = useMemo(() => [...filteredRows].sort((a, b) => num(b.delivery_pct) - num(a.delivery_pct)), [filteredRows]);
  const comparisonRows = useMemo(() => activeTab === 'compare' ? filteredClassifications : filteredClassifications, [activeTab, filteredClassifications]);

  const riskRows = useMemo(() => filteredRows
    .map((row) => {
      const gapQty = Math.max(0, row.delivered_qty - row.installed_qty);
      const riskLevel = gapQty > 0 && row.installation_pct < 35 ? 'high' : gapQty > 0 ? 'medium' : row.installation_pct < 35 && row.planned_qty > 0 ? 'low' : '';
      return { ...row, gap_qty: gapQty, risk_level: riskLevel };
    })
    .filter((row) => row.risk_level)
    .sort((a, b) => b.gap_qty - a.gap_qty), [filteredRows]);

  const selectedProjectName = selectedProject === 'all'
    ? 'All Projects'
    : projectLabel(projects.find((p) => String(p.id) === String(selectedProject)) || {});

  const clearFilters = () => setFilters({ classification: 'all', item: 'all', search: '' });

  const itemColumns = [
    { key: 'item_code', label: 'Item Code' },
    { key: 'item_name', label: 'Item Name' },
    { key: 'classification_name', label: 'Classification' },
    { key: 'unit_of_measure', label: 'Unit' },
    { key: 'planned_qty', label: 'BOQ Qty', render: (r) => <strong>{fmt(r.planned_qty)}</strong> },
    { key: 'delivered_qty', label: 'Delivered', render: (r) => fmt(r.delivered_qty) },
    { key: 'installed_qty', label: 'Installed', render: (r) => fmt(r.installed_qty) },
    { key: 'remaining_installation_qty', label: 'Remaining', render: (r) => fmt(r.remaining_installation_qty) },
    { key: 'delivery_pct', label: 'Delivery %', render: (r) => <><strong>{pct(r.delivery_pct)}</strong><MiniProgress value={r.delivery_pct} color={BLUE} /></> },
    { key: 'installation_pct', label: 'Installation %', render: (r) => <><strong>{pct(r.installation_pct)}</strong><MiniProgress value={r.installation_pct} color={GREEN} /></> },
  ];

  const classificationColumns = [
    { key: 'name', label: 'Classification' },
    { key: 'parent', label: 'Material Category' },
    { key: 'planned_qty', label: 'BOQ Qty', render: (r) => <strong>{fmt(r.planned_qty)}</strong> },
    { key: 'delivered_qty', label: 'Delivered', render: (r) => fmt(r.delivered_qty) },
    { key: 'installed_qty', label: 'Installed', render: (r) => fmt(r.installed_qty) },
    { key: 'remaining_qty', label: 'Remaining', render: (r) => fmt(r.remaining_qty) },
    { key: 'delivery_pct', label: 'Delivery %', render: (r) => <><strong>{pct(r.delivery_pct)}</strong><MiniProgress value={r.delivery_pct} color={BLUE} /></> },
    { key: 'installation_pct', label: 'Installation %', render: (r) => <><strong>{pct(r.installation_pct)}</strong><MiniProgress value={r.installation_pct} color={GREEN} /></> },
    { key: 'gap_pct', label: 'Gap %', render: (r) => <span className="gap-cell">GAP {pct(r.gap_pct)}</span> },
  ];

  return (
    <div className="enterprise-dashboard">
      <style>{dashboardStyles}</style>

      <div className="dashboard-header-row">
        <div>
          <span className="module-eyebrow">Dashboard</span>
          <h1>Project Analytics Dashboard</h1>
          <p>BOQ baseline, delivery, installation, weekly trends, and risk indicators.</p>
        </div>
        <div className="dashboard-top-controls">
          <div className="top-project-filter">
            <label>Project</label>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              <option value="all">All Projects</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
            </select>
          </div>
          <button type="button" className="refresh-btn" onClick={loadDashboard} disabled={loading}>
            <Icon type="refresh" /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="dashboard-tabs">
        {TABS.map((tab) => <button key={tab.key} type="button" className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
      </div>

      <div className="dashboard-filter-card">
        <div className="filter-field project-summary"><label>Selected Project</label><strong>{selectedProjectName}</strong></div>
        <div className="filter-field"><label>Classification</label><select value={filters.classification} onChange={(e) => setFilters((prev) => ({ ...prev, classification: e.target.value, item: 'all' }))}><option value="all">All Classifications</option>{classifications.map((c) => <option key={c.key} value={c.name}>{c.name}</option>)}</select></div>
        <div className="filter-field"><label>Item</label><select value={filters.item} onChange={(e) => setFilters((prev) => ({ ...prev, item: e.target.value }))}><option value="all">All Items</option>{itemOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div className="filter-field search-field"><label>Smart Search</label><input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Search item, code, classification..." /></div>
        <button className="ghost-btn" type="button" onClick={clearFilters}>Clear</button>
      </div>

      <div className="kpi-grid main-kpis">
        <KpiCard title="Total BOQ" value={totals.planned} subtitle="BOQ is the master baseline" color={BLUE} icon="boq" />
        <KpiCard title="Total Delivered" value={totals.delivered} subtitle={`${pct(totals.deliveryPct)} of BOQ`} color={BLUE} icon="truck" />
        <KpiCard title="Total Installed" value={totals.installed} subtitle={`${pct(totals.installationPct)} of BOQ`} color={GREEN} icon="install" />
        <KpiCard title="Remaining Installation" value={totals.remainingInstallation} subtitle={`${pct(safePct(totals.remainingInstallation, totals.planned))} of BOQ`} color={ORANGE} icon="calendar" />
        <KpiCard title="Delivered Not Installed" value={totals.deliveredNotInstalled} subtitle={`GAP ${pct(totals.gapPct)}`} color={RED} icon="risk" />
      </div>

      {activeTab === 'boq' && (
        <section className="tab-panel vertical-panel">
          <Chart3D title="BOQ Item Installation %" subtitle="Installation percentage by BOQ item based on BOQ quantity baseline." data={topInstalled} valueKey="installation_pct" color={GREEN} track />
          <div className="dash-card"><CardHeader title="BOQ Quantity Analysis" subtitle="Reads directly from BOQ / planning quantities with current filters applied." /><DataTable columns={itemColumns} rows={filteredRows} /></div>
        </section>
      )}

      {activeTab === 'delivery' && (
        <section className="tab-panel vertical-panel">
          <div className="kpi-grid compact-kpis">
            <KpiCard title="Delivery %" value={totals.deliveryPct} formatter={(v) => pct(v)} subtitle="Delivered Qty / BOQ Qty" color={BLUE} icon="truck" />
            <KpiCard title="Delivered Qty" value={totals.delivered} subtitle="Total delivered quantity" color={BLUE} icon="truck" />
            <KpiCard title="Open Delivery Qty" value={Math.max(0, totals.planned - totals.delivered)} subtitle="BOQ - Delivered" color={ORANGE} icon="calendar" />
          </div>
          <Chart3D title="Delivery % by Item" subtitle="Every delivery percentage is calculated against BOQ quantity." data={topDelivery} valueKey="delivery_pct" color={BLUE} track />
          <div className="dash-card"><CardHeader title="Delivery Progress Table" subtitle="Delivered quantity, BOQ quantity, and delivery percentage by item." /><DataTable columns={itemColumns} rows={filteredRows} /></div>
        </section>
      )}

      {activeTab === 'installation' && (
        <section className="tab-panel vertical-panel">
          <div className="kpi-grid compact-kpis">
            <KpiCard title="Installation %" value={totals.installationPct} formatter={(v) => pct(v)} subtitle="Installed Qty / BOQ Qty" color={GREEN} icon="install" />
            <KpiCard title="Installed Qty" value={totals.installed} subtitle="Total installed quantity" color={GREEN} icon="install" />
            <KpiCard title="Remaining Installation" value={totals.remainingInstallation} subtitle="BOQ - Installed" color={ORANGE} icon="calendar" />
          </div>
          <Chart3D title="Installation % by Item" subtitle="Item-level installed percentage based on BOQ quantity." data={topInstalled} valueKey="installation_pct" color={GREEN} track />
          <div className="dash-card"><CardHeader title="Installation Progress Table" subtitle="The table is shown directly under By Items without drill-down." /><DataTable columns={itemColumns} rows={filteredRows} /></div>
        </section>
      )}

      {activeTab === 'compare' && (
        <section className="tab-panel vertical-panel">
          <div className="kpi-grid compact-kpis">
            <KpiCard title="Delivered Not Installed" value={totals.deliveredNotInstalled} subtitle="Quantity backlog" color={RED} icon="risk" />
            <KpiCard title="Gap %" value={totals.gapPct} formatter={(v) => pct(v)} subtitle="Delivery % - Installation %" color={RED} icon="risk" />
            <KpiCard title="Delivery %" value={totals.deliveryPct} formatter={(v) => pct(v)} subtitle="Delivered / BOQ" color={BLUE} icon="truck" />
            <KpiCard title="Installation %" value={totals.installationPct} formatter={(v) => pct(v)} subtitle="Installed / BOQ" color={GREEN} icon="install" />
          </div>
          <ComparisonCards data={comparisonRows} />
        </section>
      )}

      {activeTab === 'weekly' && (
        <WeeklyAnalysis data={weeklyAnalytics} weeklyFilters={weeklyFilters} setWeeklyFilters={setWeeklyFilters} />
      )}

      {activeTab === 'classification' && (
        <section className="tab-panel vertical-panel">
          <ProgressClassificationCards groups={filteredClassifications} />
          <div className="dash-card"><CardHeader title="Classification Quantity Analysis" subtitle="BOQ, delivery, installation, remaining quantities, and GAP by classification." /><DataTable columns={classificationColumns} rows={filteredClassifications} /></div>
        </section>
      )}

      {activeTab === 'risks' && (
        <section className="tab-panel vertical-panel">
          <div className="kpi-grid compact-kpis">
            <KpiCard title="Risk Items" value={riskRows.length} subtitle="Delayed or low-progress items" color={RED} icon="risk" />
            <KpiCard title="Delivered Not Installed" value={totals.deliveredNotInstalled} subtitle="Critical backlog quantity" color={RED} icon="risk" />
            <KpiCard title="Remaining Critical Qty" value={riskRows.reduce((sum, row) => sum + row.remaining_installation_qty, 0)} subtitle="Open qty in risk rows" color={ORANGE} icon="calendar" />
          </div>
          <div className="dash-card">
            <CardHeader title="Risk & Delay Indicators" subtitle="Items delivered but not installed, low progress items, and critical remaining quantities." />
            <DataTable highlightRisk columns={[
              { key: 'item_code', label: 'Item Code' },
              { key: 'item_name', label: 'Item Name' },
              { key: 'classification_name', label: 'Classification' },
              { key: 'gap_qty', label: 'Delivered Not Installed', render: (r) => <strong>{fmt(r.gap_qty)}</strong> },
              { key: 'installation_pct', label: 'Installation %', render: (r) => <><strong>{pct(r.installation_pct)}</strong><MiniProgress value={r.installation_pct} color={r.installation_pct < 35 ? RED : ORANGE} /></> },
              { key: 'remaining_installation_qty', label: 'Remaining Qty', render: (r) => fmt(r.remaining_installation_qty) },
              { key: 'risk_level', label: 'Risk', render: (r) => <span className={`risk-pill ${r.risk_level}`}>{r.risk_level || 'normal'}</span> },
            ]} rows={riskRows} />
          </div>
        </section>
      )}
    </div>
  );
}

const dashboardStyles = `
.enterprise-dashboard,
.enterprise-dashboard * { box-sizing: border-box; }
.enterprise-dashboard {
  --dash-border:#dbe7f5;
  --dash-soft:#f8fbff;
  --dash-text:#0f172a;
  --dash-muted:#64748b;
  width:100%;
  max-width:100%;
  min-height:100%;
  overflow-x:hidden;
  padding: 8px 14px 24px;
  background: linear-gradient(180deg, #f8fbff 0%, #f4f8fd 100%);
  color: var(--dash-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.dashboard-header-row {
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:16px;
  margin-bottom:10px;
}
.module-eyebrow {
  display:inline-flex;
  color:${BLUE};
  font-size:11px;
  font-weight:950;
  letter-spacing:.10em;
  text-transform:uppercase;
}
.dashboard-header-row h1,
.weekly-hero h2 { margin:4px 0 2px; font-size:24px; font-weight:950; letter-spacing:-.03em; color:#0f172a; }
.dashboard-header-row p,
.weekly-hero p { margin:0; font-size:12px; font-weight:650; color:#64748b; }
.dashboard-top-controls { display:flex; align-items:center; gap:10px; min-width:0; }
.top-project-filter {
  min-width:270px;
  height:54px;
  border:1px solid var(--dash-border);
  border-radius:16px;
  background:#fff;
  padding:7px 12px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  box-shadow:0 10px 26px rgba(15,23,42,.05);
}
.top-project-filter label,
.filter-field label { font-size:10px; font-weight:900; color:#52647a; letter-spacing:.06em; text-transform:uppercase; }
.top-project-filter select,
.filter-field select,
.filter-field input {
  width:100%;
  min-width:0;
  height:34px;
  border:1px solid #cbdcf0;
  border-radius:11px;
  background:#fff;
  color:#0f172a;
  padding:0 10px;
  font-size:12px;
  font-weight:800;
  outline:0;
}
.top-project-filter select { border:0; padding:0; height:26px; }
.refresh-btn,
.ghost-btn {
  height:54px;
  border:1px solid #cbdcf0;
  border-radius:16px;
  background:#fff;
  color:#0f274b;
  padding:0 16px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  font-size:13px;
  font-weight:900;
  cursor:pointer;
  box-shadow:0 10px 26px rgba(15,23,42,.05);
  transition:.18s ease;
}
.refresh-btn:hover,
.ghost-btn:hover { transform:translateY(-1px); border-color:#93c5fd; color:${BLUE}; background:#eff6ff; }
.refresh-btn:disabled { opacity:.65; cursor:wait; transform:none; }
.dashboard-tabs {
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin:6px 0 10px;
}
.dashboard-tabs button {
  height:38px;
  border:1px solid #dbe7f5;
  border-radius:13px;
  background:#fff;
  color:#334155;
  padding:0 14px;
  font-size:12px;
  font-weight:900;
  cursor:pointer;
  box-shadow:0 8px 20px rgba(15,23,42,.04);
}
.dashboard-tabs button.active { background:linear-gradient(135deg,${BLUE},#1d4ed8); border-color:#1d4ed8; color:#fff; box-shadow:0 12px 24px rgba(37,99,235,.22); }
.dashboard-filter-card {
  display:grid;
  grid-template-columns:minmax(190px,.9fr) minmax(180px,1fr) minmax(180px,1fr) minmax(240px,1.4fr) auto;
  gap:10px;
  align-items:end;
  border:1px solid var(--dash-border);
  border-radius:18px;
  background:rgba(255,255,255,.96);
  box-shadow:0 12px 30px rgba(15,23,42,.055);
  padding:12px;
  margin-bottom:12px;
}
.filter-field { min-width:0; display:grid; gap:5px; }
.filter-field.project-summary strong { min-height:34px; display:flex; align-items:center; font-size:12px; color:#0f172a; }
.ghost-btn { height:36px; border-radius:12px; color:${BLUE}; }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; width:100%; min-width:0; }
.main-kpis { margin-bottom:14px; }
.compact-kpis { grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); }
.dash-kpi-card {
  min-width:0;
  min-height:118px;
  border:1px solid #dbe7f5;
  border-radius:18px;
  background:linear-gradient(180deg,#fff,#fbfdff);
  box-shadow:0 14px 34px rgba(15,23,42,.065);
  padding:14px;
  display:grid;
  grid-template-columns:44px minmax(0,1fr) auto;
  gap:12px;
  align-items:start;
  position:relative;
  overflow:hidden;
}
.dash-kpi-card::after { content:''; position:absolute; right:-36px; top:-38px; width:112px; height:112px; border-radius:999px; background:color-mix(in srgb,var(--kpi-color) 12%,transparent); }
.dash-kpi-icon { width:42px; height:42px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb,var(--kpi-color) 12%,#fff); color:var(--kpi-color); z-index:1; }
.dash-kpi-content { min-width:0; z-index:1; display:grid; gap:5px; }
.dash-kpi-content span { color:#334155; font-size:12px; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dash-kpi-content strong { color:#0f172a; font-size:25px; line-height:1; font-weight:950; letter-spacing:-.03em; font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dash-kpi-content small { color:#64748b; font-size:11px; font-weight:750; line-height:1.35; }
.dash-kpi-badge { z-index:1; font-style:normal; align-self:start; border-radius:999px; background:color-mix(in srgb,var(--kpi-color) 12%,#fff); color:var(--kpi-color); border:1px solid color-mix(in srgb,var(--kpi-color) 30%,#dbe7f5); padding:5px 8px; font-size:11px; font-weight:950; white-space:nowrap; }
.tab-panel,
.vertical-panel { display:grid; gap:14px; min-width:0; }
.dash-card {
  min-width:0;
  width:100%;
  border:1px solid #dbe7f5;
  border-radius:20px;
  background:#fff;
  box-shadow:0 16px 34px rgba(15,23,42,.06);
  overflow:hidden;
}
.dash-card-header {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding:14px 16px;
  border-bottom:1px solid #e5eef8;
  background:linear-gradient(180deg,#fff,#f8fbff);
}
.dash-card-header h3 { margin:0; color:#0f172a; font-size:17px; font-weight:950; }
.dash-card-header p { margin:4px 0 0; color:#64748b; font-size:12px; font-weight:650; }
.solid-bars-grid {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(132px,1fr));
  gap:12px;
  align-items:end;
  padding:16px;
  min-width:0;
  overflow:hidden;
}
.solid-bar3d {
  min-width:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:flex-end;
  border:1px solid #edf3fb;
  border-radius:16px;
  background:#fff;
  padding:10px 8px 12px;
  overflow:hidden;
}
.solid-bar3d-value {
  min-width:52px;
  height:24px;
  padding:0 8px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:1.4px solid currentColor;
  border-radius:8px;
  background:#fff;
  font-size:11px;
  font-weight:950;
  margin-bottom:4px;
}
.solid-bar3d-svg { width:min(120px,100%); height:154px; display:block; overflow:hidden; }
.solid-bar3d-label { color:#334155; font-size:11px; line-height:1.3; font-weight:900; text-align:center; min-height:30px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.comparison-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(310px,1fr)); gap:12px; min-width:0; }
.comparison-card {
  min-width:0;
  border:1px solid #dbe7f5;
  border-radius:20px;
  background:linear-gradient(180deg,#fff,#fbfdff);
  box-shadow:0 14px 30px rgba(15,23,42,.055);
  padding:14px;
  overflow:hidden;
}
.comparison-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:8px; }
.comparison-card-head h3 { margin:0; color:#1d4ed8; font-size:14px; font-weight:950; }
.comparison-card-head p { margin:4px 0 0; color:#64748b; font-size:11px; font-weight:750; }
.gap-badge { flex:0 0 auto; border:1.5px solid #ef4444; background:#fef2f2; color:#dc2626; border-radius:999px; padding:6px 9px; font-size:11px; font-weight:950; white-space:nowrap; box-shadow:0 8px 18px rgba(239,68,68,.10); }
.gap-badge.high { background:#fee2e2; }
.comparison-bars { display:grid; grid-template-columns:34px minmax(0,1fr); gap:8px; }
.comparison-y-axis,
.progress-y-axis { display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end; color:#8ea0b7; font-size:10px; font-weight:900; padding:28px 0 48px; }
.comparison-plot { position:relative; min-height:235px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; align-items:end; overflow:hidden; }
.comparison-plot > i { position:absolute; left:0; right:0; border-top:1px dashed #e2ebf7; }
.comparison-plot .solid-bar3d { border:0; background:transparent; padding:0; }
.progress-classification-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:12px; min-width:0; }
.progress-class-card { border:1px solid #dbe7f5; border-radius:20px; background:#fff; box-shadow:0 14px 30px rgba(15,23,42,.055); padding:14px; overflow:hidden; }
.progress-class-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:10px; }
.progress-class-head h3 { margin:0; color:#1d4ed8; font-size:14px; font-weight:950; }
.progress-class-head p { margin:4px 0 0; color:#64748b; font-size:11px; font-weight:750; }
.progress-class-head > span { min-width:54px; height:28px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #bbf7d0; border-radius:999px; background:#f0fdf4; color:#15803d; font-size:11px; font-weight:950; }
.progress-class-bars { display:grid; grid-template-columns:34px minmax(0,1fr); gap:8px; }
.progress-bar-area { display:grid; grid-template-columns:repeat(auto-fit,minmax(94px,1fr)); gap:8px; overflow:hidden; }
.dash-table-wrap { width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; }
.dash-table { width:100%; border-collapse:separate; border-spacing:0; font-size:12px; min-width:860px; }
.dash-table th { position:sticky; top:0; z-index:1; background:#f8fbff; color:#0f172a; text-align:left; padding:11px 12px; border-bottom:1px solid #dbe7f5; font-size:10px; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
.dash-table td { background:#fff; color:#0f172a; padding:11px 12px; border-bottom:1px solid #edf2f7; vertical-align:middle; }
.dash-table tr:hover td { background:#f8fbff; }
.dash-table tr.risk-high td { background:#fff7f7; }
.dash-table tr.risk-medium td { background:#fffbeb; }
.dash-table tr.risk-low td { background:#f8fbff; }
.dash-mini-progress { width:100%; min-width:80px; height:7px; border-radius:99px; background:#e5eaf0; overflow:hidden; margin-top:6px; }
.dash-mini-progress div { height:100%; border-radius:inherit; }
.gap-cell { display:inline-flex; align-items:center; justify-content:center; border:1px solid #fecaca; background:#fef2f2; color:#dc2626; border-radius:999px; padding:4px 8px; font-size:11px; font-weight:950; }
.risk-pill { display:inline-flex; align-items:center; justify-content:center; min-width:64px; height:24px; border-radius:999px; font-size:11px; text-transform:uppercase; font-weight:950; }
.risk-pill.high { background:#fee2e2; color:#b91c1c; }
.risk-pill.medium { background:#fef3c7; color:#b45309; }
.risk-pill.low { background:#dbeafe; color:#1d4ed8; }
.dash-empty { padding:30px; color:#64748b; text-align:center; font-weight:800; }
.dash-empty.compact { padding:18px; }
.weekly-module { display:grid; gap:14px; min-width:0; }
.weekly-hero { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; border:1px solid #dbe7f5; border-radius:20px; background:#fff; box-shadow:0 16px 34px rgba(15,23,42,.06); padding:16px; }
.weekly-range-buttons { display:flex; flex-wrap:wrap; gap:8px; }
.weekly-range-buttons button { height:34px; border:1px solid #dbe7f5; border-radius:12px; background:#fff; color:#334155; padding:0 12px; font-size:11px; font-weight:900; cursor:pointer; }
.weekly-range-buttons button.active { background:${BLUE}; border-color:${BLUE}; color:#fff; box-shadow:0 10px 22px rgba(37,99,235,.18); }
.weekly-filter-row { display:grid; grid-template-columns:repeat(3,minmax(160px,1fr)); gap:10px; border:1px solid #dbe7f5; border-radius:18px; background:#fff; padding:12px; box-shadow:0 12px 28px rgba(15,23,42,.05); }
.weekly-kpis { grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
.weekly-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(290px,.65fr); gap:14px; align-items:stretch; }
.chart-box { width:100%; min-width:0; height:360px; padding:14px; overflow:hidden; }
.chart-box.large { height:430px; }
.chart-box.scurve { height:420px; }
.growth-list { display:grid; gap:9px; padding:14px; }
.growth-item { display:flex; justify-content:space-between; align-items:center; gap:10px; border:1px solid #e5eef8; border-radius:14px; background:#fff; padding:10px 12px; }
.growth-item strong { display:block; font-size:12px; color:#0f172a; }
.growth-item span { display:block; font-size:10px; color:#64748b; margin-top:2px; }
.growth-item b { font-size:13px; font-weight:950; }
.growth-item.positive b { color:${GREEN}; }
.growth-item.negative b { color:${RED}; }
.growth-item.neutral b { color:#64748b; }
.weekly-tooltip { background:#fff; border:1px solid #dbe7f5; border-radius:14px; box-shadow:0 14px 30px rgba(15,23,42,.12); padding:10px 12px; display:grid; gap:4px; font-size:12px; color:#334155; }
.weekly-tooltip strong { color:#0f172a; font-size:13px; }
.weekly-tooltip span { color:#64748b; font-size:11px; }
.weekly-tooltip b { color:#0f172a; }
@supports not (color: color-mix(in srgb, #000 50%, #fff)) {
  .dash-kpi-card::after { background: rgba(37,99,235,.08); }
  .dash-kpi-icon { background:#eff6ff; }
}
@media (max-width:1280px) {
  .dashboard-filter-card { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .weekly-grid { grid-template-columns:1fr; }
}
@media (max-width:860px) {
  .dashboard-header-row { flex-direction:column; }
  .dashboard-top-controls { width:100%; flex-direction:column; align-items:stretch; }
  .top-project-filter { min-width:0; width:100%; }
  .refresh-btn { width:100%; }
  .dashboard-filter-card { grid-template-columns:1fr; }
  .weekly-filter-row { grid-template-columns:1fr; }
  .comparison-grid,
  .progress-classification-grid { grid-template-columns:1fr; }
}
@media (max-width:560px) {
  .enterprise-dashboard { padding:8px 10px 20px; }
  .solid-bars-grid { grid-template-columns:repeat(2,minmax(0,1fr)); padding:12px; }
  .comparison-plot { grid-template-columns:1fr 1fr; }
}
`;
