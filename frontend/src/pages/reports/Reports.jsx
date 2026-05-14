import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const fmt2 = v => (parseFloat(v)||0).toFixed(2);
const fmtPct = v => `${(parseFloat(v)||0).toFixed(1)}%`;
const pctColor = p => p >= 100 ? '#22c55e' : p >= 60 ? '#22c55e' : p >= 30 ? '#22c55e' : '#22c55e';
const pctBg    = p => p >= 100 ? '#ecfdf5' : p >= 60 ? '#ecfdf5' : p >= 30 ? '#ecfdf5' : '#ecfdf5';

// ── Shared styles ──────────────────────────────────────────────────────────
const DESIGN = {
  blue:'#2563eb', blueDark:'#1d4ed8', navy:'#0f172a', text:'#111827', muted:'#64748b',
  green:'#22c55e', line:'#e2e8f0', soft:'#f8fafc', panel:'#ffffff'
};

const thS = { background:'#f8fafc', color:'#0f172a', fontWeight:800, fontSize:11,
  padding:'12px 14px', borderBottom:'1px solid #e2e8f0', borderRight:'1px solid #edf2f7', textAlign:'left',
  whiteSpace:'nowrap', letterSpacing:'0.04em', textTransform:'uppercase' };
const tdS = { padding:'11px 14px', fontSize:12, color:'#111827', verticalAlign:'middle', borderBottom:'1px solid #eef2f7', background:'#fff' };
const fSel = { background:'#fff', border:'1px solid #cfe0ff', borderRadius:10,
  padding:'8px 14px', fontSize:13, fontWeight:600, color:'#0f172a',
  cursor:'pointer', fontFamily:'inherit', outline:'none', height:40, minWidth:280, boxShadow:'0 1px 2px rgba(15,23,42,.03)' };
const panelStyle = { background:'#fff', border:'1px solid #dbeafe', borderRadius:16, padding:16, boxShadow:'0 10px 26px rgba(15,23,42,.06)' };
const tableWrapStyle = { background:'#fff', border:'1px solid #dbeafe', borderRadius:16, overflow:'hidden', boxShadow:'0 12px 30px rgba(15,23,42,.06)' };
const filterLabelStyle = { fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'#334155' };

