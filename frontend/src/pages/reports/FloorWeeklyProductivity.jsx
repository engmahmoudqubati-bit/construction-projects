import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';

const fmt2 = v => (parseFloat(v)||0).toFixed(2);

// ── Week helpers (same as DailyProductivity) ──────────────────────────────────
function getWeekSaturday(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const date = new Date(y,m-1,d);
  const day = date.getDay();
  const offset = day===6 ? 0 : day+1;
  date.setDate(date.getDate()-offset);
  return date;
}
function addDays(date, n) { const d=new Date(date); d.setDate(d.getDate()+n); return d; }
function toISO(date) {
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function formatDate(ds) {
  if (!ds) return '';
  const [y,m,d] = ds.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function generateWeeks(firstDateStr) {
  if (!firstDateStr) return [];
  const today = new Date();
  let sat = getWeekSaturday(firstDateStr);
  const weeks=[]; let wn=1;
  while (sat<=today) {
    const thu = addDays(sat,5);
    weeks.push({ weekNum:wn++, sat:toISO(sat), thu:toISO(thu),
      label:`Week ${wn-1} — ${formatDate(toISO(sat))} → ${formatDate(toISO(thu))}` });
    sat = addDays(sat,7);
  }
  return weeks;
}



// ── Installation/Daily-style fixed filter panel ───────────────────────────────
function FilterShell({ title, subtitle, children, right, columns }) {
  return (
    <div style={{
      background:'#fff', border:'1px solid #bfdbfe', borderRadius:16, overflow:'hidden',
      boxShadow:'0 10px 22px rgba(15,23,42,0.04)', marginBottom:10
    }}>
      <div style={{
        minHeight:36, padding:'7px 10px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
        background:'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)', borderBottom:'1px solid #bfdbfe'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <div style={{ width:26, height:26, borderRadius:9, background:'#1d4ed8', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, boxShadow:'0 8px 18px rgba(29,78,216,0.18)' }}>⚙️</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:900, color:'#0f172a', lineHeight:1.1 }}>{title}</div>
            <div style={{ fontSize:11, color:'#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:2 }}>{subtitle}</div>
          </div>
        </div>
        {right}
      </div>
      <div style={{ padding:10, display:'grid', gridTemplateColumns: columns || 'repeat(auto-fit, minmax(240px, 1fr))', gap:10, alignItems:'end' }}>
        {children}
      </div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div style={{ minWidth:0 }}>
      <label style={{ display:'block', fontSize:10, fontWeight:900, color:'#334155', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}

function FloorWeekFilter({ projects, projectId, setProjectId, weeks, years, months, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, weekNum, setWeekNum, weekInput, setWeekInput, selectedWeek, search, setSearch, filterClass, setFilterClass, classifications, fSel, projectLabel }) {
  const monthName = m => new Date(`2000-${m}-01`).toLocaleDateString('en-GB',{month:'long'});
  const filteredWeeks = useMemo(()=>{
    let ws=weeks;
    if (selectedYear)  ws=ws.filter(w=>w.sat.startsWith(selectedYear)||w.thu.startsWith(selectedYear));
    if (selectedMonth) ws=ws.filter(w=>w.sat.slice(0,7)===`${selectedYear}-${selectedMonth}`||w.thu.slice(0,7)===`${selectedYear}-${selectedMonth}`);
    return ws;
  },[weeks,selectedYear,selectedMonth]);
  const resetFilters = () => { setSelectedYear(''); setSelectedMonth(''); setWeekNum(''); setWeekInput(''); setSearch(''); setFilterClass(''); };
  return (
    <FilterShell
      title="Report Filters"
      subtitle="Project, installation period, selected week, floor/basement and search."
      columns={'minmax(220px,1.35fr) minmax(90px,.55fr) minmax(130px,.75fr) minmax(90px,.55fr) minmax(220px,1.35fr) minmax(180px,1fr) minmax(220px,1.35fr)'}
      right={selectedWeek ? <div style={{ background:'#ffffff', border:'1px solid #bfdbfe', color:'#0f172a', borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:800, whiteSpace:'nowrap' }}>Week {selectedWeek.weekNum}: {formatDate(selectedWeek.sat)} → {formatDate(selectedWeek.thu)}</div> : null}
    >
      <FilterField label="Select Project">
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...fSel, width:'100%' }}>
          <option value="">— Select Project —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
        </select>
      </FilterField>
      <FilterField label="Year">
        <select value={selectedYear} onChange={e=>{setSelectedYear(e.target.value);setSelectedMonth('');setWeekNum('');setWeekInput('');}} style={{ ...fSel, width:'100%' }} disabled={!years.length}>
          <option value="">All</option>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </FilterField>
      <FilterField label="Month">
        <select value={selectedMonth} onChange={e=>{setSelectedMonth(e.target.value);setWeekNum('');setWeekInput('');}} style={{ ...fSel, width:'100%' }} disabled={!selectedYear || !months.length}>
          <option value="">All Months</option>
          {months.map(m=><option key={m} value={m}>{monthName(m)}</option>)}
        </select>
      </FilterField>
      <FilterField label={`Week No. ${weeks.length ? `(1-${weeks.length})` : ''}`}>
        <input type="number" min={1} max={weeks.length || 1} value={weekInput} placeholder="#"
          onChange={e=>{const n=parseInt(e.target.value);setWeekInput(e.target.value);if(!isNaN(n)&&weeks.find(w=>w.weekNum===n))setWeekNum(String(n));}}
          style={{ ...fSel, width:'100%', fontWeight:800, textAlign:'center' }} disabled={!weeks.length} />
      </FilterField>
      <FilterField label="Select Week">
        <select value={weekNum} onChange={e=>{setWeekNum(e.target.value);setWeekInput(e.target.value);}} style={{ ...fSel, width:'100%' }} disabled={!filteredWeeks.length}>
          <option value="">— Select —</option>
          {filteredWeeks.map(w=><option key={w.weekNum} value={w.weekNum}>W{w.weekNum}: {formatDate(w.sat)} → {formatDate(w.thu)}</option>)}
        </select>
      </FilterField>
      <FilterField label="Classification">
        <select value={filterClass} onChange={e=>setFilterClass(e.target.value)} style={{ ...fSel, width:'100%' }} disabled={!classifications?.length || classifications.length <= 1}>
          <option value="">All Classifications</option>
          {classifications.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </FilterField>
      <FilterField label="Smart Search">
        <input value={search||''} onChange={e=>setSearch(e.target.value)} placeholder="Item, code, classification..." style={{ ...fSel, width:'100%', cursor:'text' }} />
      </FilterField>
      <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:2, gap:10 }}>
        <div style={{ fontSize:11, color:'#64748b' }}>Search includes item code, item name and classification.</div>
        <button type="button" onClick={resetFilters} style={{ border:'1px solid #bfdbfe', background:'#ffffff', color:'#0f172a', borderRadius:10, padding:'8px 12px', fontSize:12, fontWeight:800, cursor:'pointer' }}>Clear Filters</button>
      </div>
    </FilterShell>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FloorWeeklyProductivity() {
  const toast = useToast();

  const [projects,     setProjects]     = useState([]);
  const [projectId,    setProjectId]    = useState('');
  const [weeks,        setWeeks]        = useState([]);
  const [firstDate,    setFirstDate]    = useState(null);
  const [weekNum,      setWeekNum]      = useState('');
  const [weekInput,    setWeekInput]    = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth,setSelectedMonth]= useState('');
  const [reportData,   setReportData]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [filterClass,  setFilterClass]  = useState('');
  const [activeTab,    setActiveTab]    = useState('single');
  const [pageSize,     setPageSize]     = useState(10);

  // Compare state
  const [cmpProjectId,  setCmpProjectId]  = useState('');
  const [cmpWeeks,      setCmpWeeks]      = useState([]);
  const [cmpFirstDate,  setCmpFirstDate]  = useState(null);
  const [cmpWeekNumA,   setCmpWeekNumA]   = useState('');
  const [cmpWeekInputA, setCmpWeekInputA] = useState('');
  const [cmpWeekNumB,   setCmpWeekNumB]   = useState('');
  const [cmpWeekInputB, setCmpWeekInputB] = useState('');
  const [cmpDataA,      setCmpDataA]      = useState(null);
  const [cmpDataB,      setCmpDataB]      = useState(null);

  useEffect(() => { api.getProjects().then(setProjects).catch(()=>{}); }, []);

  // Load weeks when project changes
  const loadWeeks = useCallback(async (pid, setWks=setWeeks, setFd=setFirstDate) => {
    if (!pid) { setWks([]); setFd(null); return; }
    try {
      const dummy = new Date().toISOString().slice(0,10);
      const data = await api.getFloorWeekly(pid, dummy, dummy);
      if (data.firstDeliveryDate) { setFd(data.firstDeliveryDate); setWks(generateWeeks(data.firstDeliveryDate)); }
      else { setWks([]); setFd(null); }
    } catch { setWks([]); }
  }, []);

  useEffect(() => {
    loadWeeks(projectId);
    setWeekNum(''); setWeekInput(''); setReportData(null);
    setSelectedYear(''); setSelectedMonth(''); setSearch(''); setFilterClass('');
  }, [projectId, loadWeeks]);

  useEffect(() => {
    loadWeeks(cmpProjectId, setCmpWeeks, setCmpFirstDate);
    setCmpWeekNumA(''); setCmpWeekInputA(''); setCmpWeekNumB(''); setCmpWeekInputB('');
    setCmpDataA(null); setCmpDataB(null);
  }, [cmpProjectId, loadWeeks]);

  const selectedWeek = useMemo(() => weeks.find(w=>w.weekNum===parseInt(weekNum)), [weeks, weekNum]);

  useEffect(() => {
    if (!selectedWeek || !projectId) return;
    setLoading(true);
    api.getFloorWeekly(projectId, selectedWeek.sat, selectedWeek.thu)
      .then(setReportData).catch(err=>toast(err.message,'error')).finally(()=>setLoading(false));
  }, [selectedWeek, projectId, toast]);

  const years  = useMemo(()=>[...new Set(weeks.map(w=>w.sat.slice(0,4)))].sort(),[weeks]);
  const months = useMemo(()=>{
    if (!selectedYear) return [];
    const ms = new Set(weeks.filter(w=>w.sat.startsWith(selectedYear)||w.thu.startsWith(selectedYear)).map(w=>w.sat.slice(5,7)));
    return [...ms].sort();
  },[weeks,selectedYear]);

  const filteredWeeks = useMemo(()=>{
    let ws=weeks;
    if (selectedYear)  ws=ws.filter(w=>w.sat.startsWith(selectedYear)||w.thu.startsWith(selectedYear));
    if (selectedMonth) ws=ws.filter(w=>w.sat.slice(0,7)===`${selectedYear}-${selectedMonth}`||w.thu.slice(0,7)===`${selectedYear}-${selectedMonth}`);
    return ws;
  },[weeks,selectedYear,selectedMonth]);

  const cmpWeekA = useMemo(() => cmpWeeks.find(w=>w.weekNum===parseInt(cmpWeekNumA)), [cmpWeeks,cmpWeekNumA]);
  const cmpWeekB = useMemo(() => cmpWeeks.find(w=>w.weekNum===parseInt(cmpWeekNumB)), [cmpWeeks,cmpWeekNumB]);

  useEffect(() => {
    if (!cmpWeekA || !cmpProjectId) return;
    api.getFloorWeekly(cmpProjectId, cmpWeekA.sat, cmpWeekA.thu).then(setCmpDataA).catch(()=>{});
  }, [cmpWeekA, cmpProjectId]);

  useEffect(() => {
    if (!cmpWeekB || !cmpProjectId) return;
    api.getFloorWeekly(cmpProjectId, cmpWeekB.sat, cmpWeekB.thu).then(setCmpDataB).catch(()=>{});
  }, [cmpWeekB, cmpProjectId]);

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');
  const monthName = m => new Date(`2000-${m}-01`).toLocaleDateString('en-GB',{month:'long'});

  // ── Build matrix data from API response ──────────────────────────────────
  const matrixData = useMemo(()=>{
    if (!reportData) return null;
    const { items, levels, allocs, weekTx, totalTx } = reportData;

    // Build lookup maps
    const allocMap = {}; // item_id → level_id → suggested_qty
    allocs.forEach(a => {
      if (!allocMap[a.item_id]) allocMap[a.item_id] = {};
      allocMap[a.item_id][a.level_id] = parseFloat(a.suggested_qty)||0;
    });
    const weekMap = {}; // item_id → level_id → qty_this_week
    weekTx.forEach(t => {
      if (!weekMap[t.item_id]) weekMap[t.item_id] = {};
      weekMap[t.item_id][t.level_id] = parseFloat(t.qty_this_week)||0;
    });
    const totalMap = {}; // item_id → level_id → qty_total
    totalTx.forEach(t => {
      if (!totalMap[t.item_id]) totalMap[t.item_id] = {};
      totalMap[t.item_id][t.level_id] = parseFloat(t.qty_total)||0;
    });

    return { items, levels, allocMap, weekMap, totalMap };
  }, [reportData]);

  // Classifications for filter
  const classifications = useMemo(()=>{
    if (!matrixData) return [];
    const seen = new Set();
    return matrixData.items.map(r => r.parent_classification_name
      ? `${r.parent_classification_name} › ${r.classification_name||''}`
      : r.classification_name || 'Uncategorized'
    ).filter(v => { if(seen.has(v)) return false; seen.add(v); return true; });
  },[matrixData]);

  // Filter items
  const visibleItems = useMemo(()=>{
    if (!matrixData) return [];
    let items = matrixData.items.filter(item =>
      // only show items with allocation or activity
      matrixData.levels.some(lv =>
        (matrixData.allocMap[item.item_id]?.[lv.id]||0) > 0 ||
        (matrixData.weekMap[item.item_id]?.[lv.id]||0) > 0 ||
        (matrixData.totalMap[item.item_id]?.[lv.id]||0) > 0
      )
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i=>(i.item_name||'').toLowerCase().includes(q)||(i.item_code||'').toLowerCase().includes(q));
    }
    if (filterClass) {
      items = items.filter(i => {
        const key = i.parent_classification_name ? `${i.parent_classification_name} › ${i.classification_name||''}` : i.classification_name||'Uncategorized';
        return key===filterClass;
      });
    }
    return items;
  },[matrixData, search, filterClass]);

  // Export CSV
  function exportCSV() {
    if (!matrixData || !visibleItems.length) return;
    const { levels, weekMap, totalMap, allocMap } = matrixData;
    const headers = ['Code','Item Name','Unit',...levels.map(l=>l.level_code),'Total This Week','Total Installed'];
    const rows = visibleItems.map(item => {
      const weekLevels = levels.map(lv => weekMap[item.item_id]?.[lv.id]||0);
      const totalWeek  = weekLevels.reduce((s,v)=>s+v,0);
      const totalInst  = levels.reduce((s,lv)=>s+(totalMap[item.item_id]?.[lv.id]||0),0);
      return [item.item_code, item.item_name, item.unit_of_measure||'', ...weekLevels.map(q=>q>0?fmt2(q):''), fmt2(totalWeek), fmt2(totalInst)].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent(csv);
    a.download = `floor_weekly_W${weekNum}_${projectId}.csv`;
    a.click();
  }

  const fSel = { background:'var(--card)', border:'1.5px solid #bfdbfe', borderRadius:12, padding:'8px 14px', fontSize:13, fontWeight:650, color:'var(--text)', cursor:'pointer', fontFamily:'inherit', outline:'none', height:40, boxShadow:'0 8px 18px rgba(37,99,235,0.06)' };
  const thBase = { background:'#ffffff', color:'#0f172a', fontWeight:850, fontSize:11, padding:'12px 12px', borderBottom:'1px solid #e5eaf3', borderRight:'1px solid #edf2f8', whiteSpace:'nowrap', letterSpacing:'0.02em', textAlign:'center' };

  // KPI totals
  const kpi = useMemo(()=>{
    if (!matrixData || !visibleItems.length) return null;
    const { levels, weekMap, totalMap, allocMap } = matrixData;
    let totalSugg=0, totalThisWeek=0, totalAllTime=0;
    visibleItems.forEach(item => {
      levels.forEach(lv => {
        totalSugg    += allocMap[item.item_id]?.[lv.id] || 0;
        totalThisWeek+= weekMap[item.item_id]?.[lv.id]  || 0;
        totalAllTime += totalMap[item.item_id]?.[lv.id] || 0;
      });
    });
    const pct = totalSugg>0 ? Math.min(100,(totalAllTime/totalSugg)*100) : 0;
    const remaining = Math.max(totalSugg-totalAllTime, 0);
    const remainingPct = totalSugg>0 ? Math.max(0, Math.min(100,(remaining/totalSugg)*100)) : 0;
    const weekPct = totalSugg>0 ? Math.min(100,(totalThisWeek/totalSugg)*100) : 0;
    const activeItems = visibleItems.filter(item => levels.some(lv=>(weekMap[item.item_id]?.[lv.id]||0)>0)).length;
    return { totalSugg, totalThisWeek, totalAllTime, remaining, remainingPct, pct, weekPct, activeItems };
  },[matrixData, visibleItems]);

  return (
    <div className="floor-weekly-productivity-page floor-productivity-wow" style={{ fontFamily:'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif', marginTop:-34, paddingTop:0 }}>
      {/* Compact Professional Header */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:10, flexWrap:'wrap',
        background:'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)', border:'1px solid #dbeafe',
        borderRadius:16, padding:'12px 16px', boxShadow:'0 14px 34px rgba(15,23,42,0.07)', backdropFilter:'blur(10px)'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
          <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,#2563eb,#38bdf8)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 12px 24px rgba(37,99,235,0.22)' }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1M9 13h1M9 17h1M15 13h1M15 17h1"/></svg>
          </div>
          <div style={{ minWidth:0 }}>
            <h1 style={{ fontSize:18, fontWeight:900, color:'var(--text)', letterSpacing:'-0.4px', margin:0 }}>Floor Weekly Productivity</h1>
            <p style={{ fontSize:12, color:'#52647a', margin:'5px 0 0 0', fontWeight:500 }}>Confirmed installation productivity by item, floor/basement and selected week.</p>
          </div>
        </div>
        {matrixData && visibleItems.length > 0 && (
          <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:7, background:'#fff', border:'1px solid #dbeafe', borderRadius:12, padding:'10px 16px', fontSize:13, fontWeight:750, color:'#0f172a', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 12px 22px rgba(37,99,235,0.18)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display:'inline-flex', gap:8, marginBottom:10, background:'transparent', padding:'0', borderRadius:14, position:'relative' }}>
        {[
          { id:'single',  label:'Single Week' },
          { id:'compare', label:'Compare Two Weeks' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding:'9px 22px', fontSize:13, fontWeight:800, cursor:'pointer',
            border:'1px solid #dbeafe', fontFamily:'inherit',
            background: activeTab===tab.id?'linear-gradient(135deg,#2563eb,#1d4ed8)':'#fff',
            color: activeTab===tab.id?'#fff':'#334155',
            borderRadius:10,
            boxShadow: activeTab===tab.id?'0 14px 24px rgba(37,99,235,0.22)':'0 8px 20px rgba(15,23,42,0.04)',
            marginBottom:0, transition:'all 0.15s', position:'relative',
          }}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'single' && <>

      {/* Fixed filters */}
      <FloorWeekFilter
        projects={projects} projectId={projectId} setProjectId={setProjectId}
        weeks={weeks} years={years} months={months}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        weekNum={weekNum} setWeekNum={setWeekNum}
        weekInput={weekInput} setWeekInput={setWeekInput}
        selectedWeek={selectedWeek}
        search={search} setSearch={setSearch}
        filterClass={filterClass} setFilterClass={setFilterClass}
        classifications={classifications}
        fSel={fSel} projectLabel={projectLabel}
      />

      {/* Empty states */}
      {!projectId && <div className="empty-state"><div className="empty-icon">🏢</div><p>Select a project to view floor productivity</p></div>}
      {projectId && weeks.length===0 && !loading && <div className="empty-state"><div className="empty-icon">📦</div><p>No delivery records found — weeks are generated from first delivery date</p></div>}
      {projectId && weeks.length>0 && !selectedWeek && !loading && (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>👆</div>
          <div style={{ fontSize:14, fontWeight:500 }}>Enter a week number or select from the dropdown</div>
          <div style={{ fontSize:12, marginTop:4 }}>Project has <strong style={{ color:'#0f172a' }}>{weeks.length}</strong> weeks since first delivery on <strong style={{ color:'#0f172a' }}>{formatDate(firstDate)}</strong></div>
        </div>
      )}
      {loading && <div style={{ textAlign:'center', padding:40 }}><div className="spinner" /></div>}

      {/* KPI cards — photo style */}
      {!loading && kpi && selectedWeek && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))', gap:12, marginBottom:18 }}>
          {[
            { label:'Total Items', value:visibleItems.length.toLocaleString(), sub:`${matrixData?.levels?.length||0} floors / basements`, color:'#0f172a', icon:'▣' },
            { label:'Total Quantity', value:fmt2(kpi.totalSugg), sub:'planned / suggested allocation', color:'#0f172a', icon:'⌘' },
            { label:'Completed Quantity', value:fmt2(kpi.totalAllTime), sub:'installed until selected week', color:'#0f172a', icon:'◎', ring:kpi.pct },
            { label:'Remaining Quantity', value:fmt2(kpi.remaining), sub:'balance against suggested', color:'#0f172a', icon:'▥', ring:kpi.remainingPct },
            { label:'Weekly Productivity', value:`${kpi.weekPct.toFixed(1)}%`, sub:`this week: ${fmt2(kpi.totalThisWeek)}`, color:'#22c55e', icon:'↗', ring:kpi.weekPct },
          ].map(k => (
            <div key={k.label} style={{ background:'#ffffff', border:'1px solid #e5eefb', borderRadius:16, padding:'18px 18px', boxShadow:'0 16px 34px rgba(15,23,42,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, minHeight:110 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, minWidth:0 }}>
                <div style={{ width:44, height:44, borderRadius:14, background:`${k.color}12`, border:`1px solid ${k.color}18`, color:k.color, display:'grid', placeItems:'center', fontSize:18, fontWeight:900, flexShrink:0 }}>{k.icon}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#475569', marginBottom:8 }}>{k.label}</div>
                  <div style={{ fontSize:25, fontWeight:950, color:'#0f172a', letterSpacing:'-0.04em', lineHeight:1 }}>{k.value}</div>
                  <div style={{ marginTop:12, fontSize:10, color:'#64748b', fontWeight:700 }}>— {k.sub}</div>
                </div>
              </div>
              {typeof k.ring === 'number' && (
                <div style={{ width:62, height:62, borderRadius:'50%', background:`conic-gradient(#22c55e ${Math.min(100,k.ring)}%, #e8eef6 0)`, display:'grid', placeItems:'center', flexShrink:0 }}>
                  <div style={{ width:48, height:48, borderRadius:'50%', background:'#fff', display:'grid', placeItems:'center', color:'#22c55e', fontSize:12, fontWeight:900 }}>{Math.min(100,k.ring).toFixed(1)}%</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main matrix table */}
      {!loading && matrixData && visibleItems.length > 0 && selectedWeek && (() => {
        const { levels, weekMap, totalMap, allocMap } = matrixData;

        // Group items by classification
        const grouped = visibleItems.reduce((acc, item) => {
          const key = item.parent_classification_name
            ? `${item.parent_classification_name} › ${item.classification_name||''}`
            : item.classification_name || 'Uncategorized';
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {});

        // Level totals (this week + all time) for footer
        const lvWeekTotals  = levels.map(lv => visibleItems.reduce((s,i)=>s+(weekMap[i.item_id]?.[lv.id]||0),0));
        const lvTotalTotals = levels.map(lv => visibleItems.reduce((s,i)=>s+(totalMap[i.item_id]?.[lv.id]||0),0));
        const grandWeek  = lvWeekTotals.reduce((s,v)=>s+v,0);
        const grandTotal = lvTotalTotals.reduce((s,v)=>s+v,0);

        const pctBar = (installed, suggested) => {
          const p = suggested>0 ? Math.min(100,(installed/suggested)*100) : 0;
          const color = '#22c55e';
          return { p, color };
        };

        return (
          <div style={{ background:'#ffffff', border:'1px solid #dbe7f6', borderRadius:18, overflow:'hidden', boxShadow:'0 18px 42px rgba(15,23,42,0.065)' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', minWidth:300+levels.length*90+200, borderCollapse:'collapse', fontSize:12, tableLayout:'fixed' }}>
                <colgroup>
                  <col style={{ width:75 }} />
                  <col style={{ width:160 }} />
                  <col style={{ width:50 }} />
                  <col style={{ width:85 }} />
                  {levels.map(lv => <col key={lv.id} style={{ width:90 }} />)}
                  <col style={{ width:90 }} />
                  <col style={{ width:90 }} />
                  <col style={{ width:110 }} />
                </colgroup>
                <thead>
                  {/* Row 1 — level codes */}
                  <tr>
                    <th colSpan={4} style={{ ...thBase, textAlign:'left', background:'#ffffff', borderRight:'1px solid #edf2f8' }}></th>
                    {levels.map(lv => (
                      <th key={lv.id} style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'1px solid #edf2f8', fontSize:13, fontWeight:850 }}>
                        {lv.level_code}
                        <div style={{ fontSize:9, fontWeight:500, color:'#9ca3af', marginTop:2 }}>{lv.level_name}</div>
                      </th>
                    ))}
                    <th style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'1px solid #edf2f8' }}>This Week</th>
                    <th style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'1px solid #edf2f8' }}>Installed Total</th>
                    <th style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'1px solid #edf2f8' }}>Progress</th>
                  </tr>
                  {/* Row 2 — Suggested QTY per level */}
                  <tr style={{ background:'#ffffff' }}>
                    <td colSpan={4} style={{ padding:'5px 12px', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      Suggested QTY →
                    </td>
                    {levels.map(lv => {
                      const lvSugg = visibleItems.reduce((s,i)=>s+(allocMap[i.item_id]?.[lv.id]||0),0);
                      return (
                        <td key={lv.id} style={{ padding:'5px 8px', textAlign:'center', fontSize:11, fontWeight:700, color:'#0f172a', borderLeft:'1px solid #edf2f8', background:'#ffffff' }}>
                          {lvSugg>0 ? fmt2(lvSugg) : <span style={{ color:'#cfe0ff' }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding:'5px 8px', textAlign:'center', fontSize:11, fontWeight:700, color:'#0f172a', background:'#ffffff', borderLeft:'1px solid #dbeafe' }}>
                      {fmt2(visibleItems.reduce((s,i)=>s+levels.reduce((ss,lv)=>ss+(weekMap[i.item_id]?.[lv.id]||0),0),0))}
                    </td>
                    <td style={{ padding:'5px 8px', textAlign:'center', fontSize:11, fontWeight:700, color:'#0f172a', background:'#ffffff', borderLeft:'1px solid #d1fae5' }}>
                      {fmt2(kpi?.totalSugg||0)}
                    </td>
                    <td style={{ padding:'5px 8px', background:'#ffffff', borderLeft:'1px solid #e0ecff' }}></td>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([group, groupItems]) => {
                    const gWeek  = levels.map(lv => groupItems.reduce((s,i)=>s+(weekMap[i.item_id]?.[lv.id]||0),0));
                    const gTotal = levels.map(lv => groupItems.reduce((s,i)=>s+(totalMap[i.item_id]?.[lv.id]||0),0));
                    const gSugg  = levels.map(lv => groupItems.reduce((s,i)=>s+(allocMap[i.item_id]?.[lv.id]||0),0));
                    const gWeekTotal  = gWeek.reduce((s,v)=>s+v,0);
                    const gTotalInst  = gTotal.reduce((s,v)=>s+v,0);
                    const gTotalSugg  = gSugg.reduce((s,v)=>s+v,0);
                    const gPct = gTotalSugg>0?Math.min(100,(gTotalInst/gTotalSugg)*100):0;
                    return (
                      <>
                        {/* Classification group header */}
                        <tr key={`g-${group}`} style={{ background:'#ffffff', borderTop:'1px solid #e5eaf3', borderLeft:'4px solid #22c55e' }}>
                          <td colSpan={4} style={{ padding:'7px 12px', fontSize:11, fontWeight:700, color:'#0f172a' }}>{group}</td>
                          {gWeek.map((qty,i) => (
                            <td key={i} style={{ padding:'7px 8px', textAlign:'center', fontSize:11, fontWeight:700, color:qty>0?'#0f172a':'#cbd5e1', borderLeft:'1px solid #cfe0ff' }}>
                              {qty>0 ? fmt2(qty) : '—'}
                            </td>
                          ))}
                          <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#0f172a', background:'#ffffff', borderLeft:'1px solid #dbeafe' }}>{gWeekTotal>0?fmt2(gWeekTotal):'—'}</td>
                          <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#0f172a', background:'#ffffff', borderLeft:'1px solid #d1fae5' }}>{gTotalInst>0?fmt2(gTotalInst):'—'}</td>
                          <td style={{ padding:'7px 8px', background:'#ffffff', borderLeft:'1px solid #e0ecff' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <div style={{ flex:1, height:5, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:40 }}>
                                <div style={{ height:'100%', width:`${gPct}%`, background:'#22c55e', borderRadius:99 }} />
                              </div>
                              <span style={{ fontSize:10, fontWeight:700, color:'#374151', minWidth:30 }}>{gPct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>

                        {/* Item rows */}
                        {groupItems.map((item, idx) => {
                          const itemWeek  = levels.map(lv => weekMap[item.item_id]?.[lv.id]||0);
                          const itemTotal = levels.map(lv => totalMap[item.item_id]?.[lv.id]||0);
                          const itemSugg  = levels.reduce((s,lv)=>s+(allocMap[item.item_id]?.[lv.id]||0),0);
                          const itemWeekTotal  = itemWeek.reduce((s,v)=>s+v,0);
                          const itemTotalInst  = itemTotal.reduce((s,v)=>s+v,0);
                          const { p:itemPct, color:pColor } = pctBar(itemTotalInst, itemSugg);
                          return (
                            <tr key={item.item_id} style={{ borderBottom:'1px solid #f3f4f6', background:'#ffffff' }}>
                              <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:'#6b7280' }}>{item.item_code}</td>
                              <td style={{ padding:'10px 12px', fontWeight:600, color:'#111827' }}>{item.item_name}</td>
                              <td style={{ padding:'10px 8px', textAlign:'center', fontSize:11, color:'#9ca3af' }}>{item.unit_of_measure||'—'}</td>
                              <td style={{ padding:'10px 8px', textAlign:'right', fontSize:11, color:'#6b7280' }}>{itemSugg>0?fmt2(itemSugg):'—'}</td>
                              {itemWeek.map((qty,i) => (
                                <td key={i} style={{ padding:'8px', textAlign:'center', borderLeft:'1px solid #f0f0f0', background:'#ffffff' }}>
                                  {qty>0
                                    ? <div>
                                        <div style={{ fontWeight:700, color:'#0f172a', fontSize:13 }}>{fmt2(qty)}</div>
                                        <div style={{ fontSize:9, color:'#9ca3af', marginTop:1 }}>/{fmt2(itemTotal[i])}</div>
                                      </div>
                                    : <span style={{ color:'#e5e7eb', fontSize:15 }}>·</span>
                                  }
                                </td>
                              ))}
                              <td style={{ padding:'8px', textAlign:'center', fontWeight:700, color:itemWeekTotal>0?'#0f172a':'#9ca3af', background:'#ffffff', borderLeft:'2px solid #bfdbfe' }}>
                                {itemWeekTotal>0 ? fmt2(itemWeekTotal) : '—'}
                              </td>
                              <td style={{ padding:'8px', textAlign:'center', fontWeight:700, color:itemTotalInst>0?'#0f172a':'#9ca3af', background:'#ffffff', borderLeft:'1px solid #a7f3d0' }}>
                                {itemTotalInst>0 ? fmt2(itemTotalInst) : '—'}
                              </td>
                              <td style={{ padding:'8px 10px', borderLeft:'1px solid #e0ecff' }}>
                                {itemSugg>0 ? (
                                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                    <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:40 }}>
                                      <div style={{ height:'100%', width:`${itemPct}%`, background:'#22c55e', borderRadius:99, transition:'width 0.3s' }} />
                                    </div>
                                    <span style={{ fontSize:11, fontWeight:700, color:'#0f172a', minWidth:32, textAlign:'right' }}>{itemPct.toFixed(0)}%</span>
                                  </div>
                                ) : <span style={{ color:'#e5e7eb', fontSize:11 }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  {/* This week row */}
                  <tr style={{ background:'#ffffff', borderTop:'2px solid #bfdbfe' }}>
                    <td colSpan={4} style={{ padding:'10px 12px', fontWeight:700, fontSize:12, color:'#0f172a' }}>THIS WEEK TOTAL</td>
                    {lvWeekTotals.map((t,i) => (
                      <td key={i} style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:t>0?'#0f172a':'#93c5fd', borderLeft:'1px solid #bfdbfe', fontSize:13 }}>
                        {t>0 ? fmt2(t) : '—'}
                      </td>
                    ))}
                    <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:'#0f172a', fontSize:14, borderLeft:'2px solid #1d4ed8' }}>{fmt2(grandWeek)}</td>
                    <td colSpan={2} style={{ background:'#ffffff' }} />
                  </tr>
                  {/* All time row */}
                  <tr style={{ background:'#ffffff', borderTop:'1px solid #a7f3d0' }}>
                    <td colSpan={4} style={{ padding:'10px 12px', fontWeight:700, fontSize:12, color:'#0f172a' }}>ALL TIME TOTAL</td>
                    {lvTotalTotals.map((t,i) => (
                      <td key={i} style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:t>0?'#0f172a':'#6ee7b7', borderLeft:'1px solid #a7f3d0', fontSize:13 }}>
                        {t>0 ? fmt2(t) : '—'}
                      </td>
                    ))}
                    <td style={{ background:'#ffffff', borderLeft:'2px solid #bfdbfe', padding:'10px 8px' }} />
                    <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:'#0f172a', fontSize:14, borderLeft:'1px solid #a7f3d0' }}>{fmt2(grandTotal)}</td>
                    <td style={{ padding:'10px 8px', background:'#ffffff', borderLeft:'1px solid #e0ecff' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <div style={{ flex:1, height:7, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:50 }}>
                          <div style={{ height:'100%', width:`${kpi?.pct||0}%`, background:'#22c55e', borderRadius:99 }} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:'#374151', minWidth:36 }}>{(kpi?.pct||0).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom note */}
            <div style={{ padding:'10px 16px', borderTop:'1px solid #e5eaf3', fontSize:11, color:'#64748b', display:'flex', gap:16, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', background:'#ffffff' }}>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ color:'#0f172a', fontWeight:700 }}>📊 {visibleItems.length} items · {levels.length} floors/basements</span>
                <span>📅 Week {selectedWeek?.weekNum}: {formatDate(selectedWeek?.sat)} – {formatDate(selectedWeek?.thu)}</span>
                <span>Numbers show: <strong style={{ color:'#0f172a' }}>this week</strong> / <span style={{ color:'#0f172a' }}>all-time total</span></span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10, color:'#0f172a', fontWeight:800, flexWrap:'wrap' }}>
                <select
                  value={pageSize}
                  onChange={e=>setPageSize(Number(e.target.value))}
                  style={{
                    minWidth:132,
                    height:40,
                    border:'1px solid #dbe7f6',
                    background:'#ffffff',
                    color:'#2563eb',
                    borderRadius:12,
                    padding:'0 14px',
                    fontWeight:900,
                    fontSize:13,
                    outline:'none',
                    boxShadow:'0 8px 20px rgba(15,23,42,0.05)',
                    cursor:'pointer'
                  }}
                >
                  {[10,25,50,100].map(n => <option key={n} value={n}>{n} per page</option>)}
                </select>
                <span style={{ color:'#64748b', fontWeight:700 }}>Showing</span>
                <span style={{ color:'#2563eb', fontWeight:900 }}>{visibleItems.length ? 1 : 0}-{Math.min(pageSize, visibleItems.length)}</span>
                <span style={{ color:'#64748b', fontWeight:700 }}>of</span>
                <span style={{ color:'#2563eb', fontWeight:900 }}>{visibleItems.length}</span>
                <button type="button" disabled style={{ border:'1px solid #dbe7f6', background:'#ffffff', color:'#94a3b8', borderRadius:8, padding:'5px 9px', cursor:'not-allowed' }}>‹</button>
                <span style={{ minWidth:28, height:28, display:'grid', placeItems:'center', borderRadius:8, background:'#2563eb', color:'#ffffff', boxShadow:'0 8px 18px rgba(37,99,235,0.18)' }}>1</span>
                <button type="button" disabled style={{ border:'1px solid #dbe7f6', background:'#ffffff', color:'#94a3b8', borderRadius:8, padding:'5px 9px', cursor:'not-allowed' }}>›</button>
              </div>
            </div>
          </div>
        );
      })()}

      {!loading && matrixData && visibleItems.length===0 && (
        <div className="empty-state"><div className="empty-icon">🔍</div><p>No items found{search?' matching search':' with floor allocation'}</p></div>
      )}

      </> /* end single tab */}

      {/* ── COMPARE TAB ── */}
      {activeTab === 'compare' && (
        <FloorCompare
          projects={projects} projectLabel={projectLabel}
          cmpProjectId={cmpProjectId} setCmpProjectId={setCmpProjectId}
          cmpWeeks={cmpWeeks} cmpWeekNumA={cmpWeekNumA} setCmpWeekNumA={setCmpWeekNumA}
          cmpWeekInputA={cmpWeekInputA} setCmpWeekInputA={setCmpWeekInputA}
          cmpWeekNumB={cmpWeekNumB} setCmpWeekNumB={setCmpWeekNumB}
          cmpWeekInputB={cmpWeekInputB} setCmpWeekInputB={setCmpWeekInputB}
          cmpWeekA={cmpWeekA} cmpWeekB={cmpWeekB}
          dataA={cmpDataA} dataB={cmpDataB}
          fSel={fSel}
        />
      )}

    </div>
  );
}

// ── Floor Compare Tab ─────────────────────────────────────────────────────────
function FloorCompare({ projects, projectLabel, cmpProjectId, setCmpProjectId, cmpWeeks,
  cmpWeekNumA, setCmpWeekNumA, cmpWeekInputA, setCmpWeekInputA,
  cmpWeekNumB, setCmpWeekNumB, cmpWeekInputB, setCmpWeekInputB,
  cmpWeekA, cmpWeekB, dataA, dataB, fSel }) {

  const fmt = v => (parseFloat(v)||0).toFixed(2);
  const dc  = d => d>0?'#16a34a':d<0?'#dc2626':'#9ca3af';
  const di  = d => d>0?'▲':d<0?'▼':'=';

  // Build floor matrix from a dataset
  function buildFloorMatrix(data) {
    if (!data) return null;
    const { items, levels, allocs, weekTx, totalTx } = data;
    const allocMap={}, weekMap={}, totalMap={};
    allocs.forEach(a=>{ if(!allocMap[a.item_id])allocMap[a.item_id]={}; allocMap[a.item_id][a.level_id]=parseFloat(a.suggested_qty)||0; });
    weekTx.forEach(t=>{ if(!weekMap[t.item_id])weekMap[t.item_id]={}; weekMap[t.item_id][t.level_id]=parseFloat(t.qty_this_week)||0; });
    totalTx.forEach(t=>{ if(!totalMap[t.item_id])totalMap[t.item_id]={}; totalMap[t.item_id][t.level_id]=parseFloat(t.qty_total)||0; });
    return { items, levels, allocMap, weekMap, totalMap };
  }

  const matA = useMemo(() => buildFloorMatrix(dataA), [dataA]);
  const matB = useMemo(() => buildFloorMatrix(dataB), [dataB]);

  // Smart insights adapted for floor comparison
  const insights = useMemo(() => {
    if (!matA || !matB || !cmpWeekA || !cmpWeekB) return [];
    const levels = matA.levels;

    const totalA = matA.items.reduce((s,i) => s+levels.reduce((ss,lv)=>ss+(matA.weekMap[i.item_id]?.[lv.id]||0),0), 0);
    const totalB = matB.items.reduce((s,i) => s+levels.reduce((ss,lv)=>ss+(matB.weekMap[i.item_id]?.[lv.id]||0),0), 0);
    const delta = totalB - totalA;
    const deltaPct = totalA>0?((delta/totalA)*100):0;

    // Floor comparison
    const floorStats = levels.map(lv => ({
      code: lv.level_code, name: lv.level_name,
      a: matA.items.reduce((s,i)=>s+(matA.weekMap[i.item_id]?.[lv.id]||0),0),
      b: matB.items.reduce((s,i)=>s+(matB.weekMap[i.item_id]?.[lv.id]||0),0),
    })).map(f => ({ ...f, delta:f.b-f.a }));

    const bestFloorA  = [...floorStats].sort((a,b)=>b.a-a.a)[0];
    const bestFloorB  = [...floorStats].sort((a,b)=>b.b-a.b)[0];
    const mostImproved = [...floorStats].filter(f=>f.delta>0).sort((a,b)=>b.delta-a.delta)[0];
    const mostDeclined = [...floorStats].filter(f=>f.delta<0).sort((a,b)=>a.delta-b.delta)[0];

    // Item comparison
    const itemStats = matA.items.map(item => ({
      name: item.item_name,
      a: levels.reduce((s,lv)=>s+(matA.weekMap[item.item_id]?.[lv.id]||0),0),
      b: levels.reduce((s,lv)=>s+(matB.weekMap[item.item_id]?.[lv.id]||0),0),
    })).map(i=>({...i,delta:i.b-i.a})).filter(i=>i.a>0||i.b>0);

    const improved = [...itemStats].filter(i=>i.delta>0).sort((a,b)=>b.delta-a.delta);
    const declined = [...itemStats].filter(i=>i.delta<0).sort((a,b)=>a.delta-b.delta);

    const ins=[];
    const verdict = deltaPct>=20?'Strong Improvement':deltaPct>=5?'Moderate Improvement':deltaPct>=-5?'Stable Performance':deltaPct>=-20?'Slight Decline':'Significant Decline';
    ins.push({ type:delta>=0?'good':'bad', text:`${verdict}: W${cmpWeekA.weekNum} installed ${fmt(totalA)} vs W${cmpWeekB.weekNum} installed ${fmt(totalB)} (${delta>=0?'+':''}${fmt(delta)}, ${deltaPct>=0?'+':''}${deltaPct.toFixed(1)}%).` });
    if (bestFloorA) ins.push({ type:'info', text:`Most active floor in W${cmpWeekA.weekNum}: ${bestFloorA.code} (${fmt(bestFloorA.a)}). Most active in W${cmpWeekB.weekNum}: ${bestFloorB?.code||'—'} (${fmt(bestFloorB?.b||0)}).` });
    if (mostImproved) ins.push({ type:'good', text:`Most improved floor: ${mostImproved.code} — up by ${fmt(mostImproved.delta)} units from W${cmpWeekA.weekNum} to W${cmpWeekB.weekNum}.` });
    if (mostDeclined) ins.push({ type:'warn', text:`Most declined floor: ${mostDeclined.code} — down by ${fmt(Math.abs(mostDeclined.delta))} units. Investigate productivity drop on this floor.` });
    if (improved.length>0) ins.push({ type:'good', text:`Top improved item: "${improved[0].name}" +${fmt(improved[0].delta)} units.` });
    if (declined.length>0) ins.push({ type:'warn', text:`Top declined item: "${declined[0].name}" −${fmt(Math.abs(declined[0].delta))} units. Review resource allocation.` });
    const activeFloorsA = floorStats.filter(f=>f.a>0).length;
    const activeFloorsB = floorStats.filter(f=>f.b>0).length;
    if (activeFloorsB>activeFloorsA) ins.push({ type:'good', text:`More floors active in W${cmpWeekB.weekNum} (${activeFloorsB}) vs W${cmpWeekA.weekNum} (${activeFloorsA}) — broader site coverage.` });
    else if (activeFloorsB<activeFloorsA) ins.push({ type:'warn', text:`Fewer floors active in W${cmpWeekB.weekNum} (${activeFloorsB}) vs W${cmpWeekA.weekNum} (${activeFloorsA}) — site coverage narrowed.` });
    ins.push({ type:'action', text:`Recommendation: ${deltaPct<-10?`Urgently review W${cmpWeekB.weekNum} productivity drop — identify bottlenecks per floor and reallocate resources.`:`Maintain focus on ${mostDeclined?`${mostDeclined.code} floor and `:``}lowest-performing items to ensure consistent progress next week.`}` });
    return ins;
  }, [matA, matB, cmpWeekA, cmpWeekB]);

  const thBase = { background:'#ffffff', color:'#111827', fontWeight:700, fontSize:11, padding:'9px 10px', borderBottom:'1px solid #e0ecff', whiteSpace:'nowrap', textAlign:'center' };

  // Combined level list from dataA (both weeks share same project)
  const levels = matA?.levels || matB?.levels || [];

  return (
    <div>
      {/* Fixed compare filters */}
      <FilterShell
        title="Compare Weeks"
        subtitle="Select one project, then choose Week 1 and Week 2 for a clear floor productivity comparison."
        right={(cmpWeekA && cmpWeekB) ? <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <span style={{ background:'#ffffff', border:'1px solid #93c5fd', color:'#0f172a', borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:900 }}>W1: Week {cmpWeekA.weekNum}</span>
          <span style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:900 }}>W2: Week {cmpWeekB.weekNum}</span>
        </div> : null}
      >
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'minmax(280px,1.1fr) minmax(330px,1.35fr) minmax(330px,1.35fr) auto', gap:12, alignItems:'end' }}>
          <FilterField label="Project">
            <select value={cmpProjectId} onChange={e=>setCmpProjectId(e.target.value)} style={{ ...fSel, width:'100%', border:'1.5px solid #bfdbfe', background:'#ffffff' }}>
              <option value="">— Select Project —</option>
              {projects.map(p=><option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
            </select>
          </FilterField>
          <FilterField label="Week 1 - Blue">
            <div style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1px solid #93c5fd', borderRadius:14, padding:8, boxShadow:'0 8px 18px rgba(29,78,216,0.08)', opacity:cmpProjectId?1:.55 }}>
              <div style={{ display:'grid', gridTemplateColumns:'64px 1fr', gap:8 }}>
                <input type="number" min={1} max={cmpWeeks.length || 1} value={cmpWeekInputA} placeholder="#" disabled={!cmpProjectId || !cmpWeeks.length}
                  onChange={e=>{const n=parseInt(e.target.value);setCmpWeekInputA(e.target.value);if(!isNaN(n)&&cmpWeeks.find(w=>w.weekNum===n))setCmpWeekNumA(String(n));}}
                  style={{ ...fSel, width:'100%', fontWeight:900, textAlign:'center', border:'1px solid #60a5fa', background:'#fff', color:'#0f172a' }} />
                <select value={cmpWeekNumA} disabled={!cmpProjectId || !cmpWeeks.length} onChange={e=>{setCmpWeekNumA(e.target.value);setCmpWeekInputA(e.target.value);}}
                  style={{ ...fSel, width:'100%', border:'1px solid #60a5fa', background:'#fff', color:'#0f172a' }}>
                  <option value="">— Week 1 —</option>
                  {cmpWeeks.map(w=><option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
                </select>
              </div>
              {cmpWeekA && <div style={{ marginTop:6, color:'#0f172a', fontSize:11, fontWeight:800 }}>{formatDate(cmpWeekA.sat)} → {formatDate(cmpWeekA.thu)}</div>}
            </div>
          </FilterField>
          <FilterField label="Week 2 - Green">
            <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1px solid #86efac', borderRadius:14, padding:8, boxShadow:'0 8px 18px rgba(34,197,94,0.10)', opacity:cmpProjectId?1:.55 }}>
              <div style={{ display:'grid', gridTemplateColumns:'64px 1fr', gap:8 }}>
                <input type="number" min={1} max={cmpWeeks.length || 1} value={cmpWeekInputB} placeholder="#" disabled={!cmpProjectId || !cmpWeeks.length}
                  onChange={e=>{const n=parseInt(e.target.value);setCmpWeekInputB(e.target.value);if(!isNaN(n)&&cmpWeeks.find(w=>w.weekNum===n))setCmpWeekNumB(String(n));}}
                  style={{ ...fSel, width:'100%', fontWeight:900, textAlign:'center', border:'1px solid #22c55e', background:'#fff', color:'#15803d' }} />
                <select value={cmpWeekNumB} disabled={!cmpProjectId || !cmpWeeks.length} onChange={e=>{setCmpWeekNumB(e.target.value);setCmpWeekInputB(e.target.value);}}
                  style={{ ...fSel, width:'100%', border:'1px solid #22c55e', background:'#fff', color:'#15803d' }}>
                  <option value="">— Week 2 —</option>
                  {cmpWeeks.map(w=><option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
                </select>
              </div>
              {cmpWeekB && <div style={{ marginTop:6, color:'#15803d', fontSize:11, fontWeight:800 }}>{formatDate(cmpWeekB.sat)} → {formatDate(cmpWeekB.thu)}</div>}
            </div>
          </FilterField>
          <button type="button" onClick={() => { setCmpWeekNumA(''); setCmpWeekInputA(''); setCmpWeekNumB(''); setCmpWeekInputB(''); }} style={{ border:'1px solid #bfdbfe', background:'#ffffff', color:'#0f172a', borderRadius:10, padding:'10px 12px', fontSize:12, fontWeight:800, cursor:'pointer', height:40 }}>Clear</button>
        </div>
        <div style={{ gridColumn:'1 / -1', fontSize:11, color:'#64748b', marginTop:-2 }}>Choose one project, then select Week 1 and Week 2 beside it. Blue = Week 1, Green = Week 2.</div>
      </FilterShell>

      {/* No project selected */}
      {!cmpProjectId && (
        <div className="empty-state"><div className="empty-icon">⚖️</div><p>Select a project above to compare weeks</p></div>
      )}

      {/* Legend */}
      {matA && matB && (
        <div style={{ display:'flex', gap:20, padding:'9px 16px', background:'#f8faff', border:'1px solid #e0ecff', borderRadius:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          {[
            { color:'#2563eb', bg:'#eff6ff', label:`Week ${cmpWeekA?.weekNum}`, date:cmpWeekA?`${formatDate(cmpWeekA.sat)} – ${formatDate(cmpWeekA.thu)}`:''},
            { color:'#22c55e', bg:'#f0fdf4', label:`Week ${cmpWeekB?.weekNum}`, date:cmpWeekB?`${formatDate(cmpWeekB.sat)} – ${formatDate(cmpWeekB.thu)}`:''},
          ].map((l,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:12, height:12, borderRadius:3, background:l.color, display:'inline-block', flexShrink:0 }} />
              <span style={{ fontSize:12, fontWeight:700, color:l.color }}>{l.label}</span>
              <span style={{ fontSize:11, color:'#9ca3af' }}>{l.date}</span>
            </div>
          ))}
        </div>
      )}

      {/* Comparison table */}
      {matA && matB && (() => {
        // All items that have activity in either week
        const allItems = matA.items.filter(item =>
          levels.some(lv=>(matA.weekMap[item.item_id]?.[lv.id]||0)>0||(matB.weekMap[item.item_id]?.[lv.id]||0)>0)
        );
        const grouped = allItems.reduce((acc,item)=>{
          const key = item.parent_classification_name?`${item.parent_classification_name} › ${item.classification_name||''}`:item.classification_name||'Uncategorized';
          if(!acc[key])acc[key]=[];
          acc[key].push(item);
          return acc;
        },{});

        // Floor totals per week
        const floorTotA = levels.map(lv=>allItems.reduce((s,i)=>s+(matA.weekMap[i.item_id]?.[lv.id]||0),0));
        const floorTotB = levels.map(lv=>allItems.reduce((s,i)=>s+(matB.weekMap[i.item_id]?.[lv.id]||0),0));
        const grandA = floorTotA.reduce((s,v)=>s+v,0);
        const grandB = floorTotB.reduce((s,v)=>s+v,0);
        const grandDelta = grandB - grandA;

        return (
          <div style={{ background:'var(--card)', border:'1px solid var(--border-light)', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', minWidth:300+levels.length*130+180, borderCollapse:'collapse', fontSize:12, tableLayout:'fixed' }}>
                <colgroup>
                  <col style={{ width:70 }} /><col style={{ width:160 }} /><col style={{ width:50 }} />
                  {levels.map((_,i)=><col key={i} style={{ width:65 }} />)}
                  {levels.map((_,i)=><col key={`b${i}`} style={{ width:65 }} />)}
                  <col style={{ width:80 }} /><col style={{ width:80 }} /><col style={{ width:75 }} />
                </colgroup>
                <thead>
                  {/* Row 1 — floor level codes (same as single week: light purple) */}
                  <tr>
                    <th colSpan={3} style={{ ...thBase, textAlign:'left', background:'#ffffff', borderRight:'1px solid #edf2f8' }}></th>
                    {levels.map(lv=>(
                      <th key={lv.id} colSpan={2} style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'1px solid #edf2f8', fontSize:13, fontWeight:850 }}>
                        {lv.level_code}
                        <div style={{ fontSize:9, fontWeight:500, color:'#9ca3af', marginTop:2 }}>{lv.level_name}</div>
                      </th>
                    ))}
                    <th style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'1px solid #edf2f8' }}>W{cmpWeekA?.weekNum} Total</th>
                    <th style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'1px solid #bfdbfe' }}>W{cmpWeekB?.weekNum} Total</th>
                    <th style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'2px solid #a7f3d0' }}>Δ Change</th>
                  </tr>
                  {/* Row 2 — W1 / W2 sub-labels per floor */}
                  <tr>
                    <th style={{ ...thBase, textAlign:'left' }}>Code</th>
                    <th style={{ ...thBase, textAlign:'left' }}>Item Name</th>
                    <th style={thBase}>Unit</th>
                    {levels.map(lv=>(
                      <>
                        <th key={`a${lv.id}`} style={{ ...thBase, background:'#ffffff', color:'#2563eb', borderLeft:'1px solid #cfe0ff', fontSize:10, padding:'5px 4px' }}>W{cmpWeekA?.weekNum}</th>
                        <th key={`b${lv.id}`} style={{ ...thBase, background:'#ffffff', color:'#22c55e', borderLeft:'1px solid #bbf7d0', fontSize:10, padding:'5px 4px' }}>W{cmpWeekB?.weekNum}</th>
                      </>
                    ))}
                    <th style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'1px solid #edf2f8', fontSize:10 }}>W{cmpWeekA?.weekNum}</th>
                    <th style={{ ...thBase, background:'#ffffff', color:'#22c55e', borderLeft:'1px solid #bbf7d0', fontSize:10 }}>W{cmpWeekB?.weekNum}</th>
                    <th style={{ ...thBase, background:'#ffffff', color:'#0f172a', borderLeft:'2px solid #a7f3d0', fontSize:10 }}>Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([group,groupItems])=>{
                    const gA = levels.map(lv=>groupItems.reduce((s,i)=>s+(matA.weekMap[i.item_id]?.[lv.id]||0),0));
                    const gB = levels.map(lv=>groupItems.reduce((s,i)=>s+(matB.weekMap[i.item_id]?.[lv.id]||0),0));
                    const gTotA=gA.reduce((s,v)=>s+v,0), gTotB=gB.reduce((s,v)=>s+v,0);
                    return (
                      <>
                        <tr key={`g-${group}`} style={{ background:'#ffffff', borderTop:'1px solid #e5eaf3', borderLeft:'4px solid #22c55e' }}>
                          <td colSpan={3} style={{ padding:'7px 12px', fontSize:11, fontWeight:700, color:'#0f172a' }}>{group}</td>
                          {levels.map((lv,i)=>(
                            <>
                              <td key={`ga${i}`} style={{ padding:'6px 6px', textAlign:'center', borderLeft:'1px solid #cfe0ff', background:'#ffffff' }}>
                                <span style={{ fontSize:11, fontWeight:700, color:gA[i]>0?'#0f172a':'#cbd5e1' }}>{gA[i]>0?fmt(gA[i]):'·'}</span>
                              </td>
                              <td key={`gb${i}`} style={{ padding:'6px 6px', textAlign:'center', borderLeft:'1px solid #bfdbfe', background:'#ffffff' }}>
                                <span style={{ fontSize:11, fontWeight:700, color:gB[i]>0?'#0f172a':'#cbd5e1' }}>{gB[i]>0?fmt(gB[i]):'·'}</span>
                              </td>
                            </>
                          ))}
                          <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#0f172a', borderLeft:'2px solid #cfe0ff' }}>{fmt(gTotA)}</td>
                          <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#0f172a', borderLeft:'1px solid #bfdbfe' }}>{fmt(gTotB)}</td>
                          <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:dc(gTotB-gTotA), borderLeft:'2px solid #fde68a' }}>
                            {gTotB-gTotA!==0?`${di(gTotB-gTotA)} ${Math.abs(gTotB-gTotA).toFixed(1)}`:'='}
                          </td>
                        </tr>
                        {groupItems.map((item,idx)=>{
                          const iA=levels.map(lv=>matA.weekMap[item.item_id]?.[lv.id]||0);
                          const iB=levels.map(lv=>matB.weekMap[item.item_id]?.[lv.id]||0);
                          const iTotA=iA.reduce((s,v)=>s+v,0), iTotB=iB.reduce((s,v)=>s+v,0);
                          const iDelta=iTotB-iTotA;
                          return (
                            <tr key={item.item_id} style={{ borderBottom:'1px solid #f3f4f6', background:'#ffffff' }}>
                              <td style={{ padding:'9px 12px', fontFamily:'monospace', fontSize:10, color:'#6b7280' }}>{item.item_code}</td>
                              <td style={{ padding:'9px 12px', fontWeight:600, color:'#111827', fontSize:12 }}>{item.item_name}</td>
                              <td style={{ padding:'9px 8px', textAlign:'center', color:'#9ca3af', fontSize:10 }}>{item.unit_of_measure||'—'}</td>
                              {levels.map((lv,i)=>{
                                const vA=iA[i], vB=iB[i];
                                return (
                                  <>
                                    <td key={`ia${i}`} style={{ padding:'6px', textAlign:'center', borderLeft:'1px solid #f3f4f6', background:'#ffffff' }}>
                                      {vA>0?<span style={{ fontWeight:700, color:'#0f172a', fontSize:12 }}>{fmt(vA)}</span>:<span style={{ color:'#e5e7eb' }}>·</span>}
                                    </td>
                                    <td key={`ib${i}`} style={{ padding:'6px', textAlign:'center', borderLeft:'1px solid #e0f2fe', background:'#ffffff' }}>
                                      {vB>0?<span style={{ fontWeight:700, color:'#0f172a', fontSize:12 }}>{fmt(vB)}</span>:<span style={{ color:'#e5e7eb' }}>·</span>}
                                    </td>
                                  </>
                                );
                              })}
                              <td style={{ padding:'9px 8px', textAlign:'center', fontWeight:700, color:'#0f172a', background:'#ffffff', borderLeft:'2px solid #cfe0ff' }}>{iTotA>0?fmt(iTotA):'—'}</td>
                              <td style={{ padding:'9px 8px', textAlign:'center', fontWeight:700, color:'#0f172a', background:'#ffffff', borderLeft:'1px solid #bfdbfe' }}>{iTotB>0?fmt(iTotB):'—'}</td>
                              <td style={{ padding:'9px 8px', textAlign:'center', fontWeight:700, color:dc(iDelta),
                                background:iDelta>0?'#f0fdf4':iDelta<0?'#fef2f2':'transparent', borderLeft:'2px solid #fde68a', fontSize:12 }}>
                                {iDelta!==0?`${di(iDelta)} ${Math.abs(iDelta).toFixed(1)}`:<span style={{ color:'#d1d5db' }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background:'#ffffff', borderTop:'2px solid #bfdbfe' }}>
                    <td colSpan={3} style={{ padding:'10px 12px', fontWeight:700, color:'#0f172a', fontSize:12 }}>THIS WEEK TOTAL</td>
                    {levels.map((lv,i)=>(
                      <>
                        <td key={`fa${i}`} style={{ padding:'8px 6px', textAlign:'center', fontWeight:700, color:floorTotA[i]>0?'#0f172a':'#bfdbfe', borderLeft:'1px solid #cfe0ff', background:'#ffffff', fontSize:12 }}>{floorTotA[i]>0?fmt(floorTotA[i]):'—'}</td>
                        <td key={`fb${i}`} style={{ padding:'8px 6px', textAlign:'center', fontWeight:700, color:floorTotB[i]>0?'#0f172a':'#bfdbfe', borderLeft:'1px solid #bfdbfe', background:'#ffffff', fontSize:12 }}>{floorTotB[i]>0?fmt(floorTotB[i]):'—'}</td>
                      </>
                    ))}
                    <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:'#0f172a', borderLeft:'2px solid #bfdbfe', fontSize:13 }}>{fmt(grandA)}</td>
                    <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:'#0f172a', borderLeft:'1px solid #bfdbfe', fontSize:13 }}>{fmt(grandB)}</td>
                    <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:dc(grandDelta), background: grandDelta>0?'#d1fae5':grandDelta<0?'#fee2e2':'#f0f7ff', borderLeft:'2px solid #a7f3d0', fontSize:13 }}>
                      {grandDelta!==0?`${di(grandDelta)} ${Math.abs(grandDelta).toFixed(1)}`:'='}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Smart Insights — same card design as DailyProductivity */}
      {matA && matB && insights.length > 0 && (() => {
        const levels = matA.levels;
        const totalA = matA.items.reduce((s,i)=>s+levels.reduce((ss,lv)=>ss+(matA.weekMap[i.item_id]?.[lv.id]||0),0),0);
        const totalB = matB.items.reduce((s,i)=>s+levels.reduce((ss,lv)=>ss+(matB.weekMap[i.item_id]?.[lv.id]||0),0),0);
        const delta = totalB - totalA;
        const deltaPct = totalA>0?((delta/totalA)*100):0;
        const tColor = v => v>0?'#16a34a':v<0?'#dc2626':'#6b7280';
        const tBg    = v => v>0?'#f0fdf4':v<0?'#fef2f2':'#f9fafb';
        const tBorder= v => v>0?'#bbf7d0':v<0?'#fecaca':'#e5e7eb';
        const fmt    = v => (parseFloat(v)||0).toFixed(2);
        const pct    = v => `${v>=0?'+':''}${v.toFixed(1)}%`;
        const verdict = deltaPct>=20?'Strong Improvement':deltaPct>=5?'Moderate Improvement':deltaPct>=-5?'Stable Performance':deltaPct>=-20?'Slight Decline':'Significant Decline';
        const verdictIcon = deltaPct>=5?'🟢':deltaPct>=-5?'🟡':'🔴';

        const floorStats = levels.map(lv=>({
          code:lv.level_code, name:lv.level_name,
          a:matA.items.reduce((s,i)=>s+(matA.weekMap[i.item_id]?.[lv.id]||0),0),
          b:matB.items.reduce((s,i)=>s+(matB.weekMap[i.item_id]?.[lv.id]||0),0),
        })).map(f=>({...f,delta:f.b-f.a}));

        const itemStats = matA.items.map(item=>({
          name:item.item_name,
          a:levels.reduce((s,lv)=>s+(matA.weekMap[item.item_id]?.[lv.id]||0),0),
          b:levels.reduce((s,lv)=>s+(matB.weekMap[item.item_id]?.[lv.id]||0),0),
        })).map(i=>({...i,delta:i.b-i.a})).filter(i=>i.a>0||i.b>0);

        const improved = [...itemStats].filter(i=>i.delta>0).sort((a,b)=>b.delta-a.delta);
        const declined = [...itemStats].filter(i=>i.delta<0).sort((a,b)=>a.delta-b.delta);
        const mostImprFloor = [...floorStats].filter(f=>f.delta>0).sort((a,b)=>b.delta-a.delta)[0];
        const mostDeclFloor = [...floorStats].filter(f=>f.delta<0).sort((a,b)=>a.delta-b.delta)[0];
        const activeFloorsA = floorStats.filter(f=>f.a>0).length;
        const activeFloorsB = floorStats.filter(f=>f.b>0).length;

        const Card = ({ icon, title, children, accent='#2563eb' }) => (
          <div style={{ background:'var(--card)', border:`1px solid ${accent}22`, borderRadius:12, padding:'14px 16px', borderLeft:`3px solid ${accent}` }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:accent, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <span>{icon}</span>{title}
            </div>
            {children}
          </div>
        );
        const Row = ({ label, valA, valB, deltaV }) => (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #f3f4f6', fontSize:12 }}>
            <span style={{ color:'#6b7280', flex:1 }}>{label}</span>
            <span style={{ color:'#0f172a', fontWeight:600, minWidth:55, textAlign:'right' }}>{valA}</span>
            <span style={{ color:'#9ca3af', margin:'0 6px' }}>→</span>
            <span style={{ color:'#0f172a', fontWeight:600, minWidth:55, textAlign:'right' }}>{valB}</span>
            {deltaV!==undefined && <span style={{ color:tColor(deltaV), fontWeight:700, minWidth:60, textAlign:'right', fontSize:11 }}>{deltaV>0?'▲':deltaV<0?'▼':'='} {Math.abs(deltaV).toFixed(2)}</span>}
          </div>
        );

        return (
          <div style={{ marginTop:20, borderRadius:14, overflow:'hidden', border:'1.5px solid #2563eb' }}>
            <div style={{ background:'linear-gradient(135deg,#1d4ed8,#2563eb)', padding:'14px 20px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:22 }}>📊</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>Floor Productivity Analysis</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)' }}>Week {cmpWeekA?.weekNum} vs Week {cmpWeekB?.weekNum} — auto-generated from your data</div>
              </div>
            </div>
            <div style={{ padding:'16px', background:'var(--card)', display:'flex', flexDirection:'column', gap:12 }}>

              {/* Verdict */}
              <div style={{ background:tBg(delta), border:`1.5px solid ${tBorder(delta)}`, borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:24 }}>{verdictIcon}</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:tColor(delta) }}>{verdict}</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                    Week {cmpWeekA?.weekNum}: <strong>{fmt(totalA)}</strong> installed &nbsp;→&nbsp;
                    Week {cmpWeekB?.weekNum}: <strong>{fmt(totalB)}</strong> installed &nbsp;
                    <span style={{ color:tColor(delta), fontWeight:700 }}>({delta>=0?'+':''}{fmt(delta)}, {pct(deltaPct)})</span>
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {/* Key metrics */}
                <Card icon="📋" title="Key Metrics" accent="#2563eb">
                  <Row label="Total Installed" valA={fmt(totalA)} valB={fmt(totalB)} deltaV={delta} />
                  <Row label="Active Floors" valA={activeFloorsA} valB={activeFloorsB} deltaV={activeFloorsB-activeFloorsA} />
                  <Row label="Avg per Floor" valA={fmt(activeFloorsA>0?totalA/activeFloorsA:0)} valB={fmt(activeFloorsB>0?totalB/activeFloorsB:0)} deltaV={(activeFloorsB>0?totalB/activeFloorsB:0)-(activeFloorsA>0?totalA/activeFloorsA:0)} />
                </Card>

                {/* Best floors */}
                <Card icon="🏢" title="Floor Performance" accent="#0369a1">
                  {[
                    { week:`Week ${cmpWeekA?.weekNum}`, floors: floorStats.map(f=>({code:f.code,val:f.a})).sort((a,b)=>b.val-a.val).slice(0,3) },
                    { week:`Week ${cmpWeekB?.weekNum}`, floors: floorStats.map(f=>({code:f.code,val:f.b})).sort((a,b)=>b.val-a.val).slice(0,3) },
                  ].map(({week,floors}) => (
                    <div key={week} style={{ marginBottom:8 }}>
                      <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, marginBottom:4 }}>{week}</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {floors.map((f,i)=>f.val>0&&(
                          <div key={f.code} style={{ background:i===0?'#f0fdf4':'#f9fafb', border:`1px solid ${i===0?'#bbf7d0':'#e5e7eb'}`, borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:700, color:i===0?'#16a34a':'#374151' }}>
                            {f.code}: {fmt(f.val)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </Card>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {/* Improved items */}
                <Card icon="📈" title={`Improved Items (${improved.length})`} accent="#16a34a">
                  {improved.length===0
                    ? <div style={{ fontSize:12, color:'#9ca3af' }}>No items improved</div>
                    : improved.slice(0,4).map(i=>(
                      <div key={i.name} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #f3f4f6', fontSize:12 }}>
                        <span style={{ color:'#111827', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.name}</span>
                        <span style={{ color:'#0f172a', fontWeight:700, marginLeft:8 }}>▲ {fmt(i.delta)}</span>
                      </div>
                    ))
                  }
                </Card>
                {/* Declined items */}
                <Card icon="📉" title={`Declined Items (${declined.length})`} accent="#dc2626">
                  {declined.length===0
                    ? <div style={{ fontSize:12, color:'#9ca3af' }}>No items declined</div>
                    : declined.slice(0,4).map(i=>(
                      <div key={i.name} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #f3f4f6', fontSize:12 }}>
                        <span style={{ color:'#111827', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.name}</span>
                        <span style={{ color:'#dc2626', fontWeight:700, marginLeft:8 }}>▼ {fmt(Math.abs(i.delta))}</span>
                      </div>
                    ))
                  }
                </Card>
              </div>

              {/* Floor delta breakdown */}
              <Card icon="🏗️" title="Floor-by-Floor Δ Change" accent="#2563eb">
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {floorStats.map(f => (
                    <div key={f.code} style={{ flex:'1 1 80px', background:f.delta>0?'#f0fdf4':f.delta<0?'#fef2f2':'#f9fafb',
                      border:`1px solid ${f.delta>0?'#bbf7d0':f.delta<0?'#fecaca':'#e5e7eb'}`, borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#374151' }}>{f.code}</div>
                      <div style={{ fontSize:11, color:'#0f172a' }}>W{cmpWeekA?.weekNum}: {f.a>0?fmt(f.a):'—'}</div>
                      <div style={{ fontSize:11, color:'#0f172a' }}>W{cmpWeekB?.weekNum}: {f.b>0?fmt(f.b):'—'}</div>
                      {f.delta!==0 && <div style={{ fontSize:12, fontWeight:700, color:tColor(f.delta), marginTop:3 }}>{f.delta>0?'▲':'▼'} {Math.abs(f.delta).toFixed(1)}</div>}
                      {f.delta===0 && (f.a>0||f.b>0) && <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>= same</div>}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Observations */}
              <Card icon="💡" title="Observations & Recommendations" accent="#f59e0b">
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {insights.map((ins,i) => {
                    const cfg = {
                      good:  { bg:'#f0fdf4', border:'#bbf7d0', icon:'✅' },
                      warn:  { bg:'#fffbeb', border:'#fde68a', icon:'⚠️' },
                      bad:   { bg:'#fef2f2', border:'#fecaca', icon:'🔴' },
                      info:  { bg:'#eff6ff', border:'#bfdbfe', icon:'ℹ️' },
                      action:{ bg:'#f8fbff', border:'#cfe0ff', icon:'🎯' },
                    }[ins.type]||{ bg:'#f9fafb', border:'#e5e7eb', icon:'➡️' };
                    return (
                      <div key={i} style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, borderRadius:8, padding:'8px 12px', display:'flex', gap:8, alignItems:'flex-start' }}>
                        <span style={{ fontSize:13, flexShrink:0 }}>{cfg.icon}</span>
                        <span style={{ fontSize:12, color:'#374151', lineHeight:1.5 }}>{ins.text}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>

            </div>
          </div>
        );
      })()}
    </div>
  );
}