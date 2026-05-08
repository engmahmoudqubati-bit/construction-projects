import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const STATUS_STYLE = {
  incomplete: { bg:'#fff7ed', color:'#ea580c', label:'Incomplete' },
  saved:      { bg:'#eff6ff', color:'#2563eb', label:'Saved' },
  approved:   { bg:'#f0fdf4', color:'#16a34a', label:'Approved' },
  draft:      { bg:'#fff7ed', color:'#ea580c', label:'Incomplete' },
};

export default function Planning() {
  const toast = useToast();
  const { permissions, canAction, isAdmin } = useAuth();
  const [projects,     setProjects]     = useState([]);
  const [projectId,    setProjectId]    = useState('');
  const [rows,         setRows]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [inserting,    setInserting]    = useState(false);
  const [insertModal,  setInsertModal]  = useState(false);
  const [available,    setAvailable]    = useState([]);
  const [selected,     setSelected]     = useState([]);
  const [insertSearch, setInsertSearch] = useState('');

  useEffect(() => {
    api.getProjects().then(ps => {
      const allowed = isAdmin() ? ps : ps.filter(p => !permissions?.projects?.length || permissions.projects.includes(p.id));
      setProjects(allowed);
    }).catch(() => {});
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

  async function openInsert() {
    if (!projectId) return;
    const items = await api.getAvailableItems(projectId);
    setAvailable(items); setSelected([]); setInsertSearch(''); setInsertModal(true);
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
  function selectAll()  { setSelected(filteredAvailable.map(i => i.id)); }
  function selectNone() { setSelected([]); }

  async function handleInsert() {
    if (!selected.length) return toast('Select at least one item', 'error');
    setInserting(true);
    try {
      await api.insertPlanningItems({ project_id: projectId, item_ids: selected });
      toast(`${selected.length} item(s) inserted`);
      setInsertModal(false);
      loadPlanning(projectId);
    } catch (err) { toast(err.message, 'error'); }
    finally { setInserting(false); }
  }

  // Save qty to backend
  async function saveQty() {
    const entries = rows.filter(r => ['incomplete','saved','draft'].includes(r.status))
      .map(r => ({ item_id: r.item_id, planned_qty: parseFloat(r.qty_input) || 0 }));
    await api.savePlanning({ project_id: projectId, entries });
  }

  async function handleDraft() {
    try { await saveQty(); await api.draftPlanning(projectId); toast('Status: Incomplete'); loadPlanning(projectId); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function handleSave() {
    try { await saveQty(); await api.savePlanningStatus(projectId); toast('Status: Saved'); loadPlanning(projectId); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function handleApprove() {
    try { await saveQty(); await api.approvePlanning(projectId); toast('Status: Approved'); loadPlanning(projectId); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function handleUnpost() {
    try { await api.unpostPlanning(projectId); toast('Unposted — status set to Incomplete'); loadPlanning(projectId); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function handleRemove(itemId) {
    try { await api.deletePlanningItem(projectId, itemId); setRows(rs => rs.filter(r => r.item_id !== itemId)); }
    catch (err) { toast(err.message, 'error'); }
  }

  // Compute status summary
  const hasIncomplete = rows.some(r => ['incomplete','draft'].includes(r.status));
  const hasSaved      = rows.some(r => r.status === 'saved');
  const hasApproved   = rows.some(r => r.status === 'approved');
  const hasEditable   = rows.some(r => ['incomplete','saved','draft'].includes(r.status));
  const canEdit       = hasEditable;
  const canApprove    = hasEditable;
  const canUnpost     = hasApproved && canAction('can_confirm');

  // Group by: main classification → leaf classification → items
  const grouped = rows.reduce((acc, row) => {
    const main = row.grandparent_classification_name || row.parent_classification_name || row.classification_name || 'Uncategorized';
    const leaf = row.grandparent_classification_name
      ? (row.parent_classification_name || row.classification_name || '')
      : row.parent_classification_name
        ? (row.classification_name || '')
        : '';
    const key = `${main}||${leaf}`;
    if (!acc[key]) acc[key] = { main, leaf, items: [] };
    acc[key].items.push(row);
    return acc;
  }, {});

  const filteredAvailable = available.filter(i =>
    !insertSearch ||
    (i.item_name||'').toLowerCase().includes(insertSearch.toLowerCase()) ||
    (i.item_code||'').toLowerCase().includes(insertSearch.toLowerCase()) ||
    (i.classification_name||'').toLowerCase().includes(insertSearch.toLowerCase())
  );

  const btnStyle = (bg, color='#fff', border=bg) => ({
    display:'flex', alignItems:'center', gap:6, background:bg,
    border:`1px solid ${border}`, borderRadius:10, padding:'8px 18px',
    fontSize:13, fontWeight:600, color, cursor:'pointer', fontFamily:'inherit',
  });

  return (
    <div>
      {/* Page header */}
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,flexWrap:'wrap'}}>
        <div style={{width:48,height:48,borderRadius:14,background:'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-0.3px'}}>Bill of Quantity (BOQ)</h1>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {/* Project selector */}
          <select style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',fontSize:13,color:'var(--text)',cursor:'pointer',fontFamily:'inherit',minWidth:260}}
            value={projectId} onChange={e=>setProjectId(e.target.value)}>
            <option value="">— Select Project —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.project_name_en}</option>)}
          </select>
          {/* Insert button */}
          {projectId && (
            <button onClick={openInsert} style={btnStyle('#7c3aed')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Insert Items
            </button>
          )}
        </div>
      </div>

      {/* Empty states */}
      {!projectId && (
        <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text-muted)'}}>
          <div style={{fontSize:48,marginBottom:12}}>📋</div>
          <div style={{fontSize:15,fontWeight:500}}>Select a project to view or build its BOQ</div>
        </div>
      )}
      {loading && projectId && (
        <div style={{textAlign:'center',padding:60}}><div className="spinner"/></div>
      )}
      {!loading && projectId && rows.length === 0 && (
        <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text-muted)'}}>
          <div style={{fontSize:48,marginBottom:12}}>📦</div>
          <div style={{fontSize:15,fontWeight:500}}>No items yet — click "Insert Items" to start</div>
        </div>
      )}

      {/* BOQ Table */}
      {!loading && rows.length > 0 && (
        <div style={{background:'var(--card)',border:'1px solid var(--border-light)',borderRadius:14,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {['#','Item Code','Item Name','Unit','Total Qty','Status',''].map((h,i) => (
                    <th key={i} style={{background:'#f0f7ff',color:'#111827',fontWeight:700,fontSize:12,
                      padding:'11px 14px',textAlign:i>=4?'center':'left',
                      borderBottom:'1px solid #e0ecff',whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.03em'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(grouped).map(({ main, leaf, items }, gi) => (
                  <>
                    {/* Main classification header */}
                    <tr key={`main-${gi}`}>
                      <td colSpan={7} style={{background:'#ede9fe',padding:'7px 14px',fontSize:12,fontWeight:700,color:'#7c3aed',letterSpacing:'0.04em'}}>
                        {main}{leaf ? <span style={{color:'#9ca3af',fontWeight:400}}> — {leaf}</span> : ''}
                      </td>
                    </tr>
                    {items.map((row, ri) => {
                      const editable = ['incomplete','saved','draft'].includes(row.status);
                      const s = STATUS_STYLE[row.status] || STATUS_STYLE.incomplete;
                      return (
                        <tr key={row.item_id} style={{borderBottom:'1px solid #f3f4f6',background:ri%2===0?'#fafbff':'#fff'}}>
                          <td style={{padding:'12px 14px',fontSize:12,color:'#9ca3af',textAlign:'center',width:44}}>{ri+1}</td>
                          <td style={{padding:'12px 14px',fontSize:12,fontWeight:500,color:'#6b7280'}}>{row.item_code}</td>
                          <td style={{padding:'12px 14px',fontSize:13,fontWeight:600,color:'#111827'}}>{row.item_name}</td>
                          <td style={{padding:'12px 14px',fontSize:12,color:'#6b7280',textAlign:'center'}}>{row.unit_desc_en||row.unit_code||'—'}</td>
                          <td style={{padding:'12px 14px',textAlign:'center',width:140}}>
                            {editable ? (
                              <input type="number" min="0" step="0.01" value={row.qty_input}
                                onChange={e=>setRows(rs=>rs.map(r=>r.item_id===row.item_id?{...r,qty_input:e.target.value}:r))}
                                style={{width:110,textAlign:'center',border:'1.5px solid #e5e7eb',borderRadius:8,padding:'6px 8px',fontSize:13,fontFamily:'inherit',outline:'none'}}
                                onFocus={e=>{e.target.style.borderColor='#7c3aed';}}
                                onBlur={e=>{e.target.style.borderColor='#e5e7eb';}}
                              />
                            ) : (
                              <span style={{fontWeight:600,fontSize:13}}>{Number(row.planned_qty||0).toFixed(2)}</span>
                            )}
                          </td>
                          <td style={{padding:'12px 14px',textAlign:'center'}}>
                            <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:s.bg,color:s.color}}>
                              <span style={{width:6,height:6,borderRadius:'50%',background:s.color}}></span>
                              {s.label}
                            </span>
                          </td>
                          <td style={{padding:'12px 14px',textAlign:'center',width:50}}>
                            {row.status === 'incomplete' || row.status === 'draft' ? (
                              <button onClick={()=>handleRemove(row.item_id)}
                                style={{width:28,height:28,borderRadius:6,border:'1px solid #fecaca',background:'#fff5f5',color:'#dc2626',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer action buttons */}
          <div style={{padding:'14px 18px',borderTop:'1px solid var(--border-light)',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:'var(--card2)'}}>
            <span style={{fontSize:12,color:'var(--text-muted)',marginRight:8}}>{rows.length} items</span>
            <div style={{marginLeft:'auto',display:'flex',gap:8,flexWrap:'wrap'}}>
              {canEdit && (
                <>
                  <button onClick={handleDraft} style={btnStyle('var(--card)','var(--text)','var(--border)')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Draft
                  </button>
                  <button onClick={handleSave} style={btnStyle('#2563eb')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Save
                  </button>
                  <button onClick={handleApprove} style={btnStyle('#16a34a')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Approve
                  </button>
                </>
              )}
              {canUnpost && (
                <button onClick={handleUnpost} style={btnStyle('#dc2626')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                  Unpost
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Insert Items Modal */}
      {insertModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.45)',backdropFilter:'blur(4px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>e.target===e.currentTarget&&setInsertModal(false)}>
          <div style={{background:'var(--card)',borderRadius:16,boxShadow:'0 24px 60px rgba(0,0,0,0.18)',width:'100%',maxWidth:780,overflow:'hidden',display:'flex',flexDirection:'column',maxHeight:'85vh'}}
            onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{background:'linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%)',padding:'18px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>BOQ › Insert Items</div>
                <div style={{fontSize:17,fontWeight:700,color:'#fff'}}>Select Items to Add</div>
              </div>
              <button onClick={()=>setInsertModal(false)} style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:13}}>✕</button>
            </div>

            {/* Search + select controls */}
            <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border-light)',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',flex:1}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input style={{border:'none',outline:'none',fontSize:13,color:'var(--text)',background:'none',width:'100%',fontFamily:'inherit'}}
                  placeholder="Search by name, code or classification..."
                  value={insertSearch} onChange={e=>setInsertSearch(e.target.value)} autoFocus />
                {insertSearch && <button onClick={()=>setInsertSearch('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:13,padding:0}}>✕</button>}
              </div>
              <button onClick={selectAll} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer',fontFamily:'inherit',color:'var(--text)'}}>Select All</button>
              <button onClick={selectNone} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer',fontFamily:'inherit',color:'var(--text)'}}>None</button>
              <span style={{fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{selected.length} selected</span>
            </div>

            {/* Items table */}
            <div style={{overflowY:'auto',flex:1}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead style={{position:'sticky',top:0}}>
                  <tr>
                    {['','Code','Item Name','Classification','Unit'].map((h,i)=>(
                      <th key={i} style={{background:'#f0f7ff',color:'#111827',fontWeight:700,fontSize:11,padding:'10px 14px',
                        textAlign:i===0?'center':'left',borderBottom:'1px solid #e0ecff',textTransform:'uppercase',letterSpacing:'0.03em',whiteSpace:'nowrap'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAvailable.length === 0 ? (
                    <tr><td colSpan={5} style={{textAlign:'center',padding:40,color:'var(--text-muted)',fontSize:13}}>No available items</td></tr>
                  ) : filteredAvailable.map((item, idx) => {
                    const isSelected = selected.includes(item.id);
                    const mainCls = item.grandparent_classification_name || item.parent_classification_name || item.classification_name || '—';
                    const leafCls = item.grandparent_classification_name
                      ? item.parent_classification_name || item.classification_name
                      : item.parent_classification_name
                        ? item.classification_name
                        : '';
                    return (
                      <tr key={item.id} onClick={()=>toggleSelect(item.id)}
                        style={{borderBottom:'1px solid #f3f4f6',cursor:'pointer',background:isSelected?'#ede9fe':idx%2===0?'#fafbff':'#fff'}}>
                        <td style={{padding:'10px 14px',textAlign:'center',width:44}}>
                          <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(item.id)}
                            onClick={e=>e.stopPropagation()} style={{accentColor:'#7c3aed',width:14,height:14,cursor:'pointer'}} />
                        </td>
                        <td style={{padding:'10px 14px',fontSize:12,fontWeight:500,color:'#6b7280'}}>{item.item_code}</td>
                        <td style={{padding:'10px 14px',fontSize:13,fontWeight:600,color:'#111827'}}>{item.item_name}</td>
                        <td style={{padding:'10px 14px',fontSize:12,color:'#6b7280'}}>
                          {mainCls}{leafCls ? <span style={{color:'#d1d5db'}}> — </span> : ''}{leafCls || ''}
                        </td>
                        <td style={{padding:'10px 14px',fontSize:12,color:'#6b7280'}}>{item.unit_desc_en||item.unit_code||'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{padding:'14px 20px',borderTop:'1px solid var(--border-light)',display:'flex',justifyContent:'flex-end',gap:8,background:'var(--card2)',flexShrink:0}}>
              <button onClick={()=>setInsertModal(false)} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 18px',fontSize:13,cursor:'pointer',fontFamily:'inherit',color:'var(--text)'}}>
                Cancel
              </button>
              <button onClick={handleInsert} disabled={inserting||selected.length===0}
                style={{background:selected.length===0?'#9ca3af':'#7c3aed',border:'none',borderRadius:8,padding:'8px 20px',fontSize:13,fontWeight:600,color:'#fff',cursor:selected.length===0?'not-allowed':'pointer',fontFamily:'inherit'}}>
                {inserting ? 'Inserting...' : `Insert ${selected.length} Item(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}