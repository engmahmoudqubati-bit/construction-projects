import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

export default function Planning() {
  const toast = useToast();
  const [projects,  setProjects]  = useState([]);
  const [projectId, setProjectId] = useState('');
  const [rows,      setRows]      = useState([]);  // flat list with editable planned_qty
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {});
  }, []);

  const loadPlanning = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await api.getPlanning(pid);
      setRows(data.map(r => ({ ...r, qty_input: r.planned_qty ?? '' })));
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadPlanning(projectId); }, [projectId, loadPlanning]);

  function setQty(itemId, val) {
    setRows(rs => rs.map(r => r.item_id === itemId ? { ...r, qty_input: val } : r));
  }

  async function handleSave() {
    if (!projectId) return toast('Select a project first', 'error');
    setSaving(true);
    try {
      const entries = rows.map(r => ({
        item_id:     r.item_id,
        planned_qty: r.qty_input !== '' ? parseFloat(r.qty_input) : null,
      }));
      await api.savePlanning({ project_id: projectId, entries });
      toast(t.saveSuccess);
      loadPlanning(projectId);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  // Group rows by parent classification → classification
  const grouped = rows.reduce((acc, row) => {
    const section = row.parent_classification_name || row.classification_name || 'Uncategorized';
    const sub     = row.parent_classification_name ? (row.classification_name || '') : '';
    const key     = `${section}||${sub}`;
    if (!acc[key]) acc[key] = { section, sub, items: [] };
    acc[key].items.push(row);
    return acc;
  }, {});

  const projectLabel = (p) => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');
  const plannedCount = rows.filter(r => r.qty_input && parseFloat(r.qty_input) > 0).length;

  return (
    <div>
      <div className="page-header">
        <h1>{t.planningTitle}</h1>
        {projectId && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t.saving : t.savePlanning}
          </button>
        )}
      </div>

      {/* Project selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              {t.selectProject}:
            </label>
            <select
              className="form-control"
              style={{ maxWidth: 380 }}
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
            >
              <option value="">{t.selectProjectToStart}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{projectLabel(p)}</option>
              ))}
            </select>
          </div>
          {projectId && !loading && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {plannedCount} / {rows.length} items planned
            </span>
          )}
        </div>
      </div>

      {!projectId && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>{t.selectProjectToStart}</p>
        </div>
      )}

      {loading && projectId && (
        <div className="spinner-wrap"><div className="spinner" /></div>
      )}

      {!loading && projectId && rows.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <p>{t.noItemsAvailable}</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card">
          <div className="table-wrapper">
            <table className="tx-table">
              <thead>
                <tr>
                  <th>{t.itemCode}</th>
                  <th>{t.itemName}</th>
                  <th>{t.classification}</th>
                  <th>{t.unitOfMeasure}</th>
                  <th style={{ minWidth: 140 }}>{t.plannedQty}</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(grouped).map(({ section, sub, items }) => (
                  <>
                    {/* Section header */}
                    <tr key={`sec-${section}-${sub}`} style={{ background: 'var(--bg2)' }}>
                      <td colSpan={5} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {section}{sub ? ` › ${sub}` : ''}
                      </td>
                    </tr>
                    {items.map(row => (
                      <tr key={row.item_id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.item_code}</td>
                        <td>{row.item_name}</td>
                        <td className="item-meta">{row.classification_name}</td>
                        <td className="item-meta">{row.unit_of_measure || '—'}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            placeholder="0"
                            value={row.qty_input}
                            onChange={e => setQty(row.item_id, e.target.value)}
                            style={{ width: 120 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.savePlanning}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