// ── Progress bar cell ──────────────────────────────────────────────────────
function PctCell({ pct }) {
  const p = parseFloat(pct||0);
  const color = DESIGN.green;
  return (
    <td style={{ ...tdS, minWidth:120 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:50 }}>
          <div style={{ height:'100%', width:`${Math.min(100,p)}%`, background:color, borderRadius:99, transition:'width 0.3s' }} />
        </div>
        <span style={{ fontSize:11, fontWeight:700, color, minWidth:38, textAlign:'right' }}>{fmtPct(p)}</span>
      </div>
    </td>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KPICard({ label, value, icon, color=DESIGN.blue, bg='#eff6ff', sub }) {
  const isPercent = String(value || '').includes('%');
  return (
    <div style={{ flex:'1 1 170px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:16,
      padding:'16px 18px', boxShadow:'0 14px 30px rgba(15,23,42,.07)', minHeight:104, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', right:-20, top:-20, width:82, height:82, borderRadius:'50%', background:bg, opacity:.85 }} />
      <div style={{ display:'flex', alignItems:'center', gap:12, position:'relative' }}>
        <div style={{ width:42, height:42, borderRadius:12, background:bg, color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
          {icon}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#475569', marginBottom:5 }}>{label}</div>
          <div style={{ fontSize:24, fontWeight:900, color:isPercent?DESIGN.green:DESIGN.navy, lineHeight:1 }}>{value}</div>
          {sub && <div style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Smart Insights (pure JS — no API) ─────────────────────────────────────
function SmartInsights({ data, type }) {
  const [open, setOpen] = useState(false);
  const insights = useMemo(() => generateInsights(data, type), [data, type]);
  if (!data?.length) return null;
  return (
    <div style={{ marginTop:16, border:'1px solid #bfdbfe', borderRadius:12, overflow:'hidden' }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'linear-gradient(135deg,#0f172a,#2563eb)', border:'none', padding:'12px 18px',
        cursor:'pointer', fontFamily:'inherit',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>📊</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>Smart Insights</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>Auto-generated analysis from your data</div>
          </div>
        </div>
        <span style={{ color:'#fff', fontSize:16 }}>{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div style={{ padding:'16px', background:'var(--card)', display:'flex', flexDirection:'column', gap:8 }}>
          {insights.map((ins, i) => {
            const cfg = {
              good:   { bg:'#f0fdf4', border:'#bbf7d0', color:'#16a34a', icon:'✅' },
              warn:   { bg:'#fffbeb', border:'#fde68a', color:'#d97706', icon:'⚠️' },
              bad:    { bg:'#fef2f2', border:'#fecaca', color:'#dc2626', icon:'🔴' },
              info:   { bg:'#eff6ff', border:'#bfdbfe', color:'#2563eb', icon:'ℹ️' },
              action: { bg:'#eff6ff', border:'#bfdbfe', color:DESIGN.blue, icon:'🎯' },
            }[ins.type] || { bg:'#f9fafb', border:'#e5e7eb', color:'#6b7280', icon:'➡️' };
            return (
              <div key={i} style={{ background:cfg.bg, border:`1px solid ${cfg.border}`,
                borderRadius:8, padding:'9px 13px', display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{cfg.icon}</span>
                <span style={{ fontSize:12, color:'#374151', lineHeight:1.6 }}>{ins.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function generateInsights(data, type) {
  if (!data?.length) return [];
  const insights = [];

  if (type === 'progress') {
    const total = data.length;
    const complete   = data.filter(r => parseFloat(r.install_pct||0) >= 100).length;
    const onTrack    = data.filter(r => { const p=parseFloat(r.install_pct||0); return p>=60&&p<100; }).length;
    const behind     = data.filter(r => parseFloat(r.install_pct||0) < 30).length;
    const avgDelPct  = data.reduce((s,r)=>s+(parseFloat(r.delivery_pct)||0),0)/total;
    const avgInstPct = data.reduce((s,r)=>s+(parseFloat(r.install_pct)||0),0)/total;
    const topItem    = [...data].sort((a,b)=>(parseFloat(b.install_pct)||0)-(parseFloat(a.install_pct)||0))[0];
    const lowItem    = [...data].filter(r=>parseFloat(r.planned_qty||0)>0).sort((a,b)=>(parseFloat(a.install_pct)||0)-(parseFloat(b.install_pct)||0))[0];

    if (complete > 0) insights.push({ type:'good',   text:`${complete} of ${total} items (${((complete/total)*100).toFixed(0)}%) are fully installed at 100%.` });
    if (onTrack > 0)  insights.push({ type:'info',   text:`${onTrack} items are on track (60–99% installed). Maintain current pace.` });
    if (behind > 0)   insights.push({ type:'bad',    text:`${behind} items are below 30% installation — these need immediate attention.` });
    insights.push({ type: avgInstPct>=70?'good':avgInstPct>=40?'warn':'bad',
      text:`Average installation progress: ${avgInstPct.toFixed(1)}%. Average delivery progress: ${avgDelPct.toFixed(1)}%.` });
    if (avgDelPct > avgInstPct + 20) insights.push({ type:'action',
      text:`Delivery is ${(avgDelPct-avgInstPct).toFixed(1)}% ahead of installation. Consider accelerating installation works to match delivered materials.` });
    if (topItem) insights.push({ type:'good',
      text:`Best performing item: "${topItem.item_name}" at ${parseFloat(topItem.install_pct||0).toFixed(1)}% installed.` });
    if (lowItem && parseFloat(lowItem.install_pct||0) < 10) insights.push({ type:'warn',
      text:`Lowest performing item: "${lowItem.item_name}" at only ${parseFloat(lowItem.install_pct||0).toFixed(1)}% installed. Review constraints.` });
  }

  if (type === 'projects') {
    const active   = data.filter(r=>r.status==='active'||r.status==='in_progress').length;
    const complete = data.filter(r=>parseFloat(r.install_pct||0)>=100).length;
    const avgPct   = data.reduce((s,r)=>s+(parseFloat(r.install_pct)||0),0)/data.length;
    const topProj  = [...data].sort((a,b)=>(parseFloat(b.install_pct)||0)-(parseFloat(a.install_pct)||0))[0];
    const totalDel = data.reduce((s,r)=>s+(parseFloat(r.delivered_qty)||0),0);
    const totalIns = data.reduce((s,r)=>s+(parseFloat(r.installed_qty)||0),0);

    insights.push({ type:'info', text:`${data.length} projects tracked. ${active} active, ${complete} fully complete.` });
    insights.push({ type:avgPct>=70?'good':avgPct>=40?'warn':'bad',
      text:`Overall portfolio installation average: ${avgPct.toFixed(1)}%.` });
    insights.push({ type:'info', text:`Total delivered across all projects: ${fmt2(totalDel)}. Total installed: ${fmt2(totalIns)}.` });
    if (totalDel > totalIns * 1.3) insights.push({ type:'action',
      text:`Significantly more material delivered (${fmt2(totalDel)}) than installed (${fmt2(totalIns)}). Investigate storage and installation bottlenecks.` });
    if (topProj) insights.push({ type:'good',
      text:`Top project: "${topProj.project_name_en||topProj.project_code}" at ${parseFloat(topProj.install_pct||0).toFixed(1)}% installed.` });
  }

  if (type === 'items') {
    const total    = data.length;
    const avgPct   = data.reduce((s,r)=>s+(parseFloat(r.install_pct)||0),0)/total;
    const notStart = data.filter(r=>parseFloat(r.total_installed||0)===0).length;
    const complete = data.filter(r=>parseFloat(r.install_pct||0)>=100).length;
    const topItem  = [...data].sort((a,b)=>(parseFloat(b.install_pct)||0)-(parseFloat(a.install_pct)||0))[0];

    insights.push({ type:'info', text:`Tracking ${total} item records across all selected filters.` });
    insights.push({ type:avgPct>=70?'good':avgPct>=40?'warn':'bad',
      text:`Average installation rate: ${avgPct.toFixed(1)}%. ${complete} items fully complete, ${notStart} not yet started.` });
    if (notStart > total * 0.3) insights.push({ type:'warn',
      text:`${notStart} items (${((notStart/total)*100).toFixed(0)}%) have zero installation. Prioritize mobilising these items.` });
    if (topItem) insights.push({ type:'good',
      text:`Best item: "${topItem.item_name}" — ${parseFloat(topItem.install_pct||0).toFixed(1)}% complete.` });
    insights.push({ type:'action', text:`Review items below 50% installation and align with delivery schedule to prevent site delays.` });
  }

  return insights;
}

// ── Search bar (inline — no sub-component to avoid focus loss) ─────────────
const searchStyle = {
  display:'flex', alignItems:'center', background:'var(--card)',
  border:'1px solid #cfe0ff', borderRadius:10, height:40, paddingLeft:12, maxWidth:380,
};

// ── Tab 1: Progress Report ─────────────────────────────────────────────────
function ProgressReport({ projects }) {
  const toast = useToast();
  const [projectId, setProjectId] = useState('');
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');

  const load = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try { setData(await api.getReportProgress(pid)); }
    catch (err) { toast(err.message,'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(projectId); }, [projectId, load]);

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(r =>
      (r.item_name||'').toLowerCase().includes(q) ||
      (r.item_code||'').toLowerCase().includes(q) ||
      (r.classification_name||'').toLowerCase().includes(q)
    );
  }, [data, search]);

  const totalPlanned   = filtered.reduce((s,r)=>s+(parseFloat(r.planned_qty)||0),0);
  const totalDelivered = filtered.reduce((s,r)=>s+(parseFloat(r.total_delivered)||0),0);
  const totalInstalled = filtered.reduce((s,r)=>s+(parseFloat(r.total_installed)||0),0);
  const avgDelPct      = totalPlanned>0 ? (totalDelivered/totalPlanned*100) : 0;
  const avgInstPct     = totalPlanned>0 ? (totalInstalled/totalPlanned*100) : 0;
  const complete       = filtered.filter(r=>parseFloat(r.install_pct||0)>=100).length;

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ ...filterLabelStyle }}>🏗️ Project</label>
          <select value={projectId} onChange={e => { setProjectId(e.target.value); setSearch(''); }} style={fSel}>
            <option value="">— Select Project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        {data.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ ...filterLabelStyle }}>🔍 Search</label>
            <div style={searchStyle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input style={{ border:'none', outline:'none', fontSize:13, color:'var(--text)', background:'none', width:'100%', padding:'0 10px', fontFamily:'inherit' }}
                placeholder="Item name or classification..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'0 12px' }}>✕</button>}
            </div>
          </div>
        )}
      </div>

      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

      {!loading && data.length > 0 && (
        <>
          {/* KPIs */}
          <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
            <KPICard label="Items" value={filtered.length} icon="📦" color="#7c3aed" bg="#f5f3ff" />
            <KPICard label="Complete" value={complete} icon="✅" color="#16a34a" bg="#f0fdf4" sub={`${((complete/Math.max(1,filtered.length))*100).toFixed(0)}% of items`} />
            <KPICard label="Delivery %" value={fmtPct(avgDelPct)} icon="🚚" color="#0369a1" bg="#eff6ff" sub={`${fmt2(totalDelivered)} / ${fmt2(totalPlanned)}`} />
            <KPICard label="Install %" value={fmtPct(avgInstPct)} icon="🔧" color={pctColor(avgInstPct)} bg={pctBg(avgInstPct)} sub={`${fmt2(totalInstalled)} / ${fmt2(totalPlanned)}`} />
          </div>

          <div style={{ ...tableWrapStyle }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={thS}>Code</th>
                    <th style={{ ...thS, minWidth:180 }}>Item Name</th>
                    <th style={thS}>Classification</th>
                    <th style={thS}>Unit</th>
                    <th style={{ ...thS, textAlign:'right' }}>Planned</th>
                    <th style={{ ...thS, textAlign:'right' }}>Delivered</th>
                    <th style={{ ...thS, minWidth:130 }}>Delivery %</th>
                    <th style={{ ...thS, textAlign:'right' }}>Installed</th>
                    <th style={{ ...thS, minWidth:130 }}>Install %</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background:'#fff' }}>
                      <td style={{ ...tdS, fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{r.item_code}</td>
                      <td style={{ ...tdS, fontWeight:600 }}>{r.item_name}</td>
                      <td style={{ ...tdS, fontSize:11, color:'#9ca3af' }}>{[r.parent_classification_name,r.classification_name].filter(Boolean).join(' › ')}</td>
                      <td style={{ ...tdS, color:'#6b7280' }}>{r.unit_of_measure||'—'}</td>
                      <td style={{ ...tdS, textAlign:'right', fontWeight:600 }}>{fmt2(r.planned_qty)}</td>
                      <td style={{ ...tdS, textAlign:'right', color:'#0369a1', fontWeight:600 }}>{fmt2(r.total_delivered)}</td>
                      <PctCell pct={r.delivery_pct} />
                      <td style={{ ...tdS, textAlign:'right', color:DESIGN.blue, fontWeight:600 }}>{fmt2(r.total_installed)}</td>
                      <PctCell pct={r.install_pct} />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:'#f0f7ff', borderTop:'2px solid #e0ecff' }}>
                    <td colSpan={4} style={{ ...tdS, fontWeight:700, color:'#374151' }}>TOTAL — {filtered.length} items</td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:700 }}>{fmt2(totalPlanned)}</td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:700, color:'#0369a1' }}>{fmt2(totalDelivered)}</td>
                    <td style={{ ...tdS }}><span style={{ fontWeight:700, color:pctColor(avgDelPct) }}>{fmtPct(avgDelPct)}</span></td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:700, color:DESIGN.blue }}>{fmt2(totalInstalled)}</td>
                    <td style={{ ...tdS }}><span style={{ fontWeight:700, color:pctColor(avgInstPct) }}>{fmtPct(avgInstPct)}</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <SmartInsights data={filtered} type="progress" />
        </>
      )}
      {!loading && !projectId && <div className="empty-state"><div className="empty-icon">📊</div><p>Select a project to view progress</p></div>}
      {!loading && projectId && data.length===0 && <div className="empty-state"><p>No data found</p></div>}
    </div>
  );
}

// ── Tab 2: Projects Summary ────────────────────────────────────────────────
function ProjectsSummaryReport() {
  const toast = useToast();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    api.getReportProjectsSummary()
      .then(setData).catch(err=>toast(err.message,'error')).finally(()=>setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(r =>
      (r.project_name_en||'').toLowerCase().includes(q) ||
      (r.project_code||'').toLowerCase().includes(q)
    );
  }, [data, search]);

  const totalPlanned   = filtered.reduce((s,r)=>s+(parseFloat(r.planned_qty)||0),0);
  const totalDelivered = filtered.reduce((s,r)=>s+(parseFloat(r.delivered_qty)||0),0);
  const totalInstalled = filtered.reduce((s,r)=>s+(parseFloat(r.installed_qty)||0),0);
  const avgInstPct     = totalPlanned>0?(totalInstalled/totalPlanned*100):0;

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  return (
    <div>
      {data.length > 0 && (
        <>
          <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ ...filterLabelStyle }}>🔍 Search</label>
              <div style={searchStyle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input style={{ border:'none', outline:'none', fontSize:13, color:'var(--text)', background:'none', width:'100%', padding:'0 10px', fontFamily:'inherit' }}
                  placeholder="Project name or code..." value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'0 12px' }}>✕</button>}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
            <KPICard label="Projects" value={filtered.length} icon="🏗️" color="#7c3aed" bg="#f5f3ff" />
            <KPICard label="Total Planned" value={fmt2(totalPlanned)} icon="📋" color="#374151" bg="#f9fafb" />
            <KPICard label="Total Delivered" value={fmt2(totalDelivered)} icon="🚚" color="#0369a1" bg="#eff6ff" />
            <KPICard label="Total Installed" value={fmt2(totalInstalled)} icon="🔧" color={pctColor(avgInstPct)} bg={pctBg(avgInstPct)} sub={fmtPct(avgInstPct)+' overall'} />
          </div>

          <div style={{ ...tableWrapStyle }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={thS}>Code</th>
                    <th style={{ ...thS, minWidth:200 }}>Project Name</th>
                    <th style={thS}>Status</th>
                    <th style={{ ...thS, textAlign:'right' }}>Planned</th>
                    <th style={{ ...thS, textAlign:'right' }}>Delivered</th>
                    <th style={{ ...thS, textAlign:'right' }}>Installed</th>
                    <th style={{ ...thS, minWidth:130 }}>Install %</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r,i) => (
                    <tr key={r.id} style={{ borderBottom:'1px solid #f3f4f6', background:'#fff' }}>
                      <td style={{ ...tdS, fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{r.project_code}</td>
                      <td style={{ ...tdS, fontWeight:600 }}>
                        <div>{r.project_name_en}</div>
                        {r.project_name_ar && <div style={{ fontSize:11, color:'#9ca3af' }}>{r.project_name_ar}</div>}
                      </td>
                      <td style={tdS}>
                        <span style={{ background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
                          {r.status||'active'}
                        </span>
                      </td>
                      <td style={{ ...tdS, textAlign:'right', fontWeight:600 }}>{fmt2(r.planned_qty)}</td>
                      <td style={{ ...tdS, textAlign:'right', color:'#0369a1', fontWeight:600 }}>{fmt2(r.delivered_qty)}</td>
                      <td style={{ ...tdS, textAlign:'right', color:DESIGN.blue, fontWeight:600 }}>{fmt2(r.installed_qty)}</td>
                      <PctCell pct={r.install_pct} />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:'#f0f7ff', borderTop:'2px solid #e0ecff' }}>
                    <td colSpan={3} style={{ ...tdS, fontWeight:700 }}>TOTAL</td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:700 }}>{fmt2(totalPlanned)}</td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:700, color:'#0369a1' }}>{fmt2(totalDelivered)}</td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:700, color:DESIGN.blue }}>{fmt2(totalInstalled)}</td>
                    <td style={tdS}><span style={{ fontWeight:700, color:pctColor(avgInstPct) }}>{fmtPct(avgInstPct)}</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <SmartInsights data={filtered} type="projects" />
        </>
      )}
      {!data.length && <div className="empty-state"><p>No project data found</p></div>}
    </div>
  );
}

