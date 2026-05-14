import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal     from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const EMPTY = { company_code:'', name_ar:'', name_en:'', type:'organization', tax_id:'', parent_id:'' };
const FILTER_FIELDS = [
  { key:'type', label:'Type', type:'select', options:[{value:'holding',label:'Holding'},{value:'organization',label:'Organization'}] },
  { key:'name_en', label:'Name (English)', type:'text' },
  { key:'tax_id',  label:'Tax ID', type:'text' },
];

const modalOverlayStyle = {
  position:'fixed', inset:0, background:'rgba(15,23,42,0.36)', backdropFilter:'blur(4px)', zIndex:1000,
  display:'flex', alignItems:'center', justifyContent:'center', padding:20
};
const modalPanelStyle = {
  background:'var(--card)', borderRadius:16, boxShadow:'0 24px 60px rgba(0,0,0,0.18)',
  width:'100%', maxWidth:680, overflow:'hidden'
};
const modalHeaderStyle = {
  background:'linear-gradient(135deg,#1f3a5f 0%,#2563eb 100%)', padding:'18px 24px',
  display:'flex', alignItems:'center', justifyContent:'space-between'
};
const modalCloseStyle = {
  background:'rgba(255,255,255,0.18)', border:'none', color:'#fff', borderRadius:8,
  width:32, height:32, cursor:'pointer', fontSize:16
};
const modalFooterStyle = {
  padding:'14px 20px', borderTop:'1px solid var(--border-light)', display:'flex', justifyContent:'flex-end',
  gap:8, background:'var(--card2)'
};
const cancelBtnStyle = {
  background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 18px',
  fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text)'
};
const primaryBtnStyle = {
  background:'linear-gradient(135deg,#1f3a5f,#2563eb)', border:'none', borderRadius:8, padding:'8px 20px',
  fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit',
  boxShadow:'0 8px 18px rgba(37,99,235,0.22)'
};
const fieldBoxStyle = {
  border:'1px solid #e5e7eb', borderRadius:12, padding:14, background:'#fafbff'
};
const labelStyle = {
  display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em',
  color:'#64748b', marginBottom:7
};
const inputStyle = {
  width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13,
  fontFamily:'inherit', outline:'none', color:'var(--text)', background:'#fff'
};
const valueLabelStyle = {
  fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:'#64748b', marginBottom:5
};

