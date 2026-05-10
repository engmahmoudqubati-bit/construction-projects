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

  useEffect(() => { api.getProjects().then(setProjects).catch(()=>{}); }, []);

  // Load weeks when project changes
  const loadWeeks = useCallback(async (pid) => {
    if (!pid) { setWeeks([]); setFirstDate(null); return; }
    try {
      const dummy = new Date().toISOString().slice(0,10);
      const data = await api.getFloorWeekly(pid, dummy, dummy);
      if (data.firstDeliveryDate) { setFirstDate(data.firstDeliveryDate); setWeeks(generateWeeks(data.firstDeliveryDate)); }
      else { setWeeks([]); setFirstDate(null); }
    } catch { setWeeks([]); }
  }, []);

  useEffect(() => {
    loadWeeks(projectId);
    setWeekNum(''); setWeekInput(''); setReportData(null);
    setSelectedYear(''); setSelectedMonth(''); setSearch(''); setFilterClass('');
  }, [projectId, loadWeeks]);

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
    </div>
  );
}