// ── Tab 3: Item Tracking ───────────────────────────────────────────────────
function ItemTrackingReport({ projects, items }) {
  const toast = useToast();
  const [projectId, setProjectId] = useState('');
  const [itemId,    setItemId]    = useState('');
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    setLoading(true);
    api.getReportItemTracking({ projectId:projectId||undefined, itemId:itemId||undefined })
      .then(setData).catch(err=>toast(err.message,'error')).finally(()=>setLoading(false));
  }, [projectId, itemId]);

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(r =>
      (r.item_name||'').toLowerCase().includes(q) ||
      (r.item_code||'').toLowerCase().includes(q) ||
      (r.project_name_en||'').toLowerCase().includes(q)
    );
  }, [data, search]);

  const avgInstPct = filtered.length>0
    ? filtered.reduce((s,r)=>s+(parseFloat(r.install_pct)||0),0)/filtered.length : 0;

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ ...filterLabelStyle }}>🏗️ Project</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...fSel, minWidth:240 }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ ...filterLabelStyle }}>📦 Item</label>
          <select value={itemId} onChange={e => setItemId(e.target.value)} style={{ ...fSel, minWidth:220 }}>
            <option value="">All Items</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
          </select>
        </div>
        {data.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ ...filterLabelStyle }}>🔍 Search</label>
            <div style={searchStyle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input style={{ border:'none', outline:'none', fontSize:13, color:'var(--text)', background:'none', width:'100%', padding:'0 10px', fontFamily:'inherit' }}
                placeholder="Item, project or code..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'0 12px' }}>✕</button>}
            </div>
          </div>
        )}
      </div>

      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}
      {!loading && filtered.length > 0 && (
        <>
          <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
            <KPICard label="Records" value={filtered.length} icon="📋" color="#7c3aed" bg="#f5f3ff" />
            <KPICard label="Avg Install %" value={fmtPct(avgInstPct)} icon="🔧" color={pctColor(avgInstPct)} bg={pctBg(avgInstPct)} />
            <KPICard label="Complete" value={filtered.filter(r=>parseFloat(r.install_pct||0)>=100).length} icon="✅" color="#16a34a" bg="#f0fdf4" />
            <KPICard label="Not Started" value={filtered.filter(r=>parseFloat(r.total_installed||0)===0).length} icon="⏳" color="#f59e0b" bg="#fffbeb" />
          </div>
          <div style={{ ...tableWrapStyle }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={thS}>Project</th>
                    <th style={thS}>Code</th>
                    <th style={{ ...thS, minWidth:160 }}>Item Name</th>
                    <th style={thS}>Unit</th>
                    <th style={{ ...thS, textAlign:'right' }}>Planned</th>
                    <th style={{ ...thS, textAlign:'right' }}>Delivered</th>
                    <th style={{ ...thS, textAlign:'right' }}>Installed</th>
                    <th style={{ ...thS, minWidth:130 }}>Install %</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background:'#fff' }}>
                      <td style={{ ...tdS, fontSize:11, color:'#6b7280' }}>{r.project_name_en||r.project_code}</td>
                      <td style={{ ...tdS, fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{r.item_code}</td>
                      <td style={{ ...tdS, fontWeight:600 }}>{r.item_name}</td>
                      <td style={{ ...tdS, color:'#6b7280' }}>{r.unit_of_measure||'—'}</td>
                      <td style={{ ...tdS, textAlign:'right', fontWeight:600 }}>{fmt2(r.planned_qty)}</td>
                      <td style={{ ...tdS, textAlign:'right', color:'#0369a1', fontWeight:600 }}>{fmt2(r.total_delivered)}</td>
                      <td style={{ ...tdS, textAlign:'right', color:DESIGN.blue, fontWeight:600 }}>{fmt2(r.total_installed)}</td>
                      <PctCell pct={r.install_pct} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <SmartInsights data={filtered} type="items" />
        </>
      )}
      {!loading && filtered.length===0 && <div className="empty-state"><p>No data found</p></div>}
    </div>
  );
}


