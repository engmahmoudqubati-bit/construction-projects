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
const qty = (v) => parseFloat(v) || 0;
const getItemPlanningQty = (row) => qty(row?.planned_qty ?? row?.boq_qty ?? row?.planning_qty ?? row?.total_planned_qty);
const getLevelPlanningQty = (row) => qty(row?.level_planned_qty ?? row?.planned_level_qty ?? row?.allocation_qty ?? row?.suggested_qty);
const sumUniquePlanned = (list = []) => {
  const seen = new Map();
  list.forEach((row) => {
    const key = row?.item_id ?? row?.item_code ?? row?.item_name;
    if (key == null) return;
    if (!seen.has(key)) seen.set(key, getItemPlanningQty(row));
  });
  return Array.from(seen.values()).reduce((s, v) => s + qty(v), 0);
};



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
function LevelSetupModal({ projectId, initialLevels = [], onClose, onSaved }) {
  const toast = useToast();
  const [levels, setLevels] = useState(() => Array.isArray(initialLevels) ? initialLevels : []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (Array.isArray(initialLevels) && initialLevels.length) setLevels(initialLevels);
    api.getInstallationLevels(projectId).then(data => {
      if (Array.isArray(data)) setLevels(data.length > 0 ? data : []);
    }).catch(() => {});
  }, [projectId, initialLevels]);

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
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.36)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card)', borderRadius:16, boxShadow:'0 24px 60px rgba(0,0,0,0.18)', width:'100%', maxWidth:560, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1f3a5f 0%,#2563eb 100%)', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Installation › Levels Setup</div>
            <div style={{ fontSize:17, fontWeight:700, color:'#fff' }}>Define Project Levels / Floors</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.18)', border:'none', color:'#fff', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding:20 }}>
          <p style={{ fontSize:12, color:'#6b7280', marginBottom:16 }}>
            Define the floors or basements for this project. Each level will receive a Planned QTY allocation per item.
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
          <button onClick={addLevel} style={{ display:'flex', alignItems:'center', gap:6, background:'#eff6ff', border:'1px solid #bfdbfe', color:'#2563eb', borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Level
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border-light)', display:'flex', justifyContent:'flex-end', gap:8, background:'var(--card2)' }}>
          <button onClick={onClose} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background:'linear-gradient(135deg,#1f3a5f,#2563eb)', border:'none', borderRadius:8, padding:'8px 20px', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 8px 18px rgba(37,99,235,0.22)' }}>
            {saving ? 'Saving...' : 'Save Levels'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Allocation Modal (Planned QTY per item per level) ───────────────────────
function AllocationModal({ projectId, levels, items, initialRows = [], onClose, onSaved }) {
  const toast = useToast();
  const buildInitialAlloc = useCallback(() => {
    const map = {};
    if (Array.isArray(initialRows)) {
      initialRows.forEach(r => {
        if (r && r.item_id != null && r.level_id != null && r.suggested_qty != null) {
          map[`${r.item_id}_${r.level_id}`] = fmt2(r.suggested_qty);
        }
      });
    }
    return map;
  }, [initialRows]);
  const [alloc, setAlloc] = useState(buildInitialAlloc);  // { 'itemId_levelId': qty }
  const [saving, setSaving] = useState(false);

  const [deliveredMap] = useState({});  // kept for old table compatibility; modal opening must not refresh page data

  useEffect(() => {
    // Show current screen values immediately. Do not call APIs here to avoid refreshing/reloading data when opening Planned QTY.
    setAlloc(buildInitialAlloc());
  }, [buildInitialAlloc]);

  function setQty(itemId, levelId, val, maxPlanned) {
    // Prevent total planned allocation across all levels from exceeding BOQ qty
    const parsed = parseFloat(val) || 0;
    const currentAlloc = Object.entries(alloc)
      .filter(([k]) => k.startsWith(`${itemId}_`) && k !== `${itemId}_${levelId}`)
      .reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
    if (maxPlanned > 0 && parsed + currentAlloc > maxPlanned) {
      const allowed = Math.max(0, maxPlanned - currentAlloc).toFixed(2);
      setAlloc(prev => ({ ...prev, [`${itemId}_${levelId}`]: allowed }));
      return;
    }
    setAlloc(prev => ({ ...prev, [`${itemId}_${levelId}`]: val }));
  }

  async function handleSave() {
    // Validate: each item's total planned allocation across all levels must equal BOQ qty
    const invalidItems = items.filter(item => {
      const planned = parseFloat(item.planned_qty) || 0;
      const allocated = levels.reduce((s,lv) => s+(parseFloat(alloc[`${item.item_id}_${lv.id}`])||0), 0);
      return Math.abs(allocated - planned) > 0.01;
    });
    if (invalidItems.length > 0) {
      toast(`${invalidItems.length} item(s) planned allocation must equal BOQ qty before saving`, 'error');
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
      toast('Planned QTY allocation saved');
      onSaved();
      onClose();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  const thS = { background:'#e8f1ff', color:'#111827', fontWeight:700, fontSize:11, padding:'8px 12px', textAlign:'left', borderBottom:'1px solid #e0ecff', whiteSpace:'nowrap' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.36)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 16px' }}>
      <div style={{ background:'var(--card)', borderRadius:16, boxShadow:'0 24px 60px rgba(0,0,0,0.18)', width:'100%',
        maxWidth: levels.length <= 3 ? 860 : levels.length <= 6 ? 1100 : '96vw',
        maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1f3a5f 0%,#2563eb 100%)', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Installation › Planned QTY</div>
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
                const maxAlloc   = planned;  // allocation must equal BOQ planned qty
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
          <button onClick={handleSave} disabled={saving} style={{ background:'linear-gradient(135deg,#1f3a5f,#2563eb)', border:'none', borderRadius:8, padding:'8px 20px', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 8px 18px rgba(37,99,235,0.22)' }}>
            {saving ? 'Saving...' : 'Save Planned QTY'}
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
  const [pageSize,     setPageSize]     = useState(10);

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
      result = result.filter(r => [r.item_code, r.item_name, r.classification_name, r.parent_classification_name, r.class_name, r.parent_class_name].some(v => String(v || '').toLowerCase().includes(q))); 
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

  const totalPlanned  = sumUniquePlanned(filteredRows);
  const totalInstalled  = filteredRows.reduce((s,r) => s+(parseFloat(r.total_installed)||0), 0);
  const totalRemaining  = Math.max(0, totalPlanned - totalInstalled);
  const totalToday      = filteredRows.reduce((s,r) => s+(parseFloat(r.qty_input)||0), 0);
  const overallPct      = totalPlanned > 0 ? Math.min(100,(totalInstalled/totalPlanned)*100) : 0;


  function downloadExcelXml(filename, columns, dataRows, sheetName = 'Installation') {
    const xmlEscape = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const allRows = [
      columns,
      ...dataRows.map(row => columns.map(col => row[col] ?? '')),
    ];

    const columnWidths = columns.map((col, idx) => {
      const maxLen = Math.max(
        String(col).length,
        ...dataRows.map(row => String(row[col] ?? '').length)
      );
      return Math.min(Math.max(maxLen * 7, 80), 360);
    });

    const rowsXml = allRows.map((row, rowIndex) => (
      `<Row>${row.map((cell) => {
        const raw = cell ?? '';
        const numeric = raw !== '' && raw !== null && !Number.isNaN(Number(String(raw).replace(/,/g, '')));
        const style = rowIndex === 0 ? 'Header' : 'Default';
        const type = rowIndex === 0 || !numeric ? 'String' : 'Number';
        const data = type === 'Number' ? String(raw).replace(/,/g, '') : xmlEscape(raw);
        return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${data}</Data></Cell>`;
      }).join('')}</Row>`
    )).join('');

    const columnsXml = columnWidths.map(width => `<Column ss:AutoFitWidth="1" ss:Width="${width}"/>`).join('');

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/><Interior ss:Color="#EAF2FF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8CFF7"/></Borders></Style>
 </Styles>
 <Worksheet ss:Name="${xmlEscape(sheetName).slice(0, 31)}">
  <Table>${columnsXml}${rowsXml}</Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = filename.replace(/\.csv$/i, '.xls').replace(/\.xlsx$/i, '.xls');
    link.href = url;
    link.download = safeName.endsWith('.xls') ? safeName : `${safeName}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function getSelectedProjectName() {
    const project = projects.find(p => String(p.id) === String(projectId));
    return project ? projectLabel(project) : '';
  }

  function getWorkDaysForSelectedMonth() {
    const monthBase = date || new Date().toISOString().slice(0, 10);
    const [yy, mm] = monthBase.split('-').map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `${yy}-${String(mm).padStart(2, '0')}-${day}`;
    }).filter(d => new Date(d + 'T00:00:00').getDay() !== 5);
  }

  function handleExport() {
    if (!projectId) return toast('Please select a project first', 'error');

    if (activeTab === 'entry') {
      const columns = [
        'Project', 'Date', 'Classification', 'Parent Classification', 'Item Code', 'Item Name',
        'Level Code', 'Level Name', 'Unit', 'Planned QTY', 'Installed Qty', 'Remaining Qty',
        'Progress %', 'Today Qty', 'Status', 'Notes'
      ];
      const exportRows = filteredRows.map(r => {
        const planned = getLevelPlanningQty(r);
        const installed = parseFloat(r.total_installed) || 0;
        const progress = planned > 0 ? Math.min(100, (installed / planned) * 100) : 0;
        return {
          'Project': getSelectedProjectName(),
          'Date': date,
          'Classification': r.classification_name || '',
          'Parent Classification': r.parent_classification_name || '',
          'Item Code': r.item_code || '',
          'Item Name': r.item_name || '',
          'Level Code': r.level_code || '',
          'Level Name': r.level_name || '',
          'Unit': r.unit_of_measure || '',
          'Planned QTY': fmt2(planned),
          'Installed Qty': fmt2(installed),
          'Remaining Qty': fmt2(Math.max(0, planned - installed)),
          'Progress %': progress.toFixed(1),
          'Today Qty': r.qty_input === '' ? '' : fmt2(r.qty_input),
          'Status': r.tx_status || 'No Entry',
          'Notes': r.notes_input || '',
        };
      });
      downloadExcelXml(`installation_daily_entry_${date || 'export'}.xls`, columns, exportRows, 'Daily Entry');
      return;
    }

    if (!mapData) return toast('Open or refresh Installation Map before exporting', 'error');
    const { items = [], levels: mapLevels = [], allocs = [], txs = [] } = mapData;
    const selectedLevelId = filterLevel ? parseInt(filterLevel) : null;
    const workDays = getWorkDaysForSelectedMonth();

    const allocMap = {};
    allocs.forEach(a => {
      if (!allocMap[a.item_id]) allocMap[a.item_id] = {};
      allocMap[a.item_id][a.level_id] = parseFloat(a.suggested_qty) || 0;
    });

    const txMap = {};
    txs.forEach(t => {
      if (filterStatus && filterStatus !== 'no_entry' && t.tx_status !== filterStatus) return;
      if (!txMap[t.item_id]) txMap[t.item_id] = {};
      if (!txMap[t.item_id][t.level_id]) txMap[t.item_id][t.level_id] = {};
      txMap[t.item_id][t.level_id][t.transaction_date] = t;
    });

    let visibleItems = items.filter(item => Object.values(allocMap[item.item_id] || {}).some(q => q > 0));
    if (search.trim()) {
      const q = search.toLowerCase();
      visibleItems = visibleItems.filter(i => [
        i.item_code, i.item_name, i.classification_name, i.class_name,
        i.parent_classification_name, i.parent_class_name,
      ].some(v => String(v || '').toLowerCase().includes(q)));
    }
    if (selectedLevelId) {
      visibleItems = visibleItems.filter(item => (allocMap[item.item_id]?.[selectedLevelId] || 0) > 0 || txs.some(t => t.item_id === item.item_id && t.level_id === selectedLevelId));
    }
    if (filterStatus && filterStatus !== 'no_entry') {
      visibleItems = visibleItems.filter(item => txs.some(t => t.item_id === item.item_id && (!selectedLevelId || t.level_id === selectedLevelId) && t.tx_status === filterStatus));
    }

    const columns = [
      'Project', 'Month', 'Classification', 'Parent Classification', 'Item Code', 'Item Name',
      'Level Code', 'Level Name', 'Unit', 'Planned QTY', 'Installed Confirmed Qty', 'Progress %',
      ...workDays
    ];

    const exportRows = [];
    visibleItems.forEach(item => {
      let itemLevels = mapLevels.filter(lv => (allocMap[item.item_id]?.[lv.id] || 0) > 0);
      if (selectedLevelId) itemLevels = itemLevels.filter(lv => lv.id === selectedLevelId);
      itemLevels.forEach(lv => {
        const planned = allocMap[item.item_id]?.[lv.id] || 0;
        const installedConfirmed = txs
          .filter(t => t.item_id === item.item_id && t.level_id === lv.id && t.tx_status === 'confirmed')
          .reduce((sum, t) => sum + (parseFloat(t.qty_installed) || 0), 0);
        const hasAnyEntry = workDays.some(d => !!txMap[item.item_id]?.[lv.id]?.[d]);
        if (filterStatus === 'no_entry' && hasAnyEntry) return;
        if (filterStatus && filterStatus !== 'no_entry' && !hasAnyEntry) return;
        const progress = planned > 0 ? Math.min(100, (installedConfirmed / planned) * 100) : 0;
        const row = {
          'Project': getSelectedProjectName(),
          'Month': (date || '').slice(0, 7),
          'Classification': item.classification_name || item.class_name || '',
          'Parent Classification': item.parent_classification_name || item.parent_class_name || '',
          'Item Code': item.item_code || '',
          'Item Name': item.item_name || '',
          'Level Code': lv.level_code || '',
          'Level Name': lv.level_name || '',
          'Unit': item.unit_of_measure || '',
          'Planned QTY': fmt2(planned),
          'Installed Confirmed Qty': fmt2(installedConfirmed),
          'Progress %': progress.toFixed(1),
        };
        workDays.forEach(d => {
          const tx = txMap[item.item_id]?.[lv.id]?.[d];
          row[d] = tx ? `${fmt2(tx.qty_installed)} (${tx.tx_status || ''})` : '';
        });
        exportRows.push(row);
      });
    });

    downloadExcelXml(`installation_map_${(date || '').slice(0, 7) || 'export'}.xls`, columns, exportRows, 'Installation Map');
  }

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
            <Space size={8} wrap style={{ marginLeft:'auto', justifyContent:'flex-end' }}>
              <Button size="middle" onClick={handleExport} disabled={!projectId}>
                Export
              </Button>
              <Button size="middle" onClick={() => setShowLevelModal(true)}>
                {levels.length > 0 ? `Levels (${levels.length})` : 'Setup Levels'}
              </Button>
              {levels.length > 0 && (
                <Button size="middle" type="primary" ghost onClick={() => setShowAllocModal(true)}>
                  Planned QTY
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
            <label style={labelStyle}>Project</label>
            <Select
              showSearch
              value={projectId || undefined}
              placeholder="— Project —"
              optionFilterProp="label"
              style={{ width:'100%' }}
              onChange={(value) => {
                const nextProjectId = value || '';
                setProjectId(nextProjectId);
                setFilterLevel('');
                setFilterStatus('');
                setSearch('');
                setPage(1);
                if (!nextProjectId) {
                  setLevels([]);
                  setPlanItems([]);
                  setRows([]);
                  rowsRef.current = [];
                  setMapData(null);
                  setShowLevelModal(false);
                  setShowAllocModal(false);
                  setLoading(false);
                  setMapLoading(false);
                }
              }}
              allowClear
              options={projects.map(p => ({ value:String(p.id), label:projectLabel(p) }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Date</label>
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
            <label style={labelStyle}>Search</label>
            <Input.Search
              allowClear
              value={search}
              disabled={!projectId}
              placeholder="Search item, code, classification..."
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            {projectId && date && <RefreshButton onRefresh={activeTab === 'map' ? loadMap : load} />}
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
        <div style={{ display:'flex', gap:6, marginBottom:2, alignItems:'center', borderBottom:'1px solid #dbe7f7', paddingBottom:8 }}>
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
          <p style={{ marginBottom:12 }}>Levels are set up. Now allocate Planned QTY per item per level.</p>
          <button onClick={() => setShowAllocModal(true)} style={{ background:'#2563eb', border:'none', borderRadius:10, padding:'10px 24px', fontSize:14, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            Set Planned QTY Allocation
          </button>
        </div>
      )}

      {/* Daily entry context strip */}
      {!loading && allocatedRows.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:10, padding:'8px 12px', background:'#eaf2ff', border:'1px solid #cfe0ff', borderRadius:12, color:'#1e3a5f', fontSize:12 }}>
          <strong>Daily Entry Mode</strong>
          <span>Planned: <strong>{fmt2(totalPlanned)}</strong></span>
          <span>Installed: <strong>{fmt2(totalInstalled)}</strong></span>
          <span>Remaining: <strong>{fmt2(totalRemaining)}</strong></span>
          <span>Today: <strong>{fmt2(totalToday)}</strong></span>
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
                  <th style={{ ...thStyle, textAlign:'right' }}>Planned QTY</th>
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
                      const totalPlan = getItemPlanningQty(meta);
                      const totalInst= itemLevels.reduce((s,r) => s+(parseFloat(r.total_installed)||0), 0);
                      // Live: add today's typed qty for non-confirmed rows
                      const liveInst = itemLevels.reduce((s,r) => {
                        const base = parseFloat(r.total_installed)||0;
                        const live = r.tx_status==='confirmed' ? base : base + (parseFloat(r.qty_input)||0);
                        return s + live;
                      }, 0);
                      const itemPct  = totalPlan > 0 ? Math.min(100,(liveInst/totalPlan)*100) : 0;
                      return (
                        <>
                          {/* Item summary row */}
                          <tr key={`item-${itemId}`} style={{ background:'#f8fbff', borderBottom:'1px solid #e7eefb' }}>
                            <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600, color:'#6b7280', fontFamily:'monospace' }}>{meta.item_code}</td>
                            <td style={{ padding:'10px 14px', fontSize:13, fontWeight:700, color:'#111827' }}>{meta.item_name}</td>
                            <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{meta.unit_of_measure||'—'}</td>
                            <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color:'#111827' }}>{fmt2(totalPlan)}</td>
                            <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color:'#111827' }}>{fmt2(totalInst)}</td>
                            <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color: totalInst>=totalPlan&&totalPlan>0?'#16a34a':'#111827' }}>
                              {totalInst>=totalPlan&&totalPlan>0 ? '✓ Done' : fmt2(Math.max(0,totalPlan-totalInst))}
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
                            const planned     = getLevelPlanningQty(row);
                            const installed   = parseFloat(row.total_installed) || 0;
                            const remaining   = Math.max(0, planned - installed);
                            const isConfirmed = row.tx_status === 'confirmed';
                            const todayInst   = parseFloat(row.qty_input) || 0;
                            // Live progress: confirmed installed + current input (if not yet confirmed)
                            const liveInstalled = isConfirmed ? installed : installed + todayInst;
                            const pct         = planned > 0 ? Math.min(100,(liveInstalled/planned)*100) : 0;
                            return (
                              <tr key={`${itemId}-${row.level_id}`} style={{ borderBottom:'1px solid #f3f4f6', background: ri%2===0?'#fff':'#fafbff' }}>
                                <td style={{ padding:'8px 14px 8px 28px', fontSize:11, color:'#9ca3af' }}>
                                  <span style={{ color:'#2563eb', fontSize:11, fontWeight:400 }}>{row.level_code}</span>
                                </td>
                                <td style={{ padding:'8px 14px', fontSize:12, color:'#6b7280' }}>{row.level_name}</td>
                                {/* FIX 2: show item unit on level rows */}
                                <td style={{ padding:'8px 14px', fontSize:11, color:'#9ca3af' }}>{meta.unit_of_measure||'—'}</td>
                                <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color:'#111827' }}>{fmt2(planned)}</td>
                                <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color:'#111827' }}>{fmt2(installed)}</td>
                                <td style={{ padding:'8px 14px', textAlign:'right', fontWeight:600, color: installed>=planned&&planned>0?'#16a34a':'#111827' }}>
                                  {installed>=planned&&planned>0 ? '✓' : fmt2(remaining)}
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
                                      // Cap at remaining (planned − confirmed installed)
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
                  <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color:'#111827' }}>{fmt2(totalPlanned)}</td>
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
            <span style={{ fontSize:12, color:'#64748b' }}><strong style={{ color:'#2563eb' }}>{totalFiltered}</strong> rows</span>
            <div style={{ display:'flex', gap:4, flex:1, justifyContent:'center' }}>
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ minWidth:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:page===1?'not-allowed':'pointer', opacity:page===1?0.4:1, fontFamily:'inherit' }}>‹</button>
              {Array.from({length:Math.min(5,totalPages)},(_,i)=>Math.min(Math.max(1, page - 2), Math.max(1, totalPages - 4)) + i).filter(p=>p<=totalPages).map(p=>(
                <button key={p} onClick={()=>setPage(p)} style={{ minWidth:32, height:32, borderRadius:8, border:p===page?'1.5px solid #2563eb':'1px solid #e5e7eb', background:p===page?'#2563eb':'#fff', color:p===page?'#fff':'#374151', fontWeight:p===page?700:400, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>{p}</button>
              ))}
              <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ minWidth:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:page===totalPages?'not-allowed':'pointer', opacity:page===totalPages?0.4:1, fontFamily:'inherit' }}>›</button>
            </div>
            <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}} style={{ border:'1px solid #dbeafe', color:'#2563eb', background:'#fff', borderRadius:8, padding:'6px 10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {[10,25,50,100].map(n=><option key={n} value={n}>{n} per page</option>)}
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
          search={search}
          filterLevel={filterLevel}
          filterStatus={filterStatus}
          selectedDate={date}
        />
      )}

      {/* Modals */}
      {showLevelModal && (
        <LevelSetupModal projectId={projectId} initialLevels={levels} onClose={() => setShowLevelModal(false)} onSaved={savedLevels => { setLevels(savedLevels); load(); }} />
      )}
      {showAllocModal && (
        <AllocationModal projectId={projectId} levels={levels} items={planItems} initialRows={rows} onClose={() => setShowAllocModal(false)} onSaved={() => load()} />
      )}
    </div>
  );
}

