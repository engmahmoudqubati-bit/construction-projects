import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import t from '../../lang';

export default function Planning() {
  const toast = useToast();
  const [projects,   setProjects]   = useState([]);
  const [projectId,  setProjectId]  = useState('');
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [inserting,  setInserting]  = useState(false);
  const [insertModal,setInsertModal]= useState(false);
  const [available,  setAvailable]  = useState([]);
  const [selected,   setSelected]   = useState([]);
  const [insertSearch, setInsertSearch] = useState('');

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  const loadPlanning = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await api.getPlanning(pid);
      setRows(data.map(r => ({ ...r, qty_input: r.planned_qty ?? '' })));
    } catch (err) { toast(err.message,'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadPlanning(projectId); }, [projectId, loadPlanning]);

  async function openInsert() {
    if (!projectId) return;
    const items = await api.getAvailableItems(projectId);
    setAvailable(items); setSelected([]); setInsertSearch(''); setInsertModal(true);
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  function selectAll() { setSelected(filteredAvailable.map(i => i.id)); }
  function selectNone() { setSelected([]); }

  async function handleInsert() {
    if (selected.length === 0) return toast('Select at least one item','error');
    setInserting(true);
    try {
      await api.insertPlanningItems({ project_id: projectId, item_ids: selected });
      toast(`${selected.length} items inserted`);
      setInsertModal(false);
      loadPlanning(projectId);
    } catch (err) { toast(err.message,'error'); }
    finally { setInserting(false); }
  }

  async function handleSave() {
    if (!projectId) return;
    setSaving(true);
    try {
      const entries = rows.map(r => ({ item_id: r.item_id, planned_qty: r.qty_input !== '' ? parseFloat(r.qty_input) : null }));
      await api.savePlanning({ project_id: projectId, entries });
      toast(t.saveSuccess);
      loadPlanning(projectId);
    } catch (err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handlePrepare() {
    try {
      await api.preparePlanning(projectId);
      toast('Planning prepared');
      loadPlanning(projectId);
    } catch (err) { toast(err.message,'error'); }
  }

  async function handleConfirm() {
    try {
      await api.confirmPlanning(projectId);
      toast('Planning confirmed');
      loadPlanning(projectId);
    } catch (err) { toast(err.message,'error'); }
  }

  async function handleRemove(itemId) {
    try {
      await api.deletePlanningItem(projectId, itemId);
      setRows(rs => rs.filter(r => r.item_id !== itemId));
    } catch (err) { toast(err.message,'error'); }
  }

  // Status counts
  const draftRows     = rows.filter(r => r.status === 'draft');
  const preparedRows  = rows.filter(r => r.status === 'prepared');
  const confirmedRows = rows.filter(r => r.status === 'confirmed');
  const canPrepare    = draftRows.some(r => r.qty_input && parseFloat(r.qty_input) > 0);
  const canConfirm    = preparedRows.length > 0;

  // Group rows
  const grouped = rows.reduce((acc, row) => {
    const section = row.parent_classification_name || row.classification_name || 'Uncategorized';
    const sub     = row.parent_classification_name ? (row.classification_name||'') : '';
    const key     = `${section}||${sub}`;
    if (!acc[key]) acc[key] = { section, sub, items:[] };
    acc[key].items.push(row);
    return acc;
  }, {});

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  const filteredAvailable = available.filter(i =>
    insertSearch === '' ||
    (i.item_name||'').toLowerCase().includes(insertSearch.toLowerCase()) ||
    (i.item_code||'').toLowerCase().includes(insertSearch.toLowerCase()) ||
    (i.classification_name||'').toLowerCase().includes(insertSearch.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>{t.planningTitle}</h1>
        <div style={{ display:'flex', gap:8 }}>
          {projectId && rows.length > 0 && <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.savePlanning}</button>}
          {canPrepare && <button className="btn btn-warning" onClick={handlePrepare}>{t.prepare}</button>}
          {canConfirm && <button className="btn btn-success" onClick={handleConfirm}>{t.confirm}</button>}
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>{t.selectProject}:</label>
          <select className="form-control" style={{ minWidth:280 }} value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">{t.selectProjectToStart}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        {projectId && (
          <button className="btn btn-primary" onClick={openInsert}>+ {t.insert}</button>
        )}
        {projectId && !loading && rows.length > 0 && (
          <div style={{ marginLeft:'auto', display:'flex', gap:10, fontSize:12, alignItems:'center' }}>
            {draftRows.length > 0 && <span className="badge badge-draft">{draftRows.length} draft</span>}
            {preparedRows.length > 0 && <span className="badge badge-prepared">{preparedRows.length} prepared</span>}
            {confirmedRows.length > 0 && <span className="badge badge-confirmed">{confirmedRows.length} confirmed</span>}
          </div>
        )}
      </div>

      {!projectId && <div className="empty-state"><div className="empty-icon">📋</div><p>{t.selectProjectToStart}</p></div>}
      {loading && projectId && <div className="spinner-wrap"><div className="spinner"/></div>}
      {!loading && projectId && rows.length === 0 && (
        <div className="empty-state"><div className="empty-icon">📦</div><p>No items added yet. Click "+ Insert Items" to add items.</p></div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card">
          <div className="table-wrapper">
            <table className="tx-table">
              <thead>
                <tr>
                  <th>{t.itemCode}</th><th>{t.itemName}</th>
                  <th>{t.classification}</th><th>{t.unitOfMeasure}</th>
                  <th style={{ minWidth:130 }}>{t.plannedQty}</th>
                  <th>{t.status}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {Object.values(grouped).map(({ section, sub, items }) => (
                  <>
                    <tr key={`sec-${section}-${sub}`} style={{ background:'var(--bg2)' }}>
                      <td colSpan={7} style={{ padding:'6px 14px', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                        {section}{sub ? ` › ${sub}` : ''}
                      </td>
                    </tr>
                    {items.map(row => (
                      <tr key={row.item_id}>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{row.item_code}</td>
                        <td>{row.item_name}</td>
                        <td className="item-meta">{row.classification_name}</td>
                        <td className="item-meta">{row.unit_of_measure||'—'}</td>
                        <td>
                          {row.status === 'draft' ? (
                            <input type="number" min="0" step="0.001" placeholder="0" value={row.qty_input}
                              onChange={e => setRows(rs => rs.map(r => r.item_id === row.item_id ? { ...r, qty_input:e.target.value } : r))}
                              style={{ width:120 }} />
                          ) : (
                            <span style={{ fontWeight:600 }}>{row.planned_qty}</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${row.status||'draft'}`}>
                            {t.txStatuses[row.status||'draft']}
                          </span>
                        </td>
                        <td>
                          {row.status === 'draft' && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleRemove(row.item_id)}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
            {rows.length > 0 && <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.savePlanning}</button>}
            {canPrepare && <button className="btn btn-warning" onClick={handlePrepare}>{t.prepare}</button>}
            {canConfirm && <button className="btn btn-success" onClick={handleConfirm}>{t.confirm}</button>}
          </div>
        </div>
      )}

      {/* Insert Items Modal */}
      <Modal open={insertModal} onClose={() => setInsertModal(false)} title={t.insert} size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setInsertModal(false)}>{t.cancel}</button>
          <button className="btn btn-primary" onClick={handleInsert} disabled={inserting || selected.length === 0}>
            {inserting ? t.saving : `Insert ${selected.length} Items`}
          </button>
        </>}>
        <div style={{ marginBottom:12, display:'flex', gap:8, alignItems:'center' }}>
          <div className="search-box" style={{ flex:1 }}>
            <span className="search-icon">🔍</span>
            <input placeholder={t.search} value={insertSearch} onChange={e => setInsertSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={selectAll}>Select All</button>
          <button className="btn btn-secondary btn-sm" onClick={selectNone}>None</button>
        </div>
        <div style={{ maxHeight:380, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg2)' }}>
                <th style={{ width:40, padding:'8px 12px' }}></th>
                <th style={{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)' }}>{t.itemCode}</th>
                <th style={{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)' }}>{t.itemName}</th>
                <th style={{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)' }}>{t.classification}</th>
                <th style={{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)' }}>{t.unitOfMeasure}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAvailable.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>No available items</td></tr>
              ) : filteredAvailable.map(i => (
                <tr key={i.id} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', background: selected.includes(i.id) ? 'rgba(14,165,233,0.06)' : undefined }}
                  onClick={() => toggleSelect(i.id)}>
                  <td style={{ padding:'8px 12px', textAlign:'center' }}>
                    <input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggleSelect(i.id)} onClick={e => e.stopPropagation()} />
                  </td>
                  <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-muted)' }}>{i.item_code}</td>
                  <td style={{ padding:'8px 12px' }}>{i.item_name}</td>
                  <td style={{ padding:'8px 12px', fontSize:12 }}>
                    {i.parent_classification_name ? `${i.parent_classification_name} › ${i.classification_name||''}` : i.classification_name}
                  </td>
                  <td style={{ padding:'8px 12px', fontSize:12 }}>{i.unit_of_measure||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}