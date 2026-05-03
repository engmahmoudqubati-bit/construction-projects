import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable   from '../../components/shared/DataTable';
import Modal       from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const STATUSES = ['active','completed','on_hold','cancelled'];
const EMPTY = {
  project_code: '', project_name_en: '', project_name_ar: '',
  location: '', client_name: '', start_date: '', end_date: '',
  status: 'active', manager_id: '',
};

export default function Projects() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState('');
  const [delModal, setDelModal] = useState(null);

  useEffect(() => {
    Promise.all([api.getProjects(), api.getUsers()])
      .then(([p, u]) => { setProjects(p); setManagers(u.filter(x => x.role !== 'site_engineer')); })
      .catch(() => toast(t.errorOccurred, 'error'))
      .finally(() => setLoading(false));
  }, []);

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }

  function openEdit(p) {
    setForm({
      project_code: p.project_code, project_name_en: p.project_name_en,
      project_name_ar: p.project_name_ar || '', location: p.location || '',
      client_name: p.client_name || '',
      start_date: p.start_date ? p.start_date.slice(0,10) : '',
      end_date:   p.end_date   ? p.end_date.slice(0,10)   : '',
      status: p.status, manager_id: p.manager_id || '',
    });
    setEditing(p);
    setModal(true);
  }

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSave() {
    if (!form.project_code || !form.project_name_en)
      return toast('Project code and English name are required', 'error');
    setSaving(true);
    try {
      const payload = { ...form, manager_id: form.manager_id || null };
      if (editing) {
        const updated = await api.updateProject(editing.id, payload);
        setProjects(ps => ps.map(x => x.id === editing.id ? updated : x));
      } else {
        const created = await api.createProject(payload);
        setProjects(ps => [...ps, created]);
      }
      toast(t.saveSuccess);
      setModal(false);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteProject(delModal.id);
      setProjects(ps => ps.filter(x => x.id !== delModal.id));
      toast(t.deleteSuccess);
      setDelModal(null);
    } catch (err) { toast(err.message, 'error'); }
  }

  const projectLabel = (p) =>
    [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  const filtered = projects.filter(p =>
    projectLabel(p).toLowerCase().includes(search.toLowerCase()) ||
    p.project_code.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'project_code',    label: t.projectCode },
    { key: 'project_name_en', label: `${t.projectNameEn} / ${t.projectNameAr}`,
      render: r => (
        <div>
          <div>{r.project_name_en}</div>
          {r.project_name_ar && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.project_name_ar}</div>}
        </div>
      )},
    { key: 'client_name',  label: t.client },
    { key: 'manager_name', label: t.manager },
    { key: 'status',       label: t.status, render: r => <StatusBadge value={r.status} /> },
    { key: 'actions',      label: '', render: r => (
      <div className="td-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>{t.edit}</button>
        <button className="btn btn-danger    btn-sm" onClick={() => setDelModal(r)}>{t.delete}</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="page-header">
        <h1>{t.projects}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t.addProject}</button>
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
        open={modal} onClose={() => setModal(false)}
        title={editing ? t.editProject : t.addProject}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
            <button className="btn btn-primary"   onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.save}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectCode} *</label>
            <input className="form-control" value={form.project_code} onChange={set('project_code')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.projectNameEn} *</label>
            <input className="form-control" value={form.project_name_en} onChange={set('project_name_en')} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectNameAr}</label>
            <input className="form-control" value={form.project_name_ar} onChange={set('project_name_ar')} dir="rtl" />
          </div>
          <div className="form-group">
            <label className="form-label">{t.client}</label>
            <input className="form-control" value={form.client_name} onChange={set('client_name')} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t.location}</label>
          <input className="form-control" value={form.location} onChange={set('location')} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.startDate}</label>
            <input className="form-control" type="date" value={form.start_date} onChange={set('start_date')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.endDate}</label>
            <input className="form-control" type="date" value={form.end_date} onChange={set('end_date')} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.manager}</label>
            <select className="form-control" value={form.manager_id} onChange={set('manager_id')}>
              <option value="">— None —</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t.status}</label>
            <select className="form-control" value={form.status} onChange={set('status')}>
              {STATUSES.map(s => <option key={s} value={s}>{t.statuses[s]}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!delModal} onClose={() => setDelModal(null)}
        title={t.delete} size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDelModal(null)}>{t.cancel}</button>
            <button className="btn btn-danger"    onClick={handleDelete}>{t.delete}</button>
          </>
        }
      >
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop: 8, fontWeight: 600 }}>{projectLabel(delModal)}</p>}
      </Modal>
    </div>
  );
}
