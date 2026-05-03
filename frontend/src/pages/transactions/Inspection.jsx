import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const today = () => new Date().toISOString().slice(0, 10);
const STATUSES = ['pending', 'pass', 'fail'];

export default function Inspection() {
  const toast = useToast();
  const [projects,  setProjects]  = useState([]);
  const [projectId, setProjectId] = useState('');
  const [date,      setDate]      = useState(today());
  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  const load = useCallback(async () => {
    if (!projectId || !date) return;
    setLoading(true);
    try {
      const data = await api.getInspection(projectId, date);
      setRows(data.map(r => ({
        ...r,
        qty_input:     r.qty_inspected ?? '',
        status_input:  r.status        ?? 'pending',
        remarks_input: r.remarks       ?? '',
      })));
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [projectId, date, toast]);

  useEffect(() => { load(); }, [load]);

  function setField(itemId, field, val) {
    setRows(rs => rs.map(r => r.item_id === itemId ? { ...r, [field]: val } : r));
  }

  async function handleSave() {
    if (!projectId || !date) return toast('Select project and date', 'error');
    setSaving(true);
    try {
      const entries = rows
        .filter(r => r.qty_input !== '' && parseFloat(r.qty_input) > 0)
        .map(r => ({
          item_id:       r.item_id,
          qty_inspected: parseFloat(r.qty_input),
          status:        r.status_input  || 'pending',
          remarks:       r.remarks_input || null,
        }));
      const res = await api.saveInspection({ project_id: projectId, transaction_date: date, entries });
      toast(`${t.saveSuccess} (${res.saved} rows)`);
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  const projectLabel = (p) => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  const grouped = rows.reduce((acc, row) => {
    const key = row.parent_classification_name || row.classification_name || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header"><h1>🔍 {t.inspection}</h1></div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label">{t.selectProject}</label>
            <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">— {t.selectProject} —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.selectDate}</label>
            <input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {projectId && date && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.saveEntries}
            </button>
          )}
        </div>
      </div>

      {!projectId && (
        <div className="empty-state"><div className="empty-icon">🔍</div><p>{t.selectProject}</p></div>
      )}

      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

      {!loading && projectId && rows.length === 0 && (
        <div className="empty-state"><div className="empty-icon">📦</div><p>{t.noItemsLinked}</p></div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card">
          <div className="table-wrapper">
            <table className="tx-table">
              <thead>
                <tr>
                  <th>{t.itemCode}</th>
                  <th>{t.itemName}</th>
                  <th>{t.unitOfMeasure}</th>
                  <th>{t.plannedQty}</th>
                  <th>{t.totalInspected}</th>
                  <th style={{ minWidth: 110 }}>{t.qtyInspected}</th>
                  <th style={{ minWidth: 110 }}>{t.inspectionStatus}</th>
                  <th style={{ minWidth: 150 }}>{t.remarks}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([group, items]) => (
                  <>
                    <tr key={`g-${group}`} style={{ background: 'var(--bg2)' }}>
                      <td colSpan={8} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {group}
                      </td>
                    </tr>
                    {items.map(row => {
                      const pct = row.planned_qty > 0
                        ? Math.min(100, (parseFloat(row.total_inspected) / parseFloat(row.planned_qty)) * 100)
                        : 0;
                      return (
                        <tr key={row.item_id}>
                          <td className="item-meta">{row.item_code}</td>
                          <td>{row.item_name}</td>
                          <td className="item-meta">{row.unit_of_measure || '—'}</td>
                          <td>{row.planned_qty}</td>
                          <td className="progress-cell">
                            <div style={{ fontSize: 12, marginBottom: 4 }}>
                              {parseFloat(row.total_inspected).toFixed(3)} ({pct.toFixed(1)}%)
                            </div>
                            <div className="progress-bar-wrap">
                              <div className="progress-bar-fill" style={{ width: `${pct}%`,
                                background: pct >= 100 ? 'var(--success)' : 'var(--accent)' }} />
                            </div>
                          </td>
                          <td><input type="number" min="0" step="0.001" value={row.qty_input}
                            onChange={e => setField(row.item_id, 'qty_input', e.target.value)} /></td>
                          <td>
                            <select value={row.status_input}
                              onChange={e => setField(row.item_id, 'status_input', e.target.value)}>
                              {STATUSES.map(s => <option key={s} value={s}>{t[s] || s}</option>)}
                            </select>
                          </td>
                          <td><input type="text" value={row.remarks_input}
                            onChange={e => setField(row.item_id, 'remarks_input', e.target.value)} /></td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.saveEntries}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
