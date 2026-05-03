import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DataTable    from '../../components/shared/DataTable';
import Modal        from '../../components/shared/Modal';
import StatusBadge  from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const ROLES = ['admin', 'project_manager', 'site_engineer'];

const EMPTY = {
  full_name: '', full_name_ar: '', full_name_en: '',
  username: '', password: '', role: 'site_engineer', email: '',
  photo_url: '', position_role_id: '', company_id: '',
  project_access: [],
};

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

  useEffect(() => {
    Promise.all([api.getUsers(), api.getProjects(), api.getPositionRoles(), api.getCompanies()])
      .then(([u, p, pr, co]) => { setUsers(u); setProjects(p); setPositionRoles(pr); setCompanies(co); })
      .catch(() => toast(t.errorOccurred, 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function openEdit(user) {
    const perms = await api.getUserPerms(user.id);
    setForm({
      full_name: user.full_name,
      full_name_ar: user.full_name_ar || '',
      full_name_en: user.full_name_en || '',
      username: user.username,
      password: '',
      role: user.role,
      email: user.email || '',
      photo_url: user.photo_url || '',
      position_role_id: user.position_role_id || '',
      company_id: user.company_id || '',
      project_access: perms.projects,
    });
    setEditing(user);
    setModal(true);
  }

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }

  function toggleProject(id) {
    setForm(f => ({
      ...f,
      project_access: f.project_access.includes(id)
        ? f.project_access.filter(p => p !== id)
        : [...f.project_access, id],
    }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, photo_url: ev.target.result }));
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.full_name || !form.username || !form.role)
      return toast('Full name, username and role are required', 'error');
    if (!editing && !form.password) return toast('Password is required for new users', 'error');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.position_role_id) payload.position_role_id = null;
      if (!payload.company_id) payload.company_id = null;
      if (editing) {
        const updated = await api.updateUser(editing.id, payload);
        setUsers(u => u.map(x => x.id === editing.id ? { ...x, ...updated } : x));
      } else {
        const created = await api.createUser(payload);
        setUsers(u => [...u, created]);
      }
      toast(t.saveSuccess);
      setModal(false);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleToggle(user) {
    try {
      const updated = await api.toggleUser(user.id);
      setUsers(u => u.map(x => x.id === user.id ? { ...x, ...updated } : x));
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleDelete() {
    try {
      await api.deleteUser(delModal.id);
      setUsers(u => u.filter(x => x.id !== delModal.id));
      toast(t.deleteSuccess);
      setDelModal(null);
    } catch (err) { toast(err.message, 'error'); }
  }

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const projectLabel = (p) => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  const columns = [
    { key: 'photo', label: '', render: r => (
      r.photo_url
        ? <img src={r.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
        : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
    )},
    { key: 'full_name',  label: t.fullName },
    { key: 'username',   label: t.username },
    { key: 'role',       label: t.role,   render: r => <StatusBadge value={r.role} /> },
    { key: 'position_role_name', label: t.positionRole },
    { key: 'email',      label: t.email },
    { key: 'is_active',  label: t.status, render: r => <StatusBadge value={r.is_active ? 'active' : 'inactive'} /> },
    { key: 'actions',    label: '', render: r => (
      <div className="td-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>{t.edit}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(r)}>
          {r.is_active ? t.inactive : t.active}
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => setDelModal(r)}>{t.delete}</button>
      </div>
    )},
  ];

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
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} />
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? t.editUser : t.addUser}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.save}
            </button>
          </>
        }
      >
        {/* Photo upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div
            style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--card2)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer' }}
            onClick={() => photoRef.current?.click()}
          >
            {form.photo_url
              ? <img src={form.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 24 }}>👤</span>
            }
          </div>
          <div>
            <button className="btn btn-secondary btn-sm" onClick={() => photoRef.current?.click()}>
              {t.profilePicture}
            </button>
            {form.photo_url && (
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => setForm(f => ({ ...f, photo_url: '' }))}>
                ✕
              </button>
            )}
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.fullName} *</label>
            <input className="form-control" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.fullNameAr}</label>
            <input className="form-control" dir="rtl" value={form.full_name_ar}
              onChange={e => setForm(f => ({ ...f, full_name_ar: e.target.value }))} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.fullNameEn}</label>
            <input className="form-control" value={form.full_name_en}
              onChange={e => setForm(f => ({ ...f, full_name_en: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.username} *</label>
            <input className="form-control" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{editing ? t.newPassword : `${t.password} *`}</label>
            <input className="form-control" type="password" value={form.password}
              placeholder={editing ? t.leaveBlankPassword : ''}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.email}</label>
            <input className="form-control" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.role} *</label>
            <select className="form-control" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{t.roles[r]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t.positionRole}</label>
            <select className="form-control" value={form.position_role_id}
              onChange={e => setForm(f => ({ ...f, position_role_id: e.target.value }))}>
              <option value="">— {t.positionRole} —</option>
              {positionRoles.map(pr => (
                <option key={pr.id} value={pr.id}>{pr.name_en}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t.companies}</label>
          <select className="form-control" value={form.company_id}
            onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}>
            <option value="">— {t.companies} —</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name_en}</option>
            ))}
          </select>
        </div>

        {/* Project access for non-admin */}
        {form.role !== 'admin' && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t.permissionsNote}</p>
            <label className="form-label">{t.projectAccess}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
              {projects.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.project_access.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                  />
                  {projectLabel(p)}
                </label>
              ))}
              {projects.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No projects available</span>}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!delModal}
        onClose={() => setDelModal(null)}
        title={t.delete}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDelModal(null)}>{t.cancel}</button>
            <button className="btn btn-danger"    onClick={handleDelete}>{t.delete}</button>
          </>
        }
      >
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop: 8, fontWeight: 600 }}>{delModal.full_name}</p>}
      </Modal>
    </div>
  );
}