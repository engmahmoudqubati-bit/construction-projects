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

const FILTER_FIELDS = [
  { key: 'role', label: 'Role', type: 'select', options: [
    { value: 'admin', label: 'Admin' },
    { value: 'project_manager', label: 'Project Manager' },
    { value: 'site_engineer', label: 'Site Engineer' },
  ]},
  { key: 'is_active', label: 'Status', type: 'select', options: [
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ]},
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

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }

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
    if (!form.full_name || !form.username || !form.role)
      return toast('Full name, username and role are required', 'error');
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
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleToggle(user) {
    try {
      const updated = await api.toggleUser(user.id);
      setUsers(u => u.map(x => x.id === user.id ? { ...x, ...updated } : x));
      toast(updated.is_active ? 'User activated' : 'User deactivated');
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

  const projectLabel = (p) => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  const columns = [
    { key: 'full_name',  label: t.fullName },
    { key: 'username',   label: t.username, render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.username}</span> },
    { key: 'role',       label: t.role,   render: r => <StatusBadge value={r.role} /> },
    { key: 'email',      label: t.email,  render: r => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.email || '—'}</span> },
    { key: 'is_active',  label: t.status, render: r => <StatusBadge value={r.is_active ? 'active' : 'inactive'} /> },
    { key: 'actions',    label: '', style: { width: 180 }, render: r => (
      <div className="td-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏ {t.edit}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(r)}>
          {r.is_active ? '⏸' : '▶'} {r.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => setDelModal(r)}>🗑</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="page-header">
        <h1>{t.users}</h1>
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        title="Users Management"
        onAdd={openAdd}
        filterFields={FILTER_FIELDS}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? t.editUser : t.addUser}
        parentTitle={t.users}
        size="lg"
        onSave={handleSave}
        saving={saving}
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

        {form.role !== 'admin' && (
          <>
            <hr className="section-divider" />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{t.permissionsNote}</p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t.pagePermissions}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {PAGE_KEYS.map(({ key, label }) => (
                    <label key={key} className="perm-item">
                      <input type="checkbox" checked={form.page_permissions.includes(key)} onChange={() => togglePage(key)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t.projectAccess}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                  {projects.map(p => (
                    <label key={p.id} className="perm-item">
                      <input type="checkbox" checked={form.project_access.includes(p.id)} onChange={() => toggleProject(p.id)} />
                      {projectLabel(p)}
                    </label>
                  ))}
                  {projects.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No projects yet</span>}
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!delModal}
        onClose={() => setDelModal(null)}
        title="Delete User"
        parentTitle={t.users}
        size="sm"
        onSave={handleDelete}
        saveLabel="Delete"
      >
        <p style={{ fontSize: 14 }}>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop: 10, fontWeight: 700, color: 'var(--danger)' }}>{delModal.full_name}</p>}
      </Modal>
    </div>
  );
}
