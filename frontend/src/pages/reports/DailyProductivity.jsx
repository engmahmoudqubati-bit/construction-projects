import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';

const fmt2 = v => (parseFloat(v) || 0).toFixed(2);

// ── Shared week helpers (same as WeeklySummary) ───────────────────────────────
function getWeekSaturday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const offset = day === 6 ? 0 : day + 1;
  date.setDate(date.getDate() - offset);
  return date;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function dayName(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short' });
}
function generateWeeks(firstDateStr) {
  if (!firstDateStr) return [];
  const today = new Date();
  let sat = getWeekSaturday(firstDateStr);
  const weeks = [];
  let wn = 1;
  while (sat <= today) {
    const thu = addDays(sat, 5);
    weeks.push({ weekNum: wn++, sat: toISO(sat), thu: toISO(thu),
      label: `Week ${wn - 1} — ${formatDate(toISO(sat))} → ${formatDate(toISO(thu))}` });
    sat = addDays(sat, 7);
  }
  return weeks;
}
// Generate the 6 working days of a week (Sat to Thu, skip Fri)
function weekDays(satStr) {
  const days = [];
  for (let i = 0; i <= 5; i++) {
    const d = addDays(new Date(satStr + 'T00:00:00'), i);
    const iso = toISO(d);
    days.push({ iso, label: formatDate(iso), day: dayName(iso) });
  }
  return days;
}

