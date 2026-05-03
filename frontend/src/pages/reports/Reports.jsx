import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const TABS = [
  { key: 'progress',  label: t.reportProgress },
  { key: 'projects',  label: t.reportProjectsSummary },
  { key: 'items',     label: t.reportItemTracking },
  { key: 'inspection',label: t.reportInspection },
];

// ── Tab 1 ─────────────────────────────────────────────────────
function ProgressReport({ projects }) {
  const toast = useToast();
  const [projectId, setProjectId] = useState('');
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);

  const load = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try { setData(await api.getReportProgress(pid)); }
    catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(projectId); }, [projectId, load]);

  const projectLabel = (p) => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0, minWidth: 280 }}>
          <label className="form-label">{t.selectProject}</label>
          <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">— {t.selectProject} —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
      </div>
      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}
      {!loading && data.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t.itemCode}</th>
                <th>{t.itemName}</th>
                <th>{t.classification}</th>
                <th>{t.unitOfMeasure}</th>
                <th>{t.plannedQty}</th>
                <th>{t.totalDelivered}</th>
                <th>{t.deliveryPct}</th>
                <th>{t.totalInstalled}</th>
                <th>{t.installPct}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td>{r.item_code}</td>
                  <td>{r.item_name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {[r.parent_classification_name, r.classification_name].filter(Boolean).join(' › ')}
                  </td>
                  <td>{r.unit_of_measure}</td>
                  <td>{parseFloat(r.planned_qty).toFixed(3)}</td>
                  <td>{parseFloat(r.total_delivered).toFixed(3)}</td>
                  <td><ProgressCell pct={r.delivery_pct} /></td>
                  <td>{parseFloat(r.total_installed).toFixed(3)}</td>
                  <td><ProgressCell pct={r.install_pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !projectId && (
        <div className="empty-state"><div className="empty-icon">📊</div><p>{t.selectProject}</p></div>
      )}
      {!loading && projectId && data.length === 0 && (
        <div className="empty-state"><p>{t.noData}</p></div>
      )}
    </div>
  );
}

// ── Tab 2 ─────────────────────────────────────────────────────
function ProjectsSummaryReport() {
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getReportProjectsSummary()
      .then(setData)
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!data.length) return <div className="empty-state"><p>{t.noData}</p></div>;

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>{t.projectCode}</th>
            <th>{t.projectNameEn} / {t.projectNameAr}</th>
            <th>{t.status}</th>
            <th>{t.plannedQty}</th>
            <th>{t.totalDelivered}</th>
            <th>{t.totalInstalled}</th>
            <th>{t.installPct}</th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => (
            <tr key={r.id}>
              <td>{r.project_code}</td>
              <td>
                <div>{r.project_name_en}</div>
                {r.project_name_ar && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.project_name_ar}</div>}
              </td>
              <td><StatusBadge value={r.status} /></td>
              <td>{parseFloat(r.planned_qty || 0).toFixed(3)}</td>
              <td>{parseFloat(r.delivered_qty || 0).toFixed(3)}</td>
              <td>{parseFloat(r.installed_qty || 0).toFixed(3)}</td>
              <td><ProgressCell pct={r.install_pct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab 3 ─────────────────────────────────────────────────────
function ItemTrackingReport({ projects, items }) {
  const toast = useToast();
  const [projectId, setProjectId] = useState('');
  const [itemId,    setItemId]    = useState('');
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);

  async function load() {
    setLoading(true);
    try {
      setData(await api.getReportItemTracking({ projectId: projectId || undefined, itemId: itemId || undefined }));
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [projectId, itemId]);

  const projectLabel = (p) => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
          <label className="form-label">{t.selectProject}</label>
          <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">{t.allProjects}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
          <label className="form-label">{t.items}</label>
          <select className="form-control" value={itemId} onChange={e => setItemId(e.target.value)}>
            <option value="">— All Items —</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
          </select>
        </div>
      </div>
      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}
      {!loading && data.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t.projectCode}</th>
                <th>{t.projects}</th>
                <th>{t.itemCode}</th>
                <th>{t.itemName}</th>
                <th>{t.unitOfMeasure}</th>
                <th>{t.plannedQty}</th>
                <th>{t.totalDelivered}</th>
                <th>{t.totalInstalled}</th>
                <th>{t.totalInspected}</th>
                <th>{t.installPct}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td>{r.project_code}</td>
                  <td>
                    <div>{r.project_name_en}</div>
                    {r.project_name_ar && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.project_name_ar}</div>}
                  </td>
                  <td>{r.item_code}</td>
                  <td>{r.item_name}</td>
                  <td>{r.unit_of_measure}</td>
                  <td>{parseFloat(r.planned_qty).toFixed(3)}</td>
                  <td>{parseFloat(r.total_delivered || 0).toFixed(3)}</td>
                  <td>{parseFloat(r.total_installed || 0).toFixed(3)}</td>
                  <td>{parseFloat(r.total_inspected || 0).toFixed(3)}</td>
                  <td><ProgressCell pct={r.install_pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && data.length === 0 && <div className="empty-state"><p>{t.noData}</p></div>}
    </div>
  );
}

