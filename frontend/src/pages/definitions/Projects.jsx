import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import DataTable   from '../../components/shared/DataTable';
import Modal       from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const STATUSES = ['active','completed','on_hold','cancelled'];
const FILTER_FIELDS = [
  { key: 'status',     label: 'Status',   type: 'select', options: STATUSES.map(s => ({ value: s, label: t.statuses[s] })) },
  { key: 'location',   label: 'Location', type: 'text' },
  { key: 'start_date', label: 'Start Date (from)', type: 'date' },
  { key: 'end_date',   label: 'End Date (to)',      type: 'date' },
];

const EMPTY = {
  project_code:'', project_name_en:'', project_name_ar:'',
  location:'', client_name:'', start_date:'', end_date:'', status:'active',
};

// ── View Detail Panel ────────────────────────────────────────────
function ProjectViewPanel({ projects, selected, onClose }) {
  const [page, setPage] = useState(0);
  const items = projects.filter(p => selected.includes(p.id));
  if (!items.length) return null;
  const p = items[page] || items[0];

  const field = (label, value) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 400 }}>{value || '—'}</div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-breadcrumb">
            <span className="modal-bc-parent">{t.projects}</span>
            <span className="modal-bc-sep">›</span>
            <span className="modal-bc-current">View — {p.project_name_en}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {items.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                <button
                  style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 14 }}
                  onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                >‹</button>
                <span style={{ color: '#fff', fontSize: 12 }}>{page + 1} / {items.length}</span>
                <button
                  style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: page >= items.length-1 ? 'not-allowed' : 'pointer', opacity: page >= items.length-1 ? 0.4 : 1, fontSize: 14 }}
                  onClick={() => setPage(p => Math.min(items.length-1, p+1))} disabled={page >= items.length-1}
                >›</button>
              </div>
            )}
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            {field(t.projectCode, <span style={{ fontFamily:'monospace', fontWeight:700, background:'var(--accent-light)', color:'var(--accent)', padding:'2px 8px', borderRadius:5 }}>{p.project_code}</span>)}
            {field(t.status, <StatusBadge value={p.status} />)}
            {field(t.projectNameEn, p.project_name_en)}
            {field(t.projectNameAr, <span dir="rtl">{p.project_name_ar}</span>)}
            {field(t.client, p.client_name)}
            {field(t.location, p.location)}
            {field(t.startDate, p.start_date ? p.start_date.slice(0,10) : null)}
            {field(t.endDate, p.end_date ? p.end_date.slice(0,10) : null)}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>✕ Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function Projects() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [viewOpen,   setViewOpen]   = useState(false);
  const [viewSelected, setViewSelected] = useState([]);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [delModal, setDelModal] = useState(null);

  const load = () => {
    setLoading(true);
    api.getProjects()
      .then(setProjects)
      .catch(() => toast(t.errorOccurred, 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openAdd()  { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(p) {
    setForm({
      project_code: p.project_code,
      project_name_en: p.project_name_en,
      project_name_ar: p.project_name_ar || '',
      location: p.location || '',
      client_name: p.client_name || '',
      start_date: p.start_date ? p.start_date.slice(0,10) : '',
      end_date:   p.end_date   ? p.end_date.slice(0,10)   : '',
      status: p.status,
    });
    setEditing(p); setModal(true);
  }

  async function handleSave() {
    if (!form.project_code || !form.project_name_en)
      return toast('Project code and English name are required', 'error');
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
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteProject(delModal.id);
      setProjects(ps => ps.filter(x => x.id !== delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch (err) { toast(err.message, 'error'); }
  }

  // Columns — Arabic inline with English, no client column, end_date added
  const columns = [
    {
      key: 'project_code',
      label: t.projectCode,
      style: { width: 110 },
      render: r => (
        <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, background:'var(--accent-light)', color:'var(--accent)', padding:'2px 8px', borderRadius:5 }}>
          {r.project_code}
        </span>
      ),
    },
    {
      key: 'project_name_en',
      label: t.projectNameEn,
      render: r => (
        <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontWeight:600, fontSize:13 }}>{r.project_name_en}</span>
          {r.project_name_ar && (
            <>
              <span style={{ color:'var(--border)', fontSize:13 }}>/</span>
              <span style={{ direction:'rtl', fontSize:13, color:'var(--text-muted)', fontFamily:"'Segoe UI', Arial, sans-serif" }}>
                {r.project_name_ar}
              </span>
            </>
          )}
        </div>
      ),
    },
    { key: 'location',   label: t.location,  render: r => <span style={{ fontSize:12 }}>{r.location||'—'}</span> },
    { key: 'start_date', label: t.startDate, style:{ width:110 }, render: r => <span style={{ fontSize:12 }}>{r.start_date?r.start_date.slice(0,10):'—'}</span> },
    { key: 'end_date',   label: t.endDate,   style:{ width:110 }, render: r => <span style={{ fontSize:12 }}>{r.end_date?r.end_date.slice(0,10):'—'}</span> },
    { key: 'status',     label: t.status,    style:{ width:110 }, render: r => <StatusBadge value={r.status} /> },
    {
      key: 'actions',
      label: '',
      style: { width: 110 },
      render: r => (
        <div className="td-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏ {t.edit}</button>
          <button className="btn btn-danger btn-sm"    onClick={() => setDelModal(r)}>🗑</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <DataTable
        columns={columns}
        data={projects}
        loading={loading}
        title={t.projects}
        onAdd={openAdd}
        onView={(sel) => { if (sel.length > 0) { setViewSelected(sel); setViewOpen(true); } }}
        filterFields={FILTER_FIELDS}
        filterStorageKey="projects_filter"
        onRefresh={load}
      />

      {/* View Panel */}
      {viewOpen && (
        <ProjectViewPanel
          projects={projects}
          selected={viewSelected}
          onClose={() => setViewOpen(false)}
        />
      )}

      {/* Edit / Add Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? t.editProject : t.addProject}
        parentTitle={t.projects}
        size="lg"
        onSave={handleSave}
        saving={saving}
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectCode} *</label>
            <input className="form-control" value={form.project_code}
              onChange={e => setForm(f => ({...f, project_code:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.status}</label>
            <select className="form-control" value={form.status}
              onChange={e => setForm(f => ({...f, status:e.target.value}))}>
              {STATUSES.map(s => <option key={s} value={s}>{t.statuses[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectNameEn} *</label>
            <input className="form-control" value={form.project_name_en}
              onChange={e => setForm(f => ({...f, project_name_en:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.projectNameAr}</label>
            <input className="form-control" dir="rtl" value={form.project_name_ar}
              onChange={e => setForm(f => ({...f, project_name_ar:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.client}</label>
            <input className="form-control" value={form.client_name}
              onChange={e => setForm(f => ({...f, client_name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.location}</label>
            <input className="form-control" value={form.location}
              onChange={e => setForm(f => ({...f, location:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.startDate}</label>
            <input className="form-control" type="date" value={form.start_date}
              onChange={e => setForm(f => ({...f, start_date:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.endDate}</label>
            <input className="form-control" type="date" value={form.end_date}
              onChange={e => setForm(f => ({...f, end_date:e.target.value}))} />
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!delModal}
        onClose={() => setDelModal(null)}
        title="Delete Project"
        parentTitle={t.projects}
        size="sm"
        onSave={handleDelete}
        saveLabel="Delete"
      >
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:700, color:'var(--danger)' }}>{delModal.project_name_en}</p>}
      </Modal>
    </div>
  );
}