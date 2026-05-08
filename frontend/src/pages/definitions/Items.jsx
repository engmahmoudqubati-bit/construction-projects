import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal     from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const EMPTY = { item_code:'', item_name:'', item_name_ar:'', classification_id:'', unit_of_measure:'', is_active:true };

export default function Items() {
  const toast = useToast();
  const [items,        setItems]        = useState([]);
  const [classes,      setClasses]      = useState([]);
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

  const load = () => {
    setLoading(true);
    Promise.all([api.getItems(), api.getClassifications()])
      .then(([i,c]) => { setItems(i); setClasses(c); })
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filterFields = [
    { key:'classification_name', label:'Classification', type:'select',
      options: classes.filter(c=>!c.parent_id).map(c=>({value:c.classification_name,label:c.classification_name})) },
    { key:'unit_of_measure', label:'Unit', type:'text' },
    { key:'is_active', label:'Status', type:'select', options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] },
  ];

  function openAdd()   { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(i) {
    setForm({ item_code:i.item_code, item_name:i.item_name, item_name_ar:i.item_name_ar||'', classification_id:i.classification_id||'', unit_of_measure:i.unit_of_measure||'', is_active:i.is_active!==false });
    setEditing(i); setModal(true);
  }

  async function handleSave() {
    if (!form.item_code||!form.item_name) return toast('Code and name are required','error');
    setSaving(true);
    try {
      const payload = { ...form, classification_id:form.classification_id||null, is_active:form.is_active!==false };
      if (editing) {
        const u = await api.updateItem(editing.id, payload);
        setItems(is => is.map(x => x.id===editing.id ? u : x));
      } else {
        const c = await api.createItem(payload);
        setItems(is => [...is,c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch(err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try { await api.deleteItem(delModal.id); setItems(is=>is.filter(x=>x.id!==delModal.id)); toast(t.deleteSuccess); setDelModal(null); }
    catch(err) { toast(err.message,'error'); }
  }

  async function handleDeleteSelected() {
    for (const id of selectedRows) { try { await api.deleteItem(id); } catch {} }
    setItems(is => is.filter(x => !selectedRows.includes(x.id)));
    setSelectedRows([]); setDelSelModal(false); toast(t.deleteSuccess);
  }

  function exportCSV() {
    const rows = items.map(i => [i.item_code, i.item_name, i.item_name_ar||'', i.classification_name||'', i.unit_of_measure||''].join(','));
    const csv = ['Code,Name,Name AR,Classification,Unit',...rows].join('\n');
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='items.csv'; a.click();
  }

  // Build classification dropdown — grouped by level
  const L1 = classes.filter(c => !c.parent_id);
  const L2 = classes.filter(c => c.parent_id && !c.grandparent_id);
  const L3 = classes.filter(c => c.grandparent_id);

  const columns = [
    { key:'item_code', label:'Code', style:{width:100},
      render: r => <span style={{fontSize:13,fontWeight:500,color:'#6b7280'}}>{r.item_code}</span> },
    { key:'item_name', label:'Item Name',
      render: r => (
        <div>
          <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>{r.item_name}</div>
          {r.item_name_ar && <div style={{fontSize:11,color:'#9ca3af',direction:'rtl'}}>{r.item_name_ar}</div>}
        </div>
      )},
    { key:'classification_name', label:'Classification',
      render: r => <span style={{fontSize:12,color:'#6b7280'}}>{r.classification_name||'—'}</span> },
    { key:'unit_of_measure', label:'Unit',
      render: r => <span style={{fontSize:12,color:'#6b7280'}}>{r.unit_of_measure||'—'}</span> },
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

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,flexWrap:'wrap'}}>
        <div style={{width:48,height:48,borderRadius:14,background:'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
        </div>
        <div><h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-0.3px'}}>{t.items}</h1></div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',minWidth:220}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{border:'none',outline:'none',fontSize:13,color:'var(--text)',background:'none',width:'100%',fontFamily:'inherit'}} placeholder="Search items..."
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
            New Item
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={items} loading={loading}
        onExport={exportCSV} filterFields={filterFields} filterStorageKey="items_filter"
        onRefresh={load} onSelectionChange={setSelectedRows}
        externalFilterOpen={filterTrigger} onExternalFilterClose={()=>{}}
        onFilterApplied={setFilterApplied} externalSearch={searchQuery} />

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?t.editItem:t.addItem} parentTitle={t.items} size="md" onSave={handleSave} saving={saving}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Item Code *</label>
            <input className="form-control" value={form.item_code} onChange={e=>setForm(f=>({...f,item_code:e.target.value}))} />
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
            <label className="form-label">Item Name (English) *</label>
            <input className="form-control" value={form.item_name} onChange={e=>setForm(f=>({...f,item_name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Item Name (Arabic)</label>
            <input className="form-control" dir="rtl" value={form.item_name_ar} onChange={e=>setForm(f=>({...f,item_name_ar:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Classification</label>
            <select className="form-control" value={form.classification_id} onChange={e=>setForm(f=>({...f,classification_id:e.target.value}))}>
              <option value="">— None —</option>
              {L1.map(l1 => (
                <optgroup key={l1.id} label={l1.classification_name}>
                  {L2.filter(l2=>l2.parent_id===l1.id).length===0
                    ? <option value={l1.id}>{l1.classification_name}</option>
                    : L2.filter(l2=>l2.parent_id===l1.id).map(l2=>(
                        <optgroup key={l2.id} label={`  └ ${l2.classification_name}`}>
                          {L3.filter(l3=>l3.parent_id===l2.id).length===0
                            ? <option value={l2.id}>{l2.classification_name}</option>
                            : L3.filter(l3=>l3.parent_id===l2.id).map(l3=>(
                                <option key={l3.id} value={l3.id}>{'    └ '}{l3.classification_name}</option>
                              ))
                          }
                        </optgroup>
                      ))
                  }
                </optgroup>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Unit of Measure</label>
            <input className="form-control" value={form.unit_of_measure} placeholder="e.g. m², pcs, kg" onChange={e=>setForm(f=>({...f,unit_of_measure:e.target.value}))} />
          </div>
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={()=>setDelModal(null)} title="Delete Item" parentTitle={t.items} size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{marginTop:8,fontWeight:700,color:'var(--danger)'}}>{delModal.item_name}</p>}
      </Modal>

      <Modal open={delSelModal} onClose={()=>setDelSelModal(false)} title={`Delete ${selectedRows.length} Items`} parentTitle={t.items} size="sm" onSave={handleDeleteSelected} saveLabel="Delete All">
        <p>Are you sure you want to delete <strong>{selectedRows.length}</strong> selected item(s)?</p>
      </Modal>
    </div>
  );
}