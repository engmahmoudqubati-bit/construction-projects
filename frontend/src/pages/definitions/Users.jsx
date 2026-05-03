import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DataTable    from '../../components/shared/DataTable';
import Modal        from '../../components/shared/Modal';
import StatusBadge  from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const ROLES     = ['admin', 'project_manager', 'site_engineer'];
const PAGE_KEYS = [
  { key: 'definitions_projects',        label: t.projects },
  { key: 'definitions_classifications', label: t.itemClassifications },
  { key: 'definitions_items',           label: t.items },
  { key: 'planning',                    label: t.planning },
  { key: 'delivery',                    label: t.delivery },
  { key: 'installation',                label: t.installation },
  { key: 'inspection',                  label: t.inspection },
  { key: 'reports',                     label: t.reports },
];

const EMPTY = {
  full_name: '', username: '', password: '', role: 'site_engineer', email: '',
  page_permissions: [], project_access: [],
};

export default function Users() {
  const toast = useToast();
  const { ALL_PAGES } = useAuth();

  const [users,    setUsers]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState('');
  const [delModal, setDelModal] = useState(null);

  useEffect(() => {
    Promise.all([api.getUsers(), api.getProjects()])
      .then(([u, p]) => { setUsers(u); setProjects(p); })
      .catch(() => toast(t.errorOccurred, 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function openEdit(user) {
    const perms = await api.getUserPerms(user.id);
    setForm({
      full_name: user.full_name, username: user.username,
      password: '', role: user.role, email: user.email || '',
      page_permissions: perms.pages,
      project_access:   perms.projects,
    });
    setEditing(user);
    setModal(true);
  }

  function openAdd() {
    setForm(EMPTY);
    setEditing(null);
    setModal(true);
  }

  function togglePage(key) {
    setForm(f => ({
      ...f,
      page_permissions: f.page_permissions.includes(key)
        ? f.page_permissions.filter(k => k !== key)
        : [...f.page_permissions, key],
    }));
  }

  function toggleProject(id) {
    setForm(f => ({
      ...f,
      project_access: f.project_access.includes(id)
        ? f.project_access.filter(p => p !== id)
        : [...f.project_access, id],
    }));
  }

  async function handleSave() {
    if (!form.full_name || !form.username || !form.role) {
      return toast('Full name, username and role are required', 'error');
    }
    if (!editing && !form.password) return toast('Password is required for new users', 'error');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (editing) {
        const updated = await api.updateUser(editing.id, payload);
        setUsers(u => u.map(x => x.id === editing.id ? { ...x, ...updated } : x));
      } else {
        const created = await api.createUser(payload);
        setUsers(u => [...u, created]);
      }
      toast(t.saveSuccess);
      setModal(false);
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
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
    { key: 'full_name',  label: t.fullName },
    { key: 'username',   label: t.username },
    { key: 'role',       label: t.role,   render: r => <StatusBadge value={r.role} /> },
    { key: 'email',      label: t.email },
    { key: 'is_active',  label: t.status, render: r => <StatusBadge value={r.is_active ? 'active' : 'inactive'} /> },
    { key: 'actions',    label: '',       render: r => (
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

      {/* Add / Edit Modal */}
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
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.fullName} *</label>
            <input className="form-control" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
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

        <div className="form-group">
          <label className="form-label">{t.role} *</label>
          <select className="form-control" value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ROLES.map(r => <option key={r} value={r}>{t.roles[r]}</option>)}
          </select>
        </div>

        {/* Permissions — only for non-admin */}
        {form.role !== 'admin' && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t.permissionsNote}</p>

            <div className="form-row">
              {/* Page permissions */}
              <div className="form-group" style={{ gridColumn: 'span 1' }}>
                <label className="form-label">{t.pagePermissions}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {PAGE_KEYS.map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={form.page_permissions.includes(key)}
                        onChange={() => togglePage(key)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Project access */}
              <div className="form-group" style={{ gridColumn: 'span 1' }}>
                <label className="form-label">{t.projectAccess}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
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
                  {projects.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No projects available</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Delete confirm */}
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
