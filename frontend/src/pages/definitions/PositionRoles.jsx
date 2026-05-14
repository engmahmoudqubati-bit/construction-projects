import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal     from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const PAGE_KEYS   = Object.keys(t.pageKeys);
const ACTION_KEYS = Object.keys(t.actionKeys);
const EMPTY = { position_code:'', name_ar:'', name_en:'', is_active:true, pages:[], actions:[], projects:[] };

const FILTER_FIELDS = [
  { key:'name_en',   label:'Name (English)', type:'text' },
  { key:'is_active', label:'Status', type:'select', options:[{value:'true',label:'Active'},{value:'false',label:'Inactive'}] },
];

export default function PositionRoles() {
  const toast = useToast();
  const { canAction } = useAuth();
  const [roles,        setRoles]        = useState([]);
  const [projects,     setProjects]     = useState([]);
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
    Promise.all([api.getPositionRoles(), api.getProjects()])
      .then(([r,p]) => { setRoles(r); setProjects(p); })
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }

  async function openEdit(r) {
    const perms = await api.getPositionRolePerms(r.id);
    setForm({ position_code:r.position_code||'', name_ar:r.name_ar, name_en:r.name_en, is_active:r.is_active!==false, pages:perms.pages||[], actions:perms.actions||[], projects:perms.projects||[] });
    setEditing(r); setModal(true);
  }

  function toggle(field, key) {
    setForm(f => ({ ...f, [field]: f[field].includes(key) ? f[field].filter(k=>k!==key) : [...f[field],key] }));
  }

  function toggleProject(id) {
    setForm(f => ({ ...f, projects: f.projects.includes(id) ? f.projects.filter(p=>p!==id) : [...f.projects,id] }));
  }

  async function handleToggleActive(r) {
    try {
      await api.updatePositionRole(r.id, { ...r, is_active: !r.is_active });
      setRoles(rs => rs.map(x => x.id===r.id ? {...x, is_active:!r.is_active} : x));
      toast(t.saveSuccess);
    } catch(err) { toast(err.message,'error'); }
  }

  async function handleSave() {
    if (!form.name_ar||!form.name_en) return toast('Both names required','error');
    setSaving(true);
    try {
      if (editing) {
        const u = await api.updatePositionRole(editing.id, form);
        setRoles(rs => rs.map(r => r.id===editing.id ? {...r,...u} : r));
      } else {
        const c = await api.createPositionRole(form);
        setRoles(rs => [...rs,c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch(err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deletePositionRole(delModal.id);
      setRoles(rs => rs.filter(r => r.id!==delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch(err) { toast(err.message,'error'); }
  }

  async function handleDeleteSelected() {
    for (const id of selectedRows) { try { await api.deletePositionRole(id); } catch {} }
    setRoles(rs => rs.filter(r => !selectedRows.includes(r.id)));
    setSelectedRows([]); setDelSelModal(false);
    toast(t.deleteSuccess);
  }

  function exportCSV() {
    const rows = roles.map(r => [r.position_code||'', r.name_en, r.name_ar, r.is_active!==false?'Active':'Inactive'].join(','));
    const csv  = ['Code,Name EN,Name AR,Status',...rows].join('\n');
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='position-roles.csv'; a.click();
  }

  const columns = [
    { key:'position_code', label:'Code', style:{width:100},
      render: r => <span style={{fontSize:13,fontWeight:500,color:'#6b7280'}}>{r.position_code||'—'}</span> },
    { key:'name_en', label:'Position Name',
      render: r => <span style={{fontSize:13,fontWeight:600,color:'#111827'}}>{r.name_en}</span> },
    { key:'name_ar', label:'Position Name (AR)',
      render: r => <span style={{direction:'rtl',fontSize:13,color:'#6b7280'}}>{r.name_ar}</span> },
    { key:'is_active', label:'Status', style:{width:110},
      render: r => (
        <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,
          background:r.is_active!==false?'#dcfce7':'#fee2e2',
          color:r.is_active!==false?'#16a34a':'#dc2626'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'currentColor',flexShrink:0}}></span>
          {r.is_active!==false ? 'Active' : 'Inactive'}
        </span>
      )},
    { key:'actions', label:'Actions', style:{width:160,textAlign:'right'},
      render: r => (
        <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
          <button onClick={()=>handleToggleActive(r)}
            style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:7,
              border:`1px solid ${r.is_active!==false?'#fecaca':'#bbf7d0'}`,
              background:r.is_active!==false?'#fff5f5':'#f0fdf4',
              color:r.is_active!==false?'#dc2626':'#16a34a',
              fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
            {r.is_active!==false ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={()=>canAction('can_edit') && openEdit(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',color:canAction('can_edit')?'var(--text-muted)':'#d1d5db',display:'flex',alignItems:'center',justifyContent:'center',cursor:canAction('can_edit')?'pointer':'not-allowed',opacity:canAction('can_edit')?1:0.5}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={()=>canAction('can_delete') && setDelModal(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid #fecaca',background:'var(--danger-bg)',color:'var(--danger)',display:'flex',alignItems:'center',justifyContent:'center',cursor:canAction('can_delete')?'pointer':'not-allowed',opacity:canAction('can_delete')?1:0.4}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      )},
  ];

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,flexWrap:'wrap'}}>
        <div style={{width:48,height:48,borderRadius:14,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-0.3px'}}>{t.positionRoles}</h1>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',minWidth:220}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{border:'none',outline:'none',fontSize:13,color:'var(--text)',background:'none',width:'100%',fontFamily:'inherit'}} placeholder="Search position roles..."
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
          {canAction('can_export') && (
            <button onClick={exportCSV} style={{display:'flex',alignItems:'center',gap:6,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--text)',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          )}
          {selectedRows.length>0 && canAction('can_delete_selected') && (
            <button onClick={()=>setDelSelModal(true)} style={{display:'flex',alignItems:'center',gap:6,background:'var(--danger-bg)',border:'1px solid var(--danger)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--danger)',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              Delete ({selectedRows.length})
            </button>
          )}
          {canAction('can_create') && (
            <button onClick={openAdd} style={{display:'flex',alignItems:'center',gap:7,background:'#2563eb',border:'none',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:600,color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Role
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={roles}
        loading={loading}
        onExport={exportCSV}
        filterFields={FILTER_FIELDS}
        filterStorageKey="position_roles_filter"
        onRefresh={load}
        onSelectionChange={setSelectedRows}
        externalFilterOpen={filterTrigger}
        onExternalFilterClose={()=>{}}
        onFilterApplied={setFilterApplied}
        externalSearch={searchQuery}
      />

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?t.editPositionRole:t.addPositionRole} parentTitle={t.positionRoles} size="lg" onSave={handleSave} saving={saving}>
        <div className="form-row" style={{marginBottom:16}}>
          <div className="form-group">
            <label className="form-label">Position Code</label>
            <input className="form-control" value={form.position_code} onChange={e=>setForm(f=>({...f,position_code:e.target.value}))} placeholder="e.g. PM-001" />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.is_active?'true':'false'} onChange={e=>setForm(f=>({...f,is_active:e.target.value==='true'}))}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-row" style={{marginBottom:16}}>
          <div className="form-group">
            <label className="form-label">{t.positionRoleNameEn} *</label>
            <input className="form-control" value={form.name_en} onChange={e=>setForm(f=>({...f,name_en:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.positionRoleNameAr} *</label>
            <input className="form-control" dir="rtl" value={form.name_ar} onChange={e=>setForm(f=>({...f,name_ar:e.target.value}))} />
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
          <div className="perm-section">
            <div className="perm-section-title">📄 {t.pagePermissions}</div>
            <div className="perm-grid" style={{gridTemplateColumns:'1fr'}}>
              {PAGE_KEYS.map(k => (
                <label key={k} className="perm-item">
                  <input type="checkbox" checked={form.pages.includes(k)} onChange={()=>toggle('pages',k)} />
                  {t.pageKeys[k]}
                </label>
              ))}
            </div>
          </div>
          <div className="perm-section">
            <div className="perm-section-title">⚙️ {t.actionPermissions}</div>
            <div className="perm-grid" style={{gridTemplateColumns:'1fr'}}>
              {ACTION_KEYS.map(k => (
                <label key={k} className="perm-item">
                  <input type="checkbox" checked={form.actions.includes(k)} onChange={()=>toggle('actions',k)} />
                  {t.actionKeys[k]}
                </label>
              ))}
            </div>
          </div>
          <div className="perm-section">
            <div className="perm-section-title">🏗️ {t.projectAccess}</div>
            <div className="perm-grid" style={{gridTemplateColumns:'1fr',maxHeight:240,overflowY:'auto'}}>
              {projects.map(p => (
                <label key={p.id} className="perm-item">
                  <input type="checkbox" checked={form.projects.includes(p.id)} onChange={()=>toggleProject(p.id)} />
                  {p.project_name_en}
                </label>
              ))}
              {projects.length===0 && <span style={{fontSize:12,color:'var(--text-muted)'}}>No projects yet</span>}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={()=>setDelModal(null)} title="Delete Position Role" parentTitle={t.positionRoles} size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{marginTop:8,fontWeight:700,color:'var(--danger)'}}>{delModal.name_en}</p>}
      </Modal>

      <Modal open={delSelModal} onClose={()=>setDelSelModal(false)} title={`Delete ${selectedRows.length} Roles`} parentTitle={t.positionRoles} size="sm" onSave={handleDeleteSelected} saveLabel="Delete All">
        <p>Are you sure you want to delete <strong>{selectedRows.length}</strong> selected role(s)?</p>
      </Modal>
    </div>
  );
}