// ── Filter bar (shared between tabs) ─────────────────────────────────────────
function WeekFilter({ projects, projectId, setProjectId, weekNum, setWeekNum, weeks, years, months, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, weekInput, setWeekInput, selectedWeek, fSel }) {
  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');
  const monthName = m => new Date(`2000-${m}-01`).toLocaleDateString('en-GB', { month: 'long' });

  const filteredWeeks = useMemo(() => {
    let ws = weeks;
    if (selectedYear)  ws = ws.filter(w => w.sat.startsWith(selectedYear) || w.thu.startsWith(selectedYear));
    if (selectedMonth) ws = ws.filter(w => w.sat.slice(0,7)===`${selectedYear}-${selectedMonth}` || w.thu.slice(0,7)===`${selectedYear}-${selectedMonth}`);
    return ws;
  }, [weeks, selectedYear, selectedMonth]);

  return (
    <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🏗️ Project</label>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...fSel, minWidth:300 }}>
          <option value="">— Select Project —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
        </select>
      </div>
      {years.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>📆 Year</label>
          <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedMonth(''); setWeekNum(''); setWeekInput(''); }} style={{ ...fSel, minWidth:110 }}>
            <option value="">All</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}
      {selectedYear && months.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🗓️ Month</label>
          <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setWeekNum(''); setWeekInput(''); }} style={{ ...fSel, minWidth:140 }}>
            <option value="">All</option>
            {months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
          </select>
        </div>
      )}
      {weeks.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>
            # Week No. <span style={{ color:'#9ca3af', fontWeight:400, textTransform:'none' }}>(1–{weeks.length})</span>
          </label>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="number" min={1} max={weeks.length} value={weekInput}
              onChange={e => { const n=parseInt(e.target.value); setWeekInput(e.target.value); if(!isNaN(n)&&weeks.find(w=>w.weekNum===n)) setWeekNum(String(n)); }}
              placeholder={`1–${weeks.length}`}
              style={{ ...fSel, minWidth:90, fontWeight:700, textAlign:'center' }} />
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
          <select value={weekNum} onChange={e => { setWeekNum(e.target.value); setWeekInput(e.target.value); }} style={{ ...fSel, minWidth:340 }}>
            <option value="">— Select Week —</option>
            {filteredWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ── Productivity Table ────────────────────────────────────────────────────────
function ProductivityTable({ items, daily, selectedWeek, label }) {
  if (!items?.length || !selectedWeek) return null;

  const days = weekDays(selectedWeek.sat);

  // Build map: item_id → date → qty
  const qtyMap = {};
  daily.forEach(d => {
    if (!qtyMap[d.item_id]) qtyMap[d.item_id] = {};
    qtyMap[d.item_id][d.transaction_date] = parseFloat(d.qty_installed) || 0;
  });

  // Filter items that have at least one entry in this week
  const activeItems = items.filter(item => days.some(d => (qtyMap[item.item_id]?.[d.iso] || 0) > 0));

  // Group by classification
  const grouped = activeItems.reduce((acc, item) => {
    const key = item.parent_classification_name
      ? `${item.parent_classification_name} › ${item.classification_name || ''}`
      : item.classification_name || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // Day totals (sum across all items)
  const dayTotals = days.map(d => activeItems.reduce((s, item) => s + (qtyMap[item.item_id]?.[d.iso] || 0), 0));
  const grandTotal = dayTotals.reduce((s, v) => s + v, 0);

  const thBase = { background:'#f0f7ff', color:'#111827', fontWeight:700, fontSize:11, padding:'10px 12px',
    borderBottom:'2px solid #e0ecff', whiteSpace:'nowrap', letterSpacing:'0.02em', textAlign:'center' };
  const tdBase = { padding:'10px 12px', verticalAlign:'middle', textAlign:'center', fontSize:12 };

  const pctBar = (qty, total) => {
    const pct = total > 0 ? Math.min(100, (qty / total) * 100) : 0;
    const color = pct >= 80 ? '#16a34a' : pct >= 40 ? '#7c3aed' : pct > 0 ? '#f59e0b' : '#e5e7eb';
    return { pct, color };
  };

  if (activeItems.length === 0) return (
    <div style={{ textAlign:'center', padding:'32px 0', color:'#9ca3af', fontSize:13 }}>
      No confirmed installation entries for this week
    </div>
  );

  return (
    <div>
      {label && <div style={{ fontSize:13, fontWeight:700, color:'#7c3aed', marginBottom:10, padding:'6px 0' }}>{label}</div>}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', minWidth: 400 + days.length * 110, borderCollapse:'collapse', fontSize:12, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:80 }} />
            <col style={{ width:170 }} />
            <col style={{ width:55 }} />
            {days.map(d => <col key={d.iso} style={{ width:110 }} />)}
            <col style={{ width:100 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign:'left' }}>Code</th>
              <th style={{ ...thBase, textAlign:'left' }}>Item Name</th>
              <th style={thBase}>Unit</th>
              {days.map(d => (
                <th key={d.iso} style={{ ...thBase, background: '#ede9fe', color:'#7c3aed', borderLeft:'1px solid #e0ecff' }}>
                  <div style={{ fontSize:11, fontWeight:700 }}>{d.label}</div>
                  <div style={{ fontSize:10, fontWeight:500, color:'#9ca3af', marginTop:2 }}>{d.day}</div>
                </th>
              ))}
              <th style={{ ...thBase, background:'#111827', color:'#fff', borderLeft:'2px solid #374151' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([group, groupItems]) => {
              const gDayTotals = days.map(d => groupItems.reduce((s, item) => s + (qtyMap[item.item_id]?.[d.iso] || 0), 0));
              const gTotal = gDayTotals.reduce((s, v) => s + v, 0);
              return (
                <>
                  {/* Classification group header */}
                  <tr key={`g-${group}`} style={{ background:'#ede9fe' }}>
                    <td colSpan={3} style={{ padding:'7px 12px', fontSize:11, fontWeight:700, color:'#7c3aed', letterSpacing:'0.04em' }}>{group}</td>
                    {gDayTotals.map((gt, i) => (
                      <td key={i} style={{ padding:'7px 12px', textAlign:'center', fontSize:11, fontWeight:700, color: gt>0?'#7c3aed':'#c4b5fd', borderLeft:'1px solid #ddd6fe' }}>
                        {gt > 0 ? fmt2(gt) : '—'}
                      </td>
                    ))}
                    <td style={{ padding:'7px 12px', textAlign:'center', fontWeight:700, fontSize:11, color:'#fff', background:'#6d28d9', borderLeft:'2px solid #5b21b6' }}>
                      {fmt2(gTotal)}
                    </td>
                  </tr>

                  {/* Item rows */}
                  {groupItems.map((item, idx) => {
                    const itemDayQtys = days.map(d => qtyMap[item.item_id]?.[d.iso] || 0);
                    const itemTotal = itemDayQtys.reduce((s, v) => s + v, 0);
                    return (
                      <tr key={item.item_id} style={{ borderBottom:'1px solid #f3f4f6', background: idx%2===0?'#fafbff':'#fff' }}>
                        <td style={{ ...tdBase, textAlign:'left', fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{item.item_code}</td>
                        <td style={{ ...tdBase, textAlign:'left', fontWeight:600, color:'#111827' }}>{item.item_name}</td>
                        <td style={{ ...tdBase, color:'#9ca3af', fontSize:11 }}>{item.unit_of_measure||'—'}</td>
                        {itemDayQtys.map((qty, i) => {
                          const { pct, color } = pctBar(qty, grandTotal > 0 ? grandTotal / activeItems.length : 1);
                          return (
                            <td key={i} style={{ ...tdBase, borderLeft:'1px solid #f3f4f6', background: qty>0?'#faf5ff':'transparent' }}>
                              {qty > 0 ? (
                                <div>
                                  <div style={{ fontWeight:700, color:'#111827', fontSize:13 }}>{fmt2(qty)}</div>
                                  <div style={{ height:3, background:'#ede9fe', borderRadius:99, overflow:'hidden', marginTop:4 }}>
                                    <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:99 }} />
                                  </div>
                                </div>
                              ) : <span style={{ color:'#e5e7eb', fontSize:16 }}>·</span>}
                            </td>
                          );
                        })}
                        <td style={{ ...tdBase, fontWeight:700, color:'#fff', background: itemTotal>0?'#1f2937':'#374151', borderLeft:'2px solid #374151', fontSize:13 }}>
                          {itemTotal > 0 ? fmt2(itemTotal) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>

          {/* Daily totals footer */}
          <tfoot>
            <tr style={{ borderTop:'2px solid #1f2937', background:'#111827' }}>
              <td colSpan={3} style={{ padding:'11px 12px', fontWeight:700, fontSize:12, color:'#fff' }}>
                Daily Total ({activeItems.length} items)
              </td>
              {dayTotals.map((total, i) => (
                <td key={i} style={{ padding:'11px 12px', textAlign:'center', fontWeight:700, color: total>0?'#a5f3fc':'#4b5563', fontSize:13, borderLeft:'1px solid #374151' }}>
                  {total > 0 ? fmt2(total) : '—'}
                </td>
              ))}
              <td style={{ padding:'11px 12px', textAlign:'center', fontWeight:700, color:'#fbbf24', fontSize:14, borderLeft:'2px solid #374151' }}>
                {fmt2(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DailyProductivity() {
  const toast = useToast();

  // Shared project/week state
  const [projects,    setProjects]    = useState([]);
  const [activeTab,   setActiveTab]   = useState('single');

  // Single week state
  const [projectId,     setProjectId]     = useState('');
  const [weeks,         setWeeks]         = useState([]);
  const [firstDate,     setFirstDate]     = useState(null);
  const [weekNum,       setWeekNum]       = useState('');
  const [weekInput,     setWeekInput]     = useState('');
  const [selectedYear,  setSelectedYear]  = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [reportData,    setReportData]    = useState(null);
  const [loading,       setLoading]       = useState(false);

  // Compare week state
  const [cmpProjectId,    setCmpProjectId]    = useState('');
  const [cmpWeeks,        setCmpWeeks]        = useState([]);
  const [cmpFirstDate,    setCmpFirstDate]    = useState(null);
  const [cmpWeekNumA,     setCmpWeekNumA]     = useState('');
  const [cmpWeekInputA,   setCmpWeekInputA]   = useState('');
  const [cmpWeekNumB,     setCmpWeekNumB]     = useState('');
  const [cmpWeekInputB,   setCmpWeekInputB]   = useState('');
  const [cmpDataA,        setCmpDataA]        = useState(null);
  const [cmpDataB,        setCmpDataB]        = useState(null);
  const [cmpLoading,      setCmpLoading]      = useState(false);
  const [cmpYear,         setCmpYear]         = useState('');
  const [cmpMonth,        setCmpMonth]        = useState('');

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  // Load weeks when project changes
  const loadWeeksForProject = useCallback(async (pid, setWks, setFd) => {
    if (!pid) { setWks([]); setFd(null); return; }
    try {
      const dummy = new Date().toISOString().slice(0,10);
      const data = await api.getDailyProductivity(pid, dummy, dummy);
      if (data.firstDeliveryDate) {
        setFd(data.firstDeliveryDate);
        setWks(generateWeeks(data.firstDeliveryDate));
      } else { setWks([]); setFd(null); }
    } catch { setWks([]); }
  }, []);

  useEffect(() => {
    loadWeeksForProject(projectId, setWeeks, setFirstDate);
    setWeekNum(''); setWeekInput(''); setReportData(null); setSelectedYear(''); setSelectedMonth('');
  }, [projectId, loadWeeksForProject]);

  useEffect(() => {
    loadWeeksForProject(cmpProjectId, setCmpWeeks, setCmpFirstDate);
    setCmpWeekNumA(''); setCmpWeekInputA(''); setCmpWeekNumB(''); setCmpWeekInputB('');
    setCmpDataA(null); setCmpDataB(null); setCmpYear(''); setCmpMonth('');
  }, [cmpProjectId, loadWeeksForProject]);

  // Load single week report
  const selectedWeek = useMemo(() => weeks.find(w => w.weekNum === parseInt(weekNum)), [weeks, weekNum]);

  useEffect(() => {
    if (!selectedWeek || !projectId) return;
    setLoading(true);
    api.getDailyProductivity(projectId, selectedWeek.sat, selectedWeek.thu)
      .then(setReportData)
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [selectedWeek, projectId, toast]);

  // Load comparison weeks
  const cmpWeekA = useMemo(() => cmpWeeks.find(w => w.weekNum === parseInt(cmpWeekNumA)), [cmpWeeks, cmpWeekNumA]);
  const cmpWeekB = useMemo(() => cmpWeeks.find(w => w.weekNum === parseInt(cmpWeekNumB)), [cmpWeeks, cmpWeekNumB]);

  useEffect(() => {
    if (!cmpWeekA || !cmpProjectId) return;
    api.getDailyProductivity(cmpProjectId, cmpWeekA.sat, cmpWeekA.thu)
      .then(setCmpDataA).catch(() => {});
  }, [cmpWeekA, cmpProjectId]);

  useEffect(() => {
    if (!cmpWeekB || !cmpProjectId) return;
    api.getDailyProductivity(cmpProjectId, cmpWeekB.sat, cmpWeekB.thu)
      .then(setCmpDataB).catch(() => {});
  }, [cmpWeekB, cmpProjectId]);

  const years = useMemo(() => [...new Set(weeks.map(w => w.sat.slice(0,4)))].sort(), [weeks]);
  const months = useMemo(() => {
    if (!selectedYear) return [];
    const ms = new Set(weeks.filter(w => w.sat.startsWith(selectedYear)||w.thu.startsWith(selectedYear)).map(w => w.sat.slice(5,7)));
    return [...ms].sort();
  }, [weeks, selectedYear]);

  const cmpYears  = useMemo(() => [...new Set(cmpWeeks.map(w => w.sat.slice(0,4)))].sort(), [cmpWeeks]);
  const cmpMonths = useMemo(() => {
    if (!cmpYear) return [];
    const ms = new Set(cmpWeeks.filter(w => w.sat.startsWith(cmpYear)||w.thu.startsWith(cmpYear)).map(w => w.sat.slice(5,7)));
    return [...ms].sort();
  }, [cmpWeeks, cmpYear]);

  function exportCSV() {
    if (!reportData?.items || !selectedWeek) return;
    const days = weekDays(selectedWeek.sat);
    const qtyMap = {};
    reportData.daily.forEach(d => {
      if (!qtyMap[d.item_id]) qtyMap[d.item_id] = {};
      qtyMap[d.item_id][d.transaction_date] = parseFloat(d.qty_installed) || 0;
    });
    const headers = ['Item Code','Item Name','Unit',...days.map(d=>`${d.label} (${d.day})`),'Total'];
    const rows = reportData.items
      .filter(item => days.some(d => (qtyMap[item.item_id]?.[d.iso]||0)>0))
      .map(item => {
        const qtys = days.map(d => qtyMap[item.item_id]?.[d.iso]||0);
        return [item.item_code, item.item_name, item.unit_of_measure||'', ...qtys.map(q=>q>0?fmt2(q):''), fmt2(qtys.reduce((s,v)=>s+v,0))].join(',');
      });
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `daily_productivity_W${weekNum}_${projectId}.csv`;
    a.click();
  }

  const fSel = { background:'var(--card)', border:'2px solid #7c3aed', borderRadius:10, padding:'8px 14px', fontSize:14, fontWeight:600, color:'var(--text)', cursor:'pointer', fontFamily:'inherit', outline:'none', height:40 };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, flexWrap:'wrap' }}>
        <div style={{ width:48, height:48, borderRadius:14, background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:24 }}>📊</span>
        </div>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text)', letterSpacing:'-0.3px', margin:0 }}>Daily Productivity Per Week</h1>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'4px 0 0 0' }}>
            Installation qty per item per working day (Sat–Thu) — reads from confirmed installation entries
          </p>
        </div>
        {activeTab === 'single' && reportData?.items?.length > 0 && (
          <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, background:'#7c3aed', border:'none', borderRadius:10, padding:'9px 18px', fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'2px solid #ede9fe' }}>
        {[
          { id:'single',  label:'📅 Single Week View' },
          { id:'compare', label:'⚖️ Compare Two Weeks' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding:'10px 28px', fontSize:13, fontWeight:600, cursor:'pointer',
            background:'none', border:'none', fontFamily:'inherit',
            color: activeTab===tab.id ? '#7c3aed' : '#6b7280',
            borderBottom: activeTab===tab.id ? '2px solid #7c3aed' : '2px solid transparent',
            marginBottom:-2, transition:'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── SINGLE WEEK TAB ── */}
      {activeTab === 'single' && (
        <>
          <WeekFilter
            projects={projects} projectId={projectId} setProjectId={setProjectId}
            weekNum={weekNum} setWeekNum={setWeekNum} weeks={weeks}
            years={years} months={months}
            selectedYear={selectedYear} setSelectedYear={setSelectedYear}
            selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
            weekInput={weekInput} setWeekInput={setWeekInput}
            selectedWeek={selectedWeek} fSel={fSel}
          />

          {!projectId && (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
              <div style={{ fontSize:15, fontWeight:500 }}>Select a project to begin</div>
            </div>
          )}
          {projectId && weeks.length === 0 && !loading && (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
              <div style={{ fontSize:15, fontWeight:500 }}>No confirmed delivery records found — weeks are generated from first delivery date</div>
            </div>
          )}
          {projectId && weeks.length > 0 && !selectedWeek && !loading && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>👆</div>
              <div style={{ fontSize:14, fontWeight:500 }}>Enter a week number or select from the dropdown</div>
              <div style={{ fontSize:12, marginTop:4 }}>Project has <strong style={{ color:'#7c3aed' }}>{weeks.length}</strong> weeks since first delivery on <strong style={{ color:'#7c3aed' }}>{formatDate(firstDate)}</strong></div>
            </div>
          )}
          {loading && <div style={{ textAlign:'center', padding:40 }}><div className="spinner" /></div>}

          {!loading && reportData && selectedWeek && (
            <>
              {/* Week KPI bar */}
              <div style={{ display:'flex', gap:12, marginBottom:18, flexWrap:'wrap' }}>
                {[
                  { label:'Week',         value:`Week ${selectedWeek.weekNum}`, color:'#7c3aed', bg:'#f5f3ff' },
                  { label:'Period Start', value:formatDate(selectedWeek.sat)+' (Sat)', color:'#7c3aed', bg:'#f5f3ff' },
                  { label:'Period End',   value:formatDate(selectedWeek.thu)+' (Thu)', color:'#7c3aed', bg:'#f5f3ff' },
                  { label:'Total Installed This Week',
                    value: fmt2(reportData.daily.reduce((s,d) => s+(parseFloat(d.qty_installed)||0), 0)),
                    color:'#16a34a', bg:'#f0fdf4' },
                  { label:'Active Items',
                    value: new Set(reportData.daily.map(d=>d.item_id)).size,
                    color:'#0369a1', bg:'#e0f2fe' },
                ].map(k => (
                  <div key={k.label} style={{ flex:'1 1 130px', background:k.bg, border:`1px solid ${k.color}33`, borderRadius:12, padding:'12px 16px' }}>
                    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:k.color, marginBottom:4 }}>{k.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background:'var(--card)', border:'1px solid var(--border-light)', borderRadius:14, overflow:'hidden', padding:'0 0 4px 0' }}>
                <ProductivityTable items={reportData.items} daily={reportData.daily} selectedWeek={selectedWeek} />
              </div>
            </>
          )}
        </>
      )}

      {/* ── COMPARE TWO WEEKS TAB ── */}
      {activeTab === 'compare' && (
        <>
          {/* Project selector for comparison */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🏗️ Project</label>
              <select value={cmpProjectId} onChange={e => setCmpProjectId(e.target.value)} style={{ ...fSel, minWidth:300 }}>
                <option value="">— Select Project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{[p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ')}</option>)}
              </select>
            </div>
          </div>

          {cmpProjectId && cmpWeeks.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
              {/* Week A selector */}
              {[
                { label:'Week A', num:cmpWeekNumA, setNum:setCmpWeekNumA, inp:cmpWeekInputA, setInp:setCmpWeekInputA, color:'#7c3aed', bg:'#f5f3ff' },
                { label:'Week B', num:cmpWeekNumB, setNum:setCmpWeekNumB, inp:cmpWeekInputB, setInp:setCmpWeekInputB, color:'#0369a1', bg:'#e0f2fe' },
              ].map(({ label, num, setNum, inp, setInp, color, bg }) => {
                const selWeek = cmpWeeks.find(w => w.weekNum === parseInt(num));
                return (
                  <div key={label} style={{ background:bg, border:`1.5px solid ${color}44`, borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, color, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <input type="number" min={1} max={cmpWeeks.length} value={inp} placeholder={`1–${cmpWeeks.length}`}
                        onChange={e => { const n=parseInt(e.target.value); setInp(e.target.value); if(!isNaN(n)&&cmpWeeks.find(w=>w.weekNum===n)) setNum(String(n)); }}
                        style={{ ...fSel, minWidth:80, width:80, fontWeight:700, textAlign:'center', border:`2px solid ${color}` }} />
                      <select value={num} onChange={e => { setNum(e.target.value); setInp(e.target.value); }}
                        style={{ ...fSel, flex:1, minWidth:200, border:`2px solid ${color}` }}>
                        <option value="">— Select {label} —</option>
                        {cmpWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
                      </select>
                    </div>
                    {selWeek && (
                      <div style={{ fontSize:11, color, fontWeight:600, marginTop:8 }}>
                        📅 {formatDate(selWeek.sat)} (Sat) → {formatDate(selWeek.thu)} (Thu)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!cmpProjectId && (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>⚖️</div>
              <div style={{ fontSize:15, fontWeight:500 }}>Select a project to compare weeks</div>
            </div>
          )}

          {/* Week A table */}
          {cmpDataA && cmpWeekA && (
            <div style={{ background:'var(--card)', border:'2px solid #7c3aed', borderRadius:14, overflow:'hidden', marginBottom:20, padding:'0 0 4px 0' }}>
              <div style={{ background:'#7c3aed', padding:'10px 16px' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>
                  Week A — Week {cmpWeekA.weekNum} &nbsp;|&nbsp; {formatDate(cmpWeekA.sat)} → {formatDate(cmpWeekA.thu)}
                  &nbsp;|&nbsp; Total: {fmt2(cmpDataA.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0))}
                </span>
              </div>
              <ProductivityTable items={cmpDataA.items} daily={cmpDataA.daily} selectedWeek={cmpWeekA} />
            </div>
          )}

          {/* Week B table */}
          {cmpDataB && cmpWeekB && (
            <div style={{ background:'var(--card)', border:'2px solid #0369a1', borderRadius:14, overflow:'hidden', padding:'0 0 4px 0' }}>
              <div style={{ background:'#0369a1', padding:'10px 16px' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>
                  Week B — Week {cmpWeekB.weekNum} &nbsp;|&nbsp; {formatDate(cmpWeekB.sat)} → {formatDate(cmpWeekB.thu)}
                  &nbsp;|&nbsp; Total: {fmt2(cmpDataB.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0))}
                </span>
              </div>
              <ProductivityTable items={cmpDataB.items} daily={cmpDataB.daily} selectedWeek={cmpWeekB} />
            </div>
          )}

          {/* Delta summary — shown when both weeks are loaded */}
          {cmpDataA && cmpDataB && cmpWeekA && cmpWeekB && (() => {
            const totalA = cmpDataA.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
            const totalB = cmpDataB.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
            const delta  = totalB - totalA;
            const deltaPct = totalA > 0 ? ((delta / totalA) * 100).toFixed(1) : '—';
            const color = delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#6b7280';
            return (
              <div style={{ marginTop:16, background: delta>0?'#f0fdf4':delta<0?'#fef2f2':'#f9fafb', border:`1.5px solid ${color}44`, borderRadius:12, padding:'14px 20px', display:'flex', gap:20, flexWrap:'wrap', alignItems:'center' }}>
                <div style={{ fontSize:13, fontWeight:700, color }}>
                  {delta > 0 ? '📈' : delta < 0 ? '📉' : '➡️'} Week B vs Week A:&nbsp;
                  <span style={{ fontSize:16 }}>{delta > 0 ? '+' : ''}{fmt2(delta)}</span>
                  {deltaPct !== '—' && <span style={{ fontSize:12, marginLeft:8 }}>({delta>0?'+':''}{deltaPct}%)</span>}
                </div>
                <div style={{ fontSize:12, color:'#6b7280' }}>
                  Week A total: <strong>{fmt2(totalA)}</strong> &nbsp;|&nbsp; Week B total: <strong>{fmt2(totalB)}</strong>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}