import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable   from '../../components/shared/DataTable';
import Modal       from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const STATUSES = ['active','completed','on_hold','cancelled'];
const FILTER_FIELDS = [
  { key: 'status', label: 'Status', type: 'select', options: STATUSES.map(s => ({ value: s, label: t.statuses[s] })) },
  { key: 'client_name', label: 'Client', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
];
const EMPTY = { project_code:'', project_name_en:'', project_name_ar:'', location:'', client_name:'', start_date:'', end_date:'', status:'active', manager_id:'' };

export default function Projects() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [delModal, setDelModal] = useState(null);

  useEffect(() => {
    Promise.all([api.getProjects(), api.getUsers()])
      .then(([p, u]) => { setProjects(p); setManagers(u.filter(x => x.role !== 'site_engineer')); })
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  }, []);

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(p) {
    setForm({ project_code:p.project_code, project_name_en:p.project_name_en, project_name_ar:p.project_name_ar||'', location:p.location||'', client_name:p.client_name||'', start_date:p.start_date?p.start_date.slice(0,10):'', end_date:p.end_date?p.end_date.slice(0,10):'', status:p.status, manager_id:p.manager_id||'' });
    setEditing(p); setModal(true);
  }

  async function handleSave() {
    if (!form.project_code || !form.project_name_en) return toast('Project code and English name are required','error');
    setSaving(true);
    try {
      const payload = { ...form, manager_id: form.manager_id || null };
      if (editing) {
        const u = await api.updateProject(editing.id, payload);
        setProjects(ps => ps.map(x => x.id === editing.id ? u : x));
      } else {
        const c = await api.createProject(payload);
        setProjects(ps => [...ps, c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch (err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteProject(delModal.id);
      setProjects(ps => ps.filter(x => x.id !== delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch (err) { toast(err.message,'error'); }
  }

  const columns = [
    { key: 'project_code',    label: t.projectCode, render: r => <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700 }}>{r.project_code}</span> },
    { key: 'project_name_en', label: `${t.projectNameEn} / ${t.projectNameAr}`,
      render: r => (
        <div>
          <div style={{ fontWeight:500 }}>{r.project_name_en}</div>
          {r.project_name_ar && <div className="rtl-text" style={{ marginTop:2 }}>{r.project_name_ar}</div>}
        </div>
      )},
    { key: 'client_name',  label: t.client,   render: r => r.client_name || '—' },
    { key: 'location',     label: t.location, render: r => <span style={{ fontSize:12 }}>{r.location||'—'}</span> },
    { key: 'start_date',   label: t.startDate, render: r => <span style={{ fontSize:12 }}>{r.start_date?r.start_date.slice(0,10):'—'}</span> },
    { key: 'status',       label: t.status, render: r => <StatusBadge value={r.status} /> },
    { key: 'actions',      label: '', style:{ width:130 }, render: r => (
      <div className="td-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏ {t.edit}</button>
        <button className="btn btn-danger btn-sm" onClick={() => setDelModal(r)}>🗑</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="page-header"><h1>{t.projects}</h1></div>

      <DataTable
        columns={columns}
        data={projects}
        loading={loading}
        title="Projects Management"
        onAdd={openAdd}
        filterFields={FILTER_FIELDS}
      />

      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? t.editProject : t.addProject}
        parentTitle={t.projects}
        size="lg" onSave={handleSave} saving={saving}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectCode} *</label>
            <input className="form-control" value={form.project_code} onChange={e => setForm(f => ({...f,project_code:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.status}</label>
            <select className="form-control" value={form.status} onChange={e => setForm(f => ({...f,status:e.target.value}))}>
              {STATUSES.map(s => <option key={s} value={s}>{t.statuses[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectNameEn} *</label>
            <input className="form-control" value={form.project_name_en} onChange={e => setForm(f => ({...f,project_name_en:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.projectNameAr}</label>
            <input className="form-control" dir="rtl" value={form.project_name_ar} onChange={e => setForm(f => ({...f,project_name_ar:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.client}</label>
            <input className="form-control" value={form.client_name} onChange={e => setForm(f => ({...f,client_name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.location}</label>
            <input className="form-control" value={form.location} onChange={e => setForm(f => ({...f,location:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.startDate}</label>
            <input className="form-control" type="date" value={form.start_date} onChange={e => setForm(f => ({...f,start_date:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.endDate}</label>
            <input className="form-control" type="date" value={form.end_date} onChange={e => setForm(f => ({...f,end_date:e.target.value}))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t.manager}</label>
          <select className="form-control" value={form.manager_id} onChange={e => setForm(f => ({...f,manager_id:e.target.value}))}>
            <option value="">— None —</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)}
        title="Delete Project" parentTitle={t.projects}
        size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:700, color:'var(--danger)' }}>{delModal.project_name_en}</p>}
      </Modal>
    </div>
  );
}
