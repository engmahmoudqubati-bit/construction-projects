import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable  from '../../components/shared/DataTable';
import Modal      from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

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

const EMPTY = { name_ar: '', name_en: '', page_permissions: [] };

export default function PositionRoles() {
  const toast = useToast();
  const [roles,   setRoles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [delModal,setDelModal]= useState(null);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    api.getPositionRoles()
      .then(setRoles)
      .catch(() => toast(t.errorOccurred, 'error'))
      .finally(() => setLoading(false));
  }, []);

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }

  async function openEdit(r) {
    const perms = await api.getPositionRolePerms(r.id);
    setForm({ name_ar: r.name_ar, name_en: r.name_en, page_permissions: perms });
    setEditing(r);
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

  async function handleSave() {
    if (!form.name_ar || !form.name_en) return toast('Arabic and English names are required', 'error');
    setSaving(true);
    try {
      if (editing) {
        const updated = await api.updatePositionRole(editing.id, form);
        setRoles(rs => rs.map(r => r.id === editing.id ? { ...r, ...updated } : r));
      } else {
        const created = await api.createPositionRole(form);
        setRoles(rs => [...rs, created]);
      }
      toast(t.saveSuccess);
      setModal(false);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deletePositionRole(delModal.id);
      setRoles(rs => rs.filter(r => r.id !== delModal.id));
      toast(t.deleteSuccess);
      setDelModal(null);
    } catch (err) { toast(err.message, 'error'); }
  }

  const filtered = roles.filter(r =>
    r.name_en.toLowerCase().includes(search.toLowerCase()) ||
    r.name_ar.includes(search)
  );

  const columns = [
    { key: 'name_en', label: t.positionRoleNameEn },
    { key: 'name_ar', label: t.positionRoleNameAr, render: r => <span dir="rtl">{r.name_ar}</span> },
    { key: 'actions', label: '', render: r => (
      <div className="td-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>{t.edit}</button>
        <button className="btn btn-danger btn-sm"    onClick={() => setDelModal(r)}>{t.delete}</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="page-header">
        <h1>{t.positionRoles}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t.addPositionRole}</button>
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
        title={editing ? t.editPositionRole : t.addPositionRole}
        size="md"
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
            <label className="form-label">{t.positionRoleNameEn} *</label>
            <input className="form-control" value={form.name_en}
              onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.positionRoleNameAr} *</label>
            <input className="form-control" dir="rtl" value={form.name_ar}
              onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} />
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
        <label className="form-label">{t.pagePermissions}</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
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
        {delModal && <p style={{ marginTop: 8, fontWeight: 600 }}>{delModal.name_en}</p>}
      </Modal>
    </div>
  );
}