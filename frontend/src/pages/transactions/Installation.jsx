import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import t from '../../lang';

const today = () => new Date().toISOString().slice(0, 10);

export default function Installation() {
  const toast = useToast();
  const [projects,   setProjects]   = useState([]);
  const [projectId,  setProjectId]  = useState('');
  const [date,       setDate]       = useState(today());
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  const load = useCallback(async () => {
    if (!projectId || !date) return;
    setLoading(true);
    try {
      const data = await api.getInstallation(projectId, date);
      setRows(data.map(r => ({
        ...r,
        qty_input:   r.qty_installed ?? '',
        notes_input: r.notes         ?? '',
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
        .map(r => ({ item_id: r.item_id, qty_installed: parseFloat(r.qty_input), notes: r.notes_input || null }));
      const res = await api.saveInstallation({ project_id: projectId, transaction_date: date, entries });
      toast(`${t.saveSuccess} (${res.saved} rows)`);
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await api.confirmInstallation(projectId, date);
      toast(`Confirmed ${res.confirmed} entries`);
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setConfirming(false); }
  }

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  const grouped = rows.reduce((acc, row) => {
    const key = row.parent_classification_name
      ? `${row.parent_classification_name} › ${row.classification_name || ''}`
      : row.classification_name || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const draftCount     = rows.filter(r => r.tx_id && r.tx_status === 'draft').length;
  const confirmedCount = rows.filter(r => r.tx_id && r.tx_status === 'confirmed').length;
  const canConfirm     = draftCount > 0;

  return (
    <div>
      <div className="page-header">
        <h1>🔧 {t.installation}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {projectId && date && (
            <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.saveEntries}
            </button>
          )}
          {canConfirm && (
            <button className="btn btn-success" onClick={handleConfirm} disabled={confirming}>
              {confirming ? t.saving : `✓ ${t.confirm} (${draftCount})`}
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label>🏗️ {t.selectProject}:</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ minWidth: 260 }}>
            <option value="">— {t.selectProject} —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>📅 {t.selectDate}:</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {projectId && date && <RefreshButton onRefresh={load} />}
        {rows.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {draftCount > 0 && <span className="badge badge-draft">{draftCount} draft</span>}
            {confirmedCount > 0 && <span className="badge badge-confirmed">{confirmedCount} confirmed</span>}
          </div>
        )}
      </div>

      {!projectId && <div className="empty-state"><div className="empty-icon">🔧</div><p>{t.selectProject}</p></div>}
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
                  <th>{t.itemCode}</th><th>{t.itemName}</th><th>{t.unitOfMeasure}</th>
                  <th>{t.plannedQty}</th><th>{t.totalInstalled}</th>
                  <th style={{ minWidth: 110 }}>{t.qtyInstalled}</th>
                  <th style={{ minWidth: 150 }}>{t.notes}</th>
                  <th>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([group, items]) => (
                  <>
                    <tr key={`g-${group}`} style={{ background: 'var(--bg2)' }}>
                      <td colSpan={8} style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group}</td>
                    </tr>
                    {items.map(row => {
                      const pct = row.planned_qty > 0
                        ? Math.min(100, (parseFloat(row.total_installed) / parseFloat(row.planned_qty)) * 100) : 0;
                      const isConfirmed = row.tx_status === 'confirmed';
                      return (
                        <tr key={row.item_id} style={{ opacity: isConfirmed ? 0.85 : 1 }}>
                          <td className="item-meta">{row.item_code}</td>
                          <td>{row.item_name}</td>
                          <td className="item-meta">{row.unit_of_measure || '—'}</td>
                          <td>{row.planned_qty}</td>
                          <td>
                            <div style={{ fontSize: 12, marginBottom: 3 }}>{parseFloat(row.total_installed).toFixed(3)} ({pct.toFixed(1)}%)</div>
                            <div className="progress-bar-wrap">
                              <div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--accent)' : 'var(--warning)' }} />
                            </div>
                          </td>
                          <td><input type="number" min="0" step="0.001" value={row.qty_input} disabled={isConfirmed} onChange={e => setField(row.item_id, 'qty_input', e.target.value)} /></td>
                          <td><input type="text" value={row.notes_input} disabled={isConfirmed} onChange={e => setField(row.item_id, 'notes_input', e.target.value)} /></td>
                          <td>{row.tx_id && <span className={`badge badge-${row.tx_status || 'draft'}`}>{t.txStatuses[row.tx_status] || row.tx_status}</span>}</td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.saveEntries}</button>
            {canConfirm && <button className="btn btn-success" onClick={handleConfirm} disabled={confirming}>{confirming ? t.saving : `✓ ${t.confirm}`}</button>}
          </div>
        </div>
      )}
    </div>
  );
}