// ── Tab 4 ─────────────────────────────────────────────────────
function InspectionReport({ projects }) {
  const toast = useToast();
  const [projectId, setProjectId] = useState('');
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);

  const load = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try { setData(await api.getReportInspection(pid)); }
    catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(projectId); }, [projectId, load]);

  const projectLabel = (p) => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="form-group" style={{ margin: 0, minWidth: 280 }}>
          <label className="form-label">{t.selectProject}</label>
          <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">— {t.selectProject} —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
      </div>
      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}
      {!loading && data.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t.selectDate}</th>
                <th>{t.itemCode}</th>
                <th>{t.itemName}</th>
                <th>{t.unitOfMeasure}</th>
                <th>{t.qtyInspected}</th>
                <th>{t.inspectionStatus}</th>
                <th>Inspector</th>
                <th>{t.remarks}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td>{r.transaction_date?.slice(0,10)}</td>
                  <td>{r.item_code}</td>
                  <td>{r.item_name}</td>
                  <td>{r.unit_of_measure}</td>
                  <td>{parseFloat(r.qty_inspected).toFixed(3)}</td>
                  <td><StatusBadge value={r.status} /></td>
                  <td>{r.inspector_name || '—'}</td>
                  <td>{r.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !projectId && (
        <div className="empty-state"><div className="empty-icon">🔍</div><p>{t.selectProject}</p></div>
      )}
      {!loading && projectId && data.length === 0 && (
        <div className="empty-state"><p>{t.noData}</p></div>
      )}
    </div>
  );
}

// ── Shared progress cell ──────────────────────────────────────
function ProgressCell({ pct }) {
  const p = parseFloat(pct || 0);
  const color = p >= 100 ? 'var(--success)' : p >= 60 ? 'var(--accent)' : 'var(--warning)';
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ fontSize: 12, marginBottom: 3, color }}>{p.toFixed(1)}%</div>
      <div className="progress-bar-wrap">
        <div className="progress-bar-fill" style={{ width: `${Math.min(100, p)}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function Reports() {
  const toast = useToast();
  const [tab,      setTab]      = useState('progress');
  const [projects, setProjects] = useState([]);
  const [items,    setItems]    = useState([]);

  useEffect(() => {
    Promise.all([api.getProjects(), api.getItems()])
      .then(([p, i]) => { setProjects(p); setItems(i); })
      .catch(() => toast(t.errorOccurred, 'error'));
  }, []);

  return (
    <div>
      <div className="page-header"><h1>📊 {t.reports}</h1></div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {TABS.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              borderBottom: tab === tb.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === tb.key ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-body">
          {tab === 'progress'  && <ProgressReport   projects={projects} />}
          {tab === 'projects'  && <ProjectsSummaryReport />}
          {tab === 'items'     && <ItemTrackingReport projects={projects} items={items} />}
          {tab === 'inspection'&& <InspectionReport  projects={projects} />}
        </div>
      </div>
    </div>
  );
}
