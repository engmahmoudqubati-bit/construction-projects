import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';

const fmt2 = v => (parseFloat(v) || 0).toFixed(2);
const fmt0 = v => (parseFloat(v) || 0).toFixed(0);

// ── Week calculation helpers ────────────────────────────────────────────────
// A week runs Sat (day 6) → Thu (day 4)
// Given any date string, find the Saturday that starts its week
function getWeekSaturday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  // days since last Saturday: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
  const offset = day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - offset);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Generate all SAT→THU weeks from firstDate up to today
function generateWeeks(firstDateStr) {
  if (!firstDateStr) return [];
  const today = new Date();
  let sat = getWeekSaturday(firstDateStr);
  const weeks = [];
  let wn = 1;
  while (sat <= today) {
    const thu = addDays(sat, 5); // Sat+5 = Thu
    weeks.push({
      weekNum: wn++,
      sat: toISO(sat),
      thu: toISO(thu),
      label: `Week ${wn - 1} — ${formatDisplay(toISO(sat))} → ${formatDisplay(toISO(thu))}`,
    });
    sat = addDays(sat, 7);
  }
  return weeks;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function WeeklySummary() {
  const toast = useToast();

  const [projects,    setProjects]    = useState([]);
  const [projectId,   setProjectId]   = useState('');
  const [weeks,       setWeeks]       = useState([]);
  const [weekNum,     setWeekNum]     = useState('');
  const [weekInput,   setWeekInput]   = useState(''); // typed week number
  const [selectedYear,  setSelectedYear]  = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [reportData,  setReportData]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [firstDate,   setFirstDate]   = useState(null);

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  // When project changes, fetch first delivery date to generate weeks
  const loadWeeks = useCallback(async (pid) => {
    if (!pid) { setWeeks([]); setFirstDate(null); return; }
    try {
      // Quick fetch with a dummy date just to get firstDeliveryDate
      const dummy = new Date().toISOString().slice(0, 10);
      const data = await api.getWeeklyReport(pid, dummy, dummy);
      if (data.firstDeliveryDate) {
        setFirstDate(data.firstDeliveryDate);
        setWeeks(generateWeeks(data.firstDeliveryDate));
      } else {
        setWeeks([]);
        setFirstDate(null);
      }
    } catch { setWeeks([]); }
  }, []);

  useEffect(() => { loadWeeks(projectId); setWeekNum(''); setWeekInput(''); setReportData(null); setSelectedYear(''); setSelectedMonth(''); }, [projectId, loadWeeks]);

  // All available years from weeks
  const years = useMemo(() => [...new Set(weeks.map(w => w.sat.slice(0, 4)))].sort(), [weeks]);

  // Filtered weeks by year+month
  const filteredWeeks = useMemo(() => {
    let ws = weeks;
    if (selectedYear)  ws = ws.filter(w => w.sat.startsWith(selectedYear) || w.thu.startsWith(selectedYear));
    if (selectedMonth) ws = ws.filter(w => w.sat.slice(0, 7) === `${selectedYear}-${selectedMonth}` || w.thu.slice(0, 7) === `${selectedYear}-${selectedMonth}`);
    return ws;
  }, [weeks, selectedYear, selectedMonth]);

  // Months available given selected year
  const months = useMemo(() => {
    if (!selectedYear) return [];
    const ms = new Set(weeks.filter(w => w.sat.startsWith(selectedYear) || w.thu.startsWith(selectedYear)).map(w => w.sat.slice(5, 7)));
    return [...ms].sort();
  }, [weeks, selectedYear]);

  const selectedWeek = useMemo(() => weeks.find(w => w.weekNum === parseInt(weekNum)), [weeks, weekNum]);

  async function loadReport() {
    if (!projectId || !selectedWeek) return;
    setLoading(true);
    try {
      const data = await api.getWeeklyReport(projectId, selectedWeek.sat, selectedWeek.thu);
      setReportData(data);
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (selectedWeek) loadReport(); }, [selectedWeek]);

  function handleWeekInput(val) {
    setWeekInput(val);
    const n = parseInt(val);
    if (!isNaN(n) && weeks.find(w => w.weekNum === n)) setWeekNum(String(n));
  }

  function exportCSV() {
    if (!reportData?.rows?.length) return;
    const headers = ['Classification','Item Code','Item Name','Unit','Planned Qty',
      'Delivered to Date','Delivery %','Installed This Week','Installed Last Week','Installed to Date','Install %'];
    const csvRows = reportData.rows.map(r => {
      const planned   = parseFloat(r.planned_qty) || 0;
      const delToDate = parseFloat(r.delivered_to_date) || 0;
      const instThisW = parseFloat(r.installed_this_week) || 0;
      const instLastW = parseFloat(r.installed_last_week) || 0;
      const instToDate= parseFloat(r.installed_to_date) || 0;
      const delPct    = planned > 0 ? ((delToDate / planned) * 100).toFixed(1) : '0.0';
      const instPct   = planned > 0 ? ((instToDate / planned) * 100).toFixed(1) : '0.0';
      const cls = [r.parent_classification_name, r.classification_name].filter(Boolean).join(' › ');
      return [cls, r.item_code, r.item_name, r.unit_of_measure||'',
        fmt2(planned), fmt2(delToDate), delPct+'%', fmt2(instThisW), fmt2(instLastW), fmt2(instToDate), instPct+'%'].join(',');
    });
    const csv = [headers.join(','), ...csvRows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `weekly_summary_W${weekNum}_${projectId}.csv`;
    a.click();
  }

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');
  const monthName = m => new Date(`2000-${m}-01`).toLocaleDateString('en-GB', { month: 'long' });

  // Group rows by classification
  const grouped = useMemo(() => {
    if (!reportData?.rows) return {};
    return reportData.rows.reduce((acc, row) => {
      const key = row.parent_classification_name
        ? `${row.parent_classification_name} › ${row.classification_name || ''}`
        : row.classification_name || 'Uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  }, [reportData]);

  // Summary totals
  const totals = useMemo(() => {
    if (!reportData?.rows) return null;
    return reportData.rows.reduce((acc, r) => ({
      planned:    acc.planned    + (parseFloat(r.planned_qty) || 0),
      delToDate:  acc.delToDate  + (parseFloat(r.delivered_to_date) || 0),
      instThisW:  acc.instThisW  + (parseFloat(r.installed_this_week) || 0),
      instLastW:  acc.instLastW  + (parseFloat(r.installed_last_week) || 0),
      instToDate: acc.instToDate + (parseFloat(r.installed_to_date) || 0),
    }), { planned:0, delToDate:0, instThisW:0, instLastW:0, instToDate:0 });
  }, [reportData]);

  const fSel = { background:'var(--card)', border:'2px solid #7c3aed', borderRadius:10, padding:'8px 14px', fontSize:14, fontWeight:600, color:'var(--text)', cursor:'pointer', fontFamily:'inherit', outline:'none', height:40 };
  const thS = { background:'#f0f7ff', color:'#111827', fontWeight:700, fontSize:11, padding:'10px 12px', textAlign:'left', borderBottom:'1px solid #e0ecff', whiteSpace:'nowrap', letterSpacing:'0.02em' };
  const thR = { ...thS, textAlign:'right' };
  const thC = { ...thS, textAlign:'center' };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, flexWrap:'wrap' }}>
        <div style={{ width:48, height:48, borderRadius:14, background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:24 }}>📅</span>
        </div>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text)', letterSpacing:'-0.3px', margin:0 }}>Weekly Summary Report</h1>
          <p style={{ fontSize:12, color:'#9ca3af', margin:'4px 0 0 0' }}>
            Delivery & installation progress per week — Sat to Thu (Friday excluded as holiday)
          </p>
        </div>
        {reportData?.rows?.length > 0 && (
          <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, background:'#7c3aed', border:'none', borderRadius:10, padding:'9px 18px', fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>

        {/* Project */}
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🏗️ Project</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...fSel, minWidth:300 }}>
            <option value="">— Select Project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>

        {/* Year */}
        {years.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>📆 Year</label>
            <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedMonth(''); setWeekNum(''); setWeekInput(''); }} style={{ ...fSel, minWidth:110 }}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {/* Month */}
        {selectedYear && months.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🗓️ Month</label>
            <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setWeekNum(''); setWeekInput(''); }} style={{ ...fSel, minWidth:140 }}>
              <option value="">All Months</option>
              {months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
          </div>
        )}

        {/* Week number input */}
        {weeks.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>
              # Week No. <span style={{ color:'#9ca3af', fontWeight:400, textTransform:'none' }}>(1 – {weeks.length})</span>
            </label>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="number" min={1} max={weeks.length} value={weekInput}
                onChange={e => handleWeekInput(e.target.value)}
                placeholder={`1–${weeks.length}`}
                style={{ ...fSel, minWidth:90, fontWeight:700, textAlign:'center' }} />
              {selectedWeek && (
                <div style={{ background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:10, padding:'8px 14px', fontSize:12, fontWeight:600, color:'#7c3aed', whiteSpace:'nowrap' }}>
                  📅 <strong>Sat</strong> {formatDisplay(selectedWeek.sat)} → <strong>Thu</strong> {formatDisplay(selectedWeek.thu)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Week dropdown (from filtered) */}
        {filteredWeeks.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>📋 Or Select Week</label>
            <select value={weekNum} onChange={e => { setWeekNum(e.target.value); setWeekInput(e.target.value); }}
              style={{ ...fSel, minWidth:340 }}>
              <option value="">— Select Week —</option>
              {filteredWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* No project selected */}
      {!projectId && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
          <div style={{ fontSize:15, fontWeight:500 }}>Select a project to generate the weekly summary</div>
        </div>
      )}

      {/* Project selected but no delivery data yet */}
      {projectId && !loading && weeks.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
          <div style={{ fontSize:15, fontWeight:500 }}>No confirmed delivery records found for this project</div>
          <div style={{ fontSize:12, marginTop:6 }}>Weeks are generated from the first confirmed delivery date</div>
        </div>
      )}

      {/* No week selected */}
      {projectId && weeks.length > 0 && !selectedWeek && !loading && (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>👆</div>
          <div style={{ fontSize:14, fontWeight:500 }}>Enter a week number or select from the dropdown</div>
          <div style={{ fontSize:12, marginTop:4 }}>Project has <strong style={{ color:'#7c3aed' }}>{weeks.length}</strong> weeks since first delivery on <strong style={{ color:'#7c3aed' }}>{formatDisplay(firstDate)}</strong></div>
        </div>
      )}

      {loading && <div style={{ textAlign:'center', padding:40 }}><div className="spinner" /></div>}

      {/* Report table */}
      {!loading && reportData?.rows?.length > 0 && selectedWeek && (
        <>
          {/* Week banner */}
          <div style={{ display:'flex', gap:12, marginBottom:18, flexWrap:'wrap' }}>
            {[
              { label:'Week Number',     value:`Week ${selectedWeek.weekNum}`,             color:'#7c3aed', bg:'#f5f3ff' },
              { label:'Period Start',    value:formatDisplay(selectedWeek.sat) + ' (Sat)', color:'#7c3aed', bg:'#f5f3ff' },
              { label:'Period End',      value:formatDisplay(selectedWeek.thu) + ' (Thu)', color:'#7c3aed', bg:'#f5f3ff' },
              { label:'Delivery % (avg)',value: totals.planned > 0 ? `${((totals.delToDate/totals.planned)*100).toFixed(1)}%` : '—', color:'#0ea5e9', bg:'#e0f2fe' },
              { label:'Install % (avg)', value: totals.planned > 0 ? `${((totals.instToDate/totals.planned)*100).toFixed(1)}%` : '—', color:'#16a34a', bg:'#f0fdf4' },
            ].map(k => (
              <div key={k.label} style={{ flex:'1 1 140px', background:k.bg, border:`1px solid ${k.color}33`, borderRadius:12, padding:'12px 16px' }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:k.color, marginBottom:4 }}>{k.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Main table */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border-light)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  {/* Column group headers */}
                  <tr>
                    <th colSpan={4} style={{ ...thS, background:'#f8f8ff', borderRight:'2px solid #e0ecff' }}></th>
                    <th colSpan={2} style={{ ...thC, background:'#e0f2fe', color:'#0369a1', borderRight:'2px solid #bae6fd' }}>
                      📦 DELIVERY — to {formatDisplay(selectedWeek.thu)}
                    </th>
                    <th colSpan={4} style={{ ...thC, background:'#f0fdf4', color:'#15803d', borderRight:'2px solid #bbf7d0' }}>
                      🔧 INSTALLATION
                    </th>
                  </tr>
                  <tr>
                    <th style={thS}>Item Code</th>
                    <th style={{ ...thS, minWidth:180 }}>Item Name</th>
                    <th style={thS}>Unit</th>
                    <th style={{ ...thS, textAlign:'right', borderRight:'2px solid #e0ecff' }}>Planned Qty</th>
                    <th style={{ ...thR, background:'#e0f2fe' }}>Delivered to Date</th>
                    <th style={{ ...thR, background:'#e0f2fe', borderRight:'2px solid #bae6fd' }}>Delivery %</th>
                    <th style={{ ...thR, background:'#f0fdf4' }}>This Week</th>
                    <th style={{ ...thR, background:'#f0fdf4' }}>Last Week</th>
                    <th style={{ ...thR, background:'#f0fdf4' }}>Installed to Date</th>
                    <th style={{ ...thR, background:'#f0fdf4', borderRight:'2px solid #bbf7d0' }}>Install %</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([group, items]) => {
                    const gPlanned    = items.reduce((s,r) => s+(parseFloat(r.planned_qty)||0), 0);
                    const gDelToDate  = items.reduce((s,r) => s+(parseFloat(r.delivered_to_date)||0), 0);
                    const gInstThisW  = items.reduce((s,r) => s+(parseFloat(r.installed_this_week)||0), 0);
                    const gInstLastW  = items.reduce((s,r) => s+(parseFloat(r.installed_last_week)||0), 0);
                    const gInstToDate = items.reduce((s,r) => s+(parseFloat(r.installed_to_date)||0), 0);
                    return (
                      <>
                        {/* Classification group header */}
                        <tr key={`g-${group}`} style={{ background:'#ede9fe' }}>
                          <td colSpan={4} style={{ padding:'7px 12px', fontSize:11, fontWeight:700, color:'#7c3aed', letterSpacing:'0.04em', borderRight:'2px solid #e0ecff' }}>{group}</td>
                          <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'#0369a1', background:'#dbeafe' }}>{fmt2(gDelToDate)}</td>
                          <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'#0369a1', background:'#dbeafe', borderRight:'2px solid #bae6fd' }}>
                            {gPlanned > 0 ? `${((gDelToDate/gPlanned)*100).toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'#15803d', background:'#dcfce7' }}>{fmt2(gInstThisW)}</td>
                          <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, color:'#6b7280', background:'#dcfce7' }}>{fmt2(gInstLastW)}</td>
                          <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'#15803d', background:'#dcfce7' }}>{fmt2(gInstToDate)}</td>
                          <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, fontWeight:700, color:'#15803d', background:'#dcfce7', borderRight:'2px solid #bbf7d0' }}>
                            {gPlanned > 0 ? `${((gInstToDate/gPlanned)*100).toFixed(1)}%` : '—'}
                          </td>
                        </tr>

                        {items.map((row, idx) => {
                          const planned    = parseFloat(row.planned_qty) || 0;
                          const delToDate  = parseFloat(row.delivered_to_date) || 0;
                          const instThisW  = parseFloat(row.installed_this_week) || 0;
                          const instLastW  = parseFloat(row.installed_last_week) || 0;
                          const instToDate = parseFloat(row.installed_to_date) || 0;
                          const delPct     = planned > 0 ? (delToDate / planned) * 100 : 0;
                          const instPct    = planned > 0 ? (instToDate / planned) * 100 : 0;
                          const pctColor   = p => p >= 100 ? '#16a34a' : p >= 60 ? '#0369a1' : '#f59e0b';

                          return (
                            <tr key={row.item_id} style={{ borderBottom:'1px solid #f3f4f6', background: idx%2===0?'#fafbff':'#fff' }}>
                              <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{row.item_code}</td>
                              <td style={{ padding:'10px 12px', fontWeight:600, color:'#111827' }}>{row.item_name}</td>
                              <td style={{ padding:'10px 12px', fontSize:11, color:'#6b7280' }}>{row.unit_of_measure||'—'}</td>
                              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:600, color:'#111827', borderRight:'2px solid #e0ecff' }}>{fmt2(planned)}</td>

                              {/* Delivery columns */}
                              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:600, color:'#0369a1', background:'#f0f9ff' }}>{fmt2(delToDate)}</td>
                              <td style={{ padding:'10px 12px', borderRight:'2px solid #bae6fd', background:'#f0f9ff' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                  <div style={{ flex:1, height:5, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:40 }}>
                                    <div style={{ height:'100%', borderRadius:99, width:`${Math.min(100,delPct)}%`, background: pctColor(delPct) }} />
                                  </div>
                                  <span style={{ fontSize:11, fontWeight:700, color: pctColor(delPct), minWidth:36 }}>{delPct.toFixed(1)}%</span>
                                </div>
                              </td>

                              {/* Installation columns */}
                              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color: instThisW>0?'#15803d':'#9ca3af', background:'#f0fdf4' }}>
                                {instThisW > 0 ? fmt2(instThisW) : '—'}
                              </td>
                              <td style={{ padding:'10px 12px', textAlign:'right', color: instLastW>0?'#6b7280':'#d1d5db', background:'#f0fdf4' }}>
                                {instLastW > 0 ? fmt2(instLastW) : '—'}
                              </td>
                              <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:600, color:'#15803d', background:'#f0fdf4' }}>{fmt2(instToDate)}</td>
                              <td style={{ padding:'10px 12px', borderRight:'2px solid #bbf7d0', background:'#f0fdf4' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                  <div style={{ flex:1, height:5, background:'#e5e7eb', borderRadius:99, overflow:'hidden', minWidth:40 }}>
                                    <div style={{ height:'100%', borderRadius:99, width:`${Math.min(100,instPct)}%`, background: pctColor(instPct) }} />
                                  </div>
                                  <span style={{ fontSize:11, fontWeight:700, color: pctColor(instPct), minWidth:36 }}>{instPct.toFixed(1)}%</span>
                                </div>
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
                  <tr style={{ background:'#f0f7ff', borderTop:'2px solid #e0ecff' }}>
                    <td colSpan={3} style={{ padding:'11px 12px', fontWeight:700, fontSize:12, color:'#111827' }}>
                      TOTAL — {reportData.rows.length} items
                    </td>
                    <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:700, color:'#111827', borderRight:'2px solid #e0ecff' }}>{fmt2(totals.planned)}</td>
                    <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:700, color:'#0369a1', background:'#e0f2fe' }}>{fmt2(totals.delToDate)}</td>
                    <td style={{ padding:'11px 12px', borderRight:'2px solid #bae6fd', background:'#e0f2fe' }}>
                      <span style={{ fontWeight:700, color: totals.planned>0 ? (totals.delToDate/totals.planned>=1?'#16a34a':'#0369a1') : '#9ca3af' }}>
                        {totals.planned > 0 ? `${((totals.delToDate/totals.planned)*100).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                    <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:700, color:'#15803d', background:'#dcfce7' }}>{fmt2(totals.instThisW)}</td>
                    <td style={{ padding:'11px 12px', textAlign:'right', color:'#6b7280', background:'#dcfce7' }}>{fmt2(totals.instLastW)}</td>
                    <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:700, color:'#15803d', background:'#dcfce7' }}>{fmt2(totals.instToDate)}</td>
                    <td style={{ padding:'11px 12px', borderRight:'2px solid #bbf7d0', background:'#dcfce7' }}>
                      <span style={{ fontWeight:700, color: totals.planned>0 ? (totals.instToDate/totals.planned>=1?'#16a34a':'#15803d') : '#9ca3af' }}>
                        {totals.planned > 0 ? `${((totals.instToDate/totals.planned)*100).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}