import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal     from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const FILTER_FIELDS = [
  { key:'role', label:'Role', type:'select', options:[
    {value:'admin',label:'Admin'},{value:'project_manager',label:'Project Manager'},{value:'site_engineer',label:'Site Engineer'},
  ]},
  { key:'is_active', label:'Status', type:'select', options:[
    {value:'true',label:'Active'},{value:'false',label:'Inactive'},
  ]},
];

const EMPTY = {
  user_code:'', full_name_en:'', full_name_ar:'', username:'', password:'',
  email:'', phone:'', position_role_id:'', photo_url:'',
  role:'site_engineer', page_permissions:[], project_access:[],
};

export default function Users() {
  const toast = useToast();
  const { canAction } = useAuth();
  const fileRef = useRef();
  const [users,        setUsers]        = useState([]);
  const [posRoles,     setPosRoles]     = useState([]);
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
  const [photoPreview, setPhotoPreview] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getUsers(), api.getProjects(), api.getPositionRoles()])
      .then(([u,p,pr]) => { setUsers(u); setProjects(p); setPosRoles(pr); })
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openAdd() { setForm(EMPTY); setEditing(null); setPhotoPreview(null); setModal(true); }

  async function openEdit(user) {
    setForm({
      user_code: user.user_code||'',
      full_name_en: user.full_name_en||user.full_name||'',
      full_name_ar: user.full_name_ar||'',
      username: user.username,
      password: '',
      email: user.email||'',
      phone: user.phone||'',
      position_role_id: user.position_role_id||'',
      photo_url: user.photo_url||'',
      role: user.role,

    });
    setPhotoPreview(user.photo_url||null);
    setEditing(user); setModal(true);
  }



  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPhotoPreview(ev.target.result);
      setForm(f => ({ ...f, photo_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.full_name_en || !form.username) return toast('English name and username are required','error');
    if (!editing && !form.password) return toast('Password is required for new users','error');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      const full_name = form.full_name_en + (form.full_name_ar ? ` / ${form.full_name_ar}` : '');
      payload.full_name = full_name;
      if (editing) {
        const updated = await api.updateUser(editing.id, payload);
        setUsers(u => u.map(x => x.id===editing.id ? {...x,...updated} : x));
      } else {
        const created = await api.createUser(payload);
        setUsers(u => [...u,created]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch(err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleToggle(user) {
    try {
      const updated = await api.toggleUser(user.id);
      setUsers(u => u.map(x => x.id===user.id ? {...x,...updated} : x));
      toast(updated.is_active ? 'User activated' : 'User deactivated');
    } catch(err) { toast(err.message,'error'); }
  }

  async function handleDelete() {
    try {
      await api.deleteUser(delModal.id);
      setUsers(u => u.filter(x => x.id!==delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch(err) { toast(err.message,'error'); }
  }

  async function handleDeleteSelected() {
    for (const id of selectedRows) { try { await api.deleteUser(id); } catch {} }
    setUsers(u => u.filter(x => !selectedRows.includes(x.id)));
    setSelectedRows([]); setDelSelModal(false); toast(t.deleteSuccess);
  }

  function exportCSV() {
    const rows = users.map(u => [u.user_code||'',u.full_name_en||u.full_name||'',u.full_name_ar||'',u.username,u.email||'',u.phone||'',u.role,u.is_active?'Active':'Inactive'].join(','));
    const csv = ['Code,Name EN,Name AR,Username,Email,Phone,Role,Status',...rows].join('\n');
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='users.csv'; a.click();
  }

  const columns = [
    { key:'user_code', label:'Code', style:{width:90},
      render: r => <span style={{fontSize:13,fontWeight:500,color:'#6b7280'}}>{r.user_code||'—'}</span> },
    { key:'photo_url', label:'', style:{width:48},
      render: r => r.photo_url
        ? <img src={r.photo_url} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)'}} />
        : <div style={{width:32,height:32,borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#2563eb'}}>
            {(r.full_name_en||r.full_name||'?')[0].toUpperCase()}
          </div> },
    { key:'full_name_en', label:'Full Name',
      render: r => (
        <div style={{maxWidth:220}}>
          <div style={{fontSize:13,fontWeight:600,color:'#111827',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.full_name_en||r.full_name||'—'}</div>
          {r.full_name_ar && <div style={{fontSize:11,color:'#6b7280',direction:'rtl',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.full_name_ar}</div>}
        </div>
      )},
    { key:'username', label:'Username',
      render: r => <span style={{fontFamily:'monospace',fontSize:12,color:'#6b7280'}}>{r.username}</span> },
    { key:'role', label:'Role',
      render: r => {
        const s = {admin:{bg:'#eff6ff',c:'#2563eb'},project_manager:{bg:'#eff6ff',c:'#1d4ed8'},site_engineer:{bg:'#f0fdf4',c:'#16a34a'}}[r.role]||{bg:'#f3f4f6',c:'#6b7280'};
        return <span style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:s.bg,color:s.c}}>{t.roles[r.role]||r.role}</span>;
      }},
    { key:'position_role_name', label:'Position', render: r => <span style={{fontSize:12,color:'#6b7280'}}>{r.position_role_name||'—'}</span> },
    { key:'is_active', label:'Status', style:{width:100},
      render: r => (
        <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,
          background:r.is_active?'#dcfce7':'#fee2e2', color:r.is_active?'#16a34a':'#dc2626'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'currentColor'}}></span>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      )},
    { key:'actions', label:'Actions', style:{width:150,textAlign:'right'},
      render: r => (
        <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
          <button onClick={()=>handleToggle(r)}
            style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:7,
              border:`1px solid ${r.is_active?'#fecaca':'#bbf7d0'}`,
              background:r.is_active?'#fff5f5':'#f0fdf4',
              color:r.is_active?'#dc2626':'#16a34a',
              fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
            {r.is_active ? 'Deactivate' : 'Activate'}
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
      {/* Page header */}
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,flexWrap:'wrap'}}>
        <div style={{width:48,height:48,borderRadius:14,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div><h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:'-0.3px'}}>{t.users}</h1></div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',minWidth:220}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{border:'none',outline:'none',fontSize:13,color:'var(--text)',background:'none',width:'100%',fontFamily:'inherit'}} placeholder="Search users..."
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
          {selectedRows.length > 0 && canAction('can_delete_selected') && (
            <button onClick={()=>setDelSelModal(true)} style={{display:'flex',alignItems:'center',gap:6,background:'var(--danger-bg)',border:'1px solid var(--danger)',borderRadius:10,padding:'8px 16px',fontSize:13,fontWeight:500,color:'var(--danger)',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              Delete ({selectedRows.length})
            </button>
          )}
          {canAction('can_create') && (
            <button onClick={openAdd} style={{display:'flex',alignItems:'center',gap:7,background:'#2563eb',border:'none',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:600,color:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New User
            </button>
          )}
        </div>
      </div>

      <DataTable columns={columns} data={users} loading={loading}
        onExport={exportCSV} filterFields={FILTER_FIELDS} filterStorageKey="users_filter"
        onRefresh={load} onSelectionChange={setSelectedRows}
        externalFilterOpen={filterTrigger} onExternalFilterClose={()=>{}}
        onFilterApplied={setFilterApplied} externalSearch={searchQuery} />

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing?t.editUser:t.addUser} parentTitle={t.users} size="lg" onSave={handleSave} saving={saving}>

        {/* Profile photo */}
        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,padding:'16px',background:'var(--card2)',borderRadius:10,border:'1px solid var(--border-light)'}}>
          <div style={{position:'relative',cursor:'pointer'}} onClick={()=>fileRef.current.click()}>
            {photoPreview
              ? <img src={photoPreview} alt="" style={{width:72,height:72,borderRadius:'50%',objectFit:'cover',border:'3px solid #2563eb'}} />
              : <div style={{width:72,height:72,borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',border:'3px dashed #c4b5fd'}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
            }
            <div style={{position:'absolute',bottom:0,right:0,width:22,height:22,background:'#2563eb',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #fff'}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>Profile Photo</div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Click to upload — JPG, PNG (max 2MB)</div>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhotoChange} />
          </div>
        </div>

        {/* Row 1: Code + Status via Position Role */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">User Code</label>
            <input className="form-control" value={form.user_code} placeholder="e.g. USR-001"
              onChange={e=>setForm(f=>({...f,user_code:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Position Role</label>
            <select className="form-control" value={form.position_role_id} onChange={e=>setForm(f=>({...f,position_role_id:e.target.value}))}>
              <option value="">— Select Position —</option>
              {posRoles.filter(r=>r.is_active!==false).map(r=><option key={r.id} value={r.id}>{r.name_en}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Full name EN + AR */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Full Name (English) *</label>
            <input className="form-control" value={form.full_name_en}
              onChange={e=>setForm(f=>({...f,full_name_en:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name (Arabic)</label>
            <input className="form-control" dir="rtl" value={form.full_name_ar}
              onChange={e=>setForm(f=>({...f,full_name_ar:e.target.value}))} />
          </div>
        </div>

        {/* Row 3: Username + Password */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.username} *</label>
            <input className="form-control" value={form.username}
              onChange={e=>setForm(f=>({...f,username:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{editing ? t.newPassword : `${t.password} *`}</label>
            <input className="form-control" type="password" value={form.password}
              placeholder={editing ? t.leaveBlankPassword : ''}
              onChange={e=>setForm(f=>({...f,password:e.target.value}))} />
          </div>
        </div>

        {/* Row 4: Email + Phone */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={form.email}
              onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <div style={{display:'flex',alignItems:'center',gap:0}}>
              <span style={{background:'var(--bg2)',border:'1.5px solid var(--border)',borderRight:'none',borderRadius:'var(--radius-sm) 0 0 var(--radius-sm)',padding:'9px 10px',fontSize:13,color:'var(--text-muted)',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:5}}>
                🇸🇦 +966
              </span>
              <input className="form-control" value={form.phone} placeholder="5XXXXXXXX"
                style={{borderRadius:'0 var(--radius-sm) var(--radius-sm) 0'}}
                onChange={e=>setForm(f=>({...f,phone:e.target.value.replace(/[^0-9]/g,'')}))} />
            </div>
          </div>
        </div>

        {/* Permissions note */}
        <hr className="section-divider" />
        <div style={{background:'var(--card2)',border:'1px solid var(--border-light)',borderRadius:8,padding:'12px 16px',fontSize:13,color:'var(--text-muted)'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:6,verticalAlign:'middle'}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Permissions are managed through <strong>Position Roles</strong>. Assign a position role above to apply permissions.
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={()=>setDelModal(null)} title="Delete User" parentTitle={t.users} size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{marginTop:8,fontWeight:700,color:'var(--danger)'}}>{delModal.full_name_en||delModal.full_name}</p>}
      </Modal>

      <Modal open={delSelModal} onClose={()=>setDelSelModal(false)} title={`Delete ${selectedRows.length} Users`} parentTitle={t.users} size="sm" onSave={handleDeleteSelected} saveLabel="Delete All">
        <p>Are you sure you want to delete <strong>{selectedRows.length}</strong> selected user(s)?</p>
      </Modal>
    </div>
  );
}