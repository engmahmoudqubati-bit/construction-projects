import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import Modal      from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import t from '../../lang';

const EMPTY = { full_name_ar:'', full_name_en:'', username:'', password:'', email:'', photo_url:'', position_role_id:'', company_id:'', project_access:[] };

function smartSearch(users, q) {
  if (!q) return users;
  const lq = q.toLowerCase();
  return users.filter(u =>
    (u.full_name_en||'').toLowerCase().includes(lq) ||
    (u.full_name_ar||'').includes(q) ||
    (u.username||'').toLowerCase().includes(lq) ||
    (u.email||'').toLowerCase().includes(lq) ||
    (u.position_role_name||'').toLowerCase().includes(lq) ||
    (u.company_name||'').toLowerCase().includes(lq)
  );
}

export default function Users() {
  const toast = useToast();
  const photoRef = useRef();
  const [users,         setUsers]         = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [positionRoles, setPositionRoles] = useState([]);
  const [companies,     setCompanies]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [form,          setForm]          = useState(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [search,        setSearch]        = useState('');
  const [delModal,      setDelModal]      = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getUsers(), api.getProjects(), api.getPositionRoles(), api.getCompanies()])
      .then(([u,p,pr,co]) => { setUsers(u); setProjects(p); setPositionRoles(pr); setCompanies(co); })
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function openEdit(user) {
    const perms = await api.getUserPerms(user.id);
    setForm({ full_name_ar:user.full_name_ar||'', full_name_en:user.full_name_en||'', username:user.username, password:'', email:user.email||'', photo_url:user.photo_url||'', position_role_id:user.position_role_id||'', company_id:user.company_id||'', project_access:perms.projects||[] });
    setEditing(user); setModal(true);
  }

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => setForm(f => ({ ...f, photo_url: ev.target.result }));
    r.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.full_name_en) return toast('Full Name (English) is required','error');
    if (!form.username) return toast('Username is required','error');
    if (!form.position_role_id) return toast('Position Role is required','error');
    if (!editing && !form.password) return toast('Password is required for new users','error');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.position_role_id) payload.position_role_id = null;
      if (!payload.company_id) payload.company_id = null;
      if (editing) {
        const u = await api.updateUser(editing.id, payload);
        setUsers(us => us.map(x => x.id === editing.id ? { ...x, ...u } : x));
      } else {
        const c = await api.createUser(payload);
        setUsers(us => [...us, c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch (err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleToggle(user) {
    try {
      const u = await api.toggleUser(user.id);
      setUsers(us => us.map(x => x.id === user.id ? { ...x, ...u } : x));
    } catch (err) { toast(err.message,'error'); }
  }

  async function handleDelete() {
    try {
      await api.deleteUser(delModal.id);
      setUsers(us => us.filter(x => x.id !== delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch (err) { toast(err.message,'error'); }
  }

  const filtered = smartSearch(users, search);

  return (
    <div>
      <div className="page-header">
        <h1>{t.users}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t.addUser}</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <RefreshButton onRefresh={load} />
        </div>
        {loading ? <div className="spinner-wrap"><div className="spinner"/></div> : (
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th></th><th>{t.fullNameEn}</th><th>{t.fullNameAr}</th>
                <th>{t.username}</th><th>{t.positionRole}</th>
                <th>{t.companies}</th><th>{t.email}</th><th>{t.status}</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>{t.noData}</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id}>
                    <td style={{ width:40 }}>
                      {u.photo_url
                        ? <img src={u.photo_url} alt="" style={{ width:32,height:32,borderRadius:'50%',objectFit:'cover' }} />
                        : <div style={{ width:32,height:32,borderRadius:'50%',background:'var(--bg2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>👤</div>
                      }
                    </td>
                    <td style={{ fontWeight:500 }}>{u.full_name_en}</td>
                    <td dir="rtl">{u.full_name_ar}</td>
                    <td style={{ color:'var(--text-muted)',fontSize:12 }}>{u.username}</td>
                    <td>{u.position_role_name || '—'}</td>
                    <td style={{ fontSize:12 }}>{u.company_name || '—'}</td>
                    <td style={{ fontSize:12 }}>{u.email || '—'}</td>
                    <td><StatusBadge value={u.is_active ? 'active' : 'inactive'} /></td>
                    <td><div className="td-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>{t.edit}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(u)}>{u.is_active ? t.inactive : t.active}</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDelModal(u)}>{t.delete}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? t.editUser : t.addUser} size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.save}</button></>}>

        {/* Photo */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          <div style={{ width:60,height:60,borderRadius:'50%',background:'var(--bg2)',border:'2px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',cursor:'pointer',flexShrink:0 }}
            onClick={() => photoRef.current?.click()}>
            {form.photo_url ? <img src={form.photo_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} /> : <span style={{ fontSize:22 }}>👤</span>}
          </div>
          <div>
            <button className="btn btn-secondary btn-sm" onClick={() => photoRef.current?.click()}>{t.profilePicture}</button>
            {form.photo_url && <button className="btn btn-secondary btn-sm" style={{ marginLeft:6 }} onClick={() => setForm(f => ({ ...f, photo_url:'' }))}>✕</button>}
            <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.fullNameEn} *</label>
            <input className="form-control" value={form.full_name_en} onChange={e => setForm(f => ({ ...f, full_name_en:e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.fullNameAr} *</label>
            <input className="form-control" dir="rtl" value={form.full_name_ar} onChange={e => setForm(f => ({ ...f, full_name_ar:e.target.value }))} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.username} *</label>
            <input className="form-control" value={form.username} onChange={e => setForm(f => ({ ...f, username:e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{editing ? t.newPassword : `${t.password} *`}</label>
            <input className="form-control" type="password" value={form.password}
              placeholder={editing ? t.leaveBlankPassword : ''} onChange={e => setForm(f => ({ ...f, password:e.target.value }))} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.positionRole} *</label>
            <select className="form-control" value={form.position_role_id} onChange={e => setForm(f => ({ ...f, position_role_id:e.target.value }))}>
              <option value="">— {t.positionRole} —</option>
              {positionRoles.map(pr => <option key={pr.id} value={pr.id}>{pr.name_en}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t.email}</label>
            <input className="form-control" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email:e.target.value }))} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t.companies}</label>
          <select className="form-control" value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id:e.target.value }))}>
            <option value="">— {t.companies} —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
          </select>
        </div>

        <hr style={{ border:'none', borderTop:'1px solid var(--border)', margin:'14px 0' }} />
        <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>{t.permissionsNote}</p>
        <label className="form-label">{t.projectAccess}</label>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:6, marginTop:6 }}>
          {projects.map(p => (
            <label key={p.id} className="perm-item">
              <input type="checkbox" checked={(form.project_access||[]).includes(p.id)}
                onChange={() => setForm(f => ({ ...f, project_access: f.project_access.includes(p.id) ? f.project_access.filter(x => x !== p.id) : [...f.project_access, p.id] }))} />
              {p.project_name_en}
            </label>
          ))}
          {projects.length === 0 && <span style={{ fontSize:12, color:'var(--text-muted)' }}>No projects</span>}
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)} title={t.delete} size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setDelModal(null)}>{t.cancel}</button>
          <button className="btn btn-danger" onClick={handleDelete}>{t.delete}</button></>}>
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:600 }}>{delModal.full_name_en}</p>}
      </Modal>
    </div>
  );
}