// ── Installation Map Component ────────────────────────────────────────────────
function InstallationMap({ projectId, data, loading, onRefresh, search = '', filterLevel = '', filterStatus = '', selectedDate }) {
  const [viewMode,    setViewMode]    = useState('by-item'); // 'by-item' | 'by-level'
  const [mapPage, setMapPage] = useState(1);
  const [mapPageSize, setMapPageSize] = useState(10);


  useEffect(() => { setMapPage(1); }, [search, filterLevel, filterStatus, selectedDate]);

  if (!projectId) return <div className="empty-state"><div className="empty-icon">🗺️</div><p>Select a project to view the installation map</p></div>;
  if (loading)    return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!data)      return <div className="empty-state"><div className="empty-icon">🗺️</div><p>Loading map...</p></div>;

  const { items = [], levels = [], allocs = [], txs = [] } = data;

  if (levels.length === 0) return (
    <div className="empty-state"><div className="empty-icon">🏢</div><p>No levels defined. Set up levels in Daily Entry first.</p></div>
  );
  // Even if there are no transactions yet, keep the map visible so users can see all work days in the selected month.

  const fmt2 = v => (parseFloat(v)||0).toFixed(2);

  // Work days for the whole selected month (Friday excluded, same rule as daily entry)
  const monthBase = selectedDate || new Date().toISOString().slice(0, 10);
  const [yy, mm] = monthBase.split('-').map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const allDates = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return `${yy}-${String(mm).padStart(2, '0')}-${day}`;
  }).filter(d => new Date(d + 'T00:00:00').getDay() !== 5);
  const monthTitle = new Date(monthBase + 'T00:00:00').toLocaleDateString('en-GB', { month:'long', year:'numeric' });

  // Alloc map: item_id → level_id → suggested_qty
  const allocMap = {};
  allocs.forEach(a => {
    if (!allocMap[a.item_id]) allocMap[a.item_id] = {};
    allocMap[a.item_id][a.level_id] = parseFloat(a.suggested_qty) || 0;
  });

  // Tx map: item_id → level_id → date → { qty, status }
  // Header Status filter applies here as well: confirmed/saved/incomplete show matching cells only;
  // No Entry keeps empty cells visible and hides rows that already have entries in the selected month.
  const statusFilteredTxs = filterStatus && filterStatus !== 'no_entry'
    ? txs.filter(t => t.tx_status === filterStatus)
    : txs;
  const txMap = {};
  statusFilteredTxs.forEach(t => {
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

  // Shared header level filter applies to quantities/items, while the map keeps every work day in the selected month visible.
  const activeLevelId = filterLevel ? parseInt(filterLevel) : null;
  const visibleDates = allDates;

  // Filter items by search
  let visibleItems = items.filter(item => Object.values(allocMap[item.item_id]||{}).some(q => q > 0));
  if (search.trim()) {
    const q = search.toLowerCase();
    visibleItems = visibleItems.filter(i => [
      i.item_code,
      i.item_name,
      i.classification_name,
      i.class_name,
      i.parent_classification_name,
      i.parent_class_name,
    ].some(v => String(v || '').toLowerCase().includes(q)));
  }

  if (activeLevelId) {
    visibleItems = visibleItems.filter(item => (allocMap[item.item_id]?.[activeLevelId] || 0) > 0 || txs.some(t => t.item_id === item.item_id && t.level_id === activeLevelId));
  }

  if (filterStatus && filterStatus !== 'no_entry') {
    visibleItems = visibleItems.filter(item => statusFilteredTxs.some(t => t.item_id === item.item_id && (!activeLevelId || t.level_id === activeLevelId)));
  }
  if (filterStatus === 'no_entry') {
    visibleItems = visibleItems.filter(item => {
      const candidateLevels = levels.filter(lv => (!activeLevelId || lv.id === activeLevelId) && (allocMap[item.item_id]?.[lv.id] || 0) > 0);
      return candidateLevels.some(lv => !allDates.some(d => !!txs.find(t => t.item_id === item.item_id && t.level_id === lv.id && t.transaction_date === d)));
    });
  }

  // Summary stats — depend on shared header filters (level/status/search), not selected date
  const filteredItemIds = new Set(visibleItems.map(item => item.item_id));
  const relevantLevels = levels.filter(lv => !activeLevelId || lv.id === activeLevelId);
  const totalAllocated = activeLevelId
    ? visibleItems.reduce((sum, item) => sum + relevantLevels.reduce((s, lv) => s + (allocMap[item.item_id]?.[lv.id] || 0), 0), 0)
    : visibleItems.reduce((sum, item) => sum + getItemPlanningQty(item), 0);
  const mapKpiTxs = filterStatus && filterStatus !== 'no_entry'
    ? txs.filter(t => t.tx_status === filterStatus)
    : txs.filter(t => t.tx_status === 'confirmed');
  const totalInstalled = mapKpiTxs
    .filter(t => filteredItemIds.has(t.item_id) && (!activeLevelId || t.level_id === activeLevelId))
    .reduce((s,t) => s + (parseFloat(t.qty_installed) || 0), 0);
  const activeDays     = allDates.length;
  const overallPct     = totalAllocated > 0 ? Math.min(100, (totalInstalled/totalAllocated)*100) : 0;
  const getShownLevelsForItem = (item) => {
    let shownLevels = levels.filter(lv => (allocMap[item.item_id]?.[lv.id] || 0) > 0);
    if (activeLevelId) shownLevels = shownLevels.filter(lv => lv.id === activeLevelId);
    if (filterStatus === 'no_entry') {
      shownLevels = shownLevels.filter(lv => !visibleDates.some(d => !!txs.find(t => t.item_id === item.item_id && t.level_id === lv.id && t.transaction_date === d)));
    }
    return shownLevels;
  };

  const visibleRowPairs = visibleItems.flatMap(item => getShownLevelsForItem(item).map(lv => ({ item, lv })));
  const mapTotalRows   = visibleRowPairs.length;
  const mapTotalPages  = Math.max(1, Math.ceil(mapTotalRows / mapPageSize));
  const pagedRowPairs  = visibleRowPairs.slice((mapPage - 1) * mapPageSize, mapPage * mapPageSize);
  const pagedMapGroups = pagedRowPairs.reduce((acc, pair) => {
    const key = pair.item.item_id;
    if (!acc[key]) acc[key] = { item: pair.item, shownLevels: [] };
    acc[key].shownLevels.push(pair.lv);
    return acc;
  }, {});

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
            <th style={{ ...thBase, textAlign:'right', minWidth:75 }}>Planned QTY</th>
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
          {Object.values(pagedMapGroups).map(({ item, shownLevels }, iIdx) => {
            // Item summary
            const itemPlan  = activeLevelId ? shownLevels.reduce((s,lv) => s + (allocMap[item.item_id]?.[lv.id]||0), 0) : getItemPlanningQty(item);
            const itemInst  = shownLevels.reduce((s,lv) => s + (totalMap[`${item.item_id}_${lv.id}`]||0), 0);
            const itemPct   = itemPlan > 0 ? Math.min(100,(itemInst/itemPlan)*100) : 0;
            const bg        = iIdx%2===0 ? '#fafbff' : '#fff';

            return (
              <>
                {/* Item header row */}
                <tr key={`item-${item.item_id}`} style={{ background:'#f5f3ff' }}>
                  <td style={{ padding:'9px 10px', fontFamily:'monospace', fontSize:11, color:'#2563eb', fontWeight:700, position:'sticky', left:0, background:'#f5f3ff', zIndex:1 }}>{item.item_code}</td>
                  <td style={{ padding:'9px 10px', fontWeight:700, color:'#4c1d95', fontSize:13, position:'sticky', left:70, background:'#f5f3ff', zIndex:1 }}>{item.item_name}</td>
                  <td style={{ padding:'9px 10px', textAlign:'center', color:'#2563eb', fontSize:11 }}>{item.unit_of_measure||'—'}</td>
                  <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:700, color:'#111827' }}>{fmt2(itemPlan)}</td>
                  <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:700, color: itemInst>=itemPlan&&itemPlan>0?'#16a34a':'#111827' }}>{fmt2(itemInst)}</td>
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
                  const planned  = allocMap[item.item_id]?.[lv.id] || 0;
                  const inst  = totalMap[`${item.item_id}_${lv.id}`] || 0;
                  const pct   = planned > 0 ? Math.min(100,(inst/planned)*100) : 0;
                  return (
                    <tr key={`${item.item_id}-${lv.id}`} style={{ borderBottom:'1px solid #f3f4f6', background: lvIdx%2===0?bg:'#fff' }}>
                      <td style={{ padding:'8px 10px 8px 20px', position:'sticky', left:0, background: lvIdx%2===0?bg:'#fff', zIndex:1 }}>
                        <span style={{ color:'#2563eb', fontSize:11, fontWeight:400 }}>{lv.level_code}</span>
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:12, color:'#6b7280', position:'sticky', left:70, background: lvIdx%2===0?bg:'#fff', zIndex:1 }}>{lv.level_name}</td>
                      <td style={{ padding:'8px 10px', textAlign:'center', fontSize:11, color:'#9ca3af' }}>—</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontSize:12, color:'#374151' }}>{fmt2(planned)}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right', fontSize:12, fontWeight:600, color: inst>=planned&&planned>0?'#16a34a':'#374151' }}>
                        {inst>=planned&&planned>0?'✓ ':''}{fmt2(inst)}
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
              const dayTotal = (filterStatus === 'no_entry' ? [] : statusFilteredTxs).filter(t => t.transaction_date===d && (!activeLevelId || t.level_id===activeLevelId)).reduce((s,t) => s+(parseFloat(t.qty_installed)||0), 0);
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
      <div style={{ background:'#fff', border:'1px solid #dbeafe', borderRadius:14, boxShadow:'0 10px 28px rgba(37,99,235,0.07)', padding:12, marginBottom:6, marginTop:-14 }}>
        <div style={{ marginTop:0, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(128px, 1fr))', gap:8 }}>
          <div style={{ background:'#eff6ff', border:'1px solid #dbeafe', borderRadius:10, padding:'8px 10px' }}>
            <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>Total QTY</div>
            <div style={{ fontSize:14, color:'#1d4ed8', fontWeight:800 }}>{fmt2(totalAllocated)}</div>
          </div>
          <div style={{ background:'#f0fdf4', border:'1px solid #dcfce7', borderRadius:10, padding:'8px 10px' }}>
            <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>Installed</div>
            <div style={{ fontSize:14, color:'#15803d', fontWeight:800 }}>{fmt2(totalInstalled)}</div>
          </div>
          <div style={{ background:'#eff6ff', border:'1px solid #dbeafe', borderRadius:10, padding:'8px 10px' }}>
            <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>Overall Progress</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:14, color:'#1d4ed8', fontWeight:800 }}>{overallPct.toFixed(1)}%</div>
              <div style={{ flex:1, height:6, background:'#dbeafe', borderRadius:99, overflow:'hidden' }}>
                <div style={{ width:`${overallPct}%`, height:'100%', background:overallPct>=100?'#16a34a':'#2563eb', borderRadius:99 }} />
              </div>
            </div>
          </div>
          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'8px 10px' }}>
            <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>Work Days</div>
            <div style={{ fontSize:14, color:'#0f172a', fontWeight:800 }}>{activeDays}</div>
          </div>
          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'8px 10px' }}>
            <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>Levels</div>
            <div style={{ fontSize:14, color:'#0f172a', fontWeight:800 }}>{levels.length}</div>
          </div>
        </div>

        <div style={{ marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', borderTop:'1px solid #eef2f7', paddingTop:10 }}>
          <div style={{ fontSize:11, color:'#64748b' }}>Header filters are applied to this map automatically.</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', fontSize:11, color:'#64748b' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><span style={{ width:8, height:8, borderRadius:99, background:'#16a34a' }} />A Approved</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><span style={{ width:8, height:8, borderRadius:99, background:'#2563eb' }} />S Saved</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><span style={{ width:8, height:8, borderRadius:99, background:'#f97316' }} />D Draft</span>
            <span style={{ color:'#94a3b8' }}>· No entry</span>
          </div>
        </div>
      </div>

      {/* Date header strip — visual calendar */}
      {visibleDates.length > 0 && (
        <div style={{ display:'flex', gap:4, marginBottom:14, overflowX:'auto', paddingBottom:4 }}>
          <div style={{ fontSize:11, color:'#475569', fontWeight:700, minWidth:250, alignSelf:'center', flexShrink:0 }}>Work days for current month ({monthTitle}) — {activeDays} days:</div>
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
        <div style={{ display:'flex', alignItems:'center', padding:'12px 18px', borderTop:'1px solid #f3f4f6', gap:8 }}>
          <span style={{ fontSize:12, color:'#64748b' }}>Showing <strong style={{ color:'#2563eb' }}>{pagedRowPairs.length}</strong> of <strong style={{ color:'#2563eb' }}>{mapTotalRows}</strong> rows</span>
          <div style={{ display:'flex', gap:4, flex:1, justifyContent:'center' }}>
            <button onClick={() => setMapPage(p=>Math.max(1,p-1))} disabled={mapPage===1} style={{ minWidth:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:mapPage===1?'not-allowed':'pointer', opacity:mapPage===1?0.4:1, fontFamily:'inherit' }}>‹</button>
            {Array.from({length:Math.min(5,mapTotalPages)},(_,i)=>Math.min(Math.max(1, mapPage - 2), Math.max(1, mapTotalPages - 4)) + i).filter(p=>p<=mapTotalPages).map(p=>(
              <button key={p} onClick={()=>setMapPage(p)} style={{ minWidth:32, height:32, borderRadius:8, border:p===mapPage?'1.5px solid #2563eb':'1px solid #e5e7eb', background:p===mapPage?'#2563eb':'#fff', color:p===mapPage?'#fff':'#2563eb', fontWeight:p===mapPage?700:600, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>{p}</button>
            ))}
            <button onClick={() => setMapPage(p=>Math.min(mapTotalPages,p+1))} disabled={mapPage===mapTotalPages} style={{ minWidth:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:mapPage===mapTotalPages?'not-allowed':'pointer', opacity:mapPage===mapTotalPages?0.4:1, fontFamily:'inherit' }}>›</button>
          </div>
          <select value={mapPageSize} onChange={e=>{setMapPageSize(Number(e.target.value));setMapPage(1);}} style={{ border:'1px solid #dbeafe', color:'#2563eb', background:'#fff', borderRadius:8, padding:'6px 10px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {[10,25,50,100].map(n=><option key={n} value={n}>{n} per page</option>)}
          </select>
        </div>
      </div>

      {/* Bottom note */}
      <div style={{ marginTop:12, fontSize:11, color:'#9ca3af', textAlign:'center' }}>
        Showing {pagedRowPairs.length} of {mapTotalRows} item-level row{mapTotalRows!==1?'s':''} × {visibleDates.length} work day{visibleDates.length!==1?'s':''}
      </div>
    </div>
  );
}