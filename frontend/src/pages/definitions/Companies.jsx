import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal     from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const EMPTY = { company_code:'', name_ar:'', name_en:'', type:'organization', tax_id:'', parent_id:'' };

const FILTER_FIELDS = [
  { key:'type', label:'Type', type:'select', options:[{value:'holding',label:'Holding'},{value:'organization',label:'Organization'}] },
  { key:'name_en', label:'Name (English)', type:'text' },
  { key:'tax_id',  label:'Tax ID',         type:'text' },
];

export default function Companies() {
  const toast = useToast();
  const [companies,    setCompanies]    = useState([]);
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
  const [delSelectedModal, setDelSelectedModal] = useState(false);

  const load = () => {
    setLoading(true);
    api.getCompanies().then(setCompanies).catch(()=>toast(t.errorOccurred,'error')).finally(()=>setLoading(false));
  };
  useEffect(load, []);

  const holdings = companies.filter(c => c.type === 'holding');

  function openAdd()   { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(c) {
    setForm({ company_code:c.company_code||'', name_ar:c.name_ar, name_en:c.name_en, type:c.type, tax_id:c.tax_id||'', parent_id:c.parent_id||'' });
    setEditing(c); setModal(true);
  }

  async function handleSave() {
    if (!form.name_ar||!form.name_en) return toast('Arabic and English names are required','error');
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.type==='organization'&&form.parent_id ? Number(form.parent_id) : null };
      if (editing) {
        const u = await api.updateCompany(editing.id, payload);
        setCompanies(cs => cs.map(c => c.id===editing.id ? u : c));
      } else {
        const c = await api.createCompany(payload);
        setCompanies(cs => [...cs, c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch(err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteCompany(delModal.id);
      setCompanies(cs => cs.filter(c => c.id!==delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch(err) { toast(err.message,'error'); }
  }

  async function handleDeleteSelected() {
    for (const id of selectedRows) {
      try { await api.deleteCompany(id); } catch {}
    }
    setCompanies(cs => cs.filter(c => !selectedRows.includes(c.id)));
    setSelectedRows([]); setDelSelectedModal(false);
    toast(t.deleteSuccess);
  }

  function exportCSV() {
    const rows = companies.map(c => [c.company_code||'', c.name_en, c.name_ar, c.type, c.tax_id||''].join(','));
    const csv  = ['Code,Name EN,Name AR,Type,Tax ID', ...rows].join('\n');
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='companies.csv'; a.click();
  }

  // Build tree rows
  function buildTree(all) {
    const rows = [];
    const hs = all.filter(c => c.type==='holding');
    const os = all.filter(c => c.type==='organization');
    hs.forEach(h => {
      rows.push({...h,_level:0});
      os.filter(o => o.parent_id===h.id).forEach(o => rows.push({...o,_level:1}));
    });
    os.filter(o => !o.parent_id).forEach(o => rows.push({...o,_level:0}));
    return rows;
  }

  const treeRows = buildTree(companies);

  const locIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;

  const columns = [
    { key:'company_code', label:'Code', style:{width:100},
      render: r => <span style={{fontSize:13,fontWeight:500,color:'#6b7280'}}>{r.company_code||'—'}</span> },
    { key:'name_en', label:'Company Name',
      render: r => (
        <div style={{paddingLeft: r._level>0 ? 24 : 0, display:'flex', alignItems:'center', gap:6}}>
          {r._level>0 && <span style={{color:'var(--text-muted)',fontSize:11}}>└─</span>}
          <span style={{fontSize:13,fontWeight:r.type==='holding'?700:600,color:'#111827'}}>{r.name_en}</span>
        </div>
      )},
    { key:'name_ar', label:'Company Name (AR)',
      render: r => <span style={{direction:'rtl',fontSize:13,color:'#6b7280'}}>{r.name_ar}</span> },
    { key:'type', label:'Type',
      render: r => <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:r.type==='holding'?'#ede9fe':'#eff6ff',color:r.type==='holding'?'#7c3aed':'#1d4ed8'}}>{r.type==='holding'?t.companyTypeHolding:t.companyTypeOrg}</span> },
    { key:'tax_id', label:'Tax ID', render: r => <span style={{fontSize:12,color:'#6b7280'}}>{r.tax_id||'—'}</span> },
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
      {/* Page header — same as Projects */}
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,flexWrap:'wrap'}}>
        <div style={{width:48,height:48,borderRadius:14,background:'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-0.3px'}}>{t.companies}</h1>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {/* Search */}
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',minWidth:220}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{border:'none',outline:'none',fontSize:13,color:'var(--text)',background:'none',width:'100%',fontFamily:'inherit'}} placeholder="Search companies..."
              value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            {searchQuery && <button onClick={()=>setSearchQuery('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:13,padding:0}}>✕</button>}
          </div>
          {/* Filter */}
          <button onClick={()=>setFilterTrigger(n=>n+1)}
            style={{display:'flex',alignItems:'center',gap:6,background:filterApplied?'var(--accent-light)':'var(--card)',border:filterApplied?'1px solid var(--accent)':'1px solid var(--border)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:filterApplied?'var(--accent)':'var(--text)',cursor:'pointer',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filter {filterApplied && <span style={{width:7,height:7,borderRadius:'50%',background:'#e97316',display:'inline-block',marginLeft:2}}/>}
          </button>
          {/* Refresh */}
          <button onClick={load} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 10px',cursor:'pointer',display:'flex',alignItems:'center',color:'var(--text-muted)'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          {/* Export */}
          <button onClick={exportCSV} style={{display:'flex',alignItems:'center',gap:6,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--text)',cursor:'pointer',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          {/* View — only when selected */}
          {selectedRows.length > 0 && (
            <button style={{display:'flex',alignItems:'center',gap:6,background:'var(--accent-light)',border:'1px solid var(--accent)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--accent)',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View ({selectedRows.length})
            </button>
          )}
          {/* Delete selected — only when selected */}
          {selectedRows.length > 0 && (
            <button onClick={()=>setDelSelectedModal(true)} style={{display:'flex',alignItems:'center',gap:6,background:'var(--danger-bg)',border:'1px solid var(--danger)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--danger)',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              Delete ({selectedRows.length})
            </button>
          )}
          {/* New */}
          <button onClick={openAdd} style={{display:'flex',alignItems:'center',gap:7,background:'#7c3aed',border:'none',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:600,color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Company
          </button>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={treeRows}
        loading={loading}
        onExport={exportCSV}
        filterFields={FILTER_FIELDS}
        filterStorageKey="companies_filter"
        onRefresh={load}
        onSelectionChange={setSelectedRows}
        externalFilterOpen={filterTrigger}
        onExternalFilterClose={()=>{}}
        onFilterApplied={setFilterApplied}
        externalSearch={searchQuery}
      />

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing?t.editCompany:t.addCompany} parentTitle={t.companies} size="md" onSave={handleSave} saving={saving}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.companyType} *</label>
            <select className="form-control" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,parent_id:''}))}>
              <option value="organization">{t.companyTypeOrg}</option>
              <option value="holding">{t.companyTypeHolding}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t.companyCode}</label>
            <input className="form-control" value={form.company_code} onChange={e=>setForm(f=>({...f,company_code:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.companyNameEn} *</label>
            <input className="form-control" value={form.name_en} onChange={e=>setForm(f=>({...f,name_en:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.companyNameAr} *</label>
            <input className="form-control" dir="rtl" value={form.name_ar} onChange={e=>setForm(f=>({...f,name_ar:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.taxId}</label>
            <input className="form-control" value={form.tax_id} onChange={e=>setForm(f=>({...f,tax_id:e.target.value}))} />
          </div>
          {form.type==='organization' && (
            <div className="form-group">
              <label className="form-label">{t.parentCompany}</label>
              <select className="form-control" value={form.parent_id} onChange={e=>setForm(f=>({...f,parent_id:e.target.value}))}>
                <option value="">{t.noParent}</option>
                {holdings.map(h=><option key={h.id} value={h.id}>{h.name_en}</option>)}
              </select>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete single */}
      <Modal open={!!delModal} onClose={()=>setDelModal(null)} title="Delete Company" parentTitle={t.companies} size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{marginTop:8,fontWeight:700,color:'var(--danger)'}}>{delModal.name_en}</p>}
      </Modal>

      {/* Delete selected */}
      <Modal open={delSelectedModal} onClose={()=>setDelSelectedModal(false)} title={`Delete ${selectedRows.length} Companies`} parentTitle={t.companies} size="sm" onSave={handleDeleteSelected} saveLabel="Delete All">
        <p>Are you sure you want to delete <strong>{selectedRows.length}</strong> selected company(s)? This cannot be undone.</p>
      </Modal>
    </div>
  );
}