function CompanyFormModal({ open, editing, form, setForm, holdings, onClose, onSave, saving }) {
  if (!open) return null;
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalPanelStyle} onClick={e=>e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>
              Companies › {editing ? 'Edit' : 'New'}
            </div>
            <div style={{ fontSize:17, fontWeight:700, color:'#fff' }}>{editing ? t.editCompany : t.addCompany}</div>
          </div>
          <button onClick={onClose} style={modalCloseStyle}>✕</button>
        </div>

        <div style={{ padding:20 }}>
          <p style={{ fontSize:12, color:'#6b7280', margin:'0 0 16px' }}>
            Maintain company profile information using the same clean Installation window style.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:14 }}>
            <div style={fieldBoxStyle}>
              <label style={labelStyle}>{t.companyType} *</label>
              <select style={inputStyle} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,parent_id:''}))}>
                <option value="organization">{t.companyTypeOrg}</option>
                <option value="holding">{t.companyTypeHolding}</option>
              </select>
            </div>
            <div style={fieldBoxStyle}>
              <label style={labelStyle}>{t.companyCode}</label>
              <input style={inputStyle} value={form.company_code} onChange={e=>setForm(f=>({...f,company_code:e.target.value}))} placeholder="Auto / Manual code" />
            </div>
            <div style={fieldBoxStyle}>
              <label style={labelStyle}>{t.companyNameEn} *</label>
              <input style={inputStyle} value={form.name_en} onChange={e=>setForm(f=>({...f,name_en:e.target.value}))} placeholder="Company name in English" />
            </div>
            <div style={fieldBoxStyle}>
              <label style={labelStyle}>{t.companyNameAr} *</label>
              <input style={inputStyle} dir="rtl" value={form.name_ar} onChange={e=>setForm(f=>({...f,name_ar:e.target.value}))} placeholder="اسم الشركة بالعربي" />
            </div>
            <div style={fieldBoxStyle}>
              <label style={labelStyle}>{t.taxId}</label>
              <input style={inputStyle} value={form.tax_id} onChange={e=>setForm(f=>({...f,tax_id:e.target.value}))} placeholder="Tax registration number" />
            </div>
            {form.type==='organization' && (
              <div style={fieldBoxStyle}>
                <label style={labelStyle}>{t.parentCompany}</label>
                <select style={inputStyle} value={form.parent_id} onChange={e=>setForm(f=>({...f,parent_id:e.target.value}))}>
                  <option value="">{t.noParent}</option>
                  {holdings.map(h=><option key={h.id} value={h.id}>{h.name_en}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <div style={modalFooterStyle}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={{ ...primaryBtnStyle, opacity:saving?0.75:1 }}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Company'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompanyViewModal({ company, parentName, onClose }) {
  if (!company) return null;
  const rows = [
    ['Code', company.company_code || '—'],
    ['Type', company.type === 'holding' ? t.companyTypeHolding : t.companyTypeOrg],
    ['Name (EN)', company.name_en || '—'],
    ['Name (AR)', company.name_ar || '—'],
    ['Tax ID', company.tax_id || '—'],
    ['Parent Company', parentName || '—'],
  ];
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{ ...modalPanelStyle, maxWidth:600 }} onClick={e=>e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Companies › View</div>
            <div style={{ fontSize:17, fontWeight:700, color:'#fff' }}>{company.name_en}</div>
          </div>
          <button onClick={onClose} style={modalCloseStyle}>✕</button>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:14 }}>
            {rows.map(([l,v])=>(
              <div key={l} style={fieldBoxStyle}>
                <div style={valueLabelStyle}>{l}</div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', direction:l.includes('(AR)')?'rtl':'ltr', textAlign:l.includes('(AR)')?'right':'left' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={modalFooterStyle}>
          <button onClick={onClose} style={cancelBtnStyle}>✕ Close</button>
        </div>
      </div>
    </div>
  );
}


export default function Companies() {
  const toast = useToast();
  const { canAction } = useAuth();
  const [companies,    setCompanies]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [form,         setForm]         = useState(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [delModal,     setDelModal]     = useState(null);
  const [viewModal,    setViewModal]    = useState(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterTrigger,setFilterTrigger]= useState(0);
  const [filterApplied,setFilterApplied]= useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [delSelModal,  setDelSelModal]  = useState(false);

  const load = () => {
    setLoading(true);
    api.getCompanies().then(setCompanies).catch(()=>toast(t.errorOccurred,'error')).finally(()=>setLoading(false));
  };
  useEffect(load, []);

  const holdings = companies.filter(c => c.type==='holding');

  function openAdd()   { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(c) {
    setForm({ company_code:c.company_code||'', name_ar:c.name_ar, name_en:c.name_en, type:c.type, tax_id:c.tax_id||'', parent_id:c.parent_id||'' });
    setEditing(c); setModal(true);
  }

  async function handleSave() {
    if (!form.name_ar||!form.name_en) return toast('Both names required','error');
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.type==='organization'&&form.parent_id ? Number(form.parent_id) : null };
      if (editing) { const u=await api.updateCompany(editing.id,payload); setCompanies(cs=>cs.map(c=>c.id===editing.id?u:c)); }
      else         { const c=await api.createCompany(payload); setCompanies(cs=>[...cs,c]); }
      toast(t.saveSuccess); setModal(false);
    } catch(err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try { await api.deleteCompany(delModal.id); setCompanies(cs=>cs.filter(c=>c.id!==delModal.id)); toast(t.deleteSuccess); setDelModal(null); }
    catch(err) { toast(err.message,'error'); }
  }

  async function handleDeleteSelected() {
    for (const id of selectedRows) { try { await api.deleteCompany(id); } catch {} }
    setCompanies(cs=>cs.filter(c=>!selectedRows.includes(c.id)));
    setSelectedRows([]); setDelSelModal(false); toast(t.deleteSuccess);
  }

  function exportCSV() {
    const rows = companies.map(c=>[c.company_code||'',c.name_en,c.name_ar,c.type,c.tax_id||''].join(','));
    const csv = ['Code,Name EN,Name AR,Type,Tax ID',...rows].join('\n');
    const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='companies.csv'; a.click();
  }

  function buildTree(all) {
    const rows = [];
    all.filter(c=>c.type==='holding').forEach(h => {
      rows.push({...h,_level:0});
      all.filter(o=>o.type==='organization'&&o.parent_id===h.id).forEach(o=>rows.push({...o,_level:1}));
    });
    all.filter(o=>o.type==='organization'&&!o.parent_id).forEach(o=>rows.push({...o,_level:0}));
    return rows;
  }

  const columns = [
    { key:'company_code', label:'Code', style:{width:100},
      render: r=><span style={{fontSize:13,fontWeight:500,color:'#6b7280'}}>{r.company_code||'—'}</span> },
    { key:'name_en', label:'Company Name',
      render: r=>(
        <div style={{paddingLeft:r._level>0?24:0,display:'flex',alignItems:'center',gap:6}}>
          {r._level>0 && <span style={{color:'#9ca3af',fontSize:11}}>└─</span>}
          <span style={{fontSize:13,fontWeight:r.type==='holding'?700:600,color:'#111827'}}>{r.name_en}</span>
        </div>
      )},
    { key:'name_ar', label:'Company Name (AR)', render: r=><span style={{direction:'rtl',fontSize:13,color:'#6b7280'}}>{r.name_ar}</span> },
    { key:'type', label:'Type',
      render: r=><span style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:r.type==='holding'?'#eff6ff':'#eff6ff',color:r.type==='holding'?'#2563eb':'#1d4ed8'}}>{r.type==='holding'?t.companyTypeHolding:t.companyTypeOrg}</span> },
    { key:'tax_id', label:'Tax ID', render: r=><span style={{fontSize:12,color:'#6b7280'}}>{r.tax_id||'—'}</span> },
    { key:'actions', label:'Actions', style:{width:120,textAlign:'right'},
      render: r=>(
        <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
          <button onClick={()=>setViewModal(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid #bfdbfe',background:'#eff6ff',color:'#1d4ed8',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button onClick={()=>canAction('can_edit')&&openEdit(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-muted)',display:canAction('can_edit')?'flex':'none',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={()=>canAction('can_delete')&&setDelModal(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid #fecaca',background:'var(--danger-bg)',color:'var(--danger)',display:canAction('can_delete')?'flex':'none',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      )},
  ];

  const Hdr = ({label,title}) => (
    <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,flexWrap:'wrap'}}>
      <div style={{width:48,height:48,borderRadius:14,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div><h1 style={{fontSize:20,fontWeight:700,color:'var(--text)'}}>{title}</h1></div>
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',minWidth:220}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input style={{border:'none',outline:'none',fontSize:13,color:'var(--text)',background:'none',width:'100%',fontFamily:'inherit'}} placeholder="Search companies..."
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
        <button onClick={exportCSV} style={{display:'flex',alignItems:'center',gap:6,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--text)',cursor:'pointer',fontFamily:'inherit'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        {selectedRows.length>0 && (
          <button onClick={()=>setDelSelModal(true)} style={{display:'flex',alignItems:'center',gap:6,background:'var(--danger-bg)',border:'1px solid var(--danger)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--danger)',cursor:'pointer',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            Delete ({selectedRows.length})
          </button>
        )}
        <button onClick={openAdd} style={{display:'flex',alignItems:'center',gap:7,background:'#2563eb',border:'none',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:600,color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Company
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <Hdr title={t.companies} />
      <DataTable columns={columns} data={buildTree(companies)} loading={loading}
        filterFields={FILTER_FIELDS} filterStorageKey="companies_filter"
        onRefresh={load} onSelectionChange={setSelectedRows}
        externalFilterOpen={filterTrigger} onExternalFilterClose={()=>{}}
        onFilterApplied={setFilterApplied} externalSearch={searchQuery} />

      <CompanyViewModal
        company={viewModal}
        parentName={viewModal?.parent_id ? companies.find(c=>c.id===viewModal.parent_id)?.name_en : ''}
        onClose={()=>setViewModal(null)}
      />

      <CompanyFormModal
        open={modal}
        editing={editing}
        form={form}
        setForm={setForm}
        holdings={holdings}
        onClose={()=>setModal(false)}
        onSave={handleSave}
        saving={saving}
      />

      <Modal open={!!delModal} onClose={()=>setDelModal(null)} title="Delete Company" parentTitle={t.companies} size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{marginTop:8,fontWeight:700,color:'var(--danger)'}}>{delModal.name_en}</p>}
      </Modal>
      <Modal open={delSelModal} onClose={()=>setDelSelModal(false)} title={`Delete ${selectedRows.length} Companies`} parentTitle={t.companies} size="sm" onSave={handleDeleteSelected} saveLabel="Delete All">
        <p>Delete <strong>{selectedRows.length}</strong> company(s)?</p>
      </Modal>
    </div>
  );
}