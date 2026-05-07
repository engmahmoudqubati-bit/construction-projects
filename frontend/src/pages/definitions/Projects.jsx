import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable   from '../../components/shared/DataTable';
import Modal       from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const STATUSES = ['active','completed','on_hold','cancelled'];
const FILTER_FIELDS = [
  { key:'status',      label:'Status',           type:'select', options:STATUSES.map(s=>({value:s,label:t.statuses[s]})) },
  { key:'client_name', label:'Client',            type:'text' },
  { key:'location',    label:'Location',          type:'text' },
  { key:'start_date',  label:'Start Date (from)', type:'date' },
  { key:'end_date',    label:'End Date (to)',      type:'date' },
];
const EMPTY = { project_code:'', project_name_en:'', project_name_ar:'', location:'', client_name:'', start_date:'', end_date:'', status:'active' };

// ── Sparkline ────────────────────────────────────────────────────
function Spark({ color }) {
  const h = [10,16,12,22,16,28,36];
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:44, position:'absolute', bottom:0, right:16, opacity:0.75 }}>
      {h.map((v,i) => <div key={i} style={{ width:8, height:v, borderRadius:'3px 3px 0 0', background:color, opacity:0.35+(i*0.1) }} />)}
    </div>
  );
}

// ── KPI Cards ────────────────────────────────────────────────────
function KpiCards({ projects }) {
  const total     = projects.length;
  const active    = projects.filter(p => p.status==='active').length;
  const onHold    = projects.filter(p => p.status==='on_hold').length;
  const completed = projects.filter(p => p.status==='completed').length;
  const pct = n => total > 0 ? Math.round((n/total)*100) : 0;

  const cards = [
    { label:'Total Projects', value:total,     sub:'All registered projects', color:'#7c3aed', bg:'#ede9fe', pct:null,
      icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { label:'Active Projects', value:active,   sub:'Currently active',        color:'#16a34a', bg:'#dcfce7', pct:pct(active),    pctBg:'#dcfce7',
      icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
    { label:'On Hold',         value:onHold,   sub:'Paused projects',         color:'#ea580c', bg:'#fff7ed', pct:pct(onHold),    pctBg:'#fff7ed',
      icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label:'Completed',       value:completed,sub:'Successfully completed',  color:'#7c3aed', bg:'#ede9fe', pct:pct(completed), pctBg:'#ede9fe',
      icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> },
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
      {cards.map(card => (
        <div key={card.label} style={{ background:'var(--card)', border:'1px solid var(--border-light)', borderRadius:16, padding:'22px 22px 0', position:'relative', overflow:'hidden', minHeight:150 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ width:52, height:52, borderRadius:14, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {card.icon}
            </div>
            {card.pct !== null && (
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20, background:card.pctBg, color:card.color }}>{card.pct}%</span>
            )}
          </div>
          <div style={{ fontSize:36, fontWeight:700, color:card.color, lineHeight:1, marginBottom:4 }}>{card.value}</div>
          <div style={{ fontSize:13, color:'#374151', fontWeight:600, marginBottom:2 }}>{card.label}</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:12 }}>{card.sub}</div>
          <Spark color={card.color} />
        </div>
      ))}
    </div>
  );
}

// ── View Panel ───────────────────────────────────────────────────
function ProjectViewPanel({ projects, selected, onClose }) {
  const [page, setPage] = useState(0);
  const items = (() => {
    const sel = projects.filter(p => selected.includes(p.id));
    if (sel.length > 1) return sel;
    const idx = projects.findIndex(p => selected.includes(p.id));
    return idx >= 0 ? [...projects.slice(idx), ...projects.slice(0, idx)] : projects;
  })();
  if (!items.length) return null;
  const proj = items[Math.min(page, items.length-1)];
  const fmt = val => { if(!val) return '—'; const[y,m,d]=val.slice(0,10).split('-'); return `${d}/${m}/${y}`; };
  const statusColor = { active:{bg:'#dcfce7',color:'#16a34a'}, completed:{bg:'#ede9fe',color:'#7c3aed'}, on_hold:{bg:'#fff7ed',color:'#ea580c'}, cancelled:{bg:'#fee2e2',color:'#dc2626'} }[proj.status] || { bg:'#f3f4f6', color:'#374151' };
  const Field = ({label,value}) => (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#9ca3af', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:14, color:'#111827' }}>{value||'—'}</div>
    </div>
  );
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--card)', borderRadius:16, boxShadow:'0 24px 60px rgba(0,0,0,0.18)', width:'100%', maxWidth:640, overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background:'linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%)', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Projects › View Project</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#fff' }}>{proj.project_name_en}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {items.length > 1 && (
              <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.15)', borderRadius:8, padding:'4px 10px' }}>
                <button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}
                  style={{ background:'none', border:'none', color:'#fff', cursor:page===0?'not-allowed':'pointer', opacity:page===0?0.35:1, display:'flex', alignItems:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span style={{ color:'#fff', fontSize:12, fontWeight:500, minWidth:40, textAlign:'center' }}>{page+1} / {items.length}</span>
                <button onClick={() => setPage(p=>Math.min(items.length-1,p+1))} disabled={page>=items.length-1}
                  style={{ background:'none', border:'none', color:'#fff', cursor:page>=items.length-1?'not-allowed':'pointer', opacity:page>=items.length-1?0.35:1, display:'flex', alignItems:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:8, width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>✕</button>
          </div>
        </div>
        <div style={{ background:'var(--card2)', borderBottom:'1px solid var(--border-light)', padding:'10px 24px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'#9ca3af', fontWeight:500 }}>Status:</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:statusColor.bg, color:statusColor.color, fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, textTransform:'uppercase' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:statusColor.color }}></span>
            {proj.status?.replace('_',' ')}
          </span>
          <span style={{ marginLeft:'auto', fontSize:11, color:'#9ca3af' }}>Code: <strong style={{ color:'#7c3aed', background:'#ede9fe', padding:'1px 7px', borderRadius:5, fontFamily:'monospace' }}>{proj.project_code}</strong></span>
        </div>
        <div style={{ padding:'24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 32px' }}>
          <Field label="Project Name (English)" value={proj.project_name_en} />
          <Field label="Project Name (Arabic)" value={<span dir="rtl">{proj.project_name_ar||'—'}</span>} />
          <Field label="Client" value={proj.client_name} />
          <Field label="Location" value={proj.location} />
          <Field label="Start Date" value={fmt(proj.start_date)} />
          <Field label="End Date" value={fmt(proj.end_date)} />
        </div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border-light)', display:'flex', justifyContent:'flex-end', background:'var(--card2)' }}>
          <button onClick={onClose} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 16px', fontSize:13, fontWeight:500, color:'var(--text)', cursor:'pointer', fontFamily:'inherit' }}>✕ Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
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
  const [selectedRows,  setSelectedRows]  = useState([]);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [filterApplied, setFilterApplied] = useState(() => {
    try { const v = JSON.parse(sessionStorage.getItem('filter_projects_filter') || '{}'); return Object.values(v).some(x => x); } catch { return false; }
  });

  const load = () => {
    setLoading(true);
    api.getProjects().then(setProjects).catch(()=>toast(t.errorOccurred,'error')).finally(()=>setLoading(false));
  };
  useEffect(load,[]);

  function openAdd()   { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(p) {
    setForm({ project_code:p.project_code, project_name_en:p.project_name_en, project_name_ar:p.project_name_ar||'', location:p.location||'', client_name:p.client_name||'', start_date:p.start_date?p.start_date.slice(0,10):'', end_date:p.end_date?p.end_date.slice(0,10):'', status:p.status });
    setEditing(p); setModal(true);
  }
  async function handleSave() {
    if (!form.project_code||!form.project_name_en) return toast('Project code and English name are required','error');
    setSaving(true);
    try {
      if (editing) { const u=await api.updateProject(editing.id,form); setProjects(ps=>ps.map(x=>x.id===editing.id?u:x)); }
      else         { const c=await api.createProject(form); setProjects(ps=>[...ps,c]); }
      toast(t.saveSuccess); setModal(false);
    } catch(err) { toast(err.message,'error'); } finally { setSaving(false); }
  }
  async function handleDelete() {
    try { await api.deleteProject(delModal.id); setProjects(ps=>ps.filter(x=>x.id!==delModal.id)); toast(t.deleteSuccess); setDelModal(null); }
    catch(err) { toast(err.message,'error'); }
  }

  const [delSelectedModal, setDelSelectedModal] = useState(false);
  async function handleDeleteSelected() {
    let failed = 0;
    for (const id of selectedRows) {
      try { await api.deleteProject(id); }
      catch { failed++; }
    }
    setProjects(ps => ps.filter(x => !selectedRows.includes(x.id)));
    setSelectedRows([]);
    setDelSelectedModal(false);
    toast(failed > 0 ? `Deleted with ${failed} error(s)` : t.deleteSuccess);
  }
  function exportCSV() {
    const rows = projects.map(p=>[p.project_code,p.project_name_en,p.client_name||'',p.location||'',p.start_date?p.start_date.slice(0,10):'',p.end_date?p.end_date.slice(0,10):'',p.status].join(','));
    const csv = ['Project Code,Project Name,Client,Location,Start Date,End Date,Status',...rows].join('\n');
    const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='projects.csv'; a.click();
  }
  const fmt = val => { if(!val) return '—'; const[y,m,d]=val.slice(0,10).split('-'); return `${d}/${m}/${y}`; };

  const locIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
  const calIcon = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;

  const columns = [
    { key:'project_code', label:'Project Code', style:{width:110},
      render:r=><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#ede9fe',color:'#7c3aed',fontSize:12,fontWeight:700,padding:'4px 10px',borderRadius:8,minWidth:36}}>{r.project_code}</span> },
    { key:'project_name_en', label:'Project Name',
      render:r=><span style={{fontSize:13,fontWeight:700,color:'#111827'}}>{r.project_name_en}</span> },
    { key:'client_name', label:'Client', render:r=><span style={{fontSize:13,color:'#6b7280'}}>{r.client_name||'—'}</span> },
    { key:'location', label:'Location',
      render:r=><div style={{display:'flex',alignItems:'center',gap:5,fontSize:13,color:'#6b7280'}}>{locIcon}{r.location||'—'}</div> },
    { key:'start_date', label:'Start Date', style:{width:120},
      render:r=><div style={{display:'flex',alignItems:'center',gap:5,fontSize:13,color:'#374151',whiteSpace:'nowrap'}}>{calIcon}{fmt(r.start_date)}</div> },
    { key:'end_date', label:'End Date', style:{width:120},
      render:r=><div style={{display:'flex',alignItems:'center',gap:5,fontSize:13,color:'#374151',whiteSpace:'nowrap'}}>{calIcon}{fmt(r.end_date)}</div> },
    { key:'status', label:'Status', style:{width:120},
      render:r=>{
        const s={active:{bg:'#dcfce7',c:'#16a34a',label:'ACTIVE'},completed:{bg:'#ede9fe',c:'#7c3aed',label:'COMPLETED'},on_hold:{bg:'#fff7ed',c:'#ea580c',label:'ON_HOLD'},cancelled:{bg:'#fee2e2',c:'#dc2626',label:'CANCELLED'}}[r.status]||{bg:'#f3f4f6',c:'#6b7280',label:r.status};
        return <span style={{display:'inline-flex',alignItems:'center',gap:5,background:s.bg,color:s.c,fontSize:11,fontWeight:700,padding:'5px 12px',borderRadius:20,textTransform:'uppercase',letterSpacing:'0.03em'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:s.c,flexShrink:0}}></span>{s.label}
        </span>;
      }},
    { key:'actions', label:'Actions', style:{width:90,textAlign:'right'},
      render:r=>(
        <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
          <button onClick={()=>openEdit(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={()=>setDelModal(r)} style={{width:32,height:32,borderRadius:8,border:'1px solid #fecaca',background:'var(--danger-bg)',color:'var(--danger)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      )},
  ];

  return (
    <div>
      {/* Page header — icon + title + subtitle + all buttons */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, flexWrap:'wrap' }}>
        <div style={{ width:48, height:48, borderRadius:14, background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </div>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#111827', letterSpacing:'-0.3px' }}>{t.projects}</h1>
          <p style={{ fontSize:12, color:'#9ca3af', marginTop:1 }}>Manage and track all your construction projects in one place.</p>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 14px', minWidth:220 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              style={{ border:'none', outline:'none', fontSize:13, color:'var(--text)', background:'none', width:'100%', fontFamily:'inherit' }}
              placeholder="Search projects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:0, lineHeight:1 }}>✕</button>
            )}
          </div>
          <button style={{ display:'flex', alignItems:'center', gap:6, background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:500, color:'var(--text)', cursor:'pointer', fontFamily:'inherit' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filter
          </button>
          <button onClick={load} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 10px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:500, color:'#374151', cursor:'pointer', fontFamily:'inherit' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          {selectedRows.length > 0 && (
            <button
              onClick={() => { setViewSelected([...selectedRows]); setViewOpen(true); }}
              style={{ display:'flex', alignItems:'center', gap:6, background:'var(--accent-light)', border:'1px solid var(--accent)', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:500, color:'var(--accent)', cursor:'pointer', fontFamily:'inherit' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View ({selectedRows.length})
            </button>
          )}
          {selectedRows.length > 0 && (
            <button
              onClick={() => setDelSelectedModal(true)}
              style={{ display:'flex', alignItems:'center', gap:6, background:'var(--danger-bg)', border:'1px solid var(--danger)', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:500, color:'var(--danger)', cursor:'pointer', fontFamily:'inherit' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              Delete ({selectedRows.length})
            </button>
          )}
          <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:7, background:'#7c3aed', border:'none', borderRadius:10, padding:'9px 18px', fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Project
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {!loading && <KpiCards projects={projects} />}

      {/* Table */}
      <DataTable
        columns={columns}
        data={projects}
        loading={loading}
        onExport={exportCSV}
        filterFields={FILTER_FIELDS}
        filterStorageKey="projects_filter"
        onRefresh={load}
        onSelectionChange={setSelectedRows}
        externalFilterOpen={filterOpen}
        onExternalFilterClose={() => setFilterOpen(false)}
        onFilterApplied={setFilterApplied}
        externalSearch={searchQuery}
      />

      {viewOpen && <ProjectViewPanel projects={projects} selected={viewSelected} onClose={()=>setViewOpen(false)} />}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?t.editProject:t.addProject} parentTitle={t.projects} size="lg" onSave={handleSave} saving={saving}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">{t.projectCode} *</label><input className="form-control" value={form.project_code} onChange={e=>setForm(f=>({...f,project_code:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">{t.status}</label><select className="form-control" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{STATUSES.map(s=><option key={s} value={s}>{t.statuses[s]}</option>)}</select></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">{t.projectNameEn} *</label><input className="form-control" value={form.project_name_en} onChange={e=>setForm(f=>({...f,project_name_en:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">{t.projectNameAr}</label><input className="form-control" dir="rtl" value={form.project_name_ar} onChange={e=>setForm(f=>({...f,project_name_ar:e.target.value}))}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">{t.client}</label><input className="form-control" value={form.client_name} onChange={e=>setForm(f=>({...f,client_name:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">{t.location}</label><input className="form-control" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">{t.startDate}</label><input className="form-control" type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">{t.endDate}</label><input className="form-control" type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/></div>
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={()=>setDelModal(null)} title="Delete Project" parentTitle={t.projects} size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{marginTop:8,fontWeight:700,color:'var(--danger)'}}>{delModal.project_name_en}</p>}
      </Modal>

      <Modal open={delSelectedModal} onClose={()=>setDelSelectedModal(false)} title={`Delete ${selectedRows.length} Projects`} parentTitle={t.projects} size="sm" onSave={handleDeleteSelected} saveLabel="Delete All">
        <p>Are you sure you want to delete <strong>{selectedRows.length}</strong> selected project(s)? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}