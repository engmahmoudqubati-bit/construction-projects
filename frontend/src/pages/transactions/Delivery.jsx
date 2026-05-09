import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import t from '../../lang';

const today = () => new Date().toISOString().slice(0, 10);

const fmt = (v, dec = 3) => (parseFloat(v) || 0).toFixed(dec);

export default function Delivery() {
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
      const data = await api.getDelivery(projectId, date);
      setRows(data.map(r => ({
        ...r,
        qty_input:   r.qty_delivered ?? '',
        ref_input:   r.delivery_ref  ?? '',
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
        .map(r => ({
          item_id: r.item_id,
          qty_delivered: parseFloat(r.qty_input),
          delivery_ref: r.ref_input || null,
          notes: r.notes_input || null,
        }));
      const res = await api.saveDelivery({ project_id: projectId, transaction_date: date, entries });
      toast(`${t.saveSuccess} (${res.saved} rows)`);
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleConfirm() {
    if (!projectId || !date) return;
    setConfirming(true);
    try {
      const res = await api.confirmDelivery(projectId, date);
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

  // Project-level summary totals
  const totalPlanned   = rows.reduce((s, r) => s + (parseFloat(r.planned_qty) || 0), 0);
  const totalDelivered = rows.reduce((s, r) => s + (parseFloat(r.total_delivered_all) || 0), 0);
  const totalToday     = rows.reduce((s, r) => s + (parseFloat(r.qty_input) || 0), 0);
  const totalRemaining = Math.max(0, totalPlanned - totalDelivered);
  const overallPct     = totalPlanned > 0 ? Math.min(100, (totalDelivered / totalPlanned) * 100) : 0;

  const filterSelectStyle = {
    background: 'var(--card)',
    border: '2px solid #0ea5e9',
    borderRadius: 10,
    padding: '8px 14px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    minWidth: 280,
    outline: 'none',
    height: 40,
    transition: 'border-color 0.15s',
  };

  const filterDateStyle = { ...filterSelectStyle, minWidth: 160, cursor: 'default' };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 24 }}>🚚</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', margin: 0 }}>
            {t.delivery}
          </h1>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0 0' }}>
            Delivering construction materials to project sites, ensuring timely supply, accurate quantities, and smooth site operations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>🏗️ {t.selectProject}:</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={filterSelectStyle}>
            <option value="">— {t.selectProject} —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>📅 {t.selectDate}:</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={filterDateStyle} />
        </div>
        {projectId && date && <RefreshButton onRefresh={load} />}
        {rows.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {draftCount > 0    && <span className="badge badge-draft">{draftCount} draft</span>}
            {confirmedCount > 0 && <span className="badge badge-confirmed">{confirmedCount} confirmed</span>}
          </div>
        )}
      </div>

      {/* Summary KPI bar */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          {[
            { label: 'Planned (Total)',      value: fmt(totalPlanned, 2),   color: '#6366f1', bg: '#eef2ff' },
            { label: 'Delivered (All Time)', value: fmt(totalDelivered, 2), color: '#0ea5e9', bg: '#e0f2fe' },
            { label: 'Remaining',            value: fmt(totalRemaining, 2), color: '#f59e0b', bg: '#fffbeb' },
            { label: "Today's Entries",      value: fmt(totalToday, 2),     color: '#10b981', bg: '#ecfdf5' },
            { label: 'Overall Progress',     value: `${overallPct.toFixed(1)}%`, color: overallPct >= 100 ? '#10b981' : overallPct >= 60 ? '#0ea5e9' : '#f59e0b', bg: '#f0fdf4' },
          ].map(k => (
            <div key={k.label} style={{ flex: '1 1 140px', background: k.bg, border: `1px solid ${k.color}22`, borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: k.color, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {!projectId && <div className="empty-state"><div className="empty-icon">🚚</div><p>{t.selectProject}</p></div>}
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
                  <th style={{ textAlign: 'right' }}>Planned Qty</th>
                  <th style={{ textAlign: 'right' }}>Total Delivered</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th style={{ minWidth: 120 }}>Progress</th>
                  <th style={{ minWidth: 110 }}>Today's Qty</th>
                  <th style={{ minWidth: 120 }}>{t.deliveryRef}</th>
                  <th style={{ minWidth: 150 }}>{t.notes}</th>
                  <th>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([group, items]) => {
                  // Group subtotals
                  const gPlanned   = items.reduce((s, r) => s + (parseFloat(r.planned_qty) || 0), 0);
                  const gDelivered = items.reduce((s, r) => s + (parseFloat(r.total_delivered_all) || 0), 0);
                  const gRemaining = Math.max(0, gPlanned - gDelivered);
                  return (
                    <>
                      {/* Classification group header */}
                      <tr key={`g-${group}`} style={{ background: '#f0f7ff' }}>
                        <td colSpan={4} style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          📁 {group}
                        </td>
                        <td style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, color: '#0ea5e9', textAlign: 'right' }}>{fmt(gDelivered, 2)}</td>
                        <td style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, color: '#f59e0b', textAlign: 'right' }}>{fmt(gRemaining, 2)}</td>
                        <td colSpan={5} />
                      </tr>

                      {items.map(row => {
                        const planned       = parseFloat(row.planned_qty) || 0;
                        const delivered     = parseFloat(row.total_delivered_all) || 0;  // all-time for remaining calc
                        const deliveredUpTo = parseFloat(row.total_delivered) || 0;       // up-to-date for progress bar
                        const remaining     = Math.max(0, planned - delivered);
                        const pct           = planned > 0 ? Math.min(100, (deliveredUpTo / planned) * 100) : 0;
                        const todayQty      = parseFloat(row.qty_input) || 0;
                        const isConfirmed   = row.tx_status === 'confirmed';
                        const isComplete    = delivered >= planned && planned > 0;
                        const isOverDel     = !isConfirmed && todayQty > 0 && (delivered + todayQty) > planned;

                        return (
                          <tr key={row.item_id} style={{
                            opacity: isComplete && !row.tx_id ? 0.55 : 1,
                            background: isOverDel ? '#fff7ed' : isConfirmed ? 'var(--bg)' : 'inherit',
                          }}>
                            <td className="item-meta" style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.item_code}</td>
                            <td style={{ fontWeight: 500 }}>
                              {row.item_name}
                              {isOverDel && (
                                <span title="Today's qty will exceed planned!" style={{ marginLeft: 6, color: '#ea580c', fontSize: 11, fontWeight: 700 }}>⚠ Over</span>
                              )}
                            </td>
                            <td className="item-meta">{row.unit_of_measure || '—'}</td>

                            {/* Planned */}
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#6366f1' }}>{fmt(planned, 2)}</td>

                            {/* Total Delivered (all time) */}
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#0ea5e9' }}>{fmt(delivered, 2)}</td>

                            {/* Remaining */}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: isComplete ? '#10b981' : '#f59e0b' }}>
                              {isComplete ? '✓ Done' : fmt(remaining, 2)}
                            </td>

                            {/* Progress bar (based on deliveries up to selected date) */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                                  <div style={{
                                    height: '100%', borderRadius: 99,
                                    width: `${pct}%`,
                                    background: pct >= 100 ? '#10b981' : pct >= 60 ? '#0ea5e9' : '#f59e0b',
                                    transition: 'width 0.3s',
                                  }} />
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{pct.toFixed(0)}%</span>
                              </div>
                            </td>

                            {/* Today's qty input */}
                            <td>
                              <input
                                type="number" min="0" step="0.001"
                                value={row.qty_input}
                                disabled={isConfirmed}
                                style={{ borderColor: isOverDel ? '#f97316' : undefined }}
                                onChange={e => setField(row.item_id, 'qty_input', e.target.value)}
                              />
                            </td>

                            {/* Delivery ref */}
                            <td>
                              <input type="text" value={row.ref_input} disabled={isConfirmed}
                                placeholder="Ref / DO #"
                                onChange={e => setField(row.item_id, 'ref_input', e.target.value)} />
                            </td>

                            {/* Notes */}
                            <td>
                              <input type="text" value={row.notes_input} disabled={isConfirmed}
                                placeholder="Notes..."
                                onChange={e => setField(row.item_id, 'notes_input', e.target.value)} />
                            </td>

                            {/* Status */}
                            <td>
                              {row.tx_id
                                ? <span className={`badge badge-${row.tx_status || 'draft'}`}>{t.txStatuses[row.tx_status] || row.tx_status}</span>
                                : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>

              {/* Summary footer */}
              <tfoot>
                <tr style={{ background: '#f0f7ff', borderTop: '2px solid #bfdbfe' }}>
                  <td colSpan={3} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#1e40af' }}>
                    TOTAL ({rows.length} items)
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>{fmt(totalPlanned, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0ea5e9' }}>{fmt(totalDelivered, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fmt(totalRemaining, 2)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                        <div style={{ height: '100%', borderRadius: 99, width: `${overallPct}%`, background: overallPct >= 100 ? '#10b981' : overallPct >= 60 ? '#0ea5e9' : '#f59e0b' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{overallPct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#10b981' }}>{fmt(totalToday, 2)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.saveEntries}
            </button>
            {canConfirm && (
              <button className="btn btn-success" onClick={handleConfirm} disabled={confirming}>
                {confirming ? t.saving : `✓ ${t.confirm}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}