// ── Tab 4: Item Logs ───────────────────────────────────────────────────────
function ItemLogsReport({ projects }) {
  const toast = useToast();
  const [projectId,  setProjectId]  = useState('');
  const [process,    setProcess]    = useState('');
  const [status,     setStatus]     = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  async function load() {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = { projectId };
      if (process)  params.process  = process;
      if (status)   params.status   = status;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo)   params.dateTo   = dateTo;
      setData(await api.getItemLogs(params));
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [projectId, process, status, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(r =>
      (r.item_name||'').toLowerCase().includes(q) ||
      (r.item_code||'').toLowerCase().includes(q)
    );
  }, [data, search]);

  const STATUS_CFG = {
    incomplete: { bg:'#fff7ed', color:'#ea580c', border:'#fed7aa', label:'Incomplete' },
    saved:      { bg:'#eff6ff', color:DESIGN.blue, border:'#bfdbfe', label:'Saved'      },
    no_entry:   { bg:'#f3f4f6', color:'#6b7280', border:'#e5e7eb', label:'No Entry'   },
  };
  const PROCESS_CFG = {
    planning:     { icon:'📋', color:'#2563eb', bg:'#eff6ff', label:'Planning'     },
    delivery:     { icon:'🚚', color:'#0369a1', bg:'#e0f2fe', label:'Delivery'     },
    installation: { icon:'🔧', color:DESIGN.blue, bg:'#eff6ff', label:'Installation' },
    no_entry:     { icon:'⭕', color:'#6b7280', bg:'#f3f4f6', label:'No Entry'     },
  };

  const StatusBadge = ({ s }) => {
    const cfg = STATUS_CFG[s] || { bg:'#f3f4f6', color:'#6b7280', border:'#e5e7eb', label: s };
    return (
      <span style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`,
        borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
        {cfg.label}
      </span>
    );
  };

  const ProcessBadge = ({ p }) => {
    const cfg = PROCESS_CFG[p] || { icon:'❓', color:'#6b7280', bg:'#f3f4f6', label: p };
    return (
      <span style={{ background:cfg.bg, color:cfg.color, borderRadius:6,
        padding:'2px 8px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  const counts = useMemo(() => {
    const c = { incomplete:0, saved:0, no_entry:0, planning:0, delivery:0, installation:0 };
    filtered.forEach(r => {
      if (r.status==='incomplete') c.incomplete++;
      if (r.status==='saved')      c.saved++;
      if (r.status==='no_entry')   c.no_entry++;
      if (r.process==='planning')     c.planning++;
      if (r.process==='delivery')     c.delivery++;
      if (r.process==='installation') c.installation++;
    });
    return c;
  }, [filtered]);

  return (
    <div>
      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ ...filterLabelStyle }}>🏗️ Project</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={fSel}>
            <option value="">— Select Project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ ...filterLabelStyle }}>⚙️ Process</label>
          <select value={process} onChange={e => setProcess(e.target.value)}
            style={{ ...fSel, minWidth:160 }}>
            <option value="">All Processes</option>
            <option value="planning">📋 Planning</option>
            <option value="delivery">🚚 Delivery</option>
            <option value="installation">🔧 Installation</option>
            <option value="no_entry">⭕ No Entry</option>
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ ...filterLabelStyle }}>📋 Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            style={{ ...fSel, minWidth:160 }}>
            <option value="">All Statuses</option>
            <option value="incomplete">Incomplete</option>
            <option value="saved">Saved</option>
            <option value="no_entry">No Entry</option>
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ ...filterLabelStyle }}>📅 From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ ...fSel, minWidth:150, cursor:'default', fontWeight:400 }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ ...filterLabelStyle }}>📅 To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ ...fSel, minWidth:150, cursor:'default', fontWeight:400 }} />
        </div>
        {data.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ ...filterLabelStyle }}>🔍 Search</label>
            <div style={searchStyle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input style={{ border:'none', outline:'none', fontSize:13, color:'var(--text)', background:'none', width:'100%', padding:'0 10px', fontFamily:'inherit' }}
                placeholder="Item name or code..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'0 12px' }}>✕</button>}
            </div>
          </div>
        )}
      </div>

      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}
      {!projectId && !loading && (
        <div className="empty-state"><div className="empty-icon">🔍</div><p>Select a project to view item logs</p></div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          {/* Summary KPIs */}
          <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
            <KPICard label="Total Logs" value={filtered.length} icon="📋" color="#7c3aed" bg="#f5f3ff" />
            {counts.incomplete > 0 && <KPICard label="Incomplete" value={counts.incomplete} icon="⏳" color="#ea580c" bg="#fff7ed" />}
            {counts.saved > 0      && <KPICard label="Saved" value={counts.saved} icon="💾" color="#7c3aed" bg="#f5f3ff" />}
            {counts.no_entry > 0   && <KPICard label="No Entry" value={counts.no_entry} icon="⭕" color="#6b7280" bg="#f3f4f6" />}
            {counts.delivery > 0       && <KPICard label="Delivery" value={counts.delivery} icon="🚚" color="#0369a1" bg="#e0f2fe" />}
            {counts.installation > 0   && <KPICard label="Installation" value={counts.installation} icon="🔧" color="#7c3aed" bg="#f5f3ff" />}
          </div>

          <div style={{ ...tableWrapStyle }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={thS}>Date</th>
                    <th style={thS}>Process</th>
                    <th style={thS}>Code</th>
                    <th style={{ ...thS, minWidth:180 }}>Item Name</th>
                    <th style={thS}>Unit</th>
                    <th style={{ ...thS, textAlign:'right' }}>Qty</th>
                    <th style={thS}>Status</th>
                    <th style={{ ...thS, minWidth:160 }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background:'#fff' }}>
                      <td style={{ ...tdS, whiteSpace:'nowrap', color:'#374151', fontWeight:500 }}>
                        {r.event_date ? r.event_date.slice(0,10) : <span style={{ color:'#d1d5db' }}>—</span>}
                      </td>
                      <td style={tdS}><ProcessBadge p={r.process} /></td>
                      <td style={{ ...tdS, fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{r.item_code}</td>
                      <td style={{ ...tdS, fontWeight:600, color:'#111827' }}>{r.item_name}</td>
                      <td style={{ ...tdS, color:'#9ca3af', fontSize:11 }}>{r.unit_of_measure||'—'}</td>
                      <td style={{ ...tdS, textAlign:'right', fontWeight:600, color:'#374151' }}>
                        {parseFloat(r.qty||0).toFixed(2)}
                      </td>
                      <td style={tdS}><StatusBadge s={r.status} /></td>
                      <td style={{ ...tdS, color:'#6b7280', fontSize:11 }}>{r.notes||<span style={{ color:'#e5e7eb' }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'10px 16px', borderTop:'1px solid #f3f4f6', fontSize:12, color:'#9ca3af' }}>
              Showing {filtered.length} log{filtered.length!==1?'s':''}
              {(dateFrom||dateTo) && <span> · Date range: {dateFrom||'—'} to {dateTo||'—'}</span>}
            </div>
          </div>

          {/* Action Required */}
          <div style={{ marginTop:14, background:'#eff6ff', border:'1px solid #ddd6fe', borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:DESIGN.blue, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.07em' }}>🎯 Action Required</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {counts.incomplete > 0 && (
                <div style={{ fontSize:12, color:'#374151', display:'flex', gap:8, alignItems:'flex-start' }}>
                  <span>⚠️</span>
                  <span><strong>{counts.incomplete}</strong> incomplete entr{counts.incomplete===1?'y':'ies'} — these have been started but not saved. Follow up with the field team to complete or save them.</span>
                </div>
              )}
              {counts.saved > 0 && (
                <div style={{ fontSize:12, color:'#374151', display:'flex', gap:8, alignItems:'flex-start' }}>
                  <span>💾</span>
                  <span><strong>{counts.saved}</strong> saved entr{counts.saved===1?'y':'ies'} pending approval — review and approve to include in official reports.</span>
                </div>
              )}
              {counts.no_entry > 0 && (
                <div style={{ fontSize:12, color:'#374151', display:'flex', gap:8, alignItems:'flex-start' }}>
                  <span>⭕</span>
                  <span><strong>{counts.no_entry}</strong> planned item{counts.no_entry===1?'':'s'} with zero delivery or installation activity — mobilise or investigate delays.</span>
                </div>
              )}
              {counts.incomplete===0 && counts.saved===0 && counts.no_entry===0 && (
                <div style={{ fontSize:12, color:'#16a34a' }}>✅ No pending items found for the selected filters.</div>
              )}
            </div>
          </div>
        </>
      )}
      {!loading && projectId && data.length === 0 && (
        <div className="empty-state"><p>No pending logs found for this project</p></div>
      )}
    </div>
  );
}

// ── Main Reports Page ──────────────────────────────────────────────────────
const TABS = [
  { key:'progress', label:'📈 Progress',        icon:'📈' },
  { key:'projects', label:'🏗️ Projects Summary', icon:'🏗️' },
  { key:'items',    label:'📦 Item Tracking',    icon:'📦' },
  { key:'logs',     label:'🔍 Item Logs',          icon:'🔍' },
];

export default function Reports() {
  const toast = useToast();
  const [tab,      setTab]      = useState('progress');
  const [projects, setProjects] = useState([]);
  const [items,    setItems]    = useState([]);

  useEffect(() => {
    Promise.all([api.getProjects(), api.getItems()])
      .then(([p,i]) => { setProjects(p); setItems(i); })
      .catch(() => toast('Failed to load', 'error'));
  }, []);

  return (
    <div style={{ marginTop:-10, paddingBottom:24 }}>
      <div style={{ background:'linear-gradient(180deg,#fff,#f8fbff)', border:'1px solid #dbeafe', borderRadius:18,
        padding:'16px 18px', boxShadow:'0 12px 30px rgba(15,23,42,.06)', display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
        <div style={{ width:46, height:46, borderRadius:14, background:'linear-gradient(135deg,#2563eb,#3b82f6)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 10px 22px rgba(37,99,235,.25)' }}>
          <span style={{ fontSize:22 }}>📊</span>
        </div>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:20, fontWeight:900, color:'#0f172a', margin:0 }}>Reports</h1>
          <p style={{ fontSize:12, color:'#64748b', margin:'5px 0 0 0' }}>
            Progress, summary, tracking and logs with consistent project monitoring analytics.
          </p>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        {TABS.map(tb => {
          const active = tab === tb.key;
          const cleanLabel = tb.label.replace(/^\S+\s+/, '');
          return (
            <button key={tb.key} onClick={() => setTab(tb.key)} style={{
              padding:'11px 18px', fontSize:13, fontWeight:800, cursor:'pointer', borderRadius:12,
              background:active?'linear-gradient(135deg,#2563eb,#1d4ed8)':'#fff',
              border:active?'1px solid #1d4ed8':'1px solid #dbeafe', fontFamily:'inherit',
              color: active?'#fff':'#334155', boxShadow:active?'0 12px 24px rgba(37,99,235,.22)':'0 6px 16px rgba(15,23,42,.04)',
              transition:'all .15s', whiteSpace:'nowrap'
            }}>{tb.icon} {cleanLabel}</button>
          );
        })}
      </div>

      {tab==='progress' && <ProgressReport   projects={projects} />}
      {tab==='projects' && <ProjectsSummaryReport />}
      {tab==='items'    && <ItemTrackingReport projects={projects} items={items} />}
      {tab==='logs'     && <ItemLogsReport     projects={projects} />}
    </div>
  );
}