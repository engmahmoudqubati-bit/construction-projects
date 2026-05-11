import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell, Legend,
} from 'recharts';

// ── Colour palette ─────────────────────────────────────────────────────────
const ORANGE   = '#e8611a';
const ORANGE2  = '#f59e0b';
const BLUE     = '#3b82f6';
const GREEN    = '#22c55e';
const PURPLE   = '#8b5cf6';
const GREY     = '#94a3b8';

// 3D bar effect via gradient + drop-shadow filter
const GradBar = ({ x, y, width, height, color }) => {
  if (!height || height <= 0) return null;
  const lighter = color + 'cc';
  const darker  = color + '88';
  const id = `grad-${color.replace('#','')}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={lighter} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      {/* Main bar */}
      <rect x={x} y={y} width={width} height={height}
        fill={`url(#${id})`} rx={3} ry={3} />
      {/* 3D top face */}
      <polygon
        points={`${x},${y} ${x+6},${y-5} ${x+width+6},${y-5} ${x+width},${y}`}
        fill={lighter} opacity={0.9} />
      {/* 3D right face */}
      <polygon
        points={`${x+width},${y} ${x+width+6},${y-5} ${x+width+6},${y+height-5} ${x+width},${y+height}`}
        fill={darker} opacity={0.85} />
    </g>
  );
};

// Custom percentage label on top of bar
const PctLabel = ({ x, y, width, value }) => {
  if (!value && value !== 0) return null;
  const pct = parseFloat(value);
  return (
    <text x={x + width / 2} y={y - 10} textAnchor="middle"
      fill="#374151" fontSize={11} fontWeight={700}>
      {pct.toFixed(0)}%
    </text>
  );
};

// ── Shared chart tooltip ────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
      padding:'10px 14px', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', fontSize:12 }}>
      <div style={{ fontWeight:700, color:'#111827', marginBottom:6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <span style={{ width:10, height:10, borderRadius:2, background:p.fill, display:'inline-block' }} />
          <span style={{ color:'#6b7280' }}>{p.name}:</span>
          <span style={{ fontWeight:700, color:'#111827' }}>{parseFloat(p.value||0).toFixed(1)}{p.name.includes('%')?'%':''}</span>
        </div>
      ))}
    </div>
  );
};

// ── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon, color, bg }) {
  const pct = parseFloat(value);
  const isPercent = typeof value === 'string' && value.includes('%');
  return (
    <div style={{ flex:'1 1 160px', background: bg||'#fff',
      border:`1px solid ${color}33`, borderRadius:14,
      padding:'16px 18px', borderLeft:`4px solid ${color}`,
      boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
          letterSpacing:'0.08em', color:'#6b7280' }}>{label}</div>
        <span style={{ fontSize:22 }}>{icon}</span>
      </div>
      <div style={{ fontSize:26, fontWeight:800, color:'#111827', marginBottom:4 }}>{value}</div>
      {isPercent && (
        <div style={{ height:5, background:'#e5e7eb', borderRadius:99, overflow:'hidden', marginBottom:4 }}>
          <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:color, borderRadius:99, transition:'width 0.5s' }} />
        </div>
      )}
      {sub && <div style={{ fontSize:11, color:'#9ca3af' }}>{sub}</div>}
    </div>
  );
}

// ── Chart Card wrapper ──────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, accent=ORANGE }) {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb',
      boxShadow:'0 2px 10px rgba(0,0,0,0.05)', overflow:'hidden' }}>
      <div style={{ background:`linear-gradient(90deg,${accent}22,transparent)`,
        padding:'12px 18px', borderBottom:'1px solid #f3f4f6' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827',
          display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:4, height:18, background:accent, borderRadius:99, display:'inline-block', flexShrink:0 }} />
          {title}
        </div>
        {subtitle && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2, marginLeft:12 }}>{subtitle}</div>}
      </div>
      <div style={{ padding:'14px 10px 10px' }}>{children}</div>
    </div>
  );
}

// ── Main 3D Bar Chart ───────────────────────────────────────────────────────
function Bar3D({ data, dataKey, nameKey='name', color=ORANGE, height=260, showLabel=true, secondaryKey, secondaryColor }) {
  if (!data?.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:13 }}>No data</div>;

  const truncate = (s, n=14) => s && s.length > n ? s.slice(0,n)+'…' : s;
  const chartData = data.map(d => ({ ...d, [nameKey]: truncate(d[nameKey]) }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top:30, right:20, left:0, bottom:55 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey={nameKey}
          tick={{ fill:'#374151', fontSize:11, fontWeight:500 }}
          angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} domain={[0,100]}
          tickFormatter={v => `${v}%`} />
        <Tooltip content={<CustomTooltip />} />
        {secondaryKey && <Legend wrapperStyle={{ fontSize:11, paddingTop:8 }} />}
        <Bar dataKey={dataKey} name={dataKey} shape={<GradBar color={color} />} maxBarSize={52}>
          {showLabel && <LabelList content={<PctLabel />} />}
        </Bar>
        {secondaryKey && (
          <Bar dataKey={secondaryKey} name={secondaryKey} shape={<GradBar color={secondaryColor||BLUE} />} maxBarSize={52}>
            {showLabel && <LabelList content={<PctLabel />} />}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Floor mini charts (like image 2 — one per floor) ────────────────────────
function FloorMiniCharts({ floorData }) {
  if (!floorData?.length) return <div style={{ color:'#9ca3af', fontSize:13, padding:20, textAlign:'center' }}>No floor data</div>;

  const truncate = (s, n=10) => s && s.length > n ? s.slice(0,n)+'…' : s;

  return (
    <div style={{ display:'flex', gap:12, overflowX:'auto', padding:'4px 2px 8px' }}>
      {floorData.map(floor => {
        const pct = parseFloat(floor.install_pct)||0;
        const color = pct >= 80 ? GREEN : pct >= 50 ? ORANGE : pct >= 20 ? ORANGE2 : GREY;
        const chartData = [{ name: floor.level_code, pct }];
        return (
          <div key={floor.level_code} style={{ flexShrink:0, width:140,
            background:'#fff', border:'1px solid #e5e7eb', borderRadius:12,
            padding:'10px 8px 6px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#111827', marginBottom:6, textAlign:'center' }}>
              {floor.level_code}
              <div style={{ fontSize:9, fontWeight:400, color:'#9ca3af' }}>{truncate(floor.level_name,12)}</div>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} margin={{ top:20, right:4, left:4, bottom:4 }} barCategoryGap="40%">
                <YAxis hide domain={[0,100]} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pct" name="Install %" shape={<GradBar color={color} />} maxBarSize={40}>
                  <LabelList content={({ x, y, width, value }) => (
                    <text x={x+width/2} y={y-6} textAnchor="middle" fill="#374151" fontSize={12} fontWeight={700}>{Math.round(value)}%</text>
                  )} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ height:4, background:'#e5e7eb', borderRadius:99, overflow:'hidden', marginTop:4 }}>
              <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:color, borderRadius:99 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [projects,        setProjects]        = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');
  const [filterClass,     setFilterClass]     = useState('');
  const [kpis,            setKpis]            = useState(null);
  const [installData,     setInstallData]     = useState([]);
  const [deliveryData,    setDeliveryData]    = useState([]);
  const [classData,       setClassData]       = useState([]);
  const [floorData,       setFloorData]       = useState([]);
  const [projectData,     setProjectData]     = useState([]);
  const [loading,         setLoading]         = useState(false);

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  const load = useCallback(async (pid) => {
    setLoading(true);
    try {
      const [k, inst, del, cls, fl, prj] = await Promise.all([
        api.getDashboardKpis(pid),
        api.getInstallationProgress(pid),
        api.getDeliveryProgress(pid),
        api.getDashboardByClassification(pid),
        api.getDashboardByFloor(pid),
        api.getDashboardByProject(),
      ]);
      setKpis(k);
      setInstallData(inst);
      setDeliveryData(del);
      setClassData(cls);
      setFloorData(fl);
      setProjectData(prj);
    } catch { /* keep stale */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(selectedProject); }, [selectedProject, load]);

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  // All classifications for filter
  const classifications = useMemo(() => {
    const seen = new Set();
    return [...installData, ...deliveryData].map(r => r.classification_name || '').filter(v => v && !seen.has(v) && seen.add(v));
  }, [installData, deliveryData]);

  // Filter chart data by classification
  const filteredInstall  = useMemo(() => filterClass ? installData.filter(r => r.classification_name===filterClass) : installData, [installData, filterClass]);
  const filteredDelivery = useMemo(() => filterClass ? deliveryData.filter(r => r.classification_name===filterClass) : deliveryData, [deliveryData, filterClass]);

  // Prepare class comparison data
  const classChartData = classData.map(r => ({
    name: r.classification,
    'Delivery %': parseFloat(r.delivery_pct)||0,
    'Install %':  parseFloat(r.install_pct)||0,
  }));

  // Project comparison
  const projectChartData = projectData.map(r => ({
    name: r.project_name?.length > 16 ? r.project_name.slice(0,16)+'…' : r.project_name,
    'Delivery %': parseFloat(r.delivery_pct)||0,
    'Install %':  parseFloat(r.install_pct)||0,
  }));

  const fSel = { appearance:'none', background:'#fff', border:'1.5px solid #d1d5db',
    borderRadius:8, padding:'7px 32px 7px 12px', fontSize:13, fontWeight:600,
    color:'#374151', cursor:'pointer', fontFamily:'inherit', outline:'none', height:38 };

  return (
    <div style={{ padding:'0 0 32px' }}>
      {/* ── Top filter bar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:800, color:'#111827', margin:0 }}>
            📊 Dashboard
          </h1>
          <p style={{ fontSize:11, color:'#9ca3af', margin:'2px 0 0 0' }}>
            Construction progress — delivery, installation & inspection
          </p>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          {/* Project filter */}
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <label style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9ca3af' }}>Project</label>
            <div style={{ position:'relative' }}>
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ ...fSel, minWidth:220 }}>
                <option value="all">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
              </select>
              <svg style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          {/* Classification filter */}
          {classifications.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              <label style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9ca3af' }}>Classification</label>
              <div style={{ position:'relative' }}>
                <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ ...fSel, minWidth:170 }}>
                  <option value="">All Classifications</option>
                  {classifications.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <svg style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          )}
          {/* Refresh */}
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <label style={{ fontSize:9, color:'transparent' }}>·</label>
            <button onClick={() => load(selectedProject)} disabled={loading}
              style={{ height:38, width:38, borderRadius:8, border:'1.5px solid #d1d5db', background:'#fff',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {kpis && (
        <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <KPICard label="Total Projects"      value={kpis.project_count}        icon="🏗️" color={PURPLE} bg="#faf5ff" />
          <KPICard label="Planned Qty"         value={parseFloat(kpis.planned_qty||0).toFixed(0)}   icon="📋" color={GREY}   bg="#f8fafc" sub="Total units in BOQ" />
          <KPICard label="Delivery Progress"   value={`${kpis.delivery_pct}%`}   icon="🚚" color={BLUE}   bg="#eff6ff"
            sub={`${parseFloat(kpis.delivered_qty||0).toFixed(0)} / ${parseFloat(kpis.planned_qty||0).toFixed(0)} units`} />
          <KPICard label="Installation Progress" value={`${kpis.installation_pct}%`} icon="🔧" color={ORANGE}  bg="#fff7ed"
            sub={`${parseFloat(kpis.installed_qty||0).toFixed(0)} / ${parseFloat(kpis.planned_qty||0).toFixed(0)} units`} />
        </div>
      )}

      {/* ── Row 1: Installation by item + Delivery by item ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <ChartCard title="Installation Progress by Item" subtitle="% installed vs planned (confirmed only)" accent={ORANGE}>
          <Bar3D
            data={filteredInstall.map(r => ({ name: r.item_name, pct: parseFloat(r.pct||0) }))}
            dataKey="pct" color={ORANGE} height={280} />
        </ChartCard>
        <ChartCard title="Delivery Progress by Item" subtitle="% delivered vs planned (confirmed only)" accent={BLUE}>
          <Bar3D
            data={filteredDelivery.map(r => ({ name: r.item_name, pct: parseFloat(r.pct||0) }))}
            dataKey="pct" color={BLUE} height={280} />
        </ChartCard>
      </div>

      {/* ── Row 2: By Classification (delivery vs install comparison) ── */}
      <div style={{ marginBottom:16 }}>
        <ChartCard title="Progress by Classification" subtitle="Delivery % vs Installation % — side by side comparison" accent={ORANGE}>
          <Bar3D
            data={classChartData} dataKey="Delivery %" nameKey="name"
            color={BLUE} secondaryKey="Install %" secondaryColor={ORANGE}
            height={300} />
        </ChartCard>
      </div>

      {/* ── Row 3: Floor/Basement mini charts (like image 2) ── */}
      {floorData.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <ChartCard title="Installation Progress by Floor / Basement" subtitle="One card per level — orange bar shows % installed vs suggested" accent={ORANGE}>
            <FloorMiniCharts floorData={floorData} />
          </ChartCard>
        </div>
      )}

      {/* ── Row 4: Project comparison ── */}
      {projectChartData.length > 1 && (
        <div style={{ marginBottom:16 }}>
          <ChartCard title="Project Comparison" subtitle="Delivery % vs Installation % across all projects" accent={PURPLE}>
            <Bar3D
              data={projectChartData} dataKey="Delivery %" nameKey="name"
              color={BLUE} secondaryKey="Install %" secondaryColor={ORANGE}
              height={280} />
          </ChartCard>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}