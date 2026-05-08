import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal     from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const FILTER_FIELDS = [
  { key:'classification_name', label:'Name', type:'text' },
  { key:'is_active', label:'Status', type:'select', options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] },
];
const EMPTY = { classification_code:'', classification_name:'', classification_name_ar:'', parent_id:'', is_active:true };

// Build 3-level tree: L1 → L2 → L3
function buildTree(list) {
  const rows = [];
  const L1 = list.filter(c => !c.parent_id);
  const L2 = list.filter(c => c.parent_id && !c.grandparent_id);
  const L3 = list.filter(c => c.grandparent_id);

  L1.forEach(l1 => {
    rows.push({ ...l1, _level: 0 });
    L2.filter(c => c.parent_id === l1.id).forEach(l2 => {
      rows.push({ ...l2, _level: 1 });
      L3.filter(c => c.parent_id === l2.id).forEach(l3 => {
        rows.push({ ...l3, _level: 2 });
      });
    });
  });
  // orphan L2s (parent deleted)
  L2.filter(l2 => !L1.find(l1 => l1.id === l2.parent_id)).forEach(l2 => {
    rows.push({ ...l2, _level: 1 });
    L3.filter(c => c.parent_id === l2.id).forEach(l3 => rows.push({ ...l3, _level: 2 }));
  });
  return rows;
}

