import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal     from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import ViewPanel from '../../components/shared/ViewPanel';
import { useAuth } from '../../context/AuthContext';

const FILTER_FIELDS = [
  { key:'desc_en',   label:'Description', type:'text' },
  { key:'is_active', label:'Status', type:'select', options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] },
];
const EMPTY = { unit_code:'', desc_en:'', desc_ar:'', is_active:true };

export default function Measurements() {
  const toast = useToast();
  const { canAction } = useAuth();
  const [list,         setList]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [form,         setForm]         = useState(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [delModal,     setDelModal]     = useState(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterTrigger,setFilterTrigger]= useState(0);
  const [filterApplied,setFilterApplied]= useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [delSelModal,  setDelSelModal]  = useState(false);
  const [viewModal,    setViewModal]    = useState(null);
  const [viewSelected, setViewSelected] = useState([]);
  const [viewPanelOpen,setViewPanelOpen]= useState(false);

  const load = () => {
    setLoading(true);
    api.getMeasurements().then(setList).catch(()=>toast('Error loading','error')).finally(()=>setLoading(false));
  };
  useEffect(load, []);

  function openAdd()   { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(r) { setForm({ unit_code:r.unit_code, desc_en:r.desc_en, desc_ar:r.desc_ar||'', is_active:r.is_active!==false }); setEditing(r); setModal(true); }

  async function handleSave() {
    if (!form.unit_code||!form.desc_en) return toast('Code and description required','error');
    setSaving(true);
    try {
      if (editing) { const u=await api.updateMeasurement(editing.id,form); setList(l=>l.map(x=>x.id===editing.id?u:x)); }
      else         { const c=await api.createMeasurement(form); setList(l=>[...l,c]); }
      toast('Saved'); setModal(false);
    } catch(err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try { await api.deleteMeasurement(delModal.id); setList(l=>l.filter(x=>x.id!==delModal.id)); toast('Deleted'); setDelModal(null); }
    catch(err) { toast(err.message,'error'); }
  }

  async function handleDeleteSelected() {
    for (const id of selectedRows) { try { await api.deleteMeasurement(id); } catch {} }
    setList(l=>l.filter(x=>!selectedRows.includes(x.id)));
    setSelectedRows([]); setDelSelModal(false); toast('Deleted');
  }

  function exportCSV() {
    const rows = list.map(r=>[r.unit_code,r.desc_en,r.desc_ar||'',r.is_active?'Active':'Inactive'].join(','));
    const csv = ['Code,Description EN,Description AR,Status',...rows].join('\n');
    const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='measurements.csv'; a.click();
  }

  const columns = [
    { key:'unit_code', label:'Code', style:{width:100},
      render: r=><span style={{fontSize:13,fontWeight:500,color:'#6b7280'}}>{r.unit_code}</span> },
    { key:'desc_en', label:'Description (English)',
      render: r=>(
        <div>
          <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>{r.desc_en}</div>

        </div>
      )},
    { key:'is_active', label:'Status', style:{width:90},
      render: r=><span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:r.is_active!==false?'#dcfce7':'#fee2e2',color:r.is_active!==false?'#16a34a':'#dc2626'}}>
        <span style={{width:6,height:6,borderRadius:'50%',background:'currentColor'}}></span>
        {r.is_active!==false?'Active':'Inactive'}
      </span>},
    { key:'actions', label:'Actions', style:{width:120,textAlign:'right'},
      render: r=>(
        <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
          <button onClick={()=>setViewModal(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid #bfdbfe',background:'#eff6ff',color:'#1d4ed8',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          {canAction('can_edit') && (
            <button onClick={()=>canAction('can_edit')&&openEdit(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-muted)',display:canAction('can_edit')?'flex':'none',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {canAction('can_delete') && (
            <button onClick={()=>canAction('can_delete')&&setDelModal(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid #fecaca',background:'var(--danger-bg)',color:'var(--danger)',display:canAction('can_delete')?'flex':'none',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          )}
        </div>
      )},
  ];

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,flexWrap:'wrap'}}>
        <div style={{width:48,height:48,borderRadius:14,background:'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8"/><path d="M3 8l9 5 9-5M12 22V13"/></svg>
        </div>
        <div><h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-0.3px'}}>Measurements</h1></div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',minWidth:220}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{border:'none',outline:'none',fontSize:13,color:'var(--text)',background:'none',width:'100%',fontFamily:'inherit'}} placeholder="Search measurements..."
              value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            {searchQuery && <button onClick={()=>setSearchQuery('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:13,padding:0}}>✕</button>}
          </div>
          <button onClick={()=>setFilterTrigger(n=>n+1)} style={{display:'flex',alignItems:'center',gap:6,background:filterApplied?'var(--accent-light)':'var(--card)',border:filterApplied?'1px solid var(--accent)':'1px solid var(--border)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:filterApplied?'var(--accent)':'var(--text)',cursor:'pointer',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filter {filterApplied && <span style={{width:7,height:7,borderRadius:'50%',background:'#e97316',display:'inline-block',marginLeft:2}}/>}
          </button>
          <button onClick={load} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 10px',cursor:'pointer',display:'flex',alignItems:'center',color:'var(--text-muted)'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          {selectedRows.length > 0 && canAction('can_view_selected') && (
            <button onClick={()=>{ setViewSelected([...selectedRows]); setViewPanelOpen(true); }}
              style={{display:'flex',alignItems:'center',gap:6,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'#1d4ed8',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View ({selectedRows.length})
            </button>
          )}
          {canAction('can_export') && (
            <button onClick={exportCSV} style={{display:'flex',alignItems:'center',gap:6,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--text)',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          )}
          {selectedRows.length>0 && canAction('can_delete') && (
            <button onClick={()=>setDelSelModal(true)} style={{display:'flex',alignItems:'center',gap:6,background:'var(--danger-bg)',border:'1px solid var(--danger)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--danger)',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              Delete ({selectedRows.length})
            </button>
          )}
          {canAction('can_create') && (
            <button onClick={openAdd} style={{display:'flex',alignItems:'center',gap:7,background:'#7c3aed',border:'none',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:600,color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Unit
            </button>
          )}
        </div>
      </div>

      <DataTable columns={columns} data={list} loading={loading}
        filterFields={FILTER_FIELDS} filterStorageKey="measurements_filter"
        onRefresh={load} onSelectionChange={setSelectedRows}
        externalFilterOpen={filterTrigger} onExternalFilterClose={()=>{}}
        onFilterApplied={setFilterApplied} externalSearch={searchQuery} />

      {/* View Modal */}

      {/* View Selected Panel */}
      {viewPanelOpen && viewSelected.length > 0 && (() => {
        const items2 = list.filter(r => viewSelected.includes(r.id));
        return (
          <ViewPanel
            title="Unit"
            items={items2}
            fields={r=>[['Code',r.unit_code],['Description (EN)',r.desc_en],['Description (AR)',r.desc_ar||'—'],['Status',r.is_active!==false?'Active':'Inactive']]}
            onClose={()=>setViewPanelOpen(false)}
          />
        );
      })()}
      {viewModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.45)',backdropFilter:'blur(4px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setViewModal(null)}>
          <div style={{background:'var(--card)',borderRadius:16,boxShadow:'0 24px 60px rgba(0,0,0,0.18)',width:'100%',maxWidth:480,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
            <div style={{background:'linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%)',padding:'18px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Measurements › View</div>
                <div style={{fontSize:17,fontWeight:700,color:'#fff'}}>{viewModal.desc_en}</div>
              </div>
              <button onClick={()=>setViewModal(null)} style={{background:'rgba(255,255,255,0.18)',border:'none',color:'#fff',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:13}}>✕</button>
            </div>
            <div style={{padding:24,display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 32px'}}>
              {[['Code',viewModal.unit_code],['Description (EN)',viewModal.desc_en],['Description (AR)',viewModal.desc_ar||'—'],['Status',viewModal.is_active!==false?'Active':'Inactive']].map(([l,v])=>(
                <div key={l} style={{marginBottom:16}}>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'#9ca3af',marginBottom:4}}>{l}</div>
                  <div style={{fontSize:14,color:'var(--text)'}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px solid var(--border-light)',display:'flex',justifyContent:'flex-end',background:'var(--card2)'}}>
              <button onClick={()=>setViewModal(null)} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 16px',fontSize:13,cursor:'pointer',fontFamily:'inherit',color:'var(--text)'}}>✕ Close</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?'Edit Unit':'Add Unit'} parentTitle="Measurements" size="sm" onSave={handleSave} saving={saving}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Code *</label>
            <input className="form-control" value={form.unit_code} placeholder="e.g. m², kg" onChange={e=>setForm(f=>({...f,unit_code:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.is_active?'true':'false'} onChange={e=>setForm(f=>({...f,is_active:e.target.value==='true'}))}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Description (English) *</label>
            <input className="form-control" value={form.desc_en} onChange={e=>setForm(f=>({...f,desc_en:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Description (Arabic)</label>
            <input className="form-control" dir="rtl" value={form.desc_ar} onChange={e=>setForm(f=>({...f,desc_ar:e.target.value}))} />
          </div>
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={()=>setDelModal(null)} title="Delete Unit" parentTitle="Measurements" size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>Are you sure? This cannot be undone.</p>
        {delModal && <p style={{marginTop:8,fontWeight:700,color:'var(--danger)'}}>{delModal.desc_en}</p>}
      </Modal>

      <Modal open={delSelModal} onClose={()=>setDelSelModal(false)} title={`Delete ${selectedRows.length} Units`} parentTitle="Measurements" size="sm" onSave={handleDeleteSelected} saveLabel="Delete All">
        <p>Are you sure you want to delete <strong>{selectedRows.length}</strong> unit(s)? Units linked to items cannot be deleted.</p>
      </Modal>
    </div>
  );
}