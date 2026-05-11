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
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `floor_weekly_W${weekNum}_${projectId}.csv`;
    a.click();
  }

  const fSel = { background:'var(--card)', border:'2px solid #7c3aed', borderRadius:10, padding:'8px 14px', fontSize:13, fontWeight:600, color:'var(--text)', cursor:'pointer', fontFamily:'inherit', outline:'none', height:40 };
  const thBase = { background:'#f0f7ff', color:'#111827', fontWeight:700, fontSize:11, padding:'10px 12px', borderBottom:'1px solid #e0ecff', whiteSpace:'nowrap', letterSpacing:'0.02em', textAlign:'center' };

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
    const activeItems = visibleItems.filter(item => levels.some(lv=>(weekMap[item.item_id]?.[lv.id]||0)>0)).length;
    return { totalSugg, totalThisWeek, totalAllTime, pct, activeItems };
  },[matrixData, visibleItems]);

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, flexWrap:'wrap' }}>
        <div style={{ width:48, height:48, borderRadius:14, background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:24 }}>🏢</span>
        </div>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text)', letterSpacing:'-0.3px', margin:0 }}>Floor Weekly Productivity</h1>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'4px 0 0 0' }}>
            Confirmed installation qty per item per floor/basement — week view (Sat–Thu)
          </p>
        </div>
        {matrixData && visibleItems.length > 0 && (
          <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, background:'#7c3aed', border:'none', borderRadius:10, padding:'9px 18px', fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'2px solid #ede9fe' }}>
        {[
          { id:'single',  label:'🏢 Single Week' },
          { id:'compare', label:'⚖️ Compare Two Weeks' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding:'10px 28px', fontSize:13, fontWeight:600, cursor:'pointer',
            background:'none', border:'none', fontFamily:'inherit',
            color: activeTab===tab.id?'#7c3aed':'#6b7280',
            borderBottom: activeTab===tab.id?'2px solid #7c3aed':'2px solid transparent',
            marginBottom:-2, transition:'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'single' && <>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🏗️ Project</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...fSel, minWidth:280 }}>
            <option value="">— Select Project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        {years.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>📆 Year</label>
            <select value={selectedYear} onChange={e=>{setSelectedYear(e.target.value);setSelectedMonth('');setWeekNum('');setWeekInput('');}} style={{ ...fSel, minWidth:100 }}>
              <option value="">All</option>
              {years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {selectedYear && months.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🗓️ Month</label>
            <select value={selectedMonth} onChange={e=>{setSelectedMonth(e.target.value);setWeekNum('');setWeekInput('');}} style={{ ...fSel, minWidth:130 }}>
              <option value="">All</option>
              {months.map(m=><option key={m} value={m}>{monthName(m)}</option>)}
            </select>
          </div>
        )}
        {weeks.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>
              # Week No. <span style={{ color:'#9ca3af', fontWeight:400, textTransform:'none' }}>(1–{weeks.length})</span>
            </label>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="number" min={1} max={weeks.length} value={weekInput} placeholder={`1–${weeks.length}`}
                onChange={e=>{const n=parseInt(e.target.value);setWeekInput(e.target.value);if(!isNaN(n)&&weeks.find(w=>w.weekNum===n))setWeekNum(String(n));}}
                style={{ ...fSel, width:85, minWidth:85, fontWeight:700, textAlign:'center' }} />
              {selectedWeek && (
                <div style={{ background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:10, padding:'8px 14px', fontSize:12, fontWeight:600, color:'#7c3aed', whiteSpace:'nowrap' }}>
                  📅 <strong>Sat</strong> {formatDate(selectedWeek.sat)} → <strong>Thu</strong> {formatDate(selectedWeek.thu)}
                </div>
              )}
            </div>
          </div>
        )}
        {filteredWeeks.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>📋 Or Select Week</label>
            <select value={weekNum} onChange={e=>{setWeekNum(e.target.value);setWeekInput(e.target.value);}} style={{ ...fSel, minWidth:320 }}>
              <option value="">— Select Week —</option>
              {filteredWeeks.map(w=><option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Search + Class filter */}
      {matrixData && visibleItems.length > 0 && (
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ display:'flex', alignItems:'center', background:'var(--card)', border:'2px solid #7c3aed', borderRadius:10, height:40, paddingLeft:12, minWidth:220 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{ border:'none', outline:'none', fontSize:13, color:'var(--text)', background:'none', width:'100%', padding:'0 10px', fontFamily:'inherit' }}
              placeholder="Search items..." value={search} onChange={e=>setSearch(e.target.value)} />
            {search && <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'0 10px' }}>✕</button>}
          </div>
          {classifications.length > 1 && (
            <select value={filterClass} onChange={e=>setFilterClass(e.target.value)} style={{ ...fSel, minWidth:200, border:'2px solid #7c3aed', fontWeight:400 }}>
              <option value="">All Classifications</option>
              {classifications.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Empty states */}
      {!projectId && <div className="empty-state"><div className="empty-icon">🏢</div><p>Select a project to view floor productivity</p></div>}
      {projectId && weeks.length===0 && !loading && <div className="empty-state"><div className="empty-icon">📦</div><p>No delivery records found — weeks are generated from first delivery date</p></div>}
      {projectId && weeks.length>0 && !selectedWeek && !loading && (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>👆</div>
          <div style={{ fontSize:14, fontWeight:500 }}>Enter a week number or select from the dropdown</div>
          <div style={{ fontSize:12, marginTop:4 }}>Project has <strong style={{ color:'#7c3aed' }}>{weeks.length}</strong> weeks since first delivery on <strong style={{ color:'#7c3aed' }}>{formatDate(firstDate)}</strong></div>
        </div>
      )}
      {loading && <div style={{ textAlign:'center', padding:40 }}><div className="spinner" /></div>}

      {/* KPI cards */}
      {!loading && kpi && selectedWeek && (
        <div style={{ display:'flex', gap:12, marginBottom:18, flexWrap:'wrap' }}>
          {[
            { label:'Week',            value:`Week ${selectedWeek.weekNum}`,   color:'#7c3aed', bg:'#f5f3ff' },
            { label:'Suggested Total', value:fmt2(kpi.totalSugg),             color:'#374151', bg:'#f9fafb' },
            { label:'This Week',       value:fmt2(kpi.totalThisWeek),         color:'#0369a1', bg:'#eff6ff' },
            { label:'Installed Total', value:fmt2(kpi.totalAllTime),          color:'#16a34a', bg:'#f0fdf4' },
            { label:'Overall Progress',value:`${kpi.pct.toFixed(1)}%`,        color: kpi.pct>=100?'#16a34a':kpi.pct>=60?'#7c3aed':'#f59e0b', bg: kpi.pct>=100?'#f0fdf4':kpi.pct>=60?'#f5f3ff':'#fffbeb' },
            { label:'Active Items',    value:kpi.activeItems,                 color:'#0369a1', bg:'#eff6ff' },
          ].map(k => (
            <div key={k.label} style={{ flex:'1 1 130px', background:k.bg, border:`1px solid ${k.color}22`, borderRadius:12, padding:'12px 16px', borderLeft:`3px solid ${k.color}` }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:k.color, marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#111827' }}>{k.value}</div>
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
          const color = p>=100?'#16a34a':p>=60?'#7c3aed':'#f59e0b';
          return { p, color };
        };

        return (
          <div style={{ background:'var(--card)', border:'1px solid var(--border-light)', borderRadius:14, overflow:'hidden' }}>
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
                    <th colSpan={4} style={{ ...thBase, textAlign:'left', background:'#f8faff', borderRight:'1px solid #e0ecff' }}></th>
                    {levels.map(lv => (
                      <th key={lv.id} style={{ ...thBase, background:'#ede9fe', color:'#7c3aed', borderLeft:'1px solid #ddd6fe', fontSize:13, fontWeight:800 }}>
                        {lv.level_code}
                        <div style={{ fontSize:9, fontWeight:500, color:'#9ca3af', marginTop:2 }}>{lv.level_name}</div>
                      </th>
                    ))}
                    <th style={{ ...thBase, background:'#dbeafe', color:'#1d4ed8', borderLeft:'2px solid #bfdbfe' }}>This Week</th>
                    <th style={{ ...thBase, background:'#d1fae5', color:'#065f46', borderLeft:'1px solid #a7f3d0' }}>Installed Total</th>
                    <th style={{ ...thBase, background:'#f0f7ff', color:'#374151', borderLeft:'1px solid #e0ecff' }}>Progress</th>
                  </tr>
                  {/* Row 2 — Suggested QTY per level */}
                  <tr style={{ background:'#f5f3ff' }}>
                    <td colSpan={4} style={{ padding:'5px 12px', fontSize:10, fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      Suggested QTY →
                    </td>
                    {levels.map(lv => {
                      const lvSugg = visibleItems.reduce((s,i)=>s+(allocMap[i.item_id]?.[lv.id]||0),0);
                      return (
                        <td key={lv.id} style={{ padding:'5px 8px', textAlign:'center', fontSize:11, fontWeight:700, color:'#7c3aed', borderLeft:'1px solid #ddd6fe', background:'#f5f3ff' }}>
                          {lvSugg>0 ? fmt2(lvSugg) : <span style={{ color:'#ddd6fe' }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding:'5px 8px', textAlign:'center', fontSize:11, fontWeight:700, color:'#1d4ed8', background:'#dbeafe', borderLeft:'2px solid #bfdbfe' }}>
                      {fmt2(visibleItems.reduce((s,i)=>s+levels.reduce((ss,lv)=>ss+(weekMap[i.item_id]?.[lv.id]||0),0),0))}
                    </td>
                    <td style={{ padding:'5px 8px', textAlign:'center', fontSize:11, fontWeight:700, color:'#065f46', background:'#d1fae5', borderLeft:'1px solid #a7f3d0' }}>
                      {fmt2(kpi?.totalSugg||0)}
                    </td>
                    <td style={{ padding:'5px 8px', background:'#f0f7ff', borderLeft:'1px solid #e0ecff' }}></td>
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
                        <tr key={`g-${group}`} style={{ background:'#ede9fe' }}>
                          <td colSpan={4} style={{ padding:'7px 12px', fontSize:11, fontWeight:700, color:'#7c3aed' }}>{group}</td>
                          {gWeek.map((qty,i) => (
                            <td key={i} style={{ padding:'7px 8px', textAlign:'center', fontSize:11, fontWeight:700, color:qty>0?'#7c3aed':'#ddd6fe', borderLeft:'1px solid #ddd6fe' }}>
                              {qty>0 ? fmt2(qty) : '—'}
                            </td>
                          ))}
                          <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#1d4ed8', background:'#dbeafe', borderLeft:'2px solid #bfdbfe' }}>{gWeekTotal>0?fmt2(gWeekTotal):'—'}</td>
                          <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#065f46', background:'#d1fae5', borderLeft:'1px solid #a7f3d0' }}>{gTotalInst>0?fmt2(gTotalInst):'—'}</td>
                          <td style={{ padding:'7px 8px', background:'#f0f7ff', borderLeft:'1px solid #e0ecff' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <div style={{ flex:1, height:5, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:40 }}>
                                <div style={{ height:'100%', width:`${gPct}%`, background:gPct>=100?'#16a34a':'#7c3aed', borderRadius:99 }} />
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
                            <tr key={item.item_id} style={{ borderBottom:'1px solid #f3f4f6', background:idx%2===0?'#fafbff':'#fff' }}>
                              <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:'#6b7280' }}>{item.item_code}</td>
                              <td style={{ padding:'10px 12px', fontWeight:600, color:'#111827' }}>{item.item_name}</td>
                              <td style={{ padding:'10px 8px', textAlign:'center', fontSize:11, color:'#9ca3af' }}>{item.unit_of_measure||'—'}</td>
                              <td style={{ padding:'10px 8px', textAlign:'right', fontSize:11, color:'#6b7280' }}>{itemSugg>0?fmt2(itemSugg):'—'}</td>
                              {itemWeek.map((qty,i) => (
                                <td key={i} style={{ padding:'8px', textAlign:'center', borderLeft:'1px solid #f0f0f0', background:qty>0?'#f5f3ff':'transparent' }}>
                                  {qty>0
                                    ? <div>
                                        <div style={{ fontWeight:700, color:'#7c3aed', fontSize:13 }}>{fmt2(qty)}</div>
                                        <div style={{ fontSize:9, color:'#9ca3af', marginTop:1 }}>/{fmt2(itemTotal[i])}</div>
                                      </div>
                                    : <span style={{ color:'#e5e7eb', fontSize:15 }}>·</span>
                                  }
                                </td>
                              ))}
                              <td style={{ padding:'8px', textAlign:'center', fontWeight:700, color:itemWeekTotal>0?'#1d4ed8':'#9ca3af', background:itemWeekTotal>0?'#eff6ff':'transparent', borderLeft:'2px solid #bfdbfe' }}>
                                {itemWeekTotal>0 ? fmt2(itemWeekTotal) : '—'}
                              </td>
                              <td style={{ padding:'8px', textAlign:'center', fontWeight:700, color:itemTotalInst>=itemSugg&&itemSugg>0?'#16a34a':itemTotalInst>0?'#065f46':'#9ca3af', background:itemTotalInst>0?'#f0fdf4':'transparent', borderLeft:'1px solid #a7f3d0' }}>
                                {itemTotalInst>0 ? fmt2(itemTotalInst) : '—'}
                              </td>
                              <td style={{ padding:'8px 10px', borderLeft:'1px solid #e0ecff' }}>
                                {itemSugg>0 ? (
                                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                    <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:40 }}>
                                      <div style={{ height:'100%', width:`${itemPct}%`, background:pColor, borderRadius:99, transition:'width 0.3s' }} />
                                    </div>
                                    <span style={{ fontSize:11, fontWeight:700, color:pColor, minWidth:32, textAlign:'right' }}>{itemPct.toFixed(0)}%</span>
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
                  <tr style={{ background:'#dbeafe', borderTop:'2px solid #bfdbfe' }}>
                    <td colSpan={4} style={{ padding:'10px 12px', fontWeight:700, fontSize:12, color:'#1d4ed8' }}>THIS WEEK TOTAL</td>
                    {lvWeekTotals.map((t,i) => (
                      <td key={i} style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:t>0?'#1d4ed8':'#93c5fd', borderLeft:'1px solid #bfdbfe', fontSize:13 }}>
                        {t>0 ? fmt2(t) : '—'}
                      </td>
                    ))}
                    <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:'#1d4ed8', fontSize:14, borderLeft:'2px solid #1d4ed8' }}>{fmt2(grandWeek)}</td>
                    <td colSpan={2} style={{ background:'#dbeafe' }} />
                  </tr>
                  {/* All time row */}
                  <tr style={{ background:'#d1fae5', borderTop:'1px solid #a7f3d0' }}>
                    <td colSpan={4} style={{ padding:'10px 12px', fontWeight:700, fontSize:12, color:'#065f46' }}>ALL TIME TOTAL</td>
                    {lvTotalTotals.map((t,i) => (
                      <td key={i} style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:t>0?'#065f46':'#6ee7b7', borderLeft:'1px solid #a7f3d0', fontSize:13 }}>
                        {t>0 ? fmt2(t) : '—'}
                      </td>
                    ))}
                    <td style={{ background:'#d1fae5', borderLeft:'2px solid #bfdbfe', padding:'10px 8px' }} />
                    <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:'#065f46', fontSize:14, borderLeft:'1px solid #a7f3d0' }}>{fmt2(grandTotal)}</td>
                    <td style={{ padding:'10px 8px', background:'#f0f7ff', borderLeft:'1px solid #e0ecff' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <div style={{ flex:1, height:7, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:50 }}>
                          <div style={{ height:'100%', width:`${kpi?.pct||0}%`, background:kpi?.pct>=100?'#16a34a':'#7c3aed', borderRadius:99 }} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:'#374151', minWidth:36 }}>{(kpi?.pct||0).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom note */}
            <div style={{ padding:'10px 16px', borderTop:'1px solid #f3f4f6', fontSize:11, color:'#9ca3af', display:'flex', gap:16, flexWrap:'wrap' }}>
              <span>📊 {visibleItems.length} items · {levels.length} floors/basements</span>
              <span>📅 Week {selectedWeek?.weekNum}: {formatDate(selectedWeek?.sat)} – {formatDate(selectedWeek?.thu)}</span>
              <span style={{ color:'#9ca3af' }}>Numbers show: <strong style={{ color:'#7c3aed' }}>this week</strong> / <span style={{ color:'#6b7280' }}>all-time total</span></span>
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

  const thBase = { background:'#f0f7ff', color:'#111827', fontWeight:700, fontSize:11, padding:'9px 10px', borderBottom:'1px solid #e0ecff', whiteSpace:'nowrap', textAlign:'center' };

  // Combined level list from dataA (both weeks share same project)
  const levels = matA?.levels || matB?.levels || [];

  return (
    <div>
      {/* Project + Week selectors */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🏗️ Project</label>
          <select value={cmpProjectId} onChange={e=>setCmpProjectId(e.target.value)} style={{ ...fSel, minWidth:280 }}>
            <option value="">— Select Project —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        {cmpProjectId && cmpWeeks.length > 0 && (
          <>
            {[
              { label:'Week 1', num:cmpWeekNumA, setNum:setCmpWeekNumA, inp:cmpWeekInputA, setInp:setCmpWeekInputA, color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
              { label:'Week 2', num:cmpWeekNumB, setNum:setCmpWeekNumB, inp:cmpWeekInputB, setInp:setCmpWeekInputB, color:'#0369a1', bg:'#eff6ff', border:'#bfdbfe' },
            ].map(({ label, num, setNum, inp, setInp, color, bg, border }) => {
              const selWeek = cmpWeeks.find(w=>w.weekNum===parseInt(num));
              return (
                <div key={label} style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color }}>📅 {label}</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" min={1} max={cmpWeeks.length} value={inp} placeholder="#"
                      onChange={e=>{const n=parseInt(e.target.value);setInp(e.target.value);if(!isNaN(n)&&cmpWeeks.find(w=>w.weekNum===n))setNum(String(n));}}
                      style={{ ...fSel, width:64, minWidth:64, fontWeight:700, textAlign:'center', border:`2px solid ${color}`, background:bg }} />
                    <select value={num} onChange={e=>{setNum(e.target.value);setInp(e.target.value);}}
                      style={{ ...fSel, minWidth:240, border:`2px solid ${color}`, background:bg }}>
                      <option value="">— {label} —</option>
                      {cmpWeeks.map(w=><option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
                    </select>
                    {selWeek && <span style={{ fontSize:11, color, fontWeight:600, whiteSpace:'nowrap' }}>{formatDate(selWeek.sat)} → {formatDate(selWeek.thu)}</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* No project selected */}
      {!cmpProjectId && (
        <div className="empty-state"><div className="empty-icon">⚖️</div><p>Select a project above to compare weeks</p></div>
      )}

      {/* Legend */}
      {matA && matB && (
        <div style={{ display:'flex', gap:20, padding:'9px 16px', background:'#f8faff', border:'1px solid #e0ecff', borderRadius:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          {[
            { color:'#7c3aed', bg:'#f5f3ff', label:`Week ${cmpWeekA?.weekNum}`, date:cmpWeekA?`${formatDate(cmpWeekA.sat)} – ${formatDate(cmpWeekA.thu)}`:''},
            { color:'#0369a1', bg:'#eff6ff', label:`Week ${cmpWeekB?.weekNum}`, date:cmpWeekB?`${formatDate(cmpWeekB.sat)} – ${formatDate(cmpWeekB.thu)}`:''},
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
                    <th colSpan={3} style={{ ...thBase, textAlign:'left', background:'#f8faff', borderRight:'1px solid #e0ecff' }}></th>
                    {levels.map(lv=>(
                      <th key={lv.id} colSpan={2} style={{ ...thBase, background:'#ede9fe', color:'#7c3aed', borderLeft:'1px solid #ddd6fe', fontSize:13, fontWeight:800 }}>
                        {lv.level_code}
                        <div style={{ fontSize:9, fontWeight:500, color:'#9ca3af', marginTop:2 }}>{lv.level_name}</div>
                      </th>
                    ))}
                    <th style={{ ...thBase, background:'#dbeafe', color:'#1d4ed8', borderLeft:'2px solid #bfdbfe' }}>W{cmpWeekA?.weekNum} Total</th>
                    <th style={{ ...thBase, background:'#dbeafe', color:'#1d4ed8', borderLeft:'1px solid #bfdbfe' }}>W{cmpWeekB?.weekNum} Total</th>
                    <th style={{ ...thBase, background:'#d1fae5', color:'#065f46', borderLeft:'2px solid #a7f3d0' }}>Δ Change</th>
                  </tr>
                  {/* Row 2 — W1 / W2 sub-labels per floor */}
                  <tr>
                    <th style={{ ...thBase, textAlign:'left' }}>Code</th>
                    <th style={{ ...thBase, textAlign:'left' }}>Item Name</th>
                    <th style={thBase}>Unit</th>
                    {levels.map(lv=>(
                      <>
                        <th key={`a${lv.id}`} style={{ ...thBase, background:'#f5f3ff', color:'#7c3aed', borderLeft:'1px solid #ddd6fe', fontSize:10, padding:'5px 4px' }}>W{cmpWeekA?.weekNum}</th>
                        <th key={`b${lv.id}`} style={{ ...thBase, background:'#eff6ff', color:'#0369a1', borderLeft:'1px solid #bfdbfe', fontSize:10, padding:'5px 4px' }}>W{cmpWeekB?.weekNum}</th>
                      </>
                    ))}
                    <th style={{ ...thBase, background:'#dbeafe', color:'#1d4ed8', borderLeft:'2px solid #bfdbfe', fontSize:10 }}>W{cmpWeekA?.weekNum}</th>
                    <th style={{ ...thBase, background:'#dbeafe', color:'#1d4ed8', borderLeft:'1px solid #bfdbfe', fontSize:10 }}>W{cmpWeekB?.weekNum}</th>
                    <th style={{ ...thBase, background:'#d1fae5', color:'#065f46', borderLeft:'2px solid #a7f3d0', fontSize:10 }}>Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([group,groupItems])=>{
                    const gA = levels.map(lv=>groupItems.reduce((s,i)=>s+(matA.weekMap[i.item_id]?.[lv.id]||0),0));
                    const gB = levels.map(lv=>groupItems.reduce((s,i)=>s+(matB.weekMap[i.item_id]?.[lv.id]||0),0));
                    const gTotA=gA.reduce((s,v)=>s+v,0), gTotB=gB.reduce((s,v)=>s+v,0);
                    return (
                      <>
                        <tr key={`g-${group}`} style={{ background:'#ede9fe' }}>
                          <td colSpan={3} style={{ padding:'7px 12px', fontSize:11, fontWeight:700, color:'#7c3aed' }}>{group}</td>
                          {levels.map((lv,i)=>(
                            <>
                              <td key={`ga${i}`} style={{ padding:'6px 6px', textAlign:'center', borderLeft:'1px solid #ddd6fe', background:'#f5f3ff' }}>
                                <span style={{ fontSize:11, fontWeight:700, color:gA[i]>0?'#7c3aed':'#ddd6fe' }}>{gA[i]>0?fmt(gA[i]):'·'}</span>
                              </td>
                              <td key={`gb${i}`} style={{ padding:'6px 6px', textAlign:'center', borderLeft:'1px solid #bfdbfe', background:'#eff6ff' }}>
                                <span style={{ fontSize:11, fontWeight:700, color:gB[i]>0?'#0369a1':'#bfdbfe' }}>{gB[i]>0?fmt(gB[i]):'·'}</span>
                              </td>
                            </>
                          ))}
                          <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#7c3aed', borderLeft:'2px solid #ddd6fe' }}>{fmt(gTotA)}</td>
                          <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#0369a1', borderLeft:'1px solid #bfdbfe' }}>{fmt(gTotB)}</td>
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
                            <tr key={item.item_id} style={{ borderBottom:'1px solid #f3f4f6', background:idx%2===0?'#fafbff':'#fff' }}>
                              <td style={{ padding:'9px 12px', fontFamily:'monospace', fontSize:10, color:'#6b7280' }}>{item.item_code}</td>
                              <td style={{ padding:'9px 12px', fontWeight:600, color:'#111827', fontSize:12 }}>{item.item_name}</td>
                              <td style={{ padding:'9px 8px', textAlign:'center', color:'#9ca3af', fontSize:10 }}>{item.unit_of_measure||'—'}</td>
                              {levels.map((lv,i)=>{
                                const vA=iA[i], vB=iB[i];
                                return (
                                  <>
                                    <td key={`ia${i}`} style={{ padding:'6px', textAlign:'center', borderLeft:'1px solid #f3f4f6', background:vA>0?'#f5f3ff':'transparent' }}>
                                      {vA>0?<span style={{ fontWeight:700, color:'#7c3aed', fontSize:12 }}>{fmt(vA)}</span>:<span style={{ color:'#e5e7eb' }}>·</span>}
                                    </td>
                                    <td key={`ib${i}`} style={{ padding:'6px', textAlign:'center', borderLeft:'1px solid #e0f2fe', background:vB>0?'#eff6ff':'transparent' }}>
                                      {vB>0?<span style={{ fontWeight:700, color:'#0369a1', fontSize:12 }}>{fmt(vB)}</span>:<span style={{ color:'#e5e7eb' }}>·</span>}
                                    </td>
                                  </>
                                );
                              })}
                              <td style={{ padding:'9px 8px', textAlign:'center', fontWeight:700, color:'#7c3aed', background:iTotA>0?'#f5f3ff':'transparent', borderLeft:'2px solid #ddd6fe' }}>{iTotA>0?fmt(iTotA):'—'}</td>
                              <td style={{ padding:'9px 8px', textAlign:'center', fontWeight:700, color:'#0369a1', background:iTotB>0?'#eff6ff':'transparent', borderLeft:'1px solid #bfdbfe' }}>{iTotB>0?fmt(iTotB):'—'}</td>
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
                  <tr style={{ background:'#dbeafe', borderTop:'2px solid #bfdbfe' }}>
                    <td colSpan={3} style={{ padding:'10px 12px', fontWeight:700, color:'#1d4ed8', fontSize:12 }}>THIS WEEK TOTAL</td>
                    {levels.map((lv,i)=>(
                      <>
                        <td key={`fa${i}`} style={{ padding:'8px 6px', textAlign:'center', fontWeight:700, color:floorTotA[i]>0?'#7c3aed':'#c4b5fd', borderLeft:'1px solid #ddd6fe', background:'#f5f3ff', fontSize:12 }}>{floorTotA[i]>0?fmt(floorTotA[i]):'—'}</td>
                        <td key={`fb${i}`} style={{ padding:'8px 6px', textAlign:'center', fontWeight:700, color:floorTotB[i]>0?'#0369a1':'#bfdbfe', borderLeft:'1px solid #bfdbfe', background:'#eff6ff', fontSize:12 }}>{floorTotB[i]>0?fmt(floorTotB[i]):'—'}</td>
                      </>
                    ))}
                    <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:'#1d4ed8', borderLeft:'2px solid #bfdbfe', fontSize:13 }}>{fmt(grandA)}</td>
                    <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:'#1d4ed8', borderLeft:'1px solid #bfdbfe', fontSize:13 }}>{fmt(grandB)}</td>
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

        const Card = ({ icon, title, children, accent='#7c3aed' }) => (
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
            <span style={{ color:'#7c3aed', fontWeight:600, minWidth:55, textAlign:'right' }}>{valA}</span>
            <span style={{ color:'#9ca3af', margin:'0 6px' }}>→</span>
            <span style={{ color:'#0369a1', fontWeight:600, minWidth:55, textAlign:'right' }}>{valB}</span>
            {deltaV!==undefined && <span style={{ color:tColor(deltaV), fontWeight:700, minWidth:60, textAlign:'right', fontSize:11 }}>{deltaV>0?'▲':deltaV<0?'▼':'='} {Math.abs(deltaV).toFixed(2)}</span>}
          </div>
        );

        return (
          <div style={{ marginTop:20, borderRadius:14, overflow:'hidden', border:'1.5px solid #7c3aed' }}>
            <div style={{ background:'linear-gradient(135deg,#6d28d9,#7c3aed)', padding:'14px 20px', display:'flex', alignItems:'center', gap:12 }}>
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
                <Card icon="📋" title="Key Metrics" accent="#7c3aed">
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
                        <span style={{ color:'#16a34a', fontWeight:700, marginLeft:8 }}>▲ {fmt(i.delta)}</span>
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
              <Card icon="🏗️" title="Floor-by-Floor Δ Change" accent="#7c3aed">
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {floorStats.map(f => (
                    <div key={f.code} style={{ flex:'1 1 80px', background:f.delta>0?'#f0fdf4':f.delta<0?'#fef2f2':'#f9fafb',
                      border:`1px solid ${f.delta>0?'#bbf7d0':f.delta<0?'#fecaca':'#e5e7eb'}`, borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#374151' }}>{f.code}</div>
                      <div style={{ fontSize:11, color:'#7c3aed' }}>W{cmpWeekA?.weekNum}: {f.a>0?fmt(f.a):'—'}</div>
                      <div style={{ fontSize:11, color:'#0369a1' }}>W{cmpWeekB?.weekNum}: {f.b>0?fmt(f.b):'—'}</div>
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
                      action:{ bg:'#f5f3ff', border:'#ddd6fe', icon:'🎯' },
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