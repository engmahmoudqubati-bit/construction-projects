
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';

const BLUE = '#2563eb';
const GREEN = '#22c55e';
const SOFT_BLUE = '#eff6ff';
const SOFT_GREEN = '#effcf3';

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value, digits = 1) {
  return num(value).toLocaleString(undefined, {
    minimumFractionDigits: digits > 0 ? 0 : 0,
    maximumFractionDigits: digits,
  });
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

function startOfIsoWeek(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diff);
  return start;
}

function endOfIsoWeek(date) {
  const start = startOfIsoWeek(date);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildWeekOptions(rows = []) {
  const seen = new Map();
  rows.forEach((row) => {
    if (!row?.transaction_date) return;
    const sourceDate = new Date(row.transaction_date);
    if (Number.isNaN(sourceDate.getTime())) return;
    const start = startOfIsoWeek(sourceDate);
    const end = endOfIsoWeek(sourceDate);
    const weekNo = getISOWeekNumber(sourceDate);
    const year = start.getFullYear();
    const key = `${year}-W${String(weekNo).padStart(2, '0')}`;
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        weekNo,
        year,
        start,
        end,
        label: `Week ${weekNo} (${formatDate(start)} - ${formatDate(end)})`,
        shortLabel: `Week ${weekNo}`,
      });
    }
  });
  return Array.from(seen.values()).sort((a, b) => a.start - b.start);
}

function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(num(value));
  const fromRef = useRef(num(value));

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = fromRef.current;
    const to = num(value);

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = to;
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}

function Icon({ type }) {
  const paths = {
    boq: 'M4 7l8-4 8 4-8 4-8-4zm0 4l8 4 8-4M4 15l8 4 8-4',
    delivered: 'M3 7h10v8H3V7zm10 3h4l3 3v2h-7v-5zM6 18a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z',
    installed: 'M14 4l6 6-3 3-2-2-6 6-3-3 6-6-2-2 4-2zM4 20l5-5',
    installPct: 'M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 5v6l4 2',
    remaining: 'M12 6v6l4 2M12 22a10 10 0 110-20 10 10 0 010 20z',
    pending: 'M4 7l8-4 8 4v10l-8 4-8-4V7zm8 4v10M4 7l8 4 8-4',
    refresh: 'M20 6v6h-6M4 18v-6h6M18 9a7 7 0 00-12-3M6 15a7 7 0 0012 3',
    export: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[type] || paths.boq} />
    </svg>
  );
}

function Sparkline({ color = BLUE }) {
  const id = `spark-${String(color).replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className="ov-sparkline" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 25 L10 22 L20 24 L30 18 L40 21 L50 14 L60 20 L70 18 L80 23 L90 13 L100 16 L110 10 L120 12 L120 32 L0 32 Z" fill={`url(#${id})`} />
      <path d="M0 25 L10 22 L20 24 L30 18 L40 21 L50 14 L60 20 L70 18 L80 23 L90 13 L100 16 L110 10 L120 12" fill="none" stroke={color} strokeWidth="2.15" strokeLinecap="round" />
    </svg>
  );
}

function RadialGauge({ value = 0, color = GREEN }) {
  const pctValue = Math.max(0, Math.min(100, num(value)));
  const animated = useCountUp(pctValue);
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg className="ov-radial" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={radius} fill="none" stroke="#e6edf7" strokeWidth="8" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference - (animated / 100) * circumference}
        transform="rotate(-90 32 32)"
      />
      <circle cx="32" cy="32" r="17" fill="#ffffff" />
      <text x="32" y="36" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0f172a">{fmt(animated, animated < 10 ? 1 : 0)}%</text>
    </svg>
  );
}

function KPI({ label, value, icon, tone = 'blue', footer, percent, isPercent = false, primary = false }) {
  const animated = useCountUp(value);
  const cardValue = isPercent ? `${fmt(animated, animated < 10 ? 1 : 0)}%` : fmt(animated, animated >= 1000 ? 0 : 1);
  return (
    <div className={`overview-kpi ${primary ? 'primary' : ''} ${tone}`}>
      <div className="overview-kpi-top">
        <div className="overview-kpi-icon"><Icon type={icon} /></div>
        {typeof percent === 'number' ? <RadialGauge value={percent} color={tone === 'green' ? GREEN : BLUE} /> : <Sparkline color={tone === 'green' ? GREEN : BLUE} />}
      </div>
      <div className="overview-kpi-label">{label}</div>
      <div className="overview-kpi-value">{cardValue}</div>
      <div className="overview-kpi-footer">{footer}</div>
    </div>
  );
}

function Section({ index, title, subtitle, right, children }) {
  return (
    <section className="overview-section-card">
      <div className="overview-section-head">
        <div className="overview-section-title-wrap">
          {index && <span className="overview-section-index">{index}</span>}
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {right && <div className="overview-section-right">{right}</div>}
      </div>
      {children}
    </section>
  );
}

function ComparisonBars({ deliveryPct, installationPct }) {
  const d = Math.max(0, Math.min(100, num(deliveryPct)));
  const i = Math.max(0, Math.min(100, num(installationPct)));
  return (
    <div className="comparison-chart">
      <div className="comparison-y-axis">
        {[100, 80, 60, 40, 20, 0].map((tick) => <span key={tick}>{tick}%</span>)}
      </div>
      <div className="comparison-plot">
        {[20, 40, 60, 80, 100].map((tick) => <div className="comparison-grid-line" key={tick} style={{ bottom: `${tick}%` }} />)}
        <div className="comparison-columns">
          <BarColumn value={d} label="Delivery %" tone="blue" />
          <BarColumn value={i} label="Installation %" tone="green" />
        </div>
      </div>
    </div>
  );
}

function BarColumn({ value, label, tone = 'blue' }) {
  const clamped = Math.max(0, Math.min(100, num(value)));
  const px = Math.max(clamped > 0 ? 10 : 5, (clamped / 100) * 148);
  return (
    <div className="comparison-bar-shell">
      <div className={`comparison-bar-value ${tone}`}>{fmt(clamped, clamped < 10 ? 1 : 0)}%</div>
      <div className="comparison-bar-stage">
        <div className={`comparison-bar ${tone}`} style={{ '--bar-height': `${px}px` }}>
          <span className="face front" />
          <span className="face side" />
          <span className="face top" />
        </div>
      </div>
      <div className="comparison-bar-label">{label}</div>
    </div>
  );
}

function ProgressPillar({ item }) {
  const installPct = Math.max(0, Math.min(100, num(item.installation_pct)));
  const installPx = Math.max(installPct > 0 ? 8 : 4, (installPct / 100) * 132);
  return (
    <div className="progress-pillar" title={`${item.item_name} — ${fmt(installPct, installPct < 10 ? 1 : 0)}%`}>
      <div className="progress-pillar-pct">{fmt(installPct, installPct < 10 ? 1 : 0)}%</div>
      <div className="progress-pillar-stage">
        <div className="progress-pillar-track">
          <div className="progress-pillar-fill" style={{ '--bar-height': `${installPx}px` }}>
            <span className="face front" />
            <span className="face side" />
            <span className="face top" />
          </div>
        </div>
      </div>
      <div className="progress-pillar-name">{item.item_name}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="overview-empty-state">
      <div className="overview-empty-icon">▣</div>
      <p>{text}</p>
    </div>
  );
}

export default function Overview() {
  const [projects, setProjects] = useState([]);
  const [details, setDetails] = useState({ boq: [], deliveries: [], installations: [] });
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedWeekKey, setSelectedWeekKey] = useState('all');
  const [compareTab, setCompareTab] = useState('classification');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getProjects().then((rows) => setProjects(rows || [])).catch(() => setProjects([]));
  }, []);

  const loadOverview = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const data = await api.getOverviewDetails(projectId);
      setDetails({
        boq: data?.boq || [],
        deliveries: data?.deliveries || [],
        installations: data?.installations || [],
      });
    } catch (error) {
      console.warn('Overview load failed', error);
      setDetails({ boq: [], deliveries: [], installations: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview(selectedProject);
  }, [selectedProject, loadOverview]);

  const weekOptions = useMemo(() => buildWeekOptions([...(details.deliveries || []), ...(details.installations || [])]), [details]);

  useEffect(() => {
    if (!weekOptions.length) {
      if (selectedWeekKey !== 'all') setSelectedWeekKey('all');
      return;
    }
    if (selectedWeekKey !== 'all' && !weekOptions.some((week) => week.key === selectedWeekKey)) {
      setSelectedWeekKey('all');
    }
  }, [weekOptions, selectedWeekKey]);

  const selectedWeek = useMemo(
    () => weekOptions.find((week) => week.key === selectedWeekKey) || null,
    [weekOptions, selectedWeekKey],
  );

  const cutoffDate = selectedWeek ? selectedWeek.end : null;

  const baseRows = useMemo(() => {
    const deliveryMap = new Map();
    const installationMap = new Map();

    (details.deliveries || []).forEach((row) => {
      const txDate = row.transaction_date ? new Date(row.transaction_date) : null;
      if (cutoffDate && txDate && txDate > cutoffDate) return;
      const key = `${row.project_id}:${row.item_id}`;
      deliveryMap.set(key, num(deliveryMap.get(key)) + num(row.qty_delivered));
    });

    (details.installations || []).forEach((row) => {
      const txDate = row.transaction_date ? new Date(row.transaction_date) : null;
      if (cutoffDate && txDate && txDate > cutoffDate) return;
      const key = `${row.project_id}:${row.item_id}`;
      installationMap.set(key, num(installationMap.get(key)) + num(row.qty_installed));
    });

    return (details.boq || []).map((row) => {
      const key = `${row.project_id}:${row.item_id}`;
      const planned = num(row.planned_qty);
      const delivered = num(deliveryMap.get(key));
      const installed = num(installationMap.get(key));
      return {
        key,
        itemKey: clean(row.item_code || row.item_name || row.item_id),
        item_id: row.item_id,
        project_id: row.project_id,
        item_code: row.item_code || '',
        item_name: row.item_name || 'Unnamed Item',
        unit_of_measure: row.unit_of_measure || '',
        classification_name: row.classification_name || 'Uncategorized',
        parent_classification_name: row.parent_classification_name || 'General',
        planned_qty: planned,
        delivered_qty: delivered,
        installed_qty: installed,
        remaining_installation_qty: Math.max(0, planned - installed),
        delivered_not_installed_qty: Math.max(0, delivered - installed),
        delivery_pct: safePct(delivered, planned),
        installation_pct: safePct(installed, planned),
      };
    });
  }, [details, cutoffDate]);

  const groupedByClassification = useMemo(() => {
    const map = new Map();
    baseRows.forEach((row) => {
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
      group.planned_qty += row.planned_qty;
      group.delivered_qty += row.delivered_qty;
      group.installed_qty += row.installed_qty;
      group.items.push(row);
    });

    return Array.from(map.values())
      .map((group) => {
        const itemMap = new Map();
        group.items.forEach((item) => {
          const itemKey = clean(item.item_code || item.item_name || item.item_id);
          if (!itemMap.has(itemKey)) {
            itemMap.set(itemKey, {
              item_name: item.item_name,
              item_code: item.item_code,
              planned_qty: 0,
              delivered_qty: 0,
              installed_qty: 0,
            });
          }
          const current = itemMap.get(itemKey);
          current.planned_qty += item.planned_qty;
          current.delivered_qty += item.delivered_qty;
          current.installed_qty += item.installed_qty;
        });
        const items = Array.from(itemMap.values())
          .map((item) => ({
            ...item,
            installation_pct: safePct(item.installed_qty, item.planned_qty),
            remaining_installation_qty: Math.max(0, item.planned_qty - item.installed_qty),
          }))
          .sort((a, b) => b.planned_qty - a.planned_qty);

        return {
          ...group,
          delivery_pct: safePct(group.delivered_qty, group.planned_qty),
          installation_pct: safePct(group.installed_qty, group.planned_qty),
          remaining_qty: Math.max(0, group.planned_qty - group.installed_qty),
          items,
        };
      })
      .sort((a, b) => b.planned_qty - a.planned_qty);
  }, [baseRows]);

  const groupedByItem = useMemo(() => {
    const map = new Map();
    baseRows.forEach((row) => {
      const key = clean(row.item_code || row.item_name || row.item_id);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: row.item_name,
          code: row.item_code,
          category: row.classification_name || 'Uncategorized',
          material: row.parent_classification_name || 'General',
          planned_qty: 0,
          delivered_qty: 0,
          installed_qty: 0,
        });
      }
      const item = map.get(key);
      item.planned_qty += row.planned_qty;
      item.delivered_qty += row.delivered_qty;
      item.installed_qty += row.installed_qty;
    });
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        delivery_pct: safePct(item.delivered_qty, item.planned_qty),
        installation_pct: safePct(item.installed_qty, item.planned_qty),
      }))
      .sort((a, b) => b.planned_qty - a.planned_qty);
  }, [baseRows]);

  const totals = useMemo(() => {
    const planned = baseRows.reduce((sum, row) => sum + num(row.planned_qty), 0);
    const delivered = baseRows.reduce((sum, row) => sum + num(row.delivered_qty), 0);
    const installed = baseRows.reduce((sum, row) => sum + num(row.installed_qty), 0);
    return {
      planned,
      delivered,
      installed,
      deliveryPct: safePct(delivered, planned),
      installationPct: safePct(installed, planned),
      remainingInstallation: Math.max(0, planned - installed),
      deliveredNotInstalled: Math.max(0, delivered - installed),
    };
  }, [baseRows]);

  const comparisonRows = compareTab === 'classification' ? groupedByClassification : groupedByItem;

  function exportOverview() {
    const rows = [
      ['Project Filter', selectedProject === 'all' ? 'All Projects' : projectLabel(projects.find((p) => String(p.id) === String(selectedProject)) || {})],
      ['Week Filter', selectedWeek?.label || 'All Progress'],
      [],
      ['Classification', 'Item Code', 'Item Name', 'BOQ Qty', 'Delivered Qty', 'Installed Qty', 'Delivery %', 'Installation %', 'Remaining Installation', 'Delivered Not Installed'],
      ...baseRows.map((row) => [
        row.classification_name,
        row.item_code,
        row.item_name,
        row.planned_qty,
        row.delivered_qty,
        row.installed_qty,
        row.delivery_pct.toFixed(1),
        row.installation_pct.toFixed(1),
        row.remaining_installation_qty,
        row.delivered_not_installed_qty,
      ]),
    ];
    const csv = '\ufeff' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'overview-dashboard.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const projectName = selectedProject === 'all'
    ? 'All Projects'
    : projectLabel(projects.find((p) => String(p.id) === String(selectedProject)) || {});

  return (
    <div className="overview-v2-page">
      <style>{styles}</style>

      <div className="overview-toolbar">
        <div className="overview-toolbar-main">
          <div className="overview-toolbar-field wide">
            <label>Project</label>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{projectLabel(project)}</option>
              ))}
            </select>
          </div>

          <div className="overview-toolbar-field">
            <label>Week</label>
            <select value={selectedWeekKey} onChange={(e) => setSelectedWeekKey(e.target.value)}>
              {!weekOptions.length && <option value="all">All Progress</option>}
              {weekOptions.length > 0 && <option value="all">All Progress</option>}
              {weekOptions.map((week) => (
                <option key={week.key} value={week.key}>{week.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overview-toolbar-actions">
          <button type="button" className="overview-toolbar-btn icon-only" onClick={() => loadOverview(selectedProject)} title="Refresh">
            <Icon type="refresh" />
          </button>
          <button type="button" className="overview-toolbar-btn" onClick={exportOverview}>
            <Icon type="export" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="overview-toolbar-meta">
        <div className="meta-chip"><strong>Project:</strong> {projectName}</div>
        <div className="meta-chip"><strong>View:</strong> {selectedWeek ? `${selectedWeek.shortLabel} snapshot` : 'Current overall progress'}</div>
        {loading && <div className="meta-chip loading">Refreshing dashboard...</div>}
      </div>

      <div className="overview-kpi-grid">
        <KPI
          primary
          label="Total BOQ"
          value={totals.planned}
          icon="boq"
          tone="blue"
          footer="Master baseline for all progress calculations"
        />
        <KPI
          label="Total Delivered"
          value={totals.delivered}
          icon="delivered"
          tone="blue"
          percent={totals.deliveryPct}
          footer={`Delivery progress: ${fmt(totals.deliveryPct, 1)}% of BOQ`}
        />
        <KPI
          label="Total Installed"
          value={totals.installed}
          icon="installed"
          tone="green"
          percent={totals.installationPct}
          footer={`Installed progress: ${fmt(totals.installationPct, 1)}% of BOQ`}
        />
        <KPI
          label="Installation %"
          value={totals.installationPct}
          icon="installPct"
          tone="green"
          percent={totals.installationPct}
          isPercent
          footer="Installed quantity / BOQ quantity × 100"
        />
        <KPI
          label="Remaining Installation"
          value={totals.remainingInstallation}
          icon="remaining"
          tone="green"
          footer={`Remaining: ${fmt(safePct(totals.remainingInstallation, totals.planned), 1)}% of BOQ`}
        />
        <KPI
          label="Delivered Not Installed"
          value={totals.deliveredNotInstalled}
          icon="pending"
          tone="blue"
          footer={`Backlog: ${fmt(safePct(totals.deliveredNotInstalled, totals.planned), 1)}% of BOQ`}
        />
      </div>

      <Section
        index="1"
        title="Delivery vs Installation Comparison"
        subtitle="Compare delivery progress and installation progress using BOQ quantity as the main baseline."
        right={
          <div className="overview-tabs" role="tablist" aria-label="Comparison tabs">
            <button className={compareTab === 'classification' ? 'active' : ''} onClick={() => setCompareTab('classification')}>By Classification</button>
            <button className={compareTab === 'item' ? 'active' : ''} onClick={() => setCompareTab('item')}>By Item</button>
          </div>
        }
      >
        {comparisonRows.length ? (
          <div className="comparison-grid-cards">
            {comparisonRows.map((row) => (
              <article key={row.key || row.name} className="comparison-card">
                <div className="comparison-card-title">{row.name}</div>
                <div className="comparison-card-subtitle">{compareTab === 'classification' ? (row.parent || 'General') : `${row.category || 'Uncategorized'} • ${row.material || 'General'}`}</div>
                <ComparisonBars deliveryPct={row.delivery_pct} installationPct={row.installation_pct} />
              </article>
            ))}
          </div>
        ) : <EmptyState text="No delivery or installation data found for the selected filters." />}
        <div className="overview-legend-row">
          <span><i className="legend-box blue" /> Delivery % = Delivered Quantity / BOQ Quantity × 100</span>
          <span><i className="legend-box green" /> Installation % = Installed Quantity / BOQ Quantity × 100</span>
        </div>
      </Section>

      <Section
        index="2"
        title="Installation Progress by Classification"
        subtitle="Cumulative installation progress by classification and related items, always measured against BOQ quantity."
      >
        {groupedByClassification.length ? (
          <div className="progress-class-grid">
            {groupedByClassification.map((group) => (
              <article key={group.key} className="progress-class-card">
                <div className="progress-class-head">
                  <div>
                    <h4>{group.name}</h4>
                    <p>{group.parent || 'General'}</p>
                  </div>
                  <span className="progress-class-badge">{fmt(group.installation_pct, group.installation_pct < 10 ? 1 : 0)}%</span>
                </div>

                <div className="progress-pillars-wrap">
                  <div className="progress-axis-labels">
                    {[100, 80, 60, 40, 20, 0].map((tick) => <span key={tick}>{tick}%</span>)}
                  </div>
                  <div className="progress-pillars-grid">
                    {group.items.slice(0, 5).map((item, index) => (
                      <ProgressPillar key={`${group.key}-${clean(item.item_code || item.item_name)}-${index}`} item={item} />
                    ))}
                  </div>
                </div>

                <div className="progress-class-note">
                  {group.items.length > 5 ? `${group.items.length - 5} more item(s) in this classification` : 'All related items shown'}
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState text="No installation progress found for the selected filters." />}
        <div className="overview-legend-row bottom-space">
          <span><i className="legend-box gray" /> Gray column shows total BOQ range</span>
          <span><i className="legend-box green" /> Green column shows installed quantity / BOQ quantity</span>
        </div>
      </Section>

      <div className="overview-footer-note">
        <span>Last updated: {new Date().toLocaleString()}</span>
        <span>All percentages in this overview are calculated using BOQ quantity as the master baseline.</span>
      </div>
    </div>
  );
}

const styles = `
.overview-v2-page,
.overview-v2-page * { box-sizing:border-box; }
.overview-v2-page{
  --bg:#f7faff;
  --card:#ffffff;
  --line:#dbe6f4;
  --line-soft:#edf3fb;
  --text:#0f172a;
  --muted:#6b7b93;
  min-height:100%;
  padding:10px 18px 22px;
  background:linear-gradient(180deg,#f9fbff 0%,#f6f9fe 100%);
  color:var(--text);
  font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;
  overflow-x:hidden;
}
.overview-toolbar{
  display:flex;
  align-items:stretch;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
  margin-bottom:10px;
}
.overview-toolbar-main{
  display:grid;
  grid-template-columns:minmax(280px,1.35fr) minmax(220px,.85fr);
  gap:12px;
  flex:1 1 560px;
  min-width:0;
}
.overview-toolbar-field{
  min-width:0;
  height:58px;
  border:1px solid var(--line);
  border-radius:16px;
  background:var(--card);
  box-shadow:0 10px 28px rgba(15,23,42,.05);
  padding:8px 14px;
  display:flex;
  flex-direction:column;
  justify-content:center;
}
.overview-toolbar-field label{
  font-size:10px;
  font-weight:800;
  color:#59708c;
  margin-bottom:5px;
  letter-spacing:.05em;
  text-transform:uppercase;
}
.overview-toolbar-field select{
  width:100%;
  border:0;
  outline:0;
  background:transparent;
  color:var(--text);
  font-size:13px;
  font-weight:800;
}
.overview-toolbar-actions{
  display:flex;
  align-items:center;
  gap:10px;
  flex:0 0 auto;
}
.overview-toolbar-btn{
  height:58px;
  border:1px solid var(--line);
  border-radius:16px;
  background:var(--card);
  box-shadow:0 10px 28px rgba(15,23,42,.05);
  color:#0f274b;
  font-size:13px;
  font-weight:800;
  padding:0 16px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  cursor:pointer;
  transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.overview-toolbar-btn.icon-only{ width:58px; padding:0; }
.overview-toolbar-btn:hover{
  transform:translateY(-1px);
  border-color:#bcd2f3;
  box-shadow:0 14px 32px rgba(37,99,235,.10);
}
.overview-toolbar-meta{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-bottom:14px;
}
.meta-chip{
  display:inline-flex;
  align-items:center;
  min-height:30px;
  border-radius:999px;
  padding:6px 12px;
  background:#ffffff;
  border:1px solid var(--line-soft);
  color:#4a5f7b;
  font-size:12px;
  font-weight:700;
}
.meta-chip strong{ color:#0f172a; margin-right:4px; }
.meta-chip.loading{ color:#1d4ed8; }
.overview-kpi-grid{
  display:grid;
  grid-template-columns:repeat(6, minmax(180px, 1fr));
  gap:14px;
  margin-bottom:16px;
}
.overview-kpi{
  min-width:0;
  min-height:152px;
  background:var(--card);
  border:1px solid var(--line);
  border-radius:18px;
  box-shadow:0 14px 34px rgba(15,23,42,.06);
  padding:14px 16px;
  transition:transform .18s ease, box-shadow .18s ease;
  overflow:hidden;
}
.overview-kpi:hover{ transform:translateY(-2px); box-shadow:0 18px 42px rgba(15,23,42,.09); }
.overview-kpi.primary{ background:linear-gradient(135deg,#0d4eb3 0%, #2a72eb 100%); border-color:#2a72eb; color:#ffffff; }
.overview-kpi.primary .overview-kpi-label,
.overview-kpi.primary .overview-kpi-footer{ color:rgba(255,255,255,.86); }
.overview-kpi.primary .overview-kpi-icon{ background:rgba(255,255,255,.16); color:#fff; }
.overview-kpi-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; min-height:56px; }
.overview-kpi-icon{
  width:42px;
  height:42px;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#edf4ff;
  color:${BLUE};
}
.overview-kpi.green .overview-kpi-icon{ background:#edfff2; color:${GREEN}; }
.overview-kpi-label{
  margin-top:6px;
  color:#47566b;
  font-size:12px;
  font-weight:800;
  line-height:1.35;
}
.overview-kpi-value{
  margin-top:8px;
  font-size:28px;
  font-weight:900;
  line-height:1.05;
  letter-spacing:-.02em;
  color:#0f172a;
  font-variant-numeric:tabular-nums;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.overview-kpi.primary .overview-kpi-value{ color:#fff; }
.overview-kpi-footer{
  margin-top:8px;
  color:#64748b;
  font-size:11px;
  font-weight:700;
  line-height:1.45;
}
.ov-sparkline{ width:88px; height:34px; flex:0 0 auto; }
.ov-radial{ width:54px; height:54px; flex:0 0 auto; }
.overview-section-card{
  background:var(--card);
  border:1px solid var(--line);
  border-radius:20px;
  box-shadow:0 14px 34px rgba(15,23,42,.06);
  padding:16px;
  margin-bottom:16px;
  width:100%;
  overflow:hidden;
}
.overview-section-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  flex-wrap:wrap;
  margin-bottom:14px;
}
.overview-section-title-wrap{ display:flex; align-items:flex-start; gap:10px; }
.overview-section-index{
  flex:0 0 auto;
  width:22px;
  height:22px;
  border-radius:7px;
  background:#2563eb;
  color:#fff;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size:12px;
  font-weight:900;
  margin-top:2px;
}
.overview-section-head h3{ margin:0; font-size:18px; font-weight:900; color:#0f172a; }
.overview-section-head p{ margin:4px 0 0; color:#6b7b93; font-size:12px; font-weight:600; }
.overview-tabs{
  display:inline-flex;
  align-items:center;
  gap:8px;
  background:#f4f8ff;
  border:1px solid var(--line-soft);
  border-radius:12px;
  padding:4px;
}
.overview-tabs button{
  height:34px;
  border:0;
  background:transparent;
  color:#506177;
  font-size:12px;
  font-weight:800;
  border-radius:10px;
  padding:0 14px;
  cursor:pointer;
}
.overview-tabs button.active{
  background:#2563eb;
  color:#fff;
  box-shadow:0 8px 20px rgba(37,99,235,.16);
}
.comparison-grid-cards{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
  gap:14px;
  width:100%;
}
.comparison-card{
  min-width:0;
  border:1px solid var(--line-soft);
  border-radius:18px;
  background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
  padding:14px 14px 12px;
}
.comparison-card-title{
  color:#2453b5;
  font-size:13px;
  font-weight:900;
  line-height:1.35;
  min-height:36px;
}
.comparison-card-subtitle{
  margin-top:2px;
  color:#7a879b;
  font-size:11px;
  font-weight:700;
}
.comparison-chart{
  display:grid;
  grid-template-columns:34px minmax(0, 1fr);
  gap:8px;
  align-items:stretch;
  margin-top:10px;
}
.comparison-y-axis{
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  align-items:flex-end;
  color:#93a2b7;
  font-size:10px;
  font-weight:800;
  padding:2px 0 18px;
}
.comparison-plot{
  position:relative;
  min-height:204px;
  padding-bottom:14px;
  border-bottom:1px solid #dce6f4;
}
.comparison-grid-line{
  position:absolute;
  left:0;
  right:0;
  border-top:1px dashed #e2ebf7;
}
.comparison-columns{
  position:relative;
  z-index:1;
  height:100%;
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:8px;
  align-items:end;
  justify-items:center;
}
.comparison-bar-shell{ width:100%; text-align:center; }
.comparison-bar-value{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:54px;
  height:26px;
  border-radius:8px;
  background:#fff;
  border:1px solid #bfdbfe;
  color:#1d4ed8;
  font-size:11px;
  font-weight:900;
  margin-bottom:6px;
}
.comparison-bar-value.green{ border-color:#bbf7d0; color:#15803d; }
.comparison-bar-stage{
  height:162px;
  display:flex;
  align-items:flex-end;
  justify-content:center;
}
.comparison-bar{
  position:relative;
  width:32px;
  height:var(--bar-height);
  min-height:4px;
}
.comparison-bar .face{ position:absolute; display:block; }
.comparison-bar .front{ left:0; bottom:0; width:32px; height:100%; border-radius:8px 0 0 8px; }
.comparison-bar .side{ right:-10px; bottom:5px; width:10px; height:calc(100% - 5px); transform:skewY(-42deg); border-radius:0 5px 5px 0; }
.comparison-bar .top{ left:2px; bottom:calc(100% - 1px); width:32px; height:10px; transform:skewX(-48deg); transform-origin:left bottom; border-radius:5px 5px 0 0; }
.comparison-bar.blue .front{ background:linear-gradient(180deg,#73abff 0%, #3b82f6 55%, #2563eb 100%); box-shadow:0 10px 20px rgba(37,99,235,.20); }
.comparison-bar.blue .side{ background:linear-gradient(180deg,#2563eb 0%, #123f9b 100%); }
.comparison-bar.blue .top{ background:linear-gradient(180deg,#bfdbfe 0%, #60a5fa 100%); }
.comparison-bar.green .front{ background:linear-gradient(180deg,#8fe5a4 0%, #4ade80 55%, #22c55e 100%); box-shadow:0 10px 20px rgba(34,197,94,.18); }
.comparison-bar.green .side{ background:linear-gradient(180deg,#22c55e 0%, #15803d 100%); }
.comparison-bar.green .top{ background:linear-gradient(180deg,#d1fae5 0%, #86efac 100%); }
.comparison-bar-label{
  margin-top:8px;
  color:#475569;
  font-size:11px;
  font-weight:800;
}
.overview-legend-row{
  display:flex;
  flex-wrap:wrap;
  gap:18px;
  margin-top:14px;
  color:#617086;
  font-size:11px;
  font-weight:700;
}
.overview-legend-row.bottom-space{ margin-top:12px; }
.legend-box{
  display:inline-block;
  width:10px;
  height:10px;
  border-radius:2px;
  margin-right:7px;
  vertical-align:middle;
}
.legend-box.blue{ background:#2563eb; }
.legend-box.green{ background:#22c55e; }
.legend-box.gray{ background:#dfe7f1; }
.progress-class-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));
  gap:14px;
}
.progress-class-card{
  min-width:0;
  border:1px solid var(--line-soft);
  border-radius:18px;
  background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
  padding:14px;
}
.progress-class-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:10px;
}
.progress-class-head h4{
  margin:0;
  color:#2453b5;
  font-size:13px;
  font-weight:900;
  line-height:1.35;
}
.progress-class-head p{
  margin:3px 0 0;
  color:#7a879b;
  font-size:11px;
  font-weight:700;
}
.progress-class-badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:54px;
  height:28px;
  border-radius:999px;
  background:#edfdf2;
  border:1px solid #bbf7d0;
  color:#15803d;
  font-size:11px;
  font-weight:900;
  white-space:nowrap;
}
.progress-pillars-wrap{
  display:grid;
  grid-template-columns:34px minmax(0, 1fr);
  gap:8px;
  min-height:220px;
}
.progress-axis-labels{
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  align-items:flex-end;
  color:#93a2b7;
  font-size:10px;
  font-weight:800;
  padding:4px 0 22px;
}
.progress-pillars-grid{
  min-width:0;
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(78px, 1fr));
  gap:8px;
}
.progress-pillar{
  min-width:0;
  text-align:center;
  border:1px solid #eef3f9;
  border-radius:14px;
  background:#fff;
  padding:8px 6px 10px;
}
.progress-pillar-pct{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:42px;
  height:22px;
  border-radius:7px;
  background:#fff;
  border:1px solid #bbf7d0;
  color:#16a34a;
  font-size:10px;
  font-weight:900;
  margin-bottom:6px;
}
.progress-pillar-stage{
  position:relative;
  height:148px;
  display:flex;
  align-items:flex-end;
  justify-content:center;
}
.progress-pillar-track{
  position:relative;
  width:34px;
  height:132px;
  border-radius:10px 0 0 10px;
  background:linear-gradient(180deg,#eef2f7 0%, #dfe7f1 100%);
}
.progress-pillar-fill{
  position:absolute;
  left:0;
  bottom:0;
  width:34px;
  height:var(--bar-height);
  min-height:4px;
}
.progress-pillar-fill .face{ position:absolute; display:block; }
.progress-pillar-fill .front{ left:0; bottom:0; width:34px; height:100%; border-radius:10px 0 0 10px; background:linear-gradient(180deg,#9be7ad 0%, #4ade80 55%, #22c55e 100%); box-shadow:0 10px 20px rgba(34,197,94,.16); }
.progress-pillar-fill .side{ right:-10px; bottom:4px; width:10px; height:calc(100% - 4px); transform:skewY(-42deg); border-radius:0 5px 5px 0; background:linear-gradient(180deg,#22c55e 0%, #15803d 100%); }
.progress-pillar-fill .top{ left:2px; bottom:calc(100% - 1px); width:34px; height:10px; transform:skewX(-48deg); transform-origin:left bottom; border-radius:5px 5px 0 0; background:linear-gradient(180deg,#dcfce7 0%, #86efac 100%); }
.progress-pillar-name{
  margin-top:10px;
  color:#334155;
  font-size:10.5px;
  font-weight:800;
  line-height:1.3;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  min-height:28px;
}
.progress-class-note{
  margin-top:10px;
  color:#7a879b;
  font-size:11px;
  font-weight:700;
}
.overview-empty-state{
  min-height:180px;
  border:1px dashed var(--line);
  border-radius:18px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  color:#7a879b;
  text-align:center;
  padding:20px;
}
.overview-empty-icon{
  width:42px;
  height:42px;
  border-radius:12px;
  background:#f1f5f9;
  display:flex;
  align-items:center;
  justify-content:center;
  margin-bottom:10px;
  color:#64748b;
}
.overview-empty-state p{ margin:0; font-size:13px; font-weight:700; }
.overview-footer-note{
  display:flex;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
  color:#64748b;
  font-size:12px;
  font-weight:700;
  padding:2px 2px 0;
}
@media (max-width: 1500px){
  .overview-kpi-grid{ grid-template-columns:repeat(3, minmax(180px, 1fr)); }
}
@media (max-width: 1080px){
  .overview-toolbar-main{ grid-template-columns:1fr; }
  .overview-kpi-grid{ grid-template-columns:repeat(2, minmax(180px, 1fr)); }
}
@media (max-width: 760px){
  .overview-v2-page{ padding:10px 12px 20px; }
  .overview-toolbar-actions{ width:100%; }
  .overview-toolbar-btn{ flex:1 1 0; }
  .overview-toolbar-btn.icon-only{ width:auto; }
  .overview-kpi-grid{ grid-template-columns:1fr; }
  .overview-section-card{ padding:14px; }
  .comparison-grid-cards,
  .progress-class-grid{ grid-template-columns:1fr; }
}
`;
