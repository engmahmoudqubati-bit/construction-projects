
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

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
const ORANGE = '#f59e0b';
const RED = '#ef4444';
const CYAN = '#06b6d4';
const SLATE = '#0f172a';

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(value, digits = 1) {
  const n = num(value);
  return `${n.toFixed(digits)}%`;
}

function fmt(value, digits = 2) {
  const n = num(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function safePct(part, total) {
  const p = num(part);
  const t = num(total);
  if (!t) return 0;
  return Math.max(0, Math.min(100, (p / t) * 100));
}

function projectLabel(p) {
  return [p.project_name_en, p.project_name_ar, p.name].filter(Boolean).join(' / ') || `Project ${p.id}`;
}

function itemKey(row) {
  return row.item_code || row.item_name || row.item_id || Math.random().toString(16).slice(2);
}

function getParentClassification(row) {
  return (
    row.parent_classification_name ||
    row.parent_classification ||
    row.classification_parent ||
    row.classification_name ||
    row.item_classification ||
    row.category ||
    'All Classifications'
  );
}

function getDateValue(row) {
  return row.transaction_date || row.progress_date || row.delivery_date || row.installation_date || row.week_start || row.date || null;
}

function weekLabelFromDate(dateValue) {
  if (!dateValue) return 'All Periods';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return 'All Periods';
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmtDate = (x) => x.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmtDate(start)} - ${fmtDate(end)}`;
}

function mergeProgressRows(installationData = [], deliveryData = []) {
  const map = new Map();
  const ensure = (row) => {
    const key = itemKey(row);
    if (!map.has(key)) {
      map.set(key, {
        key,
        item_code: row.item_code || '',
        item_name: row.item_name || row.item_desc || 'Unnamed Item',
        unit_of_measure: row.unit_of_measure || row.unit || '',
        parent_classification: getParentClassification(row),
        planned_qty: 0,
        delivered_qty: 0,
        installed_qty: 0,
        dates: new Set(),
      });
    }
    const current = map.get(key);
    current.item_code = current.item_code || row.item_code || '';
    current.item_name = current.item_name || row.item_name || row.item_desc || 'Unnamed Item';
    current.unit_of_measure = current.unit_of_measure || row.unit_of_measure || row.unit || '';
    current.parent_classification = current.parent_classification || getParentClassification(row);
    current.planned_qty = Math.max(num(current.planned_qty), num(row.planned_qty));
    const d = getDateValue(row);
    if (d) current.dates.add(weekLabelFromDate(d));
    return current;
  };

  installationData.forEach((row) => {
    const current = ensure(row);
    current.installed_qty += num(row.installed_qty ?? row.qty_installed ?? row.installed);
    current.planned_qty = Math.max(num(current.planned_qty), num(row.planned_qty));
  });

  deliveryData.forEach((row) => {
    const current = ensure(row);
    current.delivered_qty += num(row.delivered_qty ?? row.qty_delivered ?? row.delivered);
    current.planned_qty = Math.max(num(current.planned_qty), num(row.planned_qty));
  });

  return Array.from(map.values()).map((row) => ({
    ...row,
    remaining_installation_qty: Math.max(num(row.planned_qty) - num(row.installed_qty), 0),
    delivered_not_installed_qty: Math.max(num(row.delivered_qty) - num(row.installed_qty), 0),
    delivery_pct: safePct(row.delivered_qty, row.planned_qty),
    installation_pct: safePct(row.installed_qty, row.planned_qty),
    install_efficiency_pct: safePct(row.installed_qty, row.delivered_qty),
    week_labels: Array.from(row.dates || []),
  }));
}

function groupByClassification(rows = []) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.parent_classification || 'All Classifications';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: key,
        planned_qty: 0,
        delivered_qty: 0,
        installed_qty: 0,
        items: [],
      });
    }
    const g = groups.get(key);
    g.planned_qty += num(row.planned_qty);
    g.delivered_qty += num(row.delivered_qty);
    g.installed_qty += num(row.installed_qty);
    g.items.push(row);
  });
  return Array.from(groups.values()).map((g) => ({
    ...g,
    delivery_pct: safePct(g.delivered_qty, g.planned_qty),
    installation_pct: safePct(g.installed_qty, g.planned_qty),
    remaining_qty: Math.max(g.planned_qty - g.installed_qty, 0),
    delivered_not_installed_qty: Math.max(g.delivered_qty - g.installed_qty, 0),
  }));
}

function filterRows(rows, filters) {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    const matchClassification = filters.classification === 'all' || row.parent_classification === filters.classification;
    const matchItem = filters.item === 'all' || row.key === filters.item;
    const matchSearch = !q || [row.item_code, row.item_name, row.parent_classification, row.unit_of_measure]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
    const matchWeek = filters.week === 'all' || (row.week_labels || []).includes(filters.week);
    return matchClassification && matchItem && matchSearch && matchWeek;
  });
}

function buildWeeklyData(rows) {
  const labels = new Set();
  rows.forEach((row) => (row.week_labels || []).forEach((label) => labels.add(label)));
  const weekLabels = Array.from(labels);
  if (!weekLabels.length) {
    const delivered = rows.reduce((sum, row) => sum + num(row.delivered_qty), 0);
    const installed = rows.reduce((sum, row) => sum + num(row.installed_qty), 0);
    return [
      { week: 'Current Progress', delivered_qty: delivered, installed_qty: installed, growth_pct: safePct(installed, delivered || 1) },
    ];
  }
  return weekLabels.map((label, idx) => {
    const active = rows.filter((row) => (row.week_labels || []).includes(label));
    const delivered = active.reduce((sum, row) => sum + num(row.delivered_qty), 0);
    const installed = active.reduce((sum, row) => sum + num(row.installed_qty), 0);
    const previousInstalled = idx > 0
      ? rows.filter((row) => (row.week_labels || []).includes(weekLabels[idx - 1])).reduce((sum, row) => sum + num(row.installed_qty), 0)
      : 0;
    const growth = previousInstalled ? ((installed - previousInstalled) / previousInstalled) * 100 : safePct(installed, delivered || 1);
    return { week: label, delivered_qty: delivered, installed_qty: installed, growth_pct: growth };
  });
}

function AnimatedNumber({ value, formatter = fmt, duration = 900 }) {
  const target = num(value);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();
    const from = display;
    const diff = target - from;

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + diff * eased);
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return <>{formatter(display)}</>;
}

function KpiCard({ title, value, subtitle, percent, color = BLUE, icon = '◆', numericValue }) {
  const mainValue = numericValue ?? value;
  const canAnimateMain = typeof mainValue === 'number' || /^-?\d+(\.\d+)?$/.test(String(mainValue).replace(/,/g, ''));
  return (
    <div className="dash-kpi-card dash-kpi-card-pro" style={{ '--kpi-color': color }}>
      <div className="dash-kpi-accent" />
      <div className="dash-kpi-icon" style={{ color, background: `${color}14` }}>{icon}</div>
      <div className="dash-kpi-main">
        <span className="dash-kpi-title">{title}</span>
        <strong>{canAnimateMain ? <AnimatedNumber value={Number(String(mainValue).replace(/,/g, ''))} formatter={fmt} /> : value}</strong>
        {subtitle && <small>{subtitle}</small>}
        {percent !== undefined && <em><AnimatedNumber value={percent} formatter={(v) => pct(v)} /> progress</em>}
      </div>
      <div className="dash-kpi-spark" aria-hidden="true">
        {[28, 42, 36, 58, 65, 78].map((v, i) => <i key={i} style={{ height: `${Math.max(10, Math.min(90, (percent ?? v) * (0.35 + i * 0.08)))}%`, background: color }} />)}
      </div>
      {percent !== undefined && (
        <div className="dash-kpi-ring" style={{ '--ring-color': color, '--ring-pct': Math.max(0, Math.min(100, num(percent))) }}>
          <span><AnimatedNumber value={percent} formatter={(v) => pct(v, 0)} /></span>
        </div>
      )}
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

function Bar3D({ value, label, color = GREEN, height = 180, onClick, tooltip }) {
  const bounded = Math.max(0, Math.min(100, num(value)));

  // Fully SVG-based prism. The full 3D object is calculated inside the viewBox.
  // No CSS skew/translate is used, so zoom/resizing keeps the bar centered and proportional.
  const vbW = 140;
  const vbH = 188;
  const baseY = 136;
  const maxH = 88;
  const minH = bounded > 0 ? 8 : 3;
  const h = Math.max(minH, (bounded / 100) * maxH);
  const y = baseY - h;
  const x = 48;
  const w = 34;
  const dx = 12;
  const dy = 8;
  const topY = y - dy;
  const badgeY = Math.max(20, topY - 12);

  const reactId = useId().replace(/:/g, '');
  const safeId = String(label || 'bar').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18) || 'bar';
  const gradId = `barGrad_${reactId}_${safeId}_${Math.round(bounded)}_${String(color).replace(/[^a-zA-Z0-9]/g, '')}`;
  const topGradId = `${gradId}_top`;
  const sideGradId = `${gradId}_side`;
  const shadowId = `${gradId}_shadow`;

  return (
    <button className="bar3d-item" type="button" onClick={onClick} title={tooltip || label}>
      <div className="bar3d-stage" style={{ '--bar-accent': color }}>
        <svg className="bar3d-svg" viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${label}: ${pct(bounded, 0)}`}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.84" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
            <linearGradient id={topGradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.72" />
              <stop offset="100%" stopColor={color} stopOpacity="0.72" />
            </linearGradient>
            <linearGradient id={sideGradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.94" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.28" />
            </linearGradient>
            <filter id={shadowId} x="-10%" y="-10%" width="130%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="4" floodColor={color} floodOpacity="0.20" />
            </filter>
          </defs>

          <g className="bar3d-grid-svg">
            {[0, 1, 2, 3].map((i) => (
              <line key={i} x1="24" x2="118" y1={baseY - i * 23} y2={baseY - i * 23 - 8} />
            ))}
          </g>

          <polygon points={`34,146 92,146 108,137 50,137`} fill="#dbe4ef" opacity="0.78" />
          <g filter={`url(#${shadowId})`}>
            <rect x={x} y={y} width={w} height={h} rx="7" ry="7" fill={`url(#${gradId})`} />
            <polygon
              points={`${x + w},${y} ${x + w + dx},${topY} ${x + w + dx},${baseY - dy} ${x + w},${baseY}`}
              fill={`url(#${sideGradId})`}
            />
            <polygon
              points={`${x},${y} ${x + w},${y} ${x + w + dx},${topY} ${x + dx},${topY}`}
              fill={`url(#${topGradId})`}
            />
          </g>

          <g className="bar3d-badge">
            <rect x="43" y={badgeY - 12} width="54" height="24" rx="8" fill="#ffffff" stroke={color} strokeWidth="1.6" />
            <text x="70" y={badgeY + 4} textAnchor="middle">{pct(bounded, 0)}</text>
          </g>
        </svg>
      </div>
      <div className="bar3d-label">{label}</div>
    </button>
  );
}

function Chart3D({ title, subtitle, data, valueKey, color = GREEN, maxItems = 12, onBarClick }) {
  const visible = data.slice(0, maxItems);
  return (
    <div className="dash-card chart-card">
      {(title || subtitle) && (
        <div className="dash-card-header">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="bar3d-wrap">
        {visible.length ? visible.map((row) => (
          <Bar3D
            key={row.key || row.item_code || row.name || row.item_name}
            value={row[valueKey]}
            label={row.item_name || row.name || row.parent_classification || 'Item'}
            color={color}
            onClick={() => onBarClick?.(row)}
            tooltip={`BOQ: ${fmt(row.planned_qty)} | Delivered: ${fmt(row.delivered_qty)} | Installed: ${fmt(row.installed_qty)} | Delivery: ${pct(row.delivery_pct)} | Installation: ${pct(row.installation_pct)} | Remaining: ${fmt(row.remaining_qty ?? row.remaining_installation_qty)}`}
          />
        )) : <EmptyState message="No chart data available for selected filters." />}
      </div>
    </div>
  );
}


function InstallationClassificationCards({ groups = [], onSelectClassification }) {
  return (
    <div className="installation-classification-grid">
      {groups.length ? groups.map((group) => (
        <div className="install-class-card" key={group.key || group.name}>
          <div className="install-class-header">
            <div>
              <span className="install-class-eyebrow">Parent Classification</span>
              <h3>{group.name}</h3>
            </div>
            <button type="button" onClick={() => onSelectClassification?.(group)}>Drill Down</button>
          </div>

          <div className="install-class-meta">
            <div><span>BOQ</span><strong>{fmt(group.planned_qty)}</strong></div>
            <div><span>Installed</span><strong>{fmt(group.installed_qty)}</strong></div>
            <div><span>Progress</span><strong>{pct(group.installation_pct)}</strong></div>
          </div>

          <div className="install-class-scroll">
            {(group.items || []).length ? group.items.map((item) => (
              <div className="install-item-card" key={item.key || item.item_code || item.item_name}>
                <div className="install-item-title" title={item.item_name || 'Item'}>{item.item_name || 'Unnamed Item'}</div>
                <div className="install-item-code">{item.item_code || '—'}</div>
                <Bar3D
                  value={item.installation_pct || 0}
                  label={pct(item.installation_pct || 0)}
                  color={GREEN}
                  height={128}
                  tooltip={`BOQ: ${fmt(item.planned_qty)} | Delivered: ${fmt(item.delivered_qty)} | Installed: ${fmt(item.installed_qty)} | Installation: ${pct(item.installation_pct || 0)} | Remaining: ${fmt(item.remaining_installation_qty)}`}
                />
                <div className="install-item-stats">
                  <span>BOQ <strong>{fmt(item.planned_qty)}</strong></span>
                  <span>Inst. <strong>{fmt(item.installed_qty)}</strong></span>
                  <span>Rem. <strong>{fmt(item.remaining_installation_qty)}</strong></span>
                </div>
              </div>
            )) : <EmptyState message="No items inside this classification." compact />}
          </div>
        </div>
      )) : <EmptyState message="No classifications match the selected filters." />}
    </div>
  );
}

function Grouped3DChart({ title, subtitle, data, maxItems = 10 }) {
  const visible = data.slice(0, maxItems);
  return (
    <div className="dash-card chart-card">
      {(title || subtitle) && (
        <div className="dash-card-header">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="group3d-wrap">
        {visible.length ? visible.map((row) => (
          <div className="group3d-item" key={row.key}>
            <div className="group3d-bars">
              <Bar3D value={row.delivery_pct} label="Delivery" color={BLUE} height={140} tooltip={`Delivery %: ${pct(row.delivery_pct)}`} />
              <Bar3D value={row.installation_pct} label="Installation" color={GREEN} height={140} tooltip={`Installation %: ${pct(row.installation_pct)}`} />
            </div>
            <strong>{row.item_name || row.name}</strong>
            <small>Gap: {pct(Math.max(num(row.delivery_pct) - num(row.installation_pct), 0))}</small>
          </div>
        )) : <EmptyState message="No comparison data available." />}
      </div>
    </div>
  );
}

function DataTable({ columns, rows, highlightRisk = false }) {
  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.key || index} className={highlightRisk && row.risk_level ? `risk-${row.risk_level}` : ''}>
              {columns.map((col) => <td key={col.key}>{col.render ? col.render(row, index) : row[col.key]}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={columns.length}><EmptyState message="No rows match the selected filters." compact /></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message, compact = false }) {
  return <div className={compact ? 'dash-empty compact' : 'dash-empty'}>{message}</div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');
  const [activeTab, setActiveTab] = useState('boq');
  const [kpis, setKpis] = useState(null);
  const [installData, setInstallData] = useState([]);
  const [deliveryData, setDeliveryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState(null);
  const [filters, setFilters] = useState({ week: 'all', classification: 'all', item: 'all', search: '' });

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
  }, []);

  const loadDashboard = useCallback(async (pid) => {
    setLoading(true);
    try {
      const [k, inst, del] = await Promise.all([
        api.getDashboardKpis(pid),
        api.getInstallationProgress(pid),
        api.getDeliveryProgress(pid),
      ]);
      setKpis(k || {});
      setInstallData(Array.isArray(inst) ? inst : []);
      setDeliveryData(Array.isArray(del) ? del : []);
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(selectedProject);
  }, [selectedProject, loadDashboard]);

  const mergedRows = useMemo(() => mergeProgressRows(installData, deliveryData), [installData, deliveryData]);
  const classifications = useMemo(() => groupByClassification(mergedRows), [mergedRows]);
  const weekOptions = useMemo(() => {
    const set = new Set();
    mergedRows.forEach((row) => (row.week_labels || []).forEach((label) => set.add(label)));
    return Array.from(set);
  }, [mergedRows]);
  const filteredRows = useMemo(() => filterRows(mergedRows, filters), [mergedRows, filters]);
  const filteredClassifications = useMemo(() => groupByClassification(filteredRows), [filteredRows]);
  const weeklyData = useMemo(() => buildWeeklyData(filteredRows), [filteredRows]);

  const totals = useMemo(() => {
    const planned = filteredRows.reduce((sum, row) => sum + num(row.planned_qty), 0);
    const delivered = filteredRows.reduce((sum, row) => sum + num(row.delivered_qty), 0);
    const installed = filteredRows.reduce((sum, row) => sum + num(row.installed_qty), 0);
    const deliveredNotInstalled = Math.max(delivered - installed, 0);
    const remainingInstallation = Math.max(planned - installed, 0);
    const weeklyGrowth = weeklyData.length > 1
      ? num(weeklyData[weeklyData.length - 1]?.growth_pct)
      : safePct(installed, planned);
    return {
      planned,
      delivered,
      installed,
      deliveredNotInstalled,
      remainingInstallation,
      deliveryPct: safePct(delivered, planned),
      installationPct: safePct(installed, planned),
      efficiencyPct: safePct(installed, delivered),
      weeklyGrowth,
    };
  }, [filteredRows, weeklyData]);

  const itemOptions = useMemo(() => filteredRows.map((row) => ({ value: row.key, label: row.item_name })), [filteredRows]);
  const riskRows = useMemo(() => filteredRows
    .map((row) => {
      const gap = num(row.delivered_qty) - num(row.installed_qty);
      const lowProgress = num(row.installation_pct) < 35 && num(row.planned_qty) > 0;
      const riskLevel = gap > 0 && lowProgress ? 'high' : gap > 0 ? 'medium' : lowProgress ? 'low' : '';
      return { ...row, gap, risk_level: riskLevel };
    })
    .filter((row) => row.risk_level)
    .sort((a, b) => num(b.gap) - num(a.gap)), [filteredRows]);

  const topInstalled = useMemo(() => [...filteredRows].sort((a, b) => num(b.installation_pct) - num(a.installation_pct)), [filteredRows]);
  const topDelivery = useMemo(() => [...filteredRows].sort((a, b) => num(b.delivery_pct) - num(a.delivery_pct)), [filteredRows]);

  const selectedProjectName = selectedProject === 'all'
    ? 'All Projects'
    : projectLabel(projects.find((p) => String(p.id) === String(selectedProject)) || {});

  const clearFilters = () => setFilters({ week: 'all', classification: 'all', item: 'all', search: '' });

  const itemColumns = [
    { key: 'item_code', label: 'Item Code' },
    { key: 'item_name', label: 'Item Name' },
    { key: 'unit_of_measure', label: 'Unit' },
    { key: 'planned_qty', label: 'BOQ Qty', render: (r) => <strong>{fmt(r.planned_qty)}</strong> },
    { key: 'delivered_qty', label: 'Delivered', render: (r) => fmt(r.delivered_qty) },
    { key: 'installed_qty', label: 'Installed', render: (r) => fmt(r.installed_qty) },
    { key: 'remaining_installation_qty', label: 'Remaining', render: (r) => fmt(r.remaining_installation_qty) },
    { key: 'delivery_pct', label: 'Delivery %', render: (r) => <><strong>{pct(r.delivery_pct)}</strong><MiniProgress value={r.delivery_pct} color={BLUE} /></> },
    { key: 'installation_pct', label: 'Installation %', render: (r) => <><strong>{pct(r.installation_pct)}</strong><MiniProgress value={r.installation_pct} color={GREEN} /></> },
  ];

  const classificationColumns = [
    { key: 'name', label: 'Parent Classification' },
    { key: 'planned_qty', label: 'BOQ Qty', render: (r) => <strong>{fmt(r.planned_qty)}</strong> },
    { key: 'delivered_qty', label: 'Delivered', render: (r) => fmt(r.delivered_qty) },
    { key: 'installed_qty', label: 'Installed', render: (r) => fmt(r.installed_qty) },
    { key: 'remaining_qty', label: 'Remaining', render: (r) => fmt(r.remaining_qty) },
    { key: 'installation_pct', label: 'Installation %', render: (r) => <><strong>{pct(r.installation_pct)}</strong><MiniProgress value={r.installation_pct} color={GREEN} /></> },
  ];

  return (
    <div className="enterprise-dashboard">
      <style>{dashboardStyles}</style>

      <div className="dashboard-filter-card">
        <div className="filter-field project-field">
          <label>Project</label>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            <option value="all">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <label>Week</label>
          <select value={filters.week} onChange={(e) => setFilters((prev) => ({ ...prev, week: e.target.value }))}>
            <option value="all">All Weeks</option>
            {weekOptions.map((week) => <option key={week} value={week}>{week}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <label>Parent Classification</label>
          <select value={filters.classification} onChange={(e) => setFilters((prev) => ({ ...prev, classification: e.target.value, item: 'all' }))}>
            <option value="all">All Classifications</option>
            {classifications.map((c) => <option key={c.key} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <label>Item</label>
          <select value={filters.item} onChange={(e) => setFilters((prev) => ({ ...prev, item: e.target.value }))}>
            <option value="all">All Items</option>
            {itemOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="filter-field search-field">
          <label>Smart Search</label>
          <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Search item, code, classification..." />
        </div>
        <button className="ghost-btn" type="button" onClick={clearFilters}>Clear</button>
      </div>

      <div className="dashboard-tabs dashboard-tabs-no-overview">
        {TABS.map((tab) => (
          <button key={tab.key} type="button" className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'boq' && (
        <section className="tab-panel">
          <div className="dashboard-two-col">
            <Chart3D title="BOQ Item Installation %" subtitle="3D bar chart by BOQ item" data={topInstalled} valueKey="installation_pct" color={GREEN} />
            <div className="dash-card">
              <div className="dash-card-header"><div><h3>BOQ Quantity Analysis</h3><p>Planned, installed and remaining quantities by item.</p></div></div>
              <DataTable columns={itemColumns} rows={filteredRows} />
            </div>
          </div>
        </section>
      )}

      {activeTab === 'delivery' && (
        <section className="tab-panel">
          <div className="kpi-grid compact-kpis">
            <KpiCard title="Delivery %" value={pct(totals.deliveryPct)} subtitle="Delivered / BOQ" color={BLUE} />
            <KpiCard title="Delivered Qty" value={fmt(totals.delivered)} subtitle="Total delivered quantity" color={CYAN} />
            <KpiCard title="Cumulative Delivery" value={pct(totals.deliveryPct)} subtitle="Cumulative progress" color={GREEN} />
          </div>
          <div className="dashboard-two-col">
            <Chart3D title="Delivery % by Item" subtitle="3D bars from 0% to 100%" data={topDelivery} valueKey="delivery_pct" color={BLUE} />
            <div className="dash-card"><div className="dash-card-header"><div><h3>Delivery Progress Table</h3><p>Delivered quantities compared to BOQ quantities.</p></div></div><DataTable columns={itemColumns} rows={filteredRows} /></div>
          </div>
        </section>
      )}

      {activeTab === 'installation' && (
        <section className="tab-panel">
          <InstallationClassificationCards groups={filteredClassifications} onSelectClassification={setSelectedClassification} />
          {selectedClassification && (
            <div className="dash-card drill-card">
              <div className="dash-card-header">
                <div><h3>Drill-down: {selectedClassification.name}</h3><p>Item-level details inside selected classification.</p></div>
                <button type="button" className="ghost-btn" onClick={() => setSelectedClassification(null)}>Close Drill-down</button>
              </div>
              <DataTable columns={itemColumns} rows={selectedClassification.items || []} />
            </div>
          )}
        </section>
      )}

      {activeTab === 'compare' && (
        <section className="tab-panel">
          <div className="kpi-grid compact-kpis">
            <KpiCard title="Delivered Not Installed" value={fmt(totals.deliveredNotInstalled)} subtitle="Quantity gap" color={ORANGE} />
            <KpiCard title="Installation Efficiency" value={pct(totals.efficiencyPct)} subtitle="Installed / delivered" color={GREEN} />
            <KpiCard title="Delivery %" value={pct(totals.deliveryPct)} subtitle="Delivered / BOQ" color={BLUE} />
            <KpiCard title="Installation %" value={pct(totals.installationPct)} subtitle="Installed / BOQ" color={GREEN} />
          </div>
          <Grouped3DChart title="Delivery % vs Installation %" subtitle="Highlights the gap between delivery and installation" data={topDelivery} />
        </section>
      )}

      {activeTab === 'weekly' && (
        <section className="tab-panel">
          <div className="dashboard-two-col">
            <div className="dash-card">
              <div className="dash-card-header"><div><h3>Weekly Delivered vs Installed</h3><p>Weekly quantity comparison.</p></div></div>
              <div className="recharts-box">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="delivered_qty" name="Delivered Qty" fill={BLUE} radius={[8, 8, 0, 0]} />
                    <Bar dataKey="installed_qty" name="Installed Qty" fill={GREEN} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="dash-card">
              <div className="dash-card-header"><div><h3>Weekly Growth Trend</h3><p>Current week vs previous week growth.</p></div></div>
              <div className="recharts-box">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => pct(value)} />
                    <Line type="monotone" dataKey="growth_pct" name="Growth %" stroke={ORANGE} strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'classification' && (
        <section className="tab-panel">
          <Chart3D title="Classification Completion %" subtitle="3D bars grouped by parent classification" data={filteredClassifications} valueKey="installation_pct" color={GREEN} onBarClick={(row) => setSelectedClassification(row)} />
          <div className="dash-card"><div className="dash-card-header"><div><h3>Classification Quantity Analysis</h3><p>BOQ, delivery and installation quantities per parent classification.</p></div></div><DataTable columns={classificationColumns} rows={filteredClassifications} /></div>
        </section>
      )}

      {activeTab === 'risks' && (
        <section className="tab-panel">
          <div className="kpi-grid compact-kpis">
            <KpiCard title="Risk Items" value={riskRows.length} subtitle="Delayed or low-progress items" color={RED} />
            <KpiCard title="Delivered Not Installed" value={fmt(totals.deliveredNotInstalled)} subtitle="Critical gap quantity" color={ORANGE} />
            <KpiCard title="Remaining Critical Qty" value={fmt(riskRows.reduce((s, r) => s + num(r.remaining_installation_qty), 0))} subtitle="Open quantity in risk rows" color={RED} />
          </div>
          <div className="dash-card">
            <div className="dash-card-header"><div><h3>Risk & Delay Indicators</h3><p>Items delivered but not installed, low installation progress and remaining critical quantities.</p></div></div>
            <DataTable highlightRisk columns={[
              { key: 'item_code', label: 'Item Code' },
              { key: 'item_name', label: 'Item Name' },
              { key: 'parent_classification', label: 'Classification' },
              { key: 'gap', label: 'Delivered Not Installed', render: (r) => <strong>{fmt(r.gap)}</strong> },
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
.enterprise-dashboard {
  --dash-blue: #2563eb;
  --dash-blue-soft: #eff6ff;
  --dash-green: #22c55e;
  --dash-green-soft: #ecfdf5;
  --dash-orange: #f59e0b;
  --dash-red: #ef4444;
  --dash-border: #dbe7f5;
  --dash-text: #0f172a;
  --dash-muted: #64748b;
  min-height: 100%;
  padding: 0 14px 24px;
  background: radial-gradient(circle at top left, #f8fbff 0, #f3f7fc 36%, #eef4fb 100%);
  color: var(--dash-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.dashboard-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 58%, #eef6ff 100%);
  border: 1px solid var(--dash-border);
  border-radius: 22px;
  padding: 18px 22px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
}
.eyebrow { display: inline-flex; color: var(--dash-blue); font-weight: 800; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 5px; }
.dashboard-hero h1 { margin: 0; font-size: 28px; line-height: 1.12; font-weight: 850; letter-spacing: -0.03em; }
.dashboard-hero p { margin: 8px 0 0; color: var(--dash-muted); font-size: 14px; }
.hero-meta { min-width: 260px; border-radius: 18px; padding: 12px 14px; background: #fff; border: 1px solid #e5eef8; display: grid; gap: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,.8); }
.hero-meta strong { color: var(--dash-text); font-size: 14px; }
.hero-meta span { color: var(--dash-muted); font-size: 12px; }
.dashboard-filter-card {
  margin-top: 0;
  transform: translateY(-2px);
  background: rgba(255,255,255,.98);
  border: 1px solid var(--dash-border);
  border-radius: 20px;
  padding: 9px 14px 10px;
  display: grid;
  grid-template-columns: minmax(220px, 1.35fr) repeat(3, minmax(165px, .9fr)) minmax(235px, 1.15fr) auto;
  gap: 10px;
  align-items: end;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
  position: relative;
  z-index: 5;
}
.filter-field { display: grid; gap: 6px; }
.filter-field label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #334155; font-weight: 800; }
.filter-field select, .filter-field input {
  height: 38px;
  border: 1px solid #cbdcf0;
  border-radius: 12px;
  padding: 0 12px;
  background: #fff;
  color: var(--dash-text);
  outline: none;
  font-weight: 600;
}
.filter-field select:focus, .filter-field input:focus { border-color: var(--dash-blue); box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
.ghost-btn {
  height: 38px;
  border: 1px solid #cbdcf0;
  background: #fff;
  color: var(--dash-blue);
  border-radius: 12px;
  padding: 0 16px;
  font-weight: 800;
  cursor: pointer;
}
.ghost-btn:hover { background: var(--dash-blue-soft); border-color: #93c5fd; }
.dashboard-tabs {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 8px;
}
.dashboard-tabs button {
  flex: 0 0 auto;
  border: 1px solid #dbe7f5;
  background: #fff;
  color: #334155;
  border-radius: 14px;
  height: 42px;
  padding: 0 16px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}
.dashboard-tabs button.active {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-color: #1d4ed8;
  color: #fff;
  box-shadow: 0 12px 26px rgba(37, 99, 235, .25);
}
.tab-panel { display: grid; gap: 16px; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(238px, 1fr)); gap: 14px; }
.overview-kpis { grid-template-columns: repeat(auto-fit, minmax(238px, 1fr)); }
.compact-kpis { grid-template-columns: repeat(4, minmax(190px, 1fr)); }
.dash-kpi-card {
  background: linear-gradient(180deg, #ffffff, #fbfdff);
  border: 1px solid #dbe7f5;
  border-radius: 22px;
  padding: 16px;
  display: grid;
  grid-template-columns: 50px 1fr auto;
  gap: 14px;
  align-items: center;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
  position: relative;
  overflow: hidden;
}
.dash-kpi-card-pro::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--kpi-color) 16%, transparent), transparent 34%); pointer-events: none; }
.dash-kpi-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--kpi-color); }
.dash-kpi-icon { width: 50px; height: 50px; border-radius: 16px; display: grid; place-items: center; font-weight: 900; font-size: 20px; box-shadow: inset 0 1px 0 rgba(255,255,255,.85); z-index: 1; }
.dash-kpi-main { display: grid; gap: 4px; z-index: 1; min-width: 0; }
.dash-kpi-title { color: #334155; font-size: 12px; font-weight: 850; }
.dash-kpi-main strong { font-size: 26px; line-height: 1; letter-spacing: -0.04em; color: #0f172a; }
.dash-kpi-main small { color: #64748b; font-size: 11px; font-weight: 700; }
.dash-kpi-main em { color: var(--kpi-color); font-size: 11px; font-style: normal; font-weight: 900; }
.dash-kpi-ring {
  margin-left: auto;
  z-index: 1;
  width: 62px;
  height: 62px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(var(--ring-color) calc(var(--ring-pct) * 1%), #e8eef6 0);
  position: relative;
  box-shadow: 0 10px 24px rgba(15,23,42,.08);
}
.dash-kpi-ring::before { content: ''; position: absolute; inset: 6px; background: #fff; border-radius: 50%; }
.dash-kpi-ring span { position: relative; font-size: 12px; font-weight: 900; color: #0f172a; }
.dash-kpi-spark {
  position: absolute;
  right: 14px;
  bottom: 12px;
  width: 76px;
  height: 26px;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  opacity: .18;
  pointer-events: none;
}
.dash-kpi-spark i { flex: 1; border-radius: 999px 999px 2px 2px; min-height: 4px; }
.dash-kpi-card { transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease; }
.dash-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 24px 52px rgba(15, 23, 42, 0.11); border-color: color-mix(in srgb, var(--kpi-color) 30%, #dbe7f5); }

.dashboard-two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.dash-card {
  background: #fff;
  border: 1px solid #dbe7f5;
  border-radius: 20px;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.06);
  overflow: visible;
}
.dash-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid #e5eef8;
  background: linear-gradient(180deg, #ffffff, #f8fbff);
}
.dash-card-header h3 { margin: 0; font-size: 17px; font-weight: 850; color: #0f172a; }
.dash-card-header p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
.chart-card { overflow: visible; }
.bar3d-wrap { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 12px; align-items: end; padding: 16px 14px 18px; overflow: hidden; min-width: 0; }
.grouped-bars { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding-inline: 10px; }
.bar3d-item { border: 0; background: transparent; cursor: pointer; padding: 0; min-width: 0; width: 100%; max-width: 100%; overflow: visible; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; box-sizing: border-box; }
.bar3d-stage { width: clamp(62px, 68%, 92px); aspect-ratio: 140 / 188; display: flex; align-items: center; justify-content: center; overflow: hidden; box-sizing: border-box; margin-inline: auto; }
.bar3d-svg { width: 100%; height: 100%; display: block; overflow: hidden; contain: layout style; }
.bar3d-grid-svg line { stroke: #d9e4ef; stroke-width: 1.2; stroke-dasharray: 0; opacity: .78; }
.bar3d-badge text { font-size: 13px; font-weight: 900; fill: #0f172a; dominant-baseline: middle; }
.bar3d-label { margin-top: 4px; color: #0f172a; font-size: 11px; font-weight: 800; line-height: 1.25; min-height: 32px; max-width: 108px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; text-align: center; }
.group3d-wrap { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; padding: 18px; overflow: hidden; }
.group3d-item { border: 1px solid #e5eef8; border-radius: 16px; background: #fbfdff; padding: 14px; text-align: center; overflow: hidden; min-width: 0; }
.group3d-bars { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 4px; align-items: end; overflow: hidden; }
.group3d-item strong { display: block; margin-top: 8px; color: #0f172a; font-size: 12px; }
.group3d-item small { color: #64748b; font-weight: 700; }
.dash-table-wrap { overflow: auto; }
.dash-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.dash-table th { position: sticky; top: 0; z-index: 1; background: #f8fbff; color: #0f172a; text-align: left; padding: 12px 14px; border-bottom: 1px solid #dbe7f5; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.dash-table td { background: #fff; color: #0f172a; padding: 12px 14px; border-bottom: 1px solid #edf2f7; vertical-align: middle; }
.dash-table tr:hover td { background: #f8fbff; }
.dash-table tr.risk-high td { background: #fff7f7; }
.dash-table tr.risk-medium td { background: #fffbeb; }
.dash-table tr.risk-low td { background: #f8fbff; }
.dash-mini-progress { width: 100%; min-width: 95px; height: 7px; border-radius: 99px; background: #e5eaf0; overflow: hidden; margin-top: 6px; }
.dash-mini-progress div { height: 100%; border-radius: inherit; }
.risk-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 64px; height: 24px; border-radius: 99px; font-size: 11px; text-transform: uppercase; font-weight: 900; }
.risk-pill.high { background: #fee2e2; color: #b91c1c; }
.risk-pill.medium { background: #fef3c7; color: #b45309; }
.risk-pill.low { background: #dbeafe; color: #1d4ed8; }
.recharts-box { padding: 18px; height: 360px; }
.dash-empty { padding: 28px; color: #64748b; text-align: center; font-weight: 700; }
.dash-empty.compact { padding: 18px; }
.drill-card { margin-top: 16px; }

.installation-classification-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.install-class-card {
  background: #fff;
  border: 1px solid #dbe7f5;
  border-radius: 22px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.07);
  overflow: hidden;
}
.install-class-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid #e5eef8;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}
.install-class-eyebrow {
  display: block;
  font-size: 10px;
  letter-spacing: .10em;
  text-transform: uppercase;
  color: var(--dash-blue);
  font-weight: 900;
  margin-bottom: 4px;
}
.install-class-header h3 {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: -0.02em;
}
.install-class-header button {
  height: 34px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 11px;
  padding: 0 12px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
}
.install-class-header button:hover { background: #dbeafe; }
.install-class-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 12px 18px 2px;
}
.install-class-meta div {
  border: 1px solid #e5eef8;
  background: #fbfdff;
  border-radius: 14px;
  padding: 9px 10px;
  display: grid;
  gap: 3px;
}
.install-class-meta span {
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
}
.install-class-meta strong {
  color: #0f172a;
  font-size: 15px;
  font-weight: 950;
}
.install-class-scroll {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 16px 18px 20px;
  scroll-snap-type: x proximity;
}
.install-item-card {
  flex: 0 0 172px;
  min-height: 272px;
  border: 1px solid #e5eef8;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  padding: 12px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  scroll-snap-align: start;
  overflow: hidden;
}
.install-item-title {
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.25;
  min-height: 32px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.install-item-code {
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  margin-top: 4px;
}
.install-item-card .bar3d-item { width: 100%; min-width: 0; margin-top: 4px; overflow: hidden; }
.install-item-card .bar3d-stage { width: min(86%, 90px); }
.install-item-card .bar3d-label { height: auto; color: #16a34a; font-size: 12px; }
.install-item-stats {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid #edf2f7;
}
.install-item-stats span {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #64748b;
  font-size: 11px;
  font-weight: 750;
}
.install-item-stats strong { color: #0f172a; }

@supports not (color: color-mix(in srgb, #000 50%, #fff)) {
  .bar3d-front { background: linear-gradient(180deg, #4ade80, #22c55e); }
  .bar3d-side { background: #15803d; }
  .bar3d-top { background: #86efac; }
}
@media (max-width: 1200px) {
  .dashboard-filter-card { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-two-col { grid-template-columns: 1fr; }
  .kpi-grid, .compact-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .installation-classification-grid { grid-template-columns: 1fr; }
  .install-class-meta { grid-template-columns: 1fr; }
  .enterprise-dashboard { padding: 10px; }
  .dashboard-hero { flex-direction: column; align-items: stretch; }
  .dashboard-filter-card { grid-template-columns: 1fr; }
  .kpi-grid, .compact-kpis { grid-template-columns: 1fr; }
}
/* === Executive overview v10 architecture fixes === */
.enterprise-dashboard {
  padding: 0 10px 18px !important;
  background: linear-gradient(180deg, #f8fbff 0%, #f4f8fd 100%) !important;
}
.dashboard-filter-card {
  margin-top: -8px !important;
  margin-bottom: 8px !important;
  padding: 10px 14px !important;
  border-radius: 18px !important;
  grid-template-columns: minmax(220px, 1.25fr) repeat(3, minmax(160px, .85fr)) minmax(220px, 1fr) auto !important;
  box-shadow: 0 10px 28px rgba(15,23,42,.06) !important;
}
.analysis-nav-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: center;
  margin: 6px 0 10px;
}
.overview-home-btn {
  height: 42px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 14px;
  padding: 0 16px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(37,99,235,.08);
}
.overview-home-btn.active {
  color: #fff;
  background: linear-gradient(135deg,#2563eb,#1d4ed8);
  border-color: #1d4ed8;
}
.dashboard-tabs { margin-top: 0 !important; padding: 2px 0 4px !important; }
.dashboard-tabs button { height: 40px !important; }
.executive-overview-page { gap: 14px !important; }
.executive-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 13px;
}
.dash-kpi-card {
  min-height: 122px;
  background: linear-gradient(145deg, rgba(255,255,255,.92), rgba(248,251,255,.88)) !important;
  backdrop-filter: blur(16px);
  border: 1px solid rgba(219,231,245,.92) !important;
  box-shadow: 0 16px 40px rgba(15,23,42,.075), inset 0 1px 0 rgba(255,255,255,.85) !important;
}
.dash-kpi-card::after {
  content: '';
  position: absolute;
  right: -32px;
  top: -38px;
  width: 118px;
  height: 118px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--kpi-color) 16%, transparent);
  pointer-events: none;
}
.dash-kpi-icon { border: 1px solid color-mix(in srgb, var(--kpi-color) 28%, #dbe7f5); }
.dash-kpi-main strong { font-size: 27px !important; }
.dash-kpi-ring { width: 60px !important; height: 60px !important; }
.executive-visual-grid {
  display: grid;
  grid-template-columns: minmax(0,1.15fr) minmax(0,.85fr);
  gap: 14px;
  align-items: start;
}
.comparison-zone, .completion-zone {
  border-radius: 22px;
  border: 1px solid #dbe7f5;
  padding: 12px;
  background: linear-gradient(180deg,#ffffff,#fbfdff);
  box-shadow: 0 16px 36px rgba(15,23,42,.06);
}
.comparison-zone { border-left: 5px solid #f59e0b; }
.completion-zone { border-left: 5px solid #22c55e; }
.zone-title {
  display: grid;
  gap: 3px;
  padding: 2px 4px 10px;
}
.zone-title span {
  text-transform: uppercase;
  letter-spacing: .10em;
  color: #2563eb;
  font-size: 10px;
  font-weight: 950;
}
.zone-title strong { color: #0f172a; font-size: 18px; font-weight: 950; }
.zone-title small { color: #64748b; font-weight: 700; }
.comparison-zone .dash-card, .completion-zone .dash-card { box-shadow: none !important; border-radius: 18px !important; }
.comparison-zone .dash-card-header, .completion-zone .dash-card-header { padding: 12px 14px !important; }
.bar3d-wrap, .group3d-wrap, .group3d-bars, .group3d-item, .bar3d-item, .bar3d-stage {
  overflow: visible !important;
}
.bar3d-wrap {
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)) !important;
  padding: 18px 18px 20px !important;
}
.group3d-wrap {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) !important;
  padding: 16px !important;
}
.bar3d-stage {
  width: clamp(74px, 58%, 104px) !important;
  max-width: 100% !important;
  aspect-ratio: 140 / 188 !important;
}
.bar3d-svg {
  width: 100% !important;
  height: 100% !important;
  overflow: visible !important;
}
.group3d-item {
  background: linear-gradient(180deg,#fff,#fbfdff) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 10px 22px rgba(15,23,42,.04);
}
@media (max-width: 1280px) {
  .executive-visual-grid { grid-template-columns: 1fr; }
  .dashboard-filter-card { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
  .analysis-nav-row { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .dashboard-filter-card { grid-template-columns: 1fr !important; }
  .executive-kpi-grid { grid-template-columns: 1fr; }
}


/* === Overview-only stability and responsive enterprise layout fixes === */
.overview-stable-layout {
  display: grid !important;
  gap: 14px !important;
  align-items: start !important;
  width: 100% !important;
  min-width: 0 !important;
}
.stable-kpi-grid {
  display: grid !important;
  grid-template-columns: repeat(5, minmax(176px, 1fr)) !important;
  gap: 12px !important;
  align-items: stretch !important;
  width: 100% !important;
}
.stable-kpi-grid .dash-kpi-card {
  height: 132px !important;
  min-height: 132px !important;
  max-height: 132px !important;
  overflow: hidden !important;
  transform: none !important;
  transition: box-shadow .2s ease, border-color .2s ease, background .2s ease !important;
  will-change: auto !important;
  contain: layout paint !important;
}
.stable-kpi-grid .dash-kpi-card:hover {
  transform: none !important;
  box-shadow: 0 18px 42px rgba(15,23,42,.11), inset 0 1px 0 rgba(255,255,255,.85) !important;
}
.stable-kpi-grid .dash-kpi-main strong {
  display: inline-block !important;
  min-width: 108px !important;
  height: 34px !important;
  line-height: 34px !important;
  font-variant-numeric: tabular-nums !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.stable-kpi-grid .dash-kpi-main small,
.stable-kpi-grid .dash-kpi-main em,
.stable-kpi-grid .dash-kpi-title {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.stable-kpi-grid .dash-kpi-ring,
.stable-kpi-grid .dash-kpi-icon,
.stable-kpi-grid .dash-kpi-spark {
  flex: 0 0 auto !important;
}
.overview-analytics-grid {
  display: grid !important;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.25fr) !important;
  gap: 14px !important;
  align-items: start !important;
  min-width: 0 !important;
}
.overview-section-card {
  min-width: 0 !important;
  overflow: hidden !important;
  border-radius: 24px !important;
  background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,251,255,.98)) !important;
  border: 1px solid #dbe7f5 !important;
  box-shadow: 0 18px 42px rgba(15,23,42,.07) !important;
  padding: 14px !important;
}
.overview-section-heading {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: space-between !important;
  gap: 12px !important;
  margin-bottom: 10px !important;
  min-width: 0 !important;
}
.overview-section-heading span {
  display: block !important;
  font-size: 11px !important;
  font-weight: 900 !important;
  letter-spacing: .08em !important;
  text-transform: uppercase !important;
  color: #64748b !important;
}
.overview-section-heading h2 {
  margin: 3px 0 0 !important;
  color: #0f172a !important;
  font-size: 17px !important;
  line-height: 1.2 !important;
  font-weight: 950 !important;
}
.overview-section-heading > strong {
  min-width: 76px !important;
  text-align: center !important;
  padding: 8px 10px !important;
  border-radius: 14px !important;
  font-size: 17px !important;
  font-weight: 950 !important;
  font-variant-numeric: tabular-nums !important;
  color: #fff !important;
}
.comparison-heading > strong { background: linear-gradient(135deg,#2563eb,#f59e0b) !important; }
.completion-heading > strong { background: linear-gradient(135deg,#16a34a,#22c55e) !important; }
.overview-comparison-card .dash-card.chart-card {
  border: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
  background: transparent !important;
}
.overview-comparison-card .group3d-wrap {
  min-height: 330px !important;
  max-height: 430px !important;
  overflow: auto !important;
  padding: 8px 8px 14px !important;
}
.overview-completion-card .installation-classification-grid {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
  gap: 12px !important;
  max-height: 560px !important;
  overflow: auto !important;
  padding: 2px 2px 8px !important;
}
.overview-completion-card .install-class-card {
  border: 1px solid #dbe7f5 !important;
  box-shadow: 0 12px 30px rgba(15,23,42,.06) !important;
  background: #fff !important;
  border-radius: 20px !important;
  min-width: 0 !important;
}
.overview-completion-card .install-class-header {
  background: linear-gradient(135deg,#f0fdf4,#f8fbff) !important;
  border-bottom: 1px solid #e5eef8 !important;
  margin: -2px -2px 10px !important;
  padding: 12px !important;
  border-radius: 18px 18px 0 0 !important;
}
.overview-completion-card .install-class-scroll {
  display: grid !important;
  grid-auto-flow: column !important;
  grid-auto-columns: minmax(142px, 164px) !important;
  gap: 10px !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  padding-bottom: 10px !important;
  scroll-snap-type: x proximity !important;
}
.overview-completion-card .install-item-card {
  scroll-snap-align: start !important;
  background: #fff !important;
}
.overview-completion-card .bar3d-item {
  min-width: 0 !important;
  width: 100% !important;
  overflow: visible !important;
}
.overview-completion-card .bar3d-stage {
  width: 100% !important;
  max-width: 132px !important;
  margin: 0 auto !important;
  overflow: visible !important;
}
.overview-completion-card .bar3d-svg,
.overview-comparison-card .bar3d-svg {
  overflow: visible !important;
}
.overview-drill-card { margin-top: 0 !important; }
@media (max-width: 1500px) {
  .stable-kpi-grid { grid-template-columns: repeat(4, minmax(176px, 1fr)) !important; }
}
@media (max-width: 1180px) {
  .stable-kpi-grid { grid-template-columns: repeat(3, minmax(176px, 1fr)) !important; }
  .overview-analytics-grid { grid-template-columns: 1fr !important; }
}
@media (max-width: 820px) {
  .stable-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .stable-kpi-grid .dash-kpi-card { height: 138px !important; min-height: 138px !important; max-height: 138px !important; }
}
@media (max-width: 560px) {
  .stable-kpi-grid { grid-template-columns: 1fr !important; }
  .overview-completion-card .installation-classification-grid { grid-template-columns: 1fr !important; }
}

/* Dashboard without Overview tab */
.dashboard-tabs-no-overview {
  margin-top: 0 !important;
  padding-top: 0 !important;
}
`;