export default function ItemClassifications() {
  const toast = useToast();
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

  function load() {
    setLoading(true);
    api.getClassifications().then(setList).catch(()=>toast(t.errorOccurred,'error')).finally(()=>setLoading(false));
  }
  useEffect(load, []);

  const treeRows = buildTree(list);

  // Level 1 options (top-level)
  const L1 = list.filter(c => !c.parent_id);
  // Level 2 options (have a parent but no grandparent)
  const L2 = list.filter(c => c.parent_id && !c.grandparent_id);

  function openAdd()   { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(c) {
    setForm({ classification_code:c.classification_code, classification_name:c.classification_name, classification_name_ar:c.classification_name_ar||'', parent_id:c.parent_id||'', is_active:c.is_active!==false });
    setEditing(c); setModal(true);
  }

  async function handleSave() {
    if (!form.classification_code||!form.classification_name) return toast('Code and name are required','error');
    setSaving(true);
    try {
      const payload = { ...form, parent_id:form.parent_id||null, is_active:form.is_active!==false };
      if (editing) {
        const u = await api.updateClassification(editing.id, payload);
        setList(l => l.map(x => x.id===editing.id ? u : x));
      } else {
        const c = await api.createClassification(payload);
        setList(l => [...l, c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch(err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try { await api.deleteClassification(delModal.id); setList(l=>l.filter(x=>x.id!==delModal.id)); toast(t.deleteSuccess); setDelModal(null); }
    catch(err) { toast(err.message,'error'); }
  }

  async function handleDeleteSelected() {
    for (const id of selectedRows) { try { await api.deleteClassification(id); } catch {} }
    setList(l => l.filter(x => !selectedRows.includes(x.id)));
    setSelectedRows([]); setDelSelModal(false); toast(t.deleteSuccess);
  }

  function exportCSV() {
    const rows = treeRows.map(r => [r.classification_code, r.classification_name, r.classification_name_ar||'', r.parent_name||''].join(','));
    const csv = ['Code,Name,Name AR,Parent',...rows].join('\n');
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='classifications.csv'; a.click();
  }

  const indent = [0, 24, 48];
  const prefix = ['', '└─ ', '   └─ '];

  const columns = [
    { key:'classification_code', label:'Code', style:{width:110},
      render: r => <span style={{fontSize:13,fontWeight:500,color:'#6b7280'}}>{r.classification_code}</span> },
    { key:'classification_name', label:'Classification Name',
      render: r => (
        <div style={{paddingLeft:indent[r._level]||0, display:'flex', alignItems:'center', gap:5}}>
          {r._level>0 && <span style={{color:'#9ca3af',fontSize:12,whiteSpace:'nowrap'}}>{prefix[r._level]}</span>}
          <div>
            <div style={{fontSize:13,fontWeight:r._level===0?700:600,color:'#111827'}}>{r.classification_name}</div>
            {r.classification_name_ar && <div style={{fontSize:11,color:'#9ca3af',direction:'rtl',textAlign:'left'}}>{r.classification_name_ar}</div>}
          </div>
        </div>
      )},
    { key:'level', label:'Level', style:{width:80},
      render: r => {
        const labels = [{bg:'#ede9fe',c:'#7c3aed',l:'Level 1'},{bg:'#eff6ff',c:'#1d4ed8',l:'Level 2'},{bg:'#f0fdf4',c:'#16a34a',l:'Level 3'}];
        const s = labels[r._level]||labels[0];
        return <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:s.bg,color:s.c}}>{s.l}</span>;
      }},
    { key:'is_active', label:'Status', style:{width:90},
      render: r => <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:r.is_active!==false?'#dcfce7':'#fee2e2',color:r.is_active!==false?'#16a34a':'#dc2626'}}>
        <span style={{width:6,height:6,borderRadius:'50%',background:'currentColor'}}></span>
        {r.is_active!==false?'Active':'Inactive'}
      </span>},
    { key:'actions', label:'Actions', style:{width:90,textAlign:'right'},
      render: r => (
        <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
          <button onClick={()=>openEdit(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={()=>setDelModal(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid #fecaca',background:'var(--danger-bg)',color:'var(--danger)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      )},
  ];

  // Determine which parents are valid for current editing item
  // Can't set parent to self or own children
  const validL1 = L1.filter(c => !editing || c.id !== editing.id);
  const validL2 = L2.filter(c => !editing || (c.id !== editing.id && c.parent_id !== editing.id));

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,flexWrap:'wrap'}}>
        <div style={{width:48,height:48,borderRadius:14,background:'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
        </div>
        <div><h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-0.3px'}}>{t.itemClassifications}</h1></div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',minWidth:220}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{border:'none',outline:'none',fontSize:13,color:'var(--text)',background:'none',width:'100%',fontFamily:'inherit'}} placeholder="Search classifications..."
              value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            {searchQuery && <button onClick={()=>setSearchQuery('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:13,padding:0}}>✕</button>}
          </div>
          <button onClick={()=>setFilterTrigger(n=>n+1)}
            style={{display:'flex',alignItems:'center',gap:6,background:filterApplied?'var(--accent-light)':'var(--card)',border:filterApplied?'1px solid var(--accent)':'1px solid var(--border)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:filterApplied?'var(--accent)':'var(--text)',cursor:'pointer',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filter {filterApplied && <span style={{width:7,height:7,borderRadius:'50%',background:'#e97316',display:'inline-block',marginLeft:2}}/>}
          </button>
          <button onClick={load} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 10px',cursor:'pointer',display:'flex',alignItems:'center',color:'var(--text-muted)'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          <button onClick={exportCSV} style={{display:'flex',alignItems:'center',gap:6,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--text)',cursor:'pointer',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          {selectedRows.length > 0 && (
            <button onClick={()=>setDelSelModal(true)} style={{display:'flex',alignItems:'center',gap:6,background:'var(--danger-bg)',border:'1px solid var(--danger)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--danger)',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              Delete ({selectedRows.length})
            </button>
          )}
          <button onClick={openAdd} style={{display:'flex',alignItems:'center',gap:7,background:'#7c3aed',border:'none',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:600,color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Classification
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={treeRows} loading={loading}
        onExport={exportCSV} filterFields={FILTER_FIELDS} filterStorageKey="classifications_filter"
        onRefresh={load} onSelectionChange={setSelectedRows}
        externalFilterOpen={filterTrigger} onExternalFilterClose={()=>{}}
        onFilterApplied={setFilterApplied} externalSearch={searchQuery} />

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?t.editClassification:t.addClassification} parentTitle={t.itemClassifications} size="sm" onSave={handleSave} saving={saving}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Code *</label>
            <input className="form-control" value={form.classification_code} onChange={e=>setForm(f=>({...f,classification_code:e.target.value}))} />
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
            <label className="form-label">Name (English) *</label>
            <input className="form-control" value={form.classification_name} onChange={e=>setForm(f=>({...f,classification_name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Name (Arabic)</label>
            <input className="form-control" dir="rtl" value={form.classification_name_ar} onChange={e=>setForm(f=>({...f,classification_name_ar:e.target.value}))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Parent Classification</label>
          <select className="form-control" value={form.parent_id} onChange={e=>setForm(f=>({...f,parent_id:e.target.value}))}>
            <option value="">— Top Level (Level 1) —</option>
            <optgroup label="Level 1 → makes this Level 2">
              {validL1.map(c => <option key={c.id} value={c.id}>{c.classification_name}</option>)}
            </optgroup>
            <optgroup label="Level 2 → makes this Level 3">
              {validL2.map(c => <option key={c.id} value={c.id}>&nbsp;&nbsp;└ {c.classification_name} ({c.parent_name})</option>)}
            </optgroup>
          </select>
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={()=>setDelModal(null)} title="Delete Classification" parentTitle={t.itemClassifications} size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{marginTop:8,fontWeight:700,color:'var(--danger)'}}>{delModal.classification_name}</p>}
      </Modal>

      <Modal open={delSelModal} onClose={()=>setDelSelModal(false)} title={`Delete ${selectedRows.length} Classifications`} parentTitle={t.itemClassifications} size="sm" onSave={handleDeleteSelected} saveLabel="Delete All">
        <p>Are you sure you want to delete <strong>{selectedRows.length}</strong> selected classification(s)?</p>
      </Modal>
    </div>
  );
}