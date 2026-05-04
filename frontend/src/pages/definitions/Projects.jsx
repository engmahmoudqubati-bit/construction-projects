import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Modal      from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import t from '../../lang';

const STATUSES = ['active','completed','on_hold','cancelled'];
const EMPTY = { project_code:'', project_name_en:'', project_name_ar:'', location:'', client_name:'', start_date:'', end_date:'', status:'active' };

function smartSearch(projects, q) {
  if (!q) return projects;
  const lq = q.toLowerCase();
  return projects.filter(p =>
    (p.project_name_en||'').toLowerCase().includes(lq) ||
    (p.project_name_ar||'').includes(q) ||
    (p.project_code||'').toLowerCase().includes(lq) ||
    (p.client_name||'').toLowerCase().includes(lq) ||
    (p.location||'').toLowerCase().includes(lq)
  );
}

export default function Projects() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState('');
  const [delModal, setDelModal] = useState(null);

  const load = () => {
    setLoading(true);
    api.getProjects().then(setProjects).catch(() => toast(t.errorOccurred,'error')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(p) {
    setForm({ project_code:p.project_code, project_name_en:p.project_name_en, project_name_ar:p.project_name_ar||'', location:p.location||'', client_name:p.client_name||'', start_date:p.start_date?p.start_date.slice(0,10):'', end_date:p.end_date?p.end_date.slice(0,10):'', status:p.status });
    setEditing(p); setModal(true);
  }

  async function handleSave() {
    if (!form.project_code || !form.project_name_en) return toast('Project code and English name are required','error');
    setSaving(true);
    try {
      if (editing) {
        const u = await api.updateProject(editing.id, form);
        setProjects(ps => ps.map(x => x.id === editing.id ? u : x));
      } else {
        const c = await api.createProject(form);
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

  const filtered = smartSearch(projects, search);

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
          <RefreshButton onRefresh={load} />
        </div>
        {loading ? <div className="spinner-wrap"><div className="spinner"/></div> : (
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>{t.projectCode}</th><th>{t.projectNameEn} / {t.projectNameAr}</th>
                <th>{t.client}</th><th>{t.location}</th>
                <th>{t.startDate}</th><th>{t.status}</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>{t.noData}</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>{p.project_code}</td>
                    <td>
                      <div style={{ fontWeight:500 }}>{p.project_name_en}</div>
                      {p.project_name_ar && <div style={{ fontSize:12, color:'var(--text-muted)' }} style={{ textAlign:"right", direction:"rtl" }}>{p.project_name_ar}</div>}
                    </td>
                    <td style={{ fontSize:12 }}>{p.client_name||'—'}</td>
                    <td style={{ fontSize:12 }}>{p.location||'—'}</td>
                    <td style={{ fontSize:12 }}>{p.start_date ? p.start_date.slice(0,10) : '—'}</td>
                    <td><StatusBadge value={p.status} /></td>
                    <td><div className="td-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>{t.edit}</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDelModal(p)}>{t.delete}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? t.editProject : t.addProject} size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.save}</button></>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectCode} *</label>
            <input className="form-control" value={form.project_code} onChange={e => setForm(f => ({ ...f, project_code:e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.status}</label>
            <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status:e.target.value }))}>
              {STATUSES.map(s => <option key={s} value={s}>{t.statuses[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectNameEn} *</label>
            <input className="form-control" value={form.project_name_en} onChange={e => setForm(f => ({ ...f, project_name_en:e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.projectNameAr}</label>
            <input className="form-control" dir="rtl" value={form.project_name_ar} onChange={e => setForm(f => ({ ...f, project_name_ar:e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.client}</label>
            <input className="form-control" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name:e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.location}</label>
            <input className="form-control" value={form.location} onChange={e => setForm(f => ({ ...f, location:e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.startDate}</label>
            <input className="form-control" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date:e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.endDate}</label>
            <input className="form-control" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date:e.target.value }))} />
          </div>
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)} title={t.delete} size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setDelModal(null)}>{t.cancel}</button>
          <button className="btn btn-danger" onClick={handleDelete}>{t.delete}</button></>}>
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:600 }}>{delModal.project_name_en}</p>}
      </Modal>
    </div>
  );
}