import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button, Select, Input, Space, Tag, Badge } from 'antd';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const today = () => { const d = new Date(); if (d.getDay()===5) d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); };
const isFriday = (s) => s && new Date(s).getDay() === 5;
const fmt2 = (v) => (parseFloat(v)||0).toFixed(2);


// Status badge helper — avoids IIFE in JSX (Vite minifier TDZ fix)
const TX_STATUS_CFG = {
  incomplete: { bg:'#fff7ed', color:'#ea580c', border:'#fed7aa', label:'Incomplete' },
  saved:      { bg:'#f5f3ff', color:'#2563eb', border:'#ddd6fe', label:'Saved' },
  confirmed:  { bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0', label:'Approved' },
};
function StatusBadge({ status }) {
  if (!status) return <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>;
  const cfg = TX_STATUS_CFG[status] || { bg:'#f3f4f6', color:'#6b7280', border:'#e5e7eb', label: status };
  return (
    <span style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`,
      borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
      {cfg.label}
    </span>
  );
}

// ── Level Setup Modal ─────────────────────────────────────────────────────────
function LevelSetupModal({ projectId, onClose, onSaved }) {
  const toast = useToast();
  const [levels, setLevels] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getInstallationLevels(projectId).then(data => {
      setLevels(data.length > 0 ? data : []);
    }).catch(() => {});
  }, [projectId]);

  function addLevel() {
    const next = levels.length + 1;
    const code = next <= 4
      ? `B0${next}`
      : next === 5 ? 'GF'
      : `L0${next - 5}`;
    const name = next <= 4
      ? `Basement ${next}`
      : next === 5 ? 'Ground Floor'
      : `Level ${next - 5}`;
    setLevels(prev => [...prev, { level_code: code, level_name: name, isNew: true }]);
  }

  function removeLevel(idx) {
    setLevels(prev => prev.filter((_, i) => i !== idx));
  }

  function updateLevel(idx, field, val) {
    setLevels(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  }

  async function handleSave() {
    if (levels.some(l => !l.level_code || !l.level_name))
      return toast('All levels must have a code and name', 'error');
    setSaving(true);
    try {
      const saved = await api.saveInstallationLevels({ project_id: projectId, levels });
      toast(`${saved.length} levels saved`);
      onSaved(saved);
      onClose();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  const thS = { background:'#e8f1ff', color:'#111827', fontWeight:700, fontSize:11, padding:'8px 14px', textAlign:'left', borderBottom:'1px solid #e0ecff' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card)', borderRadius:16, boxShadow:'0 24px 60px rgba(0,0,0,0.18)', width:'100%', maxWidth:560, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%)', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Installation › Levels Setup</div>
            <div style={{ fontSize:17, fontWeight:700, color:'#fff' }}>Define Project Levels / Floors</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.18)', border:'none', color:'#fff', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding:20 }}>
          <p style={{ fontSize:12, color:'#6b7280', marginBottom:16 }}>
            Define the floors or basements for this project. Each level will receive a Suggested QTY allocation per item.
            Auto-generated codes: <strong>B01, B02</strong> for basements, <strong>GF</strong> for ground, <strong>L01, L02</strong> for upper floors.
          </p>
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:12 }}>
            <thead>
              <tr>
                <th style={thS}>#</th>
                <th style={thS}>Level Code</th>
                <th style={thS}>Level Name</th>
                <th style={thS}></th>
              </tr>
            </thead>
            <tbody>
              {levels.length === 0 && (
                <tr><td colSpan={4} style={{ padding:20, textAlign:'center', color:'#9ca3af', fontSize:13 }}>No levels yet — click Add Level</td></tr>
              )}
              {levels.map((lv, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'8px 14px', fontSize:12, color:'#9ca3af', width:32 }}>{i+1}</td>
                  <td style={{ padding:'6px 8px' }}>
                    <input value={lv.level_code} onChange={e => updateLevel(i,'level_code',e.target.value.toUpperCase())}
                      style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'6px 10px', fontSize:13, fontFamily:'inherit', fontWeight:700, outline:'none' }} />
                  </td>
                  <td style={{ padding:'6px 8px' }}>
                    <input value={lv.level_name} onChange={e => updateLevel(i,'level_name',e.target.value)}
                      style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'6px 10px', fontSize:13, fontFamily:'inherit', outline:'none' }} />
                  </td>
                  <td style={{ padding:'6px 8px', width:36 }}>
                    <button onClick={() => removeLevel(i)} style={{ background:'#fff5f5', border:'1px solid #fecaca', color:'#dc2626', borderRadius:6, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addLevel} style={{ display:'flex', alignItems:'center', gap:6, background:'#f5f3ff', border:'1px solid #ddd6fe', color:'#2563eb', borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Level
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border-light)', display:'flex', justifyContent:'flex-end', gap:8, background:'var(--card2)' }}>
          <button onClick={onClose} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background:'#2563eb', border:'none', borderRadius:8, padding:'8px 20px', fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            {saving ? 'Saving...' : 'Save Levels'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Allocation Modal (Suggested QTY per item per level) ───────────────────────
function AllocationModal({ projectId, levels, items, onClose, onSaved }) {
  const toast = useToast();
  const [alloc, setAlloc] = useState({});  // { 'itemId_levelId': qty }
  const [saving, setSaving] = useState(false);

  const [deliveredMap, setDeliveredMap] = useState({});  // { item_id: total_delivered }

  useEffect(() => {
    // Load existing allocation
    api.getInstallationAllocation(projectId).then(data => {
      const map = {};
      data.forEach(a => { map[`${a.item_id}_${a.level_id}`] = fmt2(a.suggested_qty); });
      setAlloc(map);
    }).catch(() => {});

    // Load total confirmed delivery per item for this project (all dates)
    api.getDeliveryTotals(projectId)
      .then(rows => {
        if (Array.isArray(rows)) {
          const dm = {};
          rows.forEach(r => { dm[r.item_id] = parseFloat(r.total_delivered) || 0; });
          setDeliveredMap(dm);
        }
      }).catch(() => {});
  }, [projectId]);

  function setQty(itemId, levelId, val, maxDelivered) {
    // Prevent total allocation across all levels from exceeding total delivered
    const parsed = parseFloat(val) || 0;
    const currentAlloc = Object.entries(alloc)
      .filter(([k]) => k.startsWith(`${itemId}_`) && k !== `${itemId}_${levelId}`)
      .reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
    if (maxDelivered > 0 && parsed + currentAlloc > maxDelivered) {
      const allowed = Math.max(0, maxDelivered - currentAlloc).toFixed(2);
      setAlloc(prev => ({ ...prev, [`${itemId}_${levelId}`]: allowed }));
      return;
    }
    setAlloc(prev => ({ ...prev, [`${itemId}_${levelId}`]: val }));
  }

  async function handleSave() {
    // Validate: no item's total allocation should exceed its total delivered
    const overItems = items.filter(item => {
      const delivered = deliveredMap[item.item_id] || 0;
      if (delivered === 0) return false;
      const allocated = levels.reduce((s,lv) => s+(parseFloat(alloc[`${item.item_id}_${lv.id}`])||0), 0);
      return allocated > delivered + 0.01;
    });
    if (overItems.length > 0) {
      toast(`${overItems.length} item(s) exceed delivered qty — please correct before saving`, 'error');
      return;
    }
    setSaving(true);
    try {
      const allocations = [];
      for (const item of items) {
        for (const level of levels) {
          const qty = parseFloat(alloc[`${item.item_id}_${level.id}`]) || 0;
          allocations.push({ item_id: item.item_id, level_id: level.id, suggested_qty: qty });
        }
      }
      await api.saveInstallationAllocation({ project_id: projectId, allocations });
      toast('Suggested QTY allocation saved');
      onSaved();
      onClose();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  const thS = { background:'#e8f1ff', color:'#111827', fontWeight:700, fontSize:11, padding:'8px 12px', textAlign:'left', borderBottom:'1px solid #e0ecff', whiteSpace:'nowrap' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 16px' }}>
      <div style={{ background:'var(--card)', borderRadius:16, boxShadow:'0 24px 60px rgba(0,0,0,0.18)', width:'100%',
        maxWidth: levels.length <= 3 ? 860 : levels.length <= 6 ? 1100 : '96vw',
        maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%)', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Installation › Suggested QTY</div>
            <div style={{ fontSize:17, fontWeight:700, color:'#fff' }}>Allocate QTY per Item per Level</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.18)', border:'none', color:'#fff', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>

        <div style={{ overflowY:'auto', flex:1 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead style={{ position:'sticky', top:0, zIndex:1 }}>
              <tr>
                <th style={{ ...thS, minWidth:80 }}>Code</th>
                <th style={{ ...thS, minWidth:160 }}>Item Name</th>
                <th style={{ ...thS, textAlign:'right' }}>BOQ Qty</th>
                <th style={{ ...thS, textAlign:'right' }}>Delivered</th>
                {levels.map(lv => (
                  <th key={lv.id} style={{ ...thS, textAlign:'center', minWidth:90, color:'#2563eb' }}>{lv.level_code}<br/><span style={{ fontSize:9, fontWeight:400, color:'#9ca3af' }}>{lv.level_name}</span></th>
                ))}
                <th style={{ ...thS, textAlign:'right', color:'#16a34a' }}>Allocated</th>
                <th style={{ ...thS, textAlign:'right', color: '#dc2626' }}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const planned    = parseFloat(item.planned_qty)||0;
                const delivered  = deliveredMap[item.item_id] || 0;
                const maxAlloc   = delivered > 0 ? delivered : planned;  // cap at delivered; fallback to planned
                const allocated  = levels.reduce((s,lv) => s + (parseFloat(alloc[`${item.item_id}_${lv.id}`])||0), 0);
                const remaining  = maxAlloc - allocated;
                const overAlloc  = allocated > maxAlloc + 0.01;
                return (
                  <tr key={item.item_id} style={{ borderBottom:'1px solid #f3f4f6', background: idx%2===0?'#fafbff':'#fff' }}>
                    <td style={{ padding:'8px 12px', fontSize:11, color:'#6b7280', fontFamily:'monospace' }}>{item.item_code}</td>
                    <td style={{ padding:'8px 12px', fontSize:12, fontWeight:600, color:'#111827' }}>{item.item_name}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', fontSize:12, fontWeight:600 }}>{fmt2(planned)}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', fontSize:12, fontWeight:700, color: delivered>0?'#16a34a':'#9ca3af' }}>
                      {delivered > 0 ? fmt2(delivered) : '—'}
                    </td>
                    {levels.map(lv => {
                      const thisVal = alloc[`${item.item_id}_${lv.id}`] || '';
                      const otherAlloc = levels.filter(l=>l.id!==lv.id).reduce((s,l)=>s+(parseFloat(alloc[`${item.item_id}_${l.id}`])||0),0);
                      const available = Math.max(0, maxAlloc - otherAlloc);
                      return (
                        <td key={lv.id} style={{ padding:'4px 6px', textAlign:'center' }}>
                          <input type="number" min="0" step="0.01" max={available}
                            value={thisVal}
                            onChange={e => setQty(item.item_id, lv.id, e.target.value, maxAlloc)}
                            onBlur={e => { const v=parseFloat(e.target.value); setQty(item.item_id, lv.id, isNaN(v)?'':v.toFixed(2), maxAlloc); }}
                            style={{ width:84, textAlign:'center',
                              border:`1.5px solid ${overAlloc?'#fecaca':Math.abs(remaining)<0.01?'#bbf7d0':'#e5e7eb'}`,
                              borderRadius:7, padding:'5px 6px', fontSize:12, fontFamily:'inherit', background:'#fff', outline:'none' }} />
                        </td>
                      );
                    })}
                    <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, color: overAlloc?'#dc2626':Math.abs(remaining)<0.01?'#16a34a':'#111827', fontSize:12 }}>
                      {overAlloc && <span title="Exceeds delivered qty">⚠ </span>}{fmt2(allocated)}
                    </td>
                    <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, color: remaining<-0.01?'#dc2626':remaining>0.01?'#f59e0b':'#16a34a', fontSize:12 }}>
                      {Math.abs(remaining)<0.01 ? '✓' : overAlloc ? '⚠ Over' : fmt2(remaining)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border-light)', display:'flex', justifyContent:'flex-end', gap:8, background:'var(--card2)', flexShrink:0 }}>
          <button onClick={onClose} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background:'#2563eb', border:'none', borderRadius:8, padding:'8px 20px', fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            {saving ? 'Saving...' : 'Save Allocation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Installation Component ───────────────────────────────────────────────
export default function Installation() {
  const toast = useToast();
  const { canAction } = useAuth();

  const [projects,     setProjects]     = useState([]);
  const [projectId,    setProjectId]    = useState('');
  const [date,         setDate]         = useState(today());
  const [levels,       setLevels]       = useState([]);
  const [planItems,    setPlanItems]    = useState([]);
  const [rows,         setRows]         = useState([]);
  const rowsRef = useRef([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [confirming,   setConfirming]   = useState(false);
  const [unposting,    setUnposting]    = useState(false);
  const [showLevelModal,  setShowLevelModal]  = useState(false);
  const [showAllocModal,  setShowAllocModal]  = useState(false);
  const [activeTab,       setActiveTab]       = useState('entry');
  const [mapData,         setMapData]         = useState(null);
  const [mapLoading,      setMapLoading]      = useState(false);
  const [filterLevel,  setFilterLevel]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(25);

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  const load = useCallback(async () => {
    if (!projectId || !date) return;
    setLoading(true);
    try {
      const raw = await api.getInstallation(projectId, date);
      // Handle both new object response { items, levels, rows } and legacy array response
      const data = Array.isArray(raw) ? { items: raw, levels: [], allocs: [], rows: raw } : raw;
      setLevels(Array.isArray(data.levels) ? data.levels : []);
      setPlanItems(Array.isArray(data.items) ? data.items : []);
      setRows((Array.isArray(data.rows) ? data.rows : []).map(r => ({
        ...r,
        qty_input:   r.qty_installed != null ? parseFloat(r.qty_installed).toFixed(2) : '',
        notes_input: r.notes ?? '',
      })));
      setPage(1);
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [projectId, date, toast]);

  useEffect(() => { load(); }, [load]);

  const softRefresh = useCallback(async () => {
    if (!projectId || !date) return;
    try {
      const raw = await api.getInstallation(projectId, date);
      const data = Array.isArray(raw) ? { items: raw, levels: [], allocs: [], rows: raw } : raw;
      setLevels(Array.isArray(data.levels) ? data.levels : []);
      setPlanItems(Array.isArray(data.items) ? data.items : []);
      setRows(prev => (Array.isArray(data.rows) ? data.rows : []).map(r => {
        const existing = prev.find(p => p.item_id === r.item_id && p.level_id === r.level_id);
        return {
          ...r,
          qty_input:      existing ? existing.qty_input   : (r.qty_installed != null ? parseFloat(r.qty_installed).toFixed(2) : ''),
          notes_input:    existing ? existing.notes_input : (r.notes ?? ''),
          tx_id:          r.tx_id,
          tx_status:      r.tx_status,
          total_installed:r.total_installed,
          suggested_qty:  r.suggested_qty,
        };
      }));
    } catch (err) { /* silent */ }
  }, [projectId, date]);

  const loadMap = useCallback(async () => {
    if (!projectId) return;
    setMapLoading(true);
    try {
      const data = await api.getInstallationMap(projectId);
      setMapData(data);
    } catch (err) { toast(err.message, 'error'); }
    finally { setMapLoading(false); }
  }, [projectId, toast]);

  useEffect(() => {
    if (activeTab === 'map' && projectId) loadMap();
  }, [activeTab, projectId, loadMap]);

  function setField(itemId, levelId, field, val) {
    setRows(rs => {
      const updated = rs.map(r => r.item_id===itemId && r.level_id===levelId ? { ...r, [field]: val } : r);
      rowsRef.current = updated;
      return updated;
    });
  }
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  function buildEntries() {
    const current = rowsRef.current;
    const toSave = current
      .filter(r => r.qty_input !== '' && parseFloat(r.qty_input) > 0 && r.suggested_qty > 0)
      .map(r => ({ item_id: r.item_id, level_id: r.level_id, qty_installed: parseFloat(r.qty_input), notes: r.notes_input||null }));
    const toDelete = current.filter(r =>
      r.tx_id && r.tx_status !== 'confirmed' && r.suggested_qty > 0 &&
      (r.qty_input === '' || parseFloat(r.qty_input) <= 0)
    );
    return { toSave, toDelete };
  }

  async function handleDraft() {
    setSaving(true);
    try {
      const { toSave, toDelete } = buildEntries();
      for (const r of toDelete) await api.deleteInstallation(r.tx_id);
      const res = await api.saveInstallation({ project_id: projectId, transaction_date: date, entries: toSave, tx_status: 'incomplete' });
      toast(`Status: Incomplete (${res.saved} saved)`);
      await softRefresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { toSave, toDelete } = buildEntries();
      for (const r of toDelete) await api.deleteInstallation(r.tx_id);
      const res = await api.saveInstallation({ project_id: projectId, transaction_date: date, entries: toSave, tx_status: 'saved' });
      toast(`Status: Saved (${res.saved} entries)`);
      await softRefresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleApprove() {
    setConfirming(true);
    try {
      const res = await api.confirmInstallation(projectId, date);
      toast(`Status: Approved (${res.confirmed} entries)`);
      await softRefresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { setConfirming(false); }
  }

  async function handleUnpost() {
    setUnposting(true);
    try {
      const res = await api.unpostInstallation(projectId, date);
      toast(`Unposted — ${res.unposted} entries reverted to Incomplete`);
      await softRefresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { setUnposting(false); }
  }

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  // Filter rows — only show rows that have a suggested_qty > 0 (have allocation)
  const allocatedRows = rows.filter(r => r.suggested_qty > 0);

  const filteredRows = useMemo(() => {
    let result = allocatedRows;
    if (filterLevel)  result = result.filter(r => r.level_id === parseInt(filterLevel));
    if (filterStatus === 'incomplete') result = result.filter(r => r.tx_status === 'incomplete');
    if (filterStatus === 'saved')      result = result.filter(r => r.tx_status === 'saved');
    if (filterStatus === 'confirmed')  result = result.filter(r => r.tx_status === 'confirmed');
    if (filterStatus === 'no_entry')   result = result.filter(r => !r.tx_id);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => (r.item_code||'').toLowerCase().includes(q) || (r.item_name||'').toLowerCase().includes(q));
    }
    return result;
  }, [allocatedRows, filterLevel, filterStatus, search]);

  const totalFiltered = filteredRows.length;
  const totalPages    = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const pagedRows     = filteredRows.slice((page-1)*pageSize, page*pageSize);

  // Group paged rows by item → sub-group by level
  const grouped = pagedRows.reduce((acc, row) => {
    const key = row.parent_classification_name
      ? `${row.parent_classification_name} › ${row.classification_name||''}`
      : row.classification_name || 'Uncategorized';
    if (!acc[key]) acc[key] = {};
    if (!acc[key][row.item_id]) acc[key][row.item_id] = { meta: row, levels: [] };
    acc[key][row.item_id].levels.push(row);
    return acc;
  }, {});

  const incompleteCount = allocatedRows.filter(r => r.tx_id && r.tx_status==='incomplete').length;
  const savedCount      = allocatedRows.filter(r => r.tx_id && r.tx_status==='saved').length;
  const confirmedCount  = allocatedRows.filter(r => r.tx_id && r.tx_status==='confirmed').length;
  const txRows          = allocatedRows.filter(r => r.tx_id);
  const allApproved     = txRows.length > 0 && txRows.every(r => r.tx_status==='confirmed');
  const showWorkflow    = allocatedRows.length > 0 && !allApproved;
  const canUnpost       = confirmedCount > 0 && canAction('can_confirm');

  const totalSuggested  = filteredRows.reduce((s,r) => s+(r.suggested_qty||0), 0);
  const totalInstalled  = filteredRows.reduce((s,r) => s+(parseFloat(r.total_installed)||0), 0);
  const totalRemaining  = Math.max(0, totalSuggested - totalInstalled);
  const totalToday      = filteredRows.reduce((s,r) => s+(parseFloat(r.qty_input)||0), 0);
  const overallPct      = totalSuggested > 0 ? Math.min(100,(totalInstalled/totalSuggested)*100) : 0;

  const btnStyle = (bg, color='#fff', border=bg) => ({ display:'flex', alignItems:'center', gap:6, background:bg, border:`1px solid ${border}`, borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, color, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' });
  const pageShell = { background:'#f4f7fb', margin:'-8px', padding:'12px', minHeight:'calc(100vh - 90px)' };
  const panelStyle = { background:'#fff', border:'1px solid #d9e2ef', borderRadius:14, boxShadow:'0 10px 28px rgba(15,23,42,0.06)' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:800, color:'#475569', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 };
  const thStyle = { background:'#eaf2ff', color:'#1e3a5f', fontWeight:800, fontSize:12, padding:'10px 14px', textAlign:'left', whiteSpace:'nowrap', borderBottom:'1px solid #cfe0ff', position:'sticky', top:0, zIndex:2 };

  const noLevels     = projectId && !loading && levels.length === 0;
  const noAllocation = projectId && !loading && levels.length > 0 && allocatedRows.length === 0 && rows.length > 0;

  return (
    <div style={pageShell}>
      <style>{`
        .tx-table { border-collapse: separate !important; border-spacing: 0; }
        .tx-table td { border-bottom: 1px solid #edf2f7; }
        .tx-table tbody tr:hover td { background: #f8fbff !important; }
        .tx-table input[type="number"], .tx-table input[type="text"] {
          width: 100%; height: 30px; border: 1px solid #d9e2ef; border-radius: 7px;
          padding: 4px 8px; font-size: 12px; outline: none; background: #fff;
        }
        .tx-table input:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.10); }
        @media (max-width: 1100px) {
          .installation-filter-grid { grid-template-columns: 1fr 1fr !important; }
          .table-wrapper { max-height: none !important; }
        }
        @media (max-width: 720px) {
          .installation-filter-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Compact professional transaction header */}
      <div style={{ ...panelStyle, padding:'10px 12px', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#1f3a5f,#2563eb)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>🔧</div>
          <div style={{ minWidth:190, flex:'1 1 240px' }}>
            <h1 style={{ fontSize:16, fontWeight:800, color:'#0f172a', margin:0, letterSpacing:'-0.2px' }}>{t.installation}</h1>
            <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Daily installation entry by project, date, level and item allocation.</div>
          </div>

          {projectId && (
            <Space size={8} wrap>
              <Button size="middle" onClick={() => setShowLevelModal(true)}>
                {levels.length > 0 ? `Levels (${levels.length})` : 'Setup Levels'}
              </Button>
              {levels.length > 0 && (
                <Button size="middle" type="primary" ghost onClick={() => setShowAllocModal(true)}>
                  Suggested QTY
                </Button>
              )}
            </Space>
          )}
        </div>
      </div>

      {/* Advanced filter workspace */}
      <div style={{ ...panelStyle, padding:12, marginBottom:10 }}>
        <div className="installation-filter-grid" style={{ display:'grid', gridTemplateColumns:'minmax(280px, 2fr) 155px minmax(160px, 1fr) minmax(150px, 1fr) minmax(220px, 1.5fr) auto', gap:10, alignItems:'end' }}>
          <div>
            <label style={labelStyle}>{t.selectProject}</label>
            <Select
              showSearch
              value={projectId || undefined}
              placeholder={`— ${t.selectProject} —`}
              optionFilterProp="label"
              style={{ width:'100%' }}
              onChange={(value) => { setProjectId(value || ''); setFilterLevel(''); setFilterStatus(''); setSearch(''); setPage(1); }}
              allowClear
              options={projects.map(p => ({ value:String(p.id), label:projectLabel(p) }))}
            />
          </div>

          <div>
            <label style={labelStyle}>{t.selectDate}</label>
            <input
              type="date"
              value={date}
              onChange={e => { if (isFriday(e.target.value)) { toast('Friday is a holiday','error'); return; } setDate(e.target.value); }}
              style={{ width:'100%', height:32, border:'1px solid #d9d9d9', borderRadius:6, padding:'4px 10px', fontSize:14, color:'#0f172a', background:'#fff' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Level</label>
            <Select
              value={filterLevel || undefined}
              placeholder="All Levels"
              style={{ width:'100%' }}
              disabled={!projectId || levels.length === 0}
              allowClear
              showSearch
              optionFilterProp="label"
              onChange={(value) => { setFilterLevel(value || ''); setPage(1); }}
              options={levels.map(lv => ({ value:String(lv.id), label:`${lv.level_code} — ${lv.level_name}` }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <Select
              value={filterStatus || undefined}
              placeholder="All Status"
              style={{ width:'100%' }}
              disabled={!projectId}
              allowClear
              onChange={(value) => { setFilterStatus(value || ''); setPage(1); }}
              options={[
                { value:'incomplete', label:'Incomplete' },
                { value:'saved', label:'Saved' },
                { value:'confirmed', label:'Approved' },
                { value:'no_entry', label:'No Entry' },
              ]}
            />
          </div>

          <div>
            <label style={labelStyle}>Smart Search</label>
            <Input.Search
              allowClear
              value={search}
              disabled={!projectId}
              placeholder="Search item code or item name..."
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            {projectId && date && <RefreshButton onRefresh={load} />}
          </div>
        </div>

        {projectId && (
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', borderTop:'1px solid #eef2f7', marginTop:12, paddingTop:10 }}>
            <Tag color="blue">Visible: {totalFiltered}</Tag>
            <Tag color={overallPct >= 100 ? "green" : "processing"}>Overall Progress: {overallPct.toFixed(1)}%</Tag>
            <Tag>Total: {allocatedRows.length}</Tag>
            {filterLevel && <Tag closable onClose={() => setFilterLevel('')}>Level filter</Tag>}
            {filterStatus && <Tag closable onClose={() => setFilterStatus('')}>Status: {filterStatus}</Tag>}
            {search && <Tag closable onClose={() => setSearch('')}>Search: {search}</Tag>}
            <div style={{ flex:1 }} />
            {incompleteCount > 0 && <Badge count={incompleteCount} style={{ backgroundColor:'#f97316' }}><Tag color="orange">Incomplete</Tag></Badge>}
            {savedCount > 0 && <Badge count={savedCount} style={{ backgroundColor:'#7c3aed' }}><Tag color="purple">Saved</Tag></Badge>}
            {confirmedCount > 0 && <Badge count={confirmedCount} style={{ backgroundColor:'#16a34a' }}><Tag color="green">Approved</Tag></Badge>}
          </div>
        )}
      </div>

      {/* Compact tab switch — placed below filters so project/date/advanced selection stays first */}
      {projectId && (
        <div style={{ display:'flex', gap:6, marginBottom:10, alignItems:'center', borderBottom:'1px solid #dbe7f7', paddingBottom:8 }}>
          {[
            { id:'entry', label:'Daily Entry' },
            { id:'map',   label:'Installation Map' },
          ].map(tab => (
            <Button
              key={tab.id}
              size="middle"
              type={activeTab===tab.id ? 'primary' : 'default'}
              onClick={() => setActiveTab(tab.id)}
              style={{ borderRadius:9, fontWeight:700 }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      )}
      {activeTab === 'entry' && <>
      {/* Setup prompts */}
      {!projectId && <div className="empty-state"><div className="empty-icon">🔧</div><p>{t.selectProject}</p></div>}
      {loading    && <div className="spinner-wrap"><div className="spinner" /></div>}

      {noLevels && (
        <div className="empty-state">
          <div className="empty-icon">🏢</div>
          <p style={{ marginBottom:12 }}>No levels defined yet for this project.</p>
          <button onClick={() => setShowLevelModal(true)} style={{ background:'#2563eb', border:'none', borderRadius:10, padding:'10px 24px', fontSize:14, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            Setup Levels / Floors
          </button>
        </div>
      )}

      {noAllocation && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p style={{ marginBottom:12 }}>Levels are set up. Now allocate Suggested QTY per item per level.</p>
          <button onClick={() => setShowAllocModal(true)} style={{ background:'#2563eb', border:'none', borderRadius:10, padding:'10px 24px', fontSize:14, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            Set Suggested QTY Allocation
          </button>
        </div>
      )}

      {/* Daily entry context strip */}
      {!loading && allocatedRows.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:10, padding:'8px 12px', background:'#eaf2ff', border:'1px solid #cfe0ff', borderRadius:12, color:'#1e3a5f', fontSize:12 }}>
          <strong>Daily Entry Mode</strong>
          <span>Suggested: {fmt2(totalSuggested)}</span>
          <span>Installed: {fmt2(totalInstalled)}</span>
          <span>Remaining: {fmt2(totalRemaining)}</span>
          <span>Today: {fmt2(totalToday)}</span>
          <span style={{ display:'flex', alignItems:'center', gap:6, minWidth:190 }}>
            <strong>Overall: {overallPct.toFixed(1)}%</strong>
            <span style={{ flex:1, height:7, background:'#dbeafe', borderRadius:99, overflow:'hidden' }}>
              <span style={{ display:'block', height:'100%', width:`${overallPct}%`, background:overallPct>=100?'#16a34a':'#2563eb', borderRadius:99 }} />
            </span>
          </span>
          <span style={{ marginLeft:'auto', color:'#475569', fontWeight:400 }}>Filters narrow the tree without changing your original item/level structure.</span>
        </div>
      )}

      {/* Main table */}
      {!loading && allocatedRows.length > 0 && (
        <div style={{ ...panelStyle, overflow:'hidden' }}>
          <div className="table-wrapper" style={{ overflowX:'auto', overflowY:'visible' }}>
            <table className="tx-table" style={{ width:'100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Item Code</th>
                  <th style={thStyle}>Item Name / Level</th>
                  <th style={thStyle}>Unit</th>
                  <th style={{ ...thStyle, textAlign:'right' }}>Suggested QTY</th>
                  <th style={{ ...thStyle, textAlign:'right' }}>Installed</th>
                  <th style={{ ...thStyle, textAlign:'right' }}>Remaining</th>
                  <th style={{ ...thStyle, minWidth:110 }}>Progress</th>
                  <th style={{ ...thStyle, minWidth:110 }}>Install Qty</th>
                  <th style={{ ...thStyle, minWidth:140 }}>Notes</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([group, itemsMap]) => (
                  <>
                    {/* Classification group header */}
                    <tr key={`g-${group}`}>
                      <td colSpan={10} style={{ background:'#f1f6ff', padding:'7px 14px', fontSize:12, fontWeight:700, color:'#2563eb', letterSpacing:'0.04em' }}>{group}</td>
                    </tr>

                    {Object.entries(itemsMap).map(([itemId, { meta, levels: itemLevels }]) => {
                      const totalSug = itemLevels.reduce((s,r) => s+(r.suggested_qty||0), 0);
                      const totalInst= itemLevels.reduce((s,r) => s+(parseFloat(r.total_installed)||0), 0);
                      // Live: add today's typed qty for non-confirmed rows
                      const liveInst = itemLevels.reduce((s,r) => {
                        const base = parseFloat(r.total_installed)||0;
                        const live = r.tx_status==='confirmed' ? base : base + (parseFloat(r.qty_input)||0);
                        return s + live;
                      }, 0);
                      const itemPct  = totalSug > 0 ? Math.min(100,(liveInst/totalSug)*100) : 0;
                      return (
                        <>
                          {/* Item summary row */}
                          <tr key={`item-${itemId}`} style={{ background:'#f8fbff', borderBottom:'1px solid #e7eefb' }}>
                            <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600, color:'#6b7280', fontFamily:'monospace' }}>{meta.item_code}</td>
                            <td style={{ padding:'10px 14px', fontSize:13, fontWeight:700, color:'#111827' }}>{meta.item_name}</td>
                            <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{meta.unit_of_measure||'—'}</td>
                            <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color:'#111827' }}>{fmt2(totalSug)}</td>
                            <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color:'#111827' }}>{fmt2(totalInst)}</td>
                            <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color: totalInst>=totalSug&&totalSug>0?'#16a34a':'#111827' }}>
                              {totalInst>=totalSug&&totalSug>0 ? '✓ Done' : fmt2(Math.max(0,totalSug-totalInst))}
                            </td>
                            <td colSpan={4} style={{ padding:'10px 14px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:80 }}>
                                  <div style={{ height:'100%', borderRadius:99, width:`${itemPct}%`, background:itemPct>=100?'#16a34a':'#2563eb', transition:'width 0.3s' }} />
                                </div>
                                <span style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap', fontWeight:600 }}>{itemPct.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>

                          {/* Level rows */}
                          {itemLevels.map((row, ri) => {
                            const suggested   = row.suggested_qty || 0;
                            const installed   = parseFloat(row.total_installed) || 0;
                            const remaining   = Math.max(0, suggested - installed);
                            const isConfirmed = row.tx_status === 'confirmed';
                            const todayInst   = parseFloat(row.qty_input) || 0;
                            // Live progress: confirmed installed + current input (if not yet confirmed)
                            const liveInstalled = isConfirmed ? installed : installed + todayInst;
                            const pct         = suggested > 0 ? Math.min(100,(liveInstalled/suggested)*100) : 0;
                            return (
                              <tr key={`${itemId}-${row.level_id}`} style={{ borderBottom:'1px solid #f3f4f6', background: ri%2===0?'#fff':'#fafbff' }}>
                                <td style={{ padding:'8px 14px 8px 28px', fontSize:11, color:'#9ca3af' }}>
                                  <span style={{ background:'#eaf2ff', color:'#2563eb', borderRadius:5, padding:'2px 7px', fontSize:11, fontWeight:700 }}>{row.level_code}</span>
                                </td>
                                <td style={{ padding:'8px 14px', fontSize:12, color:'#6b7280' }}>{row.level_name}</td>
                                {/* FIX 2: show item unit on level rows */}
                                <td style={{ padding:'8px 14px', fontSize:11, color:'#9ca3af' }}>{meta.unit_of_measure||'—'}</td>
                                <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color:'#111827' }}>{fmt2(suggested)}</td>
                                <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color:'#111827' }}>{fmt2(installed)}</td>
                                <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color: installed>=suggested&&suggested>0?'#16a34a':'#111827' }}>
                                  {installed>=suggested&&suggested>0 ? '✓' : fmt2(remaining)}
                                </td>
                                <td style={{ padding:'8px 14px' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                    <div style={{ flex:1, height:5, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:50 }}>
                                      <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background:pct>=100?'#16a34a':'#2563eb' }} />
                                    </div>
                                    <span style={{ fontSize:10, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{pct.toFixed(0)}%</span>
                                  </div>
                                </td>
                                <td style={{ padding:'6px 8px' }}>
                                  {/* FIX 1: cap input at remaining qty */}
                                  <input type="number" min="0" step="0.01" value={row.qty_input} disabled={isConfirmed}
                                    style={{
                                      background: isConfirmed ? 'var(--bg2)' : '#fff',
                                      borderColor: !isConfirmed && parseFloat(row.qty_input) > remaining + (parseFloat(row.qty_input)||0) ? '#f97316' : undefined,
                                    }}
                                    onChange={e => {
                                      const typed = parseFloat(e.target.value) || 0;
                                      // Cap at remaining (suggested − confirmed installed)
                                      if (typed > remaining) {
                                        setField(row.item_id, row.level_id, 'qty_input', remaining.toFixed(2));
                                      } else {
                                        setField(row.item_id, row.level_id, 'qty_input', e.target.value);
                                      }
                                    }}
                                    onBlur={e => {
                                      const v = parseFloat(e.target.value);
                                      if (!isNaN(v)) {
                                        setField(row.item_id, row.level_id, 'qty_input', Math.min(v, remaining).toFixed(2));
                                      } else if (e.target.value === '') {
                                        setField(row.item_id, row.level_id, 'qty_input', '');
                                      }
                                    }} />
                                </td>
                                <td style={{ padding:'6px 8px' }}>
                                  <input type="text" value={row.notes_input} disabled={isConfirmed}
                                    placeholder="Notes..." style={{ background:isConfirmed?'var(--bg2)':'#fff' }}
                                    onChange={e => setField(row.item_id, row.level_id, 'notes_input', e.target.value)} />
                                </td>
                                <td style={{ padding:'8px 14px' }}>
                                  <StatusBadge status={row.tx_id ? row.tx_status : null} />
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    })}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'#e8f1ff', borderTop:'2px solid #b8cff7' }}>
                  <td colSpan={3} style={{ padding:'10px 14px', fontSize:12, fontWeight:700, color:'#111827' }}>TOTAL — {totalFiltered} rows</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color:'#111827' }}>{fmt2(totalSuggested)}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color:'#111827' }}>{fmt2(totalInstalled)}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color:'#111827' }}>{fmt2(totalRemaining)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ flex:1, height:7, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:50 }}>
                        <div style={{ height:'100%', borderRadius:99, width:`${overallPct}%`, background:overallPct>=100?'#16a34a':'#2563eb' }} />
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:'#111827' }}>{overallPct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'10px 14px', fontWeight:700, color:'#111827' }}>{fmt2(totalToday)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display:'flex', alignItems:'center', padding:'12px 18px', borderTop:'1px solid #f3f4f6', gap:8 }}>
            <span style={{ fontSize:12, color:'#6b7280' }}><strong style={{ color:'#111827' }}>{totalFiltered}</strong> rows</span>
            <div style={{ display:'flex', gap:4, flex:1, justifyContent:'center' }}>
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ minWidth:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:page===1?'not-allowed':'pointer', opacity:page===1?0.4:1, fontFamily:'inherit' }}>‹</button>
              {Array.from({length:Math.min(5,totalPages)},(_,i)=>i+1).map(p=>(
                <button key={p} onClick={()=>setPage(p)} style={{ minWidth:32, height:32, borderRadius:8, border:p===page?'1.5px solid #2563eb':'1px solid #e5e7eb', background:p===page?'#2563eb':'#fff', color:p===page?'#fff':'#374151', fontWeight:p===page?700:400, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>{p}</button>
              ))}
              <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ minWidth:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:page===totalPages?'not-allowed':'pointer', opacity:page===totalPages?0.4:1, fontFamily:'inherit' }}>›</button>
            </div>
            <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}} style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              {[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Action bar */}
          <div style={{ padding:'14px 18px', borderTop:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', background:'var(--card2)' }}>
            <div style={{ marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap' }}>
              {showWorkflow && (
                <>
                  <button onClick={handleDraft} disabled={saving} style={btnStyle('var(--card)','var(--text)','var(--border)')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    {saving ? t.saving : 'Draft'}
                  </button>
                  <button onClick={handleSave} disabled={saving} style={btnStyle('#2563eb')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    {saving ? t.saving : 'Save'}
                  </button>
                  {savedCount > 0 && (
                    <button onClick={handleApprove} disabled={confirming} style={btnStyle('#16a34a')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      {confirming ? t.saving : 'Approve'}
                    </button>
                  )}
                </>
              )}
              {canUnpost && (
                <button onClick={handleUnpost} disabled={unposting} style={btnStyle('#dc2626')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                  {unposting ? 'Unposting...' : 'Unpost'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      </> /* end entry tab */}

      {/* Map tab */}
      {activeTab === 'map' && projectId && (
        <InstallationMap
          projectId={projectId}
          data={mapData}
          loading={mapLoading}
          onRefresh={loadMap}
        />
      )}

      {/* Modals */}
      {showLevelModal && (
        <LevelSetupModal projectId={projectId} onClose={() => setShowLevelModal(false)} onSaved={savedLevels => { setLevels(savedLevels); load(); }} />
      )}
      {showAllocModal && (
        <AllocationModal projectId={projectId} levels={levels} items={planItems} onClose={() => setShowAllocModal(false)} onSaved={() => load()} />
      )}
    </div>
  );
}

// ── Installation Map Component ────────────────────────────────────────────────
function InstallationMap({ projectId, data, loading, onRefresh }) {
  const [search,      setSearch]      = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [viewMode,    setViewMode]    = useState('by-item'); // 'by-item' | 'by-level'

  if (!projectId) return <div className="empty-state"><div className="empty-icon">🗺️</div><p>Select a project to view the installation map</p></div>;
  if (loading)    return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!data)      return <div className="empty-state"><div className="empty-icon">🗺️</div><p>Loading map...</p></div>;

  const { items = [], levels = [], allocs = [], txs = [] } = data;

  if (levels.length === 0) return (
    <div className="empty-state"><div className="empty-icon">🏢</div><p>No levels defined. Set up levels in Daily Entry first.</p></div>
  );
  if (txs.length === 0) return (
    <div className="empty-state"><div className="empty-icon">📅</div><p>No installation entries recorded yet for this project.</p></div>
  );

  const fmt2 = v => (parseFloat(v)||0).toFixed(2);

  // All unique dates sorted
  const allDates = [...new Set(txs.map(t => t.transaction_date))].sort();

  // Alloc map: item_id → level_id → suggested_qty
  const allocMap = {};
  allocs.forEach(a => {
    if (!allocMap[a.item_id]) allocMap[a.item_id] = {};
    allocMap[a.item_id][a.level_id] = parseFloat(a.suggested_qty) || 0;
  });

  // Tx map: item_id → level_id → date → { qty, status }
  const txMap = {};
  txs.forEach(t => {
    if (!txMap[t.item_id]) txMap[t.item_id] = {};
    if (!txMap[t.item_id][t.level_id]) txMap[t.item_id][t.level_id] = {};
    txMap[t.item_id][t.level_id][t.transaction_date] = {
      qty: parseFloat(t.qty_installed) || 0,
      status: t.tx_status,
    };
  });

  // Total installed per item+level
  const totalMap = {};
  txs.filter(t => t.tx_status === 'confirmed').forEach(t => {
    const k = `${t.item_id}_${t.level_id}`;
    totalMap[k] = (totalMap[k] || 0) + (parseFloat(t.qty_installed) || 0);
  });

  // Status colour helper
  const statusDotMap = {
    confirmed:  { bg:'#dcfce7', color:'#16a34a', dot:'#16a34a', label:'A' },
    saved:      { bg:'#f5f3ff', color:'#2563eb', dot:'#7c3aed', label:'S' },
    incomplete: { bg:'#fff7ed', color:'#ea580c', dot:'#ea580c', label:'D' },
  };
  const statusDot = (status) => statusDotMap[status] || { bg:'#f3f4f6', color:'#9ca3af', dot:'#9ca3af', label:'?' };

  const formatDate = d => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
  };
  const formatDateFull = d => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  };

  // Filter dates by selected level
  const activeLevelId = filterLevel ? parseInt(filterLevel) : null;
  const visibleDates = activeLevelId
    ? allDates.filter(d => txs.some(t => t.level_id === activeLevelId && t.transaction_date === d))
    : allDates;

  // Filter items by search
  let visibleItems = items.filter(item => Object.values(allocMap[item.item_id]||{}).some(q => q > 0));
  if (search.trim()) {
    const q = search.toLowerCase();
    visibleItems = visibleItems.filter(i => (i.item_code||'').toLowerCase().includes(q) || (i.item_name||'').toLowerCase().includes(q));
  }

  // Summary stats
  const totalAllocated = allocs.reduce((s,a) => s + (parseFloat(a.suggested_qty)||0), 0);
  const totalInstalled = Object.values(totalMap).reduce((s,v) => s + v, 0);
  const activeDays     = allDates.length;
  const overallPct     = totalAllocated > 0 ? Math.min(100, (totalInstalled/totalAllocated)*100) : 0;

  const thBase = { background:'#e8f1ff', color:'#111827', fontWeight:700, fontSize:11, padding:'9px 10px', textAlign:'left', borderBottom:'1px solid #e0ecff', whiteSpace:'nowrap', letterSpacing:'0.02em' };

  // ── BY-ITEM view: rows = item+level pairs, columns = dates ─────────────────
  const renderByItem = () => (
    <div style={{ overflowX:'auto' }}>
      <table style={{ borderCollapse:'collapse', fontSize:12, minWidth:'100%' }}>
        <thead>
          <tr>
            <th style={{ ...thBase, minWidth:70, position:'sticky', left:0, zIndex:3, background:'#e8f1ff' }}>Code</th>
            <th style={{ ...thBase, minWidth:170, position:'sticky', left:70, zIndex:3, background:'#e8f1ff' }}>Item / Level</th>
            <th style={{ ...thBase, textAlign:'center', minWidth:55 }}>Unit</th>
            <th style={{ ...thBase, textAlign:'right', minWidth:75 }}>Suggested</th>
            <th style={{ ...thBase, textAlign:'right', minWidth:75 }}>Installed</th>
            <th style={{ ...thBase, textAlign:'center', minWidth:80 }}>Progress</th>
            {visibleDates.map(d => (
              <th key={d} style={{ ...thBase, textAlign:'center', minWidth:68, color:'#2563eb', borderLeft:'1px solid #e0ecff' }}>
                <div>{formatDate(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item, iIdx) => {
            const itemLevels = levels.filter(lv => (allocMap[item.item_id]?.[lv.id] || 0) > 0);
            if (activeLevelId) {
              // filter to selected level only
              const lv = itemLevels.find(l => l.id === activeLevelId);
              if (!lv) return null;
            }
            const shownLevels = activeLevelId ? itemLevels.filter(l => l.id === activeLevelId) : itemLevels;

            // Item summary
            const itemSugg  = shownLevels.reduce((s,lv) => s + (allocMap[item.item_id]?.[lv.id]||0), 0);
            const itemInst  = shownLevels.reduce((s,lv) => s + (totalMap[`${item.item_id}_${lv.id}`]||0), 0);
            const itemPct   = itemSugg > 0 ? Math.min(100,(itemInst/itemSugg)*100) : 0;
            const bg        = iIdx%2===0 ? '#fafbff' : '#fff';

            return (
              <>
                {/* Item header row */}
                <tr key={`item-${item.item_id}`} style={{ background:'#f5f3ff' }}>
                  <td style={{ padding:'9px 10px', fontFamily:'monospace', fontSize:11, color:'#2563eb', fontWeight:700, position:'sticky', left:0, background:'#f5f3ff', zIndex:1 }}>{item.item_code}</td>
                  <td style={{ padding:'9px 10px', fontWeight:700, color:'#4c1d95', fontSize:13, position:'sticky', left:70, background:'#f5f3ff', zIndex:1 }}>{item.item_name}</td>
                  <td style={{ padding:'9px 10px', textAlign:'center', color:'#2563eb', fontSize:11 }}>{item.unit_of_measure||'—'}</td>
                  <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:700, color:'#111827' }}>{fmt2(itemSugg)}</td>
                  <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:700, color: itemInst>=itemSugg&&itemSugg>0?'#16a34a':'#111827' }}>{fmt2(itemInst)}</td>
                  <td style={{ padding:'9px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ flex:1, height:7, background:'#ddd6fe', borderRadius:99, overflow:'hidden', minWidth:50 }}>
                        <div style={{ height:'100%', borderRadius:99, width:`${itemPct}%`, background: itemPct>=100?'#16a34a':'#7c3aed', transition:'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, color:'#2563eb', minWidth:32 }}>{itemPct.toFixed(0)}%</span>
                    </div>
                  </td>
                  {visibleDates.map(d => {
                    const dayTotal = shownLevels.reduce((s,lv) => s + (txMap[item.item_id]?.[lv.id]?.[d]?.qty||0), 0);
                    const dayStatus = shownLevels.map(lv => txMap[item.item_id]?.[lv.id]?.[d]?.status).filter(Boolean);
                    const bestStatus = dayStatus.includes('confirmed') ? 'confirmed' : dayStatus.includes('saved') ? 'saved' : dayStatus[0];
                    const cfg = statusDot(bestStatus);
                    return (
                      <td key={d} style={{ padding:'7px 8px', textAlign:'center', borderLeft:'1px solid #ede9fe', background: dayTotal>0?cfg.bg:'transparent' }}>
                        {dayTotal > 0 ? (
                          <div title={`${formatDateFull(d)}: ${fmt2(dayTotal)}`}>
                            <div style={{ fontWeight:700, color:'#111827', fontSize:12 }}>{fmt2(dayTotal)}</div>
                            <div style={{ fontSize:9, color:cfg.color, fontWeight:700 }}>{cfg.label}</div>
                          </div>
                        ) : <span style={{ color:'#e5e7eb', fontSize:14 }}>·</span>}
                      </td>
                    );
                  })}
                </tr>

                {/* Level rows */}
                {shownLevels.map((lv, lvIdx) => {
                  const sugg  = allocMap[item.item_id]?.[lv.id] || 0;
                  const inst  = totalMap[`${item.item_id}_${lv.id}`] || 0;
                  const pct   = sugg > 0 ? Math.min(100,(inst/sugg)*100) : 0;
                  return (
                    <tr key={`${item.item_id}-${lv.id}`} style={{ borderBottom:'1px solid #f3f4f6', background: lvIdx%2===0?bg:'#fff' }}>
                      <td style={{ padding:'8px 10px 8px 20px', position:'sticky', left:0, background: lvIdx%2===0?bg:'#fff', zIndex:1 }}>
                        <span style={{ background:'#eaf2ff', color:'#2563eb', borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{lv.level_code}</span>
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:12, color:'#6b7280', position:'sticky', left:70, background: lvIdx%2===0?bg:'#fff', zIndex:1 }}>{lv.level_name}</td>
                      <td style={{ padding:'8px 10px', textAlign:'center', fontSize:11, color:'#9ca3af' }}>—</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontSize:12, color:'#374151' }}>{fmt2(sugg)}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontSize:12, fontWeight:600, color: inst>=sugg&&sugg>0?'#16a34a':'#374151' }}>
                        {inst>=sugg&&sugg>0?'✓ ':''}{fmt2(inst)}
                      </td>
                      <td style={{ padding:'8px 10px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <div style={{ flex:1, height:4, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:40 }}>
                            <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background:pct>=100?'#16a34a':'#2563eb' }} />
                          </div>
                          <span style={{ fontSize:10, color:'#6b7280', minWidth:28 }}>{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      {visibleDates.map(d => {
                        const entry = txMap[item.item_id]?.[lv.id]?.[d];
                        const cfg   = statusDot(entry?.status);
                        return (
                          <td key={d} style={{ padding:'6px 8px', textAlign:'center', borderLeft:'1px solid #f3f4f6', background: entry?cfg.bg:'transparent' }}>
                            {entry ? (
                              <div title={`${lv.level_code} · ${formatDateFull(d)}\n${fmt2(entry.qty)} ${item.unit_of_measure||''}\nStatus: ${entry.status}`}>
                                <div style={{ fontWeight:600, color:'#111827', fontSize:12 }}>{fmt2(entry.qty)}</div>
                                <div style={{ fontSize:9, color:cfg.color, fontWeight:700 }}>{cfg.label}</div>
                              </div>
                            ) : <span style={{ color:'#f0f0f0', fontSize:14 }}>·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
        {/* Date totals footer */}
        <tfoot>
          <tr style={{ background:'#e8f1ff', borderTop:'2px solid #b8cff7' }}>
            <td colSpan={5} style={{ padding:'10px 10px', fontWeight:700, fontSize:12, color:'#111827', position:'sticky', left:0, background:'#e8f1ff' }}>DAILY TOTAL</td>
            <td style={{ padding:'10px 10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:40 }}>
                  <div style={{ height:'100%', borderRadius:99, width:`${overallPct}%`, background:overallPct>=100?'#16a34a':'#2563eb' }} />
                </div>
                <span style={{ fontSize:11, fontWeight:700, color:'#2563eb' }}>{overallPct.toFixed(1)}%</span>
              </div>
            </td>
            {visibleDates.map(d => {
              const dayTotal = txs.filter(t => t.transaction_date===d && (!activeLevelId || t.level_id===activeLevelId)).reduce((s,t) => s+(parseFloat(t.qty_installed)||0), 0);
              return (
                <td key={d} style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:'#2563eb', borderLeft:'1px solid #e0ecff', fontSize:12 }}>
                  {dayTotal > 0 ? fmt2(dayTotal) : <span style={{ color:'#e5e7eb' }}>—</span>}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div>
      {/* Installation Map compact workspace */}
      <div style={{ background:'#fff', border:'1px solid #d9e2ef', borderRadius:14, boxShadow:'0 10px 28px rgba(15,23,42,0.06)', padding:12, marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#1f3a5f,#2563eb)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🗺️</div>
          <div style={{ flex:'1 1 260px', minWidth:220 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', lineHeight:1.2 }}>Installation Map</div>
            <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Track installed quantities across levels and work dates without changing your original item structure.</div>
          </div>
          <Tag color="blue">Suggested: {fmt2(totalAllocated)}</Tag>
          <Tag color="green">Installed: {fmt2(totalInstalled)}</Tag>
          <Tag color="processing">Overall: {overallPct.toFixed(1)}%</Tag>
          <Tag>Days: {activeDays}</Tag>
          <Tag>Levels: {levels.length}</Tag>
        </div>
        <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ flex:'1 1 260px', minWidth:220 }}>
            <Input.Search
              allowClear
              value={search}
              placeholder="Search item code or item name..."
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={filterLevel || undefined}
            placeholder="All Levels"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width:210 }}
            onChange={(value) => setFilterLevel(value || '')}
            options={levels.map(lv => ({ value:String(lv.id), label:`${lv.level_code} — ${lv.level_name}` }))}
          />
          <Button onClick={onRefresh}>Refresh</Button>
          <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', fontSize:11, color:'#64748b' }}>
            <Tag color="green">A Approved</Tag>
            <Tag color="blue">S Saved</Tag>
            <Tag color="orange">D Draft</Tag>
            <span style={{ color:'#94a3b8' }}>· = No entry</span>
          </div>
        </div>
      </div>

      {/* Date header strip — visual calendar */}
      {visibleDates.length > 0 && (
        <div style={{ display:'flex', gap:4, marginBottom:14, overflowX:'auto', paddingBottom:4 }}>
          <div style={{ fontSize:11, color:'#475569', fontWeight:700, minWidth:80, alignSelf:'center', flexShrink:0 }}>Work days:</div>
          {visibleDates.map(d => {
            const dt = new Date(d + 'T00:00:00');
            const dayName = dt.toLocaleDateString('en-GB', { weekday:'short' });
            const dayNum  = dt.toLocaleDateString('en-GB', { day:'2-digit' });
            const month   = dt.toLocaleDateString('en-GB', { month:'short' });
            const dayTxs  = txs.filter(t => t.transaction_date===d && (!activeLevelId||t.level_id===activeLevelId));
            const hasEntry = dayTxs.length > 0;
            const allConfirmed = hasEntry && dayTxs.every(t => t.tx_status==='confirmed');
            const hasSaved = hasEntry && dayTxs.some(t => t.tx_status==='saved');
            return (
              <div key={d} title={formatDateFull(d)} style={{
                flexShrink:0, background: allConfirmed?'#dcfce7':hasSaved?'#eaf2ff':hasEntry?'#fff7ed':'var(--card)',
                border: `1.5px solid ${allConfirmed?'#bbf7d0':hasSaved?'#cfe0ff':hasEntry?'#fed7aa':'#e5e7eb'}`,
                borderRadius:8, padding:'6px 10px', textAlign:'center', minWidth:50, cursor:'default',
              }}>
                <div style={{ fontSize:9, color:'#9ca3af', fontWeight:500, textTransform:'uppercase' }}>{dayName}</div>
                <div style={{ fontSize:15, fontWeight:700, color: allConfirmed?'#16a34a':hasSaved?'#2563eb':hasEntry?'#ea580c':'#d1d5db', lineHeight:1.2 }}>{dayNum}</div>
                <div style={{ fontSize:9, color:'#9ca3af' }}>{month}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main matrix table */}
      <div style={{ background:'#fff', border:'1px solid #d9e2ef', borderRadius:14, overflow:'hidden', boxShadow:'0 10px 28px rgba(15,23,42,0.05)' }}>
        {renderByItem()}
      </div>

      {/* Bottom note */}
      <div style={{ marginTop:12, fontSize:11, color:'#9ca3af', textAlign:'center' }}>
        Showing {visibleItems.length} item{visibleItems.length!==1?'s':''} × {levels.length} level{levels.length!==1?'s':''} × {visibleDates.length} work day{visibleDates.length!==1?'s':''}
      </div>
    </div>
  );
}