import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import DataTable   from '../../components/shared/DataTable';
import Modal       from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const STATUSES = ['active','completed','on_hold','cancelled'];
const FILTER_FIELDS = [
  { key: 'status',      label: 'Status',           type: 'select', options: STATUSES.map(s => ({ value: s, label: t.statuses[s] })) },
  { key: 'client_name', label: 'Client',            type: 'text' },
  { key: 'location',    label: 'Location',          type: 'text' },
  { key: 'start_date',  label: 'Start Date (from)', type: 'date' },
  { key: 'end_date',    label: 'End Date (to)',      type: 'date' },
];
const EMPTY = { project_code:'', project_name_en:'', project_name_ar:'', location:'', client_name:'', start_date:'', end_date:'', status:'active' };

// ── KPI Cards ────────────────────────────────────────────────────
function KpiCards({ projects }) {
  const total     = projects.length;
  const active    = projects.filter(p => p.status === 'active').length;
  const onHold    = projects.filter(p => p.status === 'on_hold').length;
  const completed = projects.filter(p => p.status === 'completed').length;

  const cards = [
    { label: 'Total Projects',    value: total,     sub: 'All registered projects',  color: '#2563eb', bg: '#eff6ff',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
    { label: 'Active Projects',   value: active,    sub: 'Currently active',         color: '#16a34a', bg: '#f0fdf4',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
    { label: 'On Hold',           value: onHold,    sub: 'Paused projects',          color: '#ea580c', bg: '#fff7ed',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label: 'Completed',         value: completed, sub: 'Successfully completed',   color: '#9333ea', bg: '#faf5ff',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> },
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background:'#fff', border:'1px solid #f0f0f0', borderRadius:12, padding:'18px 20px', display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {c.icon}
          </div>
          <div>
            <div style={{ fontSize:12, color:'#6b7280', fontWeight:500 }}>{c.label}</div>
            <div style={{ fontSize:26, fontWeight:700, color:'#111827', lineHeight:1.1, margin:'2px 0' }}>{c.value}</div>
            <div style={{ fontSize:11, color:'#9ca3af' }}>{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── View Detail Panel ────────────────────────────────────────────
function ProjectViewPanel({ projects, selected, onClose }) {
  const [page, setPage] = useState(0);
  const items = projects.filter(p => selected.includes(p.id));
  if (!items.length) return null;
  const p = items[page] || items[0];

  const field = (label, value) => (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:14, color:'var(--text)', fontWeight:400 }}>{value || '—'}</div>
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
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {items.length > 1 && (
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <button style={{ background:'rgba(255,255,255,0.18)', border:'none', color:'#fff', borderRadius:6, width:28, height:28, cursor:page===0?'not-allowed':'pointer', opacity:page===0?0.4:1, fontSize:14 }}
                  onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}>‹</button>
                <span style={{ color:'#fff', fontSize:12 }}>{page+1} / {items.length}</span>
                <button style={{ background:'rgba(255,255,255,0.18)', border:'none', color:'#fff', borderRadius:6, width:28, height:28, cursor:page>=items.length-1?'not-allowed':'pointer', opacity:page>=items.length-1?0.4:1, fontSize:14 }}
                  onClick={() => setPage(p => Math.min(items.length-1,p+1))} disabled={page>=items.length-1}>›</button>
              </div>
            )}
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 32px' }}>
            {field(t.projectCode, <span style={{ fontFamily:'monospace', fontWeight:700, background:'#eff6ff', color:'#2563eb', padding:'2px 8px', borderRadius:5 }}>{p.project_code}</span>)}
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
  const [projects,     setProjects]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(false);
  const [viewOpen,     setViewOpen]     = useState(false);
  const [viewSelected, setViewSelected] = useState([]);
  const [editing,      setEditing]      = useState(null);
  const [form,         setForm]         = useState(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [delModal,     setDelModal]     = useState(null);

  const load = () => {
    setLoading(true);
    api.getProjects()
      .then(setProjects)
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openAdd()  { setForm(EMPTY); setEditing(null); setModal(true); }
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
        setProjects(ps => ps.map(x => x.id===editing.id ? u : x));
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

  const DateCell = ({ val }) => val ? (
    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, color:'#374151', whiteSpace:'nowrap' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      {val.slice(0,10)}
    </div>
  ) : <span style={{ color:'#9ca3af' }}>—</span>;

  const columns = [
    { key:'project_code', label:'Project Code', style:{ width:100 },
      render: r => <span style={{ fontSize:13, fontWeight:600, color:'#2563eb' }}>{r.project_code}</span> },
    { key:'project_name_en', label:'Project Name (English)',
      render: r => (
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.project_name_en}</div>
          {r.project_name_ar && (
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:3, direction:'rtl', textAlign:'right', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {r.project_name_ar}
            </div>
          )}
        </div>
      )},
    { key:'client_name', label:'Client',    render: r => <span style={{ fontSize:13, color:'#6b7280' }}>{r.client_name||'—'}</span> },
    { key:'location',    label:'Location',  render: r => <span style={{ fontSize:13, color:'#6b7280' }}>{r.location||'—'}</span> },
    { key:'start_date',  label:'Start Date', style:{ width:120 }, render: r => <DateCell val={r.start_date} /> },
    { key:'end_date',    label:'End Date',   style:{ width:120 }, render: r => <DateCell val={r.end_date} /> },
    { key:'status',      label:'Status',     style:{ width:120 }, render: r => <StatusBadge value={r.status} /> },
    { key:'actions', label:'Actions', style:{ width:120, textAlign:'right' },
      render: r => (
        <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end' }}>
          <button className="pj-act-edit" onClick={() => openEdit(r)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button className="pj-act-del" onClick={() => setDelModal(r)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
          <button className="pj-act-more">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
        </div>
      )},
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:12, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.3px' }}>{t.projects}</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>Create, view, and manage all your construction projects in one place.</p>
        </div>
      </div>

      {/* KPI Cards */}
      {!loading && <KpiCards projects={projects} />}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={projects}
        loading={loading}
        title={t.projects}
        onAdd={openAdd}
        onView={(sel) => { if (sel.length>0) { setViewSelected(sel); setViewOpen(true); } }}
        filterFields={FILTER_FIELDS}
        filterStorageKey="projects_filter"
        onRefresh={load}
      />

      {viewOpen && <ProjectViewPanel projects={projects} selected={viewSelected} onClose={() => setViewOpen(false)} />}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? t.editProject : t.addProject}
        parentTitle={t.projects} size="lg" onSave={handleSave} saving={saving}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectCode} *</label>
            <input className="form-control" value={form.project_code} onChange={e => setForm(f=>({...f,project_code:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.status}</label>
            <select className="form-control" value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
              {STATUSES.map(s => <option key={s} value={s}>{t.statuses[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.projectNameEn} *</label>
            <input className="form-control" value={form.project_name_en} onChange={e => setForm(f=>({...f,project_name_en:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.projectNameAr}</label>
            <input className="form-control" dir="rtl" value={form.project_name_ar} onChange={e => setForm(f=>({...f,project_name_ar:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.client}</label>
            <input className="form-control" value={form.client_name} onChange={e => setForm(f=>({...f,client_name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.location}</label>
            <input className="form-control" value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.startDate}</label>
            <input className="form-control" type="date" value={form.start_date} onChange={e => setForm(f=>({...f,start_date:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.endDate}</label>
            <input className="form-control" type="date" value={form.end_date} onChange={e => setForm(f=>({...f,end_date:e.target.value}))} />
          </div>
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)} title="Delete Project"
        parentTitle={t.projects} size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:700, color:'var(--danger)' }}>{delModal.project_name_en}</p>}
      </Modal>
    </div>
  );
}