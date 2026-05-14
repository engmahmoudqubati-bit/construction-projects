import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';


const reportDarkModeStyles = `
[data-theme="dark"] .cpms-report-darkable,
.dark .cpms-report-darkable,
body.dark .cpms-report-darkable {
  background: linear-gradient(180deg,#0f172a 0%,#111827 100%) !important;
  color: #e5e7eb !important;
}
[data-theme="dark"] .cpms-report-darkable div,
[data-theme="dark"] .cpms-report-darkable section,
.dark .cpms-report-darkable div,
.dark .cpms-report-darkable section,
body.dark .cpms-report-darkable div,
body.dark .cpms-report-darkable section {
  border-color: #334155 !important;
}
[data-theme="dark"] .cpms-report-darkable input,
[data-theme="dark"] .cpms-report-darkable select,
[data-theme="dark"] .cpms-report-darkable textarea,
.dark .cpms-report-darkable input,
.dark .cpms-report-darkable select,
.dark .cpms-report-darkable textarea,
body.dark .cpms-report-darkable input,
body.dark .cpms-report-darkable select,
body.dark .cpms-report-darkable textarea {
  background: #0b1220 !important;
  color: #e5e7eb !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .cpms-report-darkable input::placeholder,
.dark .cpms-report-darkable input::placeholder,
body.dark .cpms-report-darkable input::placeholder { color: #94a3b8 !important; }
[data-theme="dark"] .cpms-report-darkable button,
.dark .cpms-report-darkable button,
body.dark .cpms-report-darkable button {
  border-color: #334155 !important;
}
[data-theme="dark"] .cpms-report-darkable h1,
[data-theme="dark"] .cpms-report-darkable h2,
[data-theme="dark"] .cpms-report-darkable h3,
[data-theme="dark"] .cpms-report-darkable label,
.dark .cpms-report-darkable h1,
.dark .cpms-report-darkable h2,
.dark .cpms-report-darkable h3,
.dark .cpms-report-darkable label,
body.dark .cpms-report-darkable h1,
body.dark .cpms-report-darkable h2,
body.dark .cpms-report-darkable h3,
body.dark .cpms-report-darkable label { color: #f8fafc !important; }
[data-theme="dark"] .cpms-report-darkable p,
[data-theme="dark"] .cpms-report-darkable span,
.dark .cpms-report-darkable p,
.dark .cpms-report-darkable span,
body.dark .cpms-report-darkable p,
body.dark .cpms-report-darkable span { color: inherit; }
[data-theme="dark"] .cpms-report-darkable table,
.dark .cpms-report-darkable table,
body.dark .cpms-report-darkable table { background: #111827 !important; color:#e5e7eb !important; }
[data-theme="dark"] .cpms-report-darkable th,
.dark .cpms-report-darkable th,
body.dark .cpms-report-darkable th {
  background: linear-gradient(180deg,#1e293b 0%,#0f172a 100%) !important;
  color: #dbeafe !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .cpms-report-darkable td,
.dark .cpms-report-darkable td,
body.dark .cpms-report-darkable td {
  background: #111827 !important;
  color: #e5e7eb !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .cpms-report-darkable tr:nth-child(even) td,
.dark .cpms-report-darkable tr:nth-child(even) td,
body.dark .cpms-report-darkable tr:nth-child(even) td { background: #0f172a !important; }
[data-theme="dark"] .cpms-report-darkable [style*="background: rgb(255, 255, 255)"],
[data-theme="dark"] .cpms-report-darkable [style*="background:#fff"],
[data-theme="dark"] .cpms-report-darkable [style*="background: '#fff'"],
.dark .cpms-report-darkable [style*="background:#fff"],
body.dark .cpms-report-darkable [style*="background:#fff"] {
  background: #1e293b !important;
}
`;

function ReportDarkModeStyle() {
  return <style>{reportDarkModeStyles}</style>;
}

const fmt2 = v => (parseFloat(v) || 0).toFixed(2);

// ── Shared week helpers ───────────────────────────────────────────────────────
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
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function formatDate(ds) {
  if (!ds) return '';
  const [y,m,d] = ds.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function dayName(ds) {
  const [y,m,d] = ds.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('en-GB',{weekday:'short'});
}
function generateWeeks(firstDateStr, lastDateStr) {
  if (!firstDateStr) return [];
  const last = lastDateStr ? new Date(...lastDateStr.split('-').map((v,i)=>i===1?Number(v)-1:Number(v))) : new Date();
  let sat = getWeekSaturday(firstDateStr);
  const weeks = []; let wn = 1;
  while (sat <= last) {
    const thu = addDays(sat, 5);
    weeks.push({ weekNum:wn++, sat:toISO(sat), thu:toISO(thu), label:`Week ${wn-1} — ${formatDate(toISO(sat))} → ${formatDate(toISO(thu))}` });
    sat = addDays(sat, 7);
  }
  return weeks;
}

function getInstallationDateRangeFromMap(mapData) {
  const confirmedDates = (mapData?.txs || [])
    .filter(t => (t.tx_status || '').toLowerCase() === 'confirmed' && t.transaction_date)
    .map(t => String(t.transaction_date).slice(0,10))
    .sort();
  if (!confirmedDates.length) return { first: null, last: null };
  return { first: confirmedDates[0], last: confirmedDates[confirmedDates.length - 1] };
}
function weekDays(satStr) {
  const days = [];
  for (let i = 0; i <= 5; i++) {
    const d = addDays(new Date(satStr+'T00:00:00'), i);
    const iso = toISO(d);
    days.push({ iso, label:formatDate(iso), day:dayName(iso) });
  }
  return days;
}
function buildQtyMap(daily) {
  const map = {};
  daily.forEach(d => {
    if (!map[d.item_id]) map[d.item_id] = {};
    map[d.item_id][d.transaction_date] = parseFloat(d.qty_installed)||0;
  });
  return map;
}

// ── Week Filter Bar ───────────────────────────────────────────────────────────
function FilterShell({ title, subtitle, children, right }) {
  return (
    <div style={{
      background:'#fff', border:'1px solid #bfdbfe', borderRadius:16, overflow:'hidden',
      boxShadow:'0 10px 26px rgba(15,23,42,0.06)', marginBottom:14
    }}>
      <div style={{
        minHeight:42, padding:'9px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
        background:'linear-gradient(180deg,#f8fbff 0%,#eff6ff 100%)', borderBottom:'1px solid #bfdbfe'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <div style={{ width:30, height:30, borderRadius:9, background:'#1d4ed8', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, boxShadow:'0 8px 18px rgba(29,78,216,0.18)' }}>⚙️</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:900, color:'#0f172a', lineHeight:1.1 }}>{title}</div>
            <div style={{ fontSize:11, color:'#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:2 }}>{subtitle}</div>
          </div>
        </div>
        {right}
      </div>
      <div style={{ padding:12, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))', gap:10, alignItems:'end' }}>
        {children}
      </div>
    </div>
  );
}

function FilterField({ label, span=3, children }) {
  return (
    <div style={{ gridColumn: span >= 12 ? '1 / -1' : 'auto', minWidth:0 }}>
      <label style={{ display:'block', fontSize:10, fontWeight:900, color:'#334155', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}

function ClearableInput({ value, onChange, placeholder, style }) {
  return (
    <div style={{ position:'relative' }}>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ ...style, width:'100%' }} />
    </div>
  );
}

// ── Week Filter Bar ───────────────────────────────────────────────────────────
function WeekFilter({ projects, projectId, setProjectId, weekNum, setWeekNum, weeks, years, months, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, weekInput, setWeekInput, selectedWeek, fSel, search, setSearch }) {
  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');
  const monthName = m => new Date(`2000-${m}-01`).toLocaleDateString('en-GB',{month:'long'});
  const filteredWeeks = useMemo(() => {
    let ws = weeks;
    if (selectedYear)  ws = ws.filter(w => w.sat.startsWith(selectedYear)||w.thu.startsWith(selectedYear));
    if (selectedMonth) ws = ws.filter(w => w.sat.slice(0,7)===`${selectedYear}-${selectedMonth}`||w.thu.slice(0,7)===`${selectedYear}-${selectedMonth}`);
    return ws;
  }, [weeks, selectedYear, selectedMonth]);

  const resetFilters = () => {
    setSelectedYear(''); setSelectedMonth(''); setWeekNum(''); setWeekInput(''); setSearch?.('');
  };

  return (
    <FilterShell
      title="Productivity Filters"
      subtitle="Installation-style filters: project, installation period, selected week and smart search above the report."
      right={selectedWeek ? <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1d4ed8', borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:800, whiteSpace:'nowrap' }}>Week {selectedWeek.weekNum}: {formatDate(selectedWeek.sat)} → {formatDate(selectedWeek.thu)}</div> : null}
    >
      <FilterField label="Select Project" span={4}>
        <div style={{ position:'relative' }}>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...fSel, width:'100%' }}>
            <option value="">— Select Project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
      </FilterField>

      <FilterField label="Year" span={1}>
        <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedMonth(''); setWeekNum(''); setWeekInput(''); }} style={{ ...fSel, width:'100%' }} disabled={!years.length}>
          <option value="">All</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </FilterField>

      <FilterField label="Month" span={2}>
        <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setWeekNum(''); setWeekInput(''); }} style={{ ...fSel, width:'100%' }} disabled={!selectedYear || !months.length}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
        </select>
      </FilterField>

      <FilterField label={`Week No. ${weeks.length ? `(1-${weeks.length})` : ''}`} span={1}>
        <input type="number" min={1} max={weeks.length || 1} value={weekInput} placeholder="#"
          onChange={e => { const n=parseInt(e.target.value); setWeekInput(e.target.value); if(!isNaN(n)&&weeks.find(w=>w.weekNum===n)) setWeekNum(String(n)); }}
          style={{ ...fSel, width:'100%', fontWeight:800, textAlign:'center' }} disabled={!weeks.length} />
      </FilterField>

      <FilterField label="Select Week" span={2}>
        <select value={weekNum} onChange={e => { setWeekNum(e.target.value); setWeekInput(e.target.value); }} style={{ ...fSel, width:'100%' }} disabled={!filteredWeeks.length}>
          <option value="">— Select —</option>
          {filteredWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>W{w.weekNum}: {formatDate(w.sat)} → {formatDate(w.thu)}</option>)}
        </select>
      </FilterField>

      <FilterField label="Smart Search" span={2}>
        <ClearableInput value={search||''} onChange={setSearch} placeholder="Item, code, classification..." style={fSel} />
      </FilterField>

      <div style={{ gridColumn:'span 12', display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:2, gap:10 }}>
        <div style={{ fontSize:11, color:'#64748b' }}>
          Search includes item code, item name, classification and parent classification.
        </div>
        <button type="button" onClick={resetFilters} style={{ border:'1px solid #bfdbfe', background:'#eff6ff', color:'#1d4ed8', borderRadius:10, padding:'8px 12px', fontSize:12, fontWeight:800, cursor:'pointer' }}>Clear Filters</button>
      </div>
    </FilterShell>
  );
}

// ── Single Week Productivity Table ────────────────────────────────────────────
function ProductivityTable({ items, daily, selectedWeek, search }) {
  if (!items?.length || !selectedWeek) return null;
  const days = weekDays(selectedWeek.sat);
  const qtyMap = buildQtyMap(daily);

  let activeItems = items.filter(item => days.some(d => (qtyMap[item.item_id]?.[d.iso]||0) > 0));
  if (search?.trim()) {
    const q = search.toLowerCase();
    activeItems = activeItems.filter(i =>
      (i.item_name||'').toLowerCase().includes(q) ||
      (i.item_code||'').toLowerCase().includes(q) ||
      (i.classification_name||'').toLowerCase().includes(q) ||
      (i.parent_classification_name||'').toLowerCase().includes(q)
    );
  }

  const grouped = activeItems.reduce((acc, item) => {
    const key = item.parent_classification_name
      ? `${item.parent_classification_name} › ${item.classification_name||''}`
      : item.classification_name || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const dayTotals = days.map(d => activeItems.reduce((s,i) => s+(qtyMap[i.item_id]?.[d.iso]||0), 0));
  const grandTotal = dayTotals.reduce((s,v)=>s+v,0);

  const th = { background:'#eff6ff', color:'#1e3a8a', fontWeight:800, fontSize:11, padding:'10px 12px',
    borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap', letterSpacing:'0.04em', textAlign:'center', textTransform:'uppercase' };
  const td = { padding:'10px 12px', verticalAlign:'middle', textAlign:'center', fontSize:12 };

  if (activeItems.length === 0)
    return <div style={{ textAlign:'center', padding:'32px 0', color:'#9ca3af', fontSize:13 }}>No confirmed installation entries{search?' matching search':' for this week'}</div>;

  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', minWidth:400+days.length*115, borderCollapse:'collapse', fontSize:12, tableLayout:'fixed' }}>
        <colgroup>
          <col style={{ width:75 }} /><col style={{ width:160 }} /><col style={{ width:50 }} />
          {days.map(d => <col key={d.iso} style={{ width:115 }} />)}
          <col style={{ width:95 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...th, textAlign:'left' }}>Code</th>
            <th style={{ ...th, textAlign:'left' }}>Item Name</th>
            <th style={th}>Unit</th>
            {days.map(d => (
              <th key={d.iso} style={{ ...th, background:'#dbeafe', color:'#1d4ed8', borderLeft:'1px solid #bfdbfe' }}>
                <div style={{ fontSize:11, fontWeight:700 }}>{d.label}</div>
                <div style={{ fontSize:10, fontWeight:500, color:'#9ca3af', marginTop:2 }}>{d.day}</div>
              </th>
            ))}
            <th style={{ ...th, background:'#eff6ff', color:'#2563eb', borderLeft:'2px solid #bfdbfe' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped).map(([group, groupItems]) => {
            const gDayTotals = days.map(d => groupItems.reduce((s,i)=>s+(qtyMap[i.item_id]?.[d.iso]||0),0));
            const gTotal = gDayTotals.reduce((s,v)=>s+v,0);
            return (
              <>
                <tr key={`g-${group}`} style={{ background:'#eff6ff' }}>
                  <td colSpan={3} style={{ padding:'7px 12px', fontSize:11, fontWeight:700, color:'#2563eb' }}>{group}</td>
                  {gDayTotals.map((gt,i) => (
                    <td key={i} style={{ padding:'7px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:gt>0?'#2563eb':'#bfdbfe', borderLeft:'1px solid #eff6ff' }}>
                      {gt > 0 ? fmt2(gt) : '—'}
                    </td>
                  ))}
                  <td style={{ padding:'7px 12px', textAlign:'center', fontWeight:700, fontSize:11, color:'#2563eb', background:'#eff6ff', borderLeft:'2px solid #bfdbfe' }}>{fmt2(gTotal)}</td>
                </tr>
                {groupItems.map((item, idx) => {
                  const qtys = days.map(d => qtyMap[item.item_id]?.[d.iso]||0);
                  const itemTotal = qtys.reduce((s,v)=>s+v,0);
                  return (
                    <tr key={item.item_id} style={{ borderBottom:'1px solid #f3f4f6', background:idx%2===0?'#fafbff':'#fff' }}>
                      <td style={{ ...td, textAlign:'left', fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{item.item_code}</td>
                      <td style={{ ...td, textAlign:'left', fontWeight:600, color:'#111827' }}>{item.item_name}</td>
                      <td style={{ ...td, color:'#9ca3af', fontSize:11 }}>{item.unit_of_measure||'—'}</td>
                      {qtys.map((qty,i) => (
                        <td key={i} style={{ ...td, borderLeft:'1px solid #f3f4f6', background:qty>0?'#f8fafc':'transparent' }}>
                          {qty > 0
                            ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                                <div style={{ fontWeight:800, color:'#1d4ed8', fontSize:13 }}>{fmt2(qty)}</div>
                                <div style={{ fontSize:10, fontWeight:800, color:'#2563eb', background:'#dbeafe', border:'1px solid #bfdbfe', borderRadius:999, padding:'1px 7px' }}>
                                  {grandTotal > 0 ? ((qty / grandTotal) * 100).toFixed(1) : '0.0'}%
                                </div>
                                <div style={{ height:3, background:'#e2e8f0', borderRadius:99, overflow:'hidden', marginTop:1, width:'72%' }}>
                                  <div style={{ height:'100%', width:`${grandTotal > 0 ? Math.min(100,(qty/grandTotal)*100) : 0}%`, background:'#2563eb', borderRadius:99 }} />
                                </div>
                              </div>
                            : <span style={{ color:'#cbd5e1', fontSize:15 }}>·</span>}
                        </td>
                      ))}
                      <td style={{ ...td, fontWeight:700, color:'#2563eb', background:'#eff6ff', borderLeft:'2px solid #bfdbfe', fontSize:13 }}>
                        {itemTotal > 0 ? <div><div>{fmt2(itemTotal)}</div><div style={{ fontSize:10, color:'#1d4ed8', marginTop:2 }}>{grandTotal > 0 ? ((itemTotal / grandTotal) * 100).toFixed(1) : '0.0'}%</div></div> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop:'2px solid #dbeafe', background:'#f8fafc' }}>
            <td colSpan={3} style={{ padding:'11px 12px', fontWeight:700, fontSize:12, color:'#374151' }}>Daily Total ({activeItems.length} items)</td>
            {dayTotals.map((total,i) => (
              <td key={i} style={{ padding:'11px 12px', textAlign:'center', fontWeight:700, color:total>0?'#2563eb':'#93c5fd', fontSize:13, borderLeft:'1px solid #dbeafe' }}>
                {total > 0 ? fmt2(total) : '—'}
              </td>
            ))}
            <td style={{ padding:'11px 12px', textAlign:'center', fontWeight:700, color:'#2563eb', background:'#eff6ff', fontSize:14, borderLeft:'2px solid #bfdbfe' }}>{fmt2(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Side-by-Side Comparison Table ───────────────────────────────────────────
function CompareTable({ dataA, dataB, weekA, weekB, search }) {
  if (!dataA || !dataB || !weekA || !weekB) return null;

  const daysA = weekDays(weekA.sat);
  const daysB = weekDays(weekB.sat);
  const qA = buildQtyMap(dataA.daily);
  const qB = buildQtyMap(dataB.daily);

  const allItems = dataA.items.filter(item =>
    daysA.some(d=>(qA[item.item_id]?.[d.iso]||0)>0) ||
    daysB.some(d=>(qB[item.item_id]?.[d.iso]||0)>0)
  );

  let filtered = allItems;
  if (search?.trim()) {
    const q = search.toLowerCase();
    filtered = allItems.filter(i =>
      (i.item_name||'').toLowerCase().includes(q) ||
      (i.item_code||'').toLowerCase().includes(q) ||
      (i.classification_name||'').toLowerCase().includes(q) ||
      (i.parent_classification_name||'').toLowerCase().includes(q)
    );
  }

  const grouped = filtered.reduce((acc, item) => {
    const key = item.parent_classification_name
      ? `${item.parent_classification_name} › ${item.classification_name||''}`
      : item.classification_name || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const totalA = dataA.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
  const totalB = dataB.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
  const dc = d => d>0?'#16a34a':d<0?'#dc2626':'#9ca3af';
  const di = d => d>0?'▲':d<0?'▼':'—';

  if (filtered.length === 0)
    return <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af' }}>No items found</div>;

  // Colours — light palette
  const CLR = {
    wA:      '#1d4ed8', wAbg:   '#eff6ff', wAborder:'#93c5fd',
    wB:      '#c2410c', wBbg:   '#fff7ed', wBborder:'#fdba74',
    head:    '#f8fafc', headBorder:'#bfdbfe',
    grp:     '#eef6ff', grpText:'#1d4ed8',
    totA:    '#eff6ff', totB:   '#fffbeb',
    delta:   '#f0fdf4', foot:   '#f8fbff',
  };

  // Fixed column widths to keep table on screen
  // Code(60) + Name(160) + Unit(45) + 6 days × (W1 col 62 + W2 col 62 + divider) + TotA(70) + TotB(70) + Δ(65)
  // Each day = 2 sub-cols of 60px each = 120px per day → 6 days = 720
  // Total ≈ 60+160+45+720+70+70+65 = 1190 — acceptable, fits 1280px screen

  const subColW = 60; // px per W1 / W2 sub-column

  const thBase  = { background:CLR.head, color:'#374151', fontWeight:700, fontSize:11,
    padding:'8px 6px', borderBottom:`2px solid ${CLR.headBorder}`, textAlign:'center', whiteSpace:'nowrap' };
  const tdBase  = { padding:'8px 6px', verticalAlign:'middle', textAlign:'center', fontSize:12 };
  const numA    = (v) => v>0 ? <span style={{ fontWeight:700, color:CLR.wA }}>{fmt2(v)}</span> : <span style={{ color:'#e5e7eb' }}>·</span>;
  const numB    = (v) => v>0 ? <span style={{ fontWeight:700, color:CLR.wB }}>{fmt2(v)}</span> : <span style={{ color:'#e5e7eb' }}>·</span>;

  return (
    <div>
      {/* Legend */}
      <div style={{ display:'flex', gap:20, padding:'9px 16px', background:'#f8faff', borderBottom:`1px solid ${CLR.headBorder}`, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:10, height:10, borderRadius:2, background:CLR.wA, display:'inline-block' }} />
          <span style={{ fontSize:12, fontWeight:700, color:CLR.wA }}>W{weekA.weekNum}</span>
          <span style={{ fontSize:11, color:'#9ca3af' }}>{formatDate(weekA.sat)} – {formatDate(weekA.thu)}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:10, height:10, borderRadius:2, background:CLR.wB, display:'inline-block' }} />
          <span style={{ fontSize:12, fontWeight:700, color:CLR.wB }}>W{weekB.weekNum}</span>
          <span style={{ fontSize:11, color:'#9ca3af' }}>{formatDate(weekB.sat)} – {formatDate(weekB.thu)}</span>
        </div>
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', fontSize:12, tableLayout:'fixed', width:'100%', minWidth:1050 }}>
          <colgroup>
            <col style={{ width:60 }} />
            <col style={{ width:160 }} />
            <col style={{ width:45 }} />
            {daysA.map((_,i) => <col key={`a${i}`} style={{ width:subColW }} />)}
            {daysA.map((_,i) => <col key={`b${i}`} style={{ width:subColW }} />)}
            <col style={{ width:68 }} />
            <col style={{ width:68 }} />
            <col style={{ width:65 }} />
          </colgroup>
          <thead>
            {/* Row 1 — day names spanning W1+W2 */}
            <tr>
              <th colSpan={3} style={{ ...thBase, textAlign:'left', borderRight:`1px solid ${CLR.headBorder}` }}></th>
              {daysA.map((dA, i) => (
                <th key={dA.iso} colSpan={2} style={{ ...thBase, borderLeft:`1px solid ${CLR.headBorder}`,
                  background: i%2===0?'#eff6ff':'#f0f9ff', color:'#1e40af', fontSize:13, fontWeight:800, padding:'7px 4px' }}>
                  {dA.day}
                </th>
              ))}
              <th style={{ ...thBase, background:CLR.wAbg, color:CLR.wA, borderLeft:`2px solid ${CLR.wAborder}` }}>Total</th>
              <th style={{ ...thBase, background:CLR.wBbg, color:CLR.wB, borderLeft:`1px solid ${CLR.wBborder}` }}>Total</th>
              <th style={{ ...thBase, background:'#fff7ed', color:'#c2410c', borderLeft:'2px solid #fde68a' }}>Δ</th>
            </tr>
            {/* Row 2 — W1 / W2 labels */}
            <tr>
              <th style={{ ...thBase, textAlign:'left', fontSize:10, color:'#6b7280' }}>Code</th>
              <th style={{ ...thBase, textAlign:'left', fontSize:10, color:'#6b7280' }}>Item Name</th>
              <th style={{ ...thBase, fontSize:10, color:'#6b7280' }}>Unit</th>
              {daysA.map((dA, i) => (
                <>
                  <th key={`h1-${i}`} style={{ ...thBase, background:CLR.wAbg, color:CLR.wA, fontSize:10,
                    borderLeft:`1px solid ${CLR.wAborder}`, padding:'5px 4px' }}>
                    W{weekA.weekNum}
                  </th>
                  <th key={`h2-${i}`} style={{ ...thBase, background:CLR.wBbg, color:CLR.wB, fontSize:10,
                    borderLeft:`1px solid ${CLR.wBborder}`, borderRight: i===5?`2px solid ${CLR.wAborder}`:'none', padding:'5px 4px' }}>
                    W{weekB.weekNum}
                  </th>
                </>
              ))}
              <th style={{ ...thBase, background:CLR.wAbg, color:CLR.wA, fontSize:10, borderLeft:`2px solid ${CLR.wAborder}` }}>W{weekA.weekNum}</th>
              <th style={{ ...thBase, background:CLR.wBbg, color:CLR.wB, fontSize:10, borderLeft:`1px solid ${CLR.wBborder}` }}>W{weekB.weekNum}</th>
              <th style={{ ...thBase, background:'#fff7ed', color:'#c2410c', fontSize:10, borderLeft:'2px solid #fde68a' }}>W{weekB.weekNum}−W{weekA.weekNum}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([group, groupItems]) => {
              const gA = groupItems.reduce((s,i)=>s+daysA.reduce((ss,d)=>ss+(qA[i.item_id]?.[d.iso]||0),0),0);
              const gB = groupItems.reduce((s,i)=>s+daysB.reduce((ss,d)=>ss+(qB[i.item_id]?.[d.iso]||0),0),0);
              return (
                <>
                  <tr key={`g-${group}`} style={{ background:CLR.grp }}>
                    <td colSpan={3} style={{ padding:'7px 10px', fontSize:11, fontWeight:700, color:CLR.grpText }}>{group}</td>
                    {daysA.map((dA, i) => {
                      const dB = daysB[i];
                      const a = groupItems.reduce((s,it)=>s+(qA[it.item_id]?.[dA.iso]||0),0);
                      const b = groupItems.reduce((s,it)=>s+(qB[it.item_id]?.[dB.iso]||0),0);
                      return (
                        <>
                          <td key={`ga-${i}`} style={{ ...tdBase, background:CLR.wAbg, borderLeft:`1px solid ${CLR.wAborder}` }}>{numA(a)}</td>
                          <td key={`gb-${i}`} style={{ ...tdBase, background:CLR.wBbg, borderLeft:`1px solid ${CLR.wBborder}` }}>{numB(b)}</td>
                        </>
                      );
                    })}
                    <td style={{ ...tdBase, background:CLR.totA, fontWeight:700, color:CLR.wA, borderLeft:`2px solid ${CLR.wAborder}` }}>{fmt2(gA)}</td>
                    <td style={{ ...tdBase, background:CLR.totB, fontWeight:700, color:CLR.wB, borderLeft:`1px solid ${CLR.wBborder}` }}>{fmt2(gB)}</td>
                    <td style={{ ...tdBase, background:CLR.delta, fontWeight:700, color:dc(gB-gA), borderLeft:'2px solid #fde68a' }}>
                      {gB-gA!==0?`${di(gB-gA)} ${Math.abs(gB-gA).toFixed(1)}`:'='}
                    </td>
                  </tr>
                  {groupItems.map((item, idx) => {
                    const tA = daysA.reduce((s,d)=>s+(qA[item.item_id]?.[d.iso]||0),0);
                    const tB = daysB.reduce((s,d)=>s+(qB[item.item_id]?.[d.iso]||0),0);
                    const delta = tB - tA;
                    return (
                      <tr key={item.item_id} style={{ borderBottom:`1px solid #f3f4f6`, background:idx%2===0?'#fafbff':'#fff' }}>
                        <td style={{ ...tdBase, textAlign:'left', fontFamily:'monospace', fontSize:10, color:'#6b7280' }}>{item.item_code}</td>
                        <td style={{ ...tdBase, textAlign:'left', fontWeight:600, color:'#111827' }}>{item.item_name}</td>
                        <td style={{ ...tdBase, color:'#9ca3af', fontSize:10 }}>{item.unit_of_measure||'—'}</td>
                        {daysA.map((dA, i) => {
                          const dB = daysB[i];
                          const vA = qA[item.item_id]?.[dA.iso]||0;
                          const vB = qB[item.item_id]?.[dB.iso]||0;
                          return (
                            <>
                              <td key={`ia-${i}`} style={{ ...tdBase, background:vA>0?CLR.wAbg:'transparent', borderLeft:`1px solid ${vA>0?CLR.wAborder:'#f3f4f6'}` }}>{numA(vA)}</td>
                              <td key={`ib-${i}`} style={{ ...tdBase, background:vB>0?CLR.wBbg:'transparent', borderLeft:`1px solid ${vB>0?CLR.wBborder:'#f3f4f6'}` }}>{numB(vB)}</td>
                            </>
                          );
                        })}
                        <td style={{ ...tdBase, fontWeight:700, color:CLR.wA, background:CLR.totA, borderLeft:`2px solid ${CLR.wAborder}` }}>{tA>0?fmt2(tA):'—'}</td>
                        <td style={{ ...tdBase, fontWeight:700, color:CLR.wB, background:CLR.totB, borderLeft:`1px solid ${CLR.wBborder}` }}>{tB>0?fmt2(tB):'—'}</td>
                        <td style={{ ...tdBase, fontWeight:700, color:dc(delta),
                          background:delta>0?'#f0fdf4':delta<0?'#fef2f2':CLR.delta,
                          borderLeft:'2px solid #fde68a', fontSize:12 }}>
                          {delta!==0?`${di(delta)} ${Math.abs(delta).toFixed(1)}`:<span style={{ color:'#d1d5db' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background:'#f8fafc', borderTop:`2px solid ${CLR.headBorder}` }}>
              <td colSpan={3} style={{ padding:'10px 12px', fontWeight:700, color:'#374151', fontSize:12 }}>Grand Total</td>
              {daysA.map((dA, i) => {
                const dB = daysB[i];
                const tA = filtered.reduce((s,it)=>s+(qA[it.item_id]?.[dA.iso]||0),0);
                const tB = filtered.reduce((s,it)=>s+(qB[it.item_id]?.[dB.iso]||0),0);
                return (
                  <>
                    <td key={`fa-${i}`} style={{ ...tdBase, background:CLR.wAbg, fontWeight:700, color:CLR.wA, borderLeft:`1px solid ${CLR.wAborder}` }}>{tA>0?fmt2(tA):'—'}</td>
                    <td key={`fb-${i}`} style={{ ...tdBase, background:CLR.wBbg, fontWeight:700, color:CLR.wB, borderLeft:`1px solid ${CLR.wBborder}` }}>{tB>0?fmt2(tB):'—'}</td>
                  </>
                );
              })}
              <td style={{ ...tdBase, fontWeight:700, color:CLR.wA, background:CLR.totA, borderLeft:`2px solid ${CLR.wAborder}`, fontSize:13 }}>{fmt2(totalA)}</td>
              <td style={{ ...tdBase, fontWeight:700, color:CLR.wB, background:CLR.totB, borderLeft:`1px solid ${CLR.wBborder}`, fontSize:13 }}>{fmt2(totalB)}</td>
              <td style={{ ...tdBase, fontWeight:700, color:dc(totalB-totalA), background:CLR.delta, borderLeft:'2px solid #fde68a', fontSize:13 }}>
                {totalB-totalA!==0?`${di(totalB-totalA)} ${Math.abs(totalB-totalA).toFixed(1)}`:'='}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


// ── Smart Analytics Panel (pure JS — no API cost) ────────────────────────────
function analyzeWeeks(dataA, dataB, weekA, weekB) {
  const daysA = weekDays(weekA.sat);
  const daysB = weekDays(weekB.sat);
  const qA = buildQtyMap(dataA.daily);
  const qB = buildQtyMap(dataB.daily);

  const totalA = dataA.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
  const totalB = dataB.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
  const delta  = totalB - totalA;
  const deltaPct = totalA > 0 ? ((delta/totalA)*100) : 0;

  // Day totals for each week
  const dayTotalsA = daysA.map(d => ({ day:d.day, date:d.label, total: dataA.items.reduce((s,i)=>s+(qA[i.item_id]?.[d.iso]||0),0) }));
  const dayTotalsB = daysB.map(d => ({ day:d.day, date:d.label, total: dataB.items.reduce((s,i)=>s+(qB[i.item_id]?.[d.iso]||0),0) }));

  const bestDayA  = dayTotalsA.reduce((a,b)=>b.total>a.total?b:a, dayTotalsA[0]);
  const worstDayA = dayTotalsA.filter(d=>d.total>0).reduce((a,b)=>b.total<a.total?b:a, dayTotalsA[0]);
  const bestDayB  = dayTotalsB.reduce((a,b)=>b.total>a.total?b:a, dayTotalsB[0]);
  const worstDayB = dayTotalsB.filter(d=>d.total>0).reduce((a,b)=>b.total<a.total?b:a, dayTotalsB[0]);

  // Active days (days with any installation)
  const activeDaysA = dayTotalsA.filter(d=>d.total>0).length;
  const activeDaysB = dayTotalsB.filter(d=>d.total>0).length;

  // Day-by-day comparison
  const dayPairs = daysA.map((dA,i) => {
    const dB = daysB[i];
    const tA = dayTotalsA[i].total;
    const tB = dayTotalsB[i].total;
    return { day:dA.day, tA, tB, delta:tB-tA };
  });

  // Item comparison
  const itemStats = dataA.items.map(item => {
    const a = daysA.reduce((s,d)=>s+(qA[item.item_id]?.[d.iso]||0),0);
    const b = daysB.reduce((s,d)=>s+(qB[item.item_id]?.[d.iso]||0),0);
    return { name:item.item_name, unit:item.unit_of_measure||'', a, b, delta:b-a, pct: a>0?((b-a)/a*100):null };
  }).filter(i=>i.a>0||i.b>0);

  const improved  = [...itemStats].filter(i=>i.delta>0).sort((a,b)=>b.delta-a.delta);
  const declined  = [...itemStats].filter(i=>i.delta<0).sort((a,b)=>a.delta-b.delta);
  const newItems  = itemStats.filter(i=>i.a===0&&i.b>0);
  const stoppedItems = itemStats.filter(i=>i.a>0&&i.b===0);

  // Avg daily rate
  const avgDayA = activeDaysA > 0 ? totalA/activeDaysA : 0;
  const avgDayB = activeDaysB > 0 ? totalB/activeDaysB : 0;

  // Consistency score (std deviation of active days)
  const activeA = dayTotalsA.filter(d=>d.total>0).map(d=>d.total);
  const activeB = dayTotalsB.filter(d=>d.total>0).map(d=>d.total);
  const stdDev = arr => { if(arr.length<2) return 0; const m=arr.reduce((s,v)=>s+v,0)/arr.length; return Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/arr.length); };
  const sdA = stdDev(activeA), sdB = stdDev(activeB);
  const cvA = avgDayA>0?sdA/avgDayA:0, cvB = avgDayB>0?sdB/avgDayB:0;

  return { totalA, totalB, delta, deltaPct, bestDayA, worstDayA, bestDayB, worstDayB,
    activeDaysA, activeDaysB, avgDayA, avgDayB, dayPairs, itemStats, improved, declined,
    newItems, stoppedItems, cvA, cvB };
}

function SmartInsights({ dataA, dataB, weekA, weekB }) {
  if (!dataA || !dataB || !weekA || !weekB) return null;

  const r = analyzeWeeks(dataA, dataB, weekA, weekB);
  const fmt = v => (parseFloat(v)||0).toFixed(2);
  const pct  = v => `${v>=0?'+':''}${v.toFixed(1)}%`;
  const trend = v => v > 0 ? '📈' : v < 0 ? '📉' : '➡️';
  const tColor = v => v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#6b7280';
  const tBg    = v => v > 0 ? '#f0fdf4' : v < 0 ? '#fef2f2' : '#f9fafb';
  const tBorder= v => v > 0 ? '#bbf7d0' : v < 0 ? '#fecaca' : '#e5e7eb';

  // Overall verdict
  const verdict = r.deltaPct >= 20 ? 'Strong Improvement' : r.deltaPct >= 5 ? 'Moderate Improvement'
    : r.deltaPct >= -5 ? 'Stable Performance' : r.deltaPct >= -20 ? 'Slight Decline' : 'Significant Decline';
  const verdictIcon = r.deltaPct >= 5 ? '🟢' : r.deltaPct >= -5 ? '🟡' : '🔴';

  const Card = ({ icon, title, children, accent='#2563eb' }) => (
    <div style={{ background:'var(--card)', border:`1px solid ${accent}22`, borderRadius:12,
      padding:'14px 16px', borderLeft:`3px solid ${accent}` }}>
      <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em',
        color:accent, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  );

  const Row = ({ label, valA, valB, delta, unit='' }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #f3f4f6', fontSize:12 }}>
      <span style={{ color:'#6b7280', flex:1 }}>{label}</span>
      <span style={{ color:'#2563eb', fontWeight:600, minWidth:60, textAlign:'right' }}>{valA}{unit}</span>
      <span style={{ color:'#9ca3af', margin:'0 8px' }}>→</span>
      <span style={{ color:'#0369a1', fontWeight:600, minWidth:60, textAlign:'right' }}>{valB}{unit}</span>
      {delta !== undefined && (
        <span style={{ color:tColor(delta), fontWeight:700, minWidth:64, textAlign:'right', fontSize:11 }}>
          {delta>0?'▲':delta<0?'▼':'='} {Math.abs(delta).toFixed(2)}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ marginTop:20, borderRadius:14, overflow:'hidden', border:'1.5px solid #2563eb' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1d4ed8 0%,#2563eb 100%)', padding:'14px 20px', display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:22 }}>📊</span>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>Productivity Analysis</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)' }}>
            Week {weekA.weekNum} vs Week {weekB.weekNum} — Auto-generated from your data
          </div>
        </div>
      </div>

      <div style={{ padding:'16px', background:'var(--card)', display:'flex', flexDirection:'column', gap:12 }}>

        {/* Verdict banner */}
        <div style={{ background:tBg(r.delta), border:`1.5px solid ${tBorder(r.delta)}`, borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:24 }}>{verdictIcon}</span>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:tColor(r.delta) }}>{verdict}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
              Week {weekA.weekNum}: <strong>{fmt(r.totalA)}</strong> installed &nbsp;→&nbsp;
              Week {weekB.weekNum}: <strong>{fmt(r.totalB)}</strong> installed &nbsp;
              <span style={{ color:tColor(r.delta), fontWeight:700 }}>
                ({r.delta>=0?'+':''}{fmt(r.delta)}, {pct(r.deltaPct)})
              </span>
            </div>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {/* Key metrics */}
          <Card icon="📋" title="Key Metrics" accent="#2563eb">
            <Row label="Total Installed" valA={fmt(r.totalA)} valB={fmt(r.totalB)} delta={r.delta} />
            <Row label="Active Work Days" valA={r.activeDaysA} valB={r.activeDaysB} delta={r.activeDaysB-r.activeDaysA} />
            <Row label="Avg per Active Day" valA={fmt(r.avgDayA)} valB={fmt(r.avgDayB)} delta={r.avgDayB-r.avgDayA} />
            <Row label="Consistency (CV)" valA={`${(r.cvA*100).toFixed(0)}%`} valB={`${(r.cvB*100).toFixed(0)}%`}
              delta={r.cvA-r.cvB} />
            <div style={{ fontSize:10, color:'#9ca3af', marginTop:6 }}>
              * Lower CV = more consistent daily output
            </div>
          </Card>

          {/* Best/worst days */}
          <Card icon="📅" title="Daily Performance" accent="#0369a1">
            <div style={{ fontSize:11, color:'#6b7280', marginBottom:6 }}>Week {weekA.weekNum}</div>
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <div style={{ flex:1, background:'#f0fdf4', borderRadius:8, padding:'7px 10px' }}>
                <div style={{ fontSize:9, color:'#16a34a', fontWeight:700, textTransform:'uppercase' }}>Best Day</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#111827', marginTop:2 }}>{r.bestDayA?.day}</div>
                <div style={{ fontSize:11, color:'#16a34a' }}>{fmt(r.bestDayA?.total||0)}</div>
              </div>
              <div style={{ flex:1, background:'#fff7ed', borderRadius:8, padding:'7px 10px' }}>
                <div style={{ fontSize:9, color:'#ea580c', fontWeight:700, textTransform:'uppercase' }}>Lowest Day</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#111827', marginTop:2 }}>{r.worstDayA?.day||'—'}</div>
                <div style={{ fontSize:11, color:'#ea580c' }}>{fmt(r.worstDayA?.total||0)}</div>
              </div>
            </div>
            <div style={{ fontSize:11, color:'#6b7280', marginBottom:6 }}>Week {weekB.weekNum}</div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1, background:'#f0fdf4', borderRadius:8, padding:'7px 10px' }}>
                <div style={{ fontSize:9, color:'#16a34a', fontWeight:700, textTransform:'uppercase' }}>Best Day</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#111827', marginTop:2 }}>{r.bestDayB?.day}</div>
                <div style={{ fontSize:11, color:'#16a34a' }}>{fmt(r.bestDayB?.total||0)}</div>
              </div>
              <div style={{ flex:1, background:'#fff7ed', borderRadius:8, padding:'7px 10px' }}>
                <div style={{ fontSize:9, color:'#ea580c', fontWeight:700, textTransform:'uppercase' }}>Lowest Day</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#111827', marginTop:2 }}>{r.worstDayB?.day||'—'}</div>
                <div style={{ fontSize:11, color:'#ea580c' }}>{fmt(r.worstDayB?.total||0)}</div>
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {/* Improved items */}
          <Card icon="📈" title={`Improved Items (${r.improved.length})`} accent="#16a34a">
            {r.improved.length === 0
              ? <div style={{ fontSize:12, color:'#9ca3af' }}>No items improved this week</div>
              : r.improved.slice(0,4).map(i => (
                <div key={i.name} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #f3f4f6', fontSize:12 }}>
                  <span style={{ color:'#111827', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.name}</span>
                  <span style={{ color:'#16a34a', fontWeight:700, marginLeft:8, whiteSpace:'nowrap' }}>▲ {fmt(i.delta)}</span>
                  {i.pct!==null && <span style={{ color:'#9ca3af', fontSize:10, marginLeft:6 }}>({pct(i.pct)})</span>}
                </div>
              ))
            }
          </Card>

          {/* Declined items */}
          <Card icon="📉" title={`Declined Items (${r.declined.length})`} accent="#dc2626">
            {r.declined.length === 0
              ? <div style={{ fontSize:12, color:'#9ca3af' }}>No items declined this week</div>
              : r.declined.slice(0,4).map(i => (
                <div key={i.name} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #f3f4f6', fontSize:12 }}>
                  <span style={{ color:'#111827', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.name}</span>
                  <span style={{ color:'#dc2626', fontWeight:700, marginLeft:8, whiteSpace:'nowrap' }}>▼ {fmt(Math.abs(i.delta))}</span>
                  {i.pct!==null && <span style={{ color:'#9ca3af', fontSize:10, marginLeft:6 }}>({pct(i.pct)})</span>}
                </div>
              ))
            }
          </Card>
        </div>

        {/* Day-by-day breakdown */}
        <Card icon="🗓️" title="Day-by-Day Breakdown" accent="#2563eb">
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {r.dayPairs.map(d => {
              const hasBoth = d.tA>0||d.tB>0;
              return (
                <div key={d.day} style={{ flex:'1 1 80px', background:tBg(d.delta), border:`1px solid ${tBorder(d.delta)}`,
                  borderRadius:8, padding:'8px 10px', textAlign:'center', opacity:hasBoth?1:0.4 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:4 }}>{d.day}</div>
                  <div style={{ fontSize:11, color:'#2563eb', fontWeight:600 }}>W{weekA.weekNum}: {d.tA>0?fmt(d.tA):'—'}</div>
                  <div style={{ fontSize:11, color:'#0369a1', fontWeight:600 }}>W{weekB.weekNum}: {d.tB>0?fmt(d.tB):'—'}</div>
                  {hasBoth && (
                    <div style={{ fontSize:12, fontWeight:700, color:tColor(d.delta), marginTop:4 }}>
                      {d.delta>0?'▲':d.delta<0?'▼':'='} {d.delta!==0?Math.abs(d.delta).toFixed(1):'same'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Observations & Recommendations */}
        <Card icon="💡" title="Observations & Recommendations" accent="#f59e0b">
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              // Observation 1 — overall
              r.delta > 0
                ? { type:'positive', text:`Overall productivity improved by ${fmt(r.delta)} units (+${r.deltaPct.toFixed(1)}%) from Week ${weekA.weekNum} to Week ${weekB.weekNum}.` }
                : r.delta < 0
                ? { type:'warning',  text:`Overall productivity declined by ${fmt(Math.abs(r.delta))} units (${r.deltaPct.toFixed(1)}%) from Week ${weekA.weekNum} to Week ${weekB.weekNum}.` }
                : { type:'neutral',  text:`Productivity remained stable between Week ${weekA.weekNum} and Week ${weekB.weekNum}.` },

              // Observation 2 — active days
              r.activeDaysB > r.activeDaysA
                ? { type:'positive', text:`Work activity increased — ${r.activeDaysB} active days in Week ${weekB.weekNum} vs ${r.activeDaysA} in Week ${weekA.weekNum}.` }
                : r.activeDaysB < r.activeDaysA
                ? { type:'warning',  text:`Fewer active days in Week ${weekB.weekNum} (${r.activeDaysB}) vs Week ${weekA.weekNum} (${r.activeDaysA}). Consider increasing daily work frequency.` }
                : null,

              // Observation 3 — avg daily rate
              r.avgDayB > r.avgDayA
                ? { type:'positive', text:`Daily output rate improved: ${fmt(r.avgDayA)} → ${fmt(r.avgDayB)} per active day.` }
                : r.avgDayB < r.avgDayA
                ? { type:'warning',  text:`Daily output rate dropped: ${fmt(r.avgDayA)} → ${fmt(r.avgDayB)} per active day. Review resource allocation.` }
                : null,

              // Observation 4 — consistency
              r.cvB < r.cvA && r.cvA > 0.3
                ? { type:'positive', text:`Consistency improved (less variation between days). More predictable workflow in Week ${weekB.weekNum}.` }
                : r.cvB > r.cvA && r.cvB > 0.5
                ? { type:'warning',  text:`High variation in daily output in Week ${weekB.weekNum}. Aim for more consistent daily targets.` }
                : null,

              // Observation 5 — new/stopped items
              r.newItems.length > 0
                ? { type:'info', text:`${r.newItems.length} new item(s) started in Week ${weekB.weekNum}: ${r.newItems.slice(0,2).map(i=>i.name).join(', ')}${r.newItems.length>2?'...':''}.` }
                : null,
              r.stoppedItems.length > 0
                ? { type:'warning', text:`${r.stoppedItems.length} item(s) had no activity in Week ${weekB.weekNum}: ${r.stoppedItems.slice(0,2).map(i=>i.name).join(', ')}. Follow up on status.` }
                : null,

              // Recommendation
              r.deltaPct < -10
                ? { type:'action', text:`Recommendation: Investigate root cause of decline. Check if resource shortage, site access issues, or material delays affected Week ${weekB.weekNum}.` }
                : r.deltaPct > 20
                ? { type:'action', text:`Recommendation: Strong week — maintain current momentum. Document what worked well in Week ${weekB.weekNum} and replicate it.` }
                : { type:'action', text:`Recommendation: Performance is ${r.delta>=0?'on track':'slightly off track'}. Focus on improving the lowest-performing days (${r.delta>=0?r.worstDayB?.day||'—':r.worstDayA?.day||'—'}) next week.` },
            ].filter(Boolean).map((obs, i) => {
              const cfg = {
                positive:{ bg:'#f0fdf4', border:'#bbf7d0', color:'#16a34a', icon:'✅' },
                warning: { bg:'#fff7ed', border:'#fed7aa', color:'#ea580c', icon:'⚠️' },
                info:    { bg:'#e0f2fe', border:'#bae6fd', color:'#0369a1', icon:'ℹ️' },
                neutral: { bg:'#f9fafb', border:'#e5e7eb', color:'#6b7280', icon:'➡️' },
                action:  { bg:'#eff6ff', border:'#bfdbfe', color:'#2563eb', icon:'🎯' },
              }[obs.type];
              return (
                <div key={i} style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, borderRadius:8, padding:'8px 12px', display:'flex', gap:8, alignItems:'flex-start' }}>
                  <span style={{ fontSize:14, flexShrink:0 }}>{cfg.icon}</span>
                  <span style={{ fontSize:12, color:'#374151', lineHeight:1.5 }}>{obs.text}</span>
                </div>
              );
            })}
          </div>
        </Card>

      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DailyProductivity() {
  const toast = useToast();
  const [projects,    setProjects]    = useState([]);
  const [activeTab,   setActiveTab]   = useState('single');
  const [search,      setSearch]      = useState('');

  // Single week
  const [projectId,     setProjectId]     = useState('');
  const [weeks,         setWeeks]         = useState([]);
  const [firstDate,     setFirstDate]     = useState(null);
  const [weekNum,       setWeekNum]       = useState('');
  const [weekInput,     setWeekInput]     = useState('');
  const [selectedYear,  setSelectedYear]  = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [reportData,    setReportData]    = useState(null);
  const [loading,       setLoading]       = useState(false);

  // Compare
  const [cmpProjectId,  setCmpProjectId]  = useState('');
  const [cmpWeeks,      setCmpWeeks]      = useState([]);
  const [cmpFirstDate,  setCmpFirstDate]  = useState(null);
  const [cmpWeekNumA,   setCmpWeekNumA]   = useState('');
  const [cmpWeekInputA, setCmpWeekInputA] = useState('');
  const [cmpWeekNumB,   setCmpWeekNumB]   = useState('');
  const [cmpWeekInputB, setCmpWeekInputB] = useState('');
  const [cmpDataA,      setCmpDataA]      = useState(null);
  const [cmpDataB,      setCmpDataB]      = useState(null);
  const [cmpYear,       setCmpYear]       = useState('');
  const [cmpMonth,      setCmpMonth]      = useState('');

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  const loadWeeksForProject = useCallback(async (pid, setWks, setFd) => {
    if (!pid) { setWks([]); setFd(null); return; }
    try {
      // Weeks are based on confirmed INSTALLATION transactions only.
      // This avoids delivery dates expanding or shifting the productivity report period.
      const mapData = await api.getInstallationMap(pid);
      const { first, last } = getInstallationDateRangeFromMap(mapData);
      if (first) { setFd(first); setWks(generateWeeks(first, last)); }
      else { setWks([]); setFd(null); }
    } catch {
      setWks([]); setFd(null);
    }
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

  const selectedWeek = useMemo(() => weeks.find(w => w.weekNum === parseInt(weekNum)), [weeks, weekNum]);

  useEffect(() => {
    if (!selectedWeek || !projectId) return;
    setLoading(true);
    api.getDailyProductivity(projectId, selectedWeek.sat, selectedWeek.thu)
      .then(setReportData).catch(err => toast(err.message,'error')).finally(() => setLoading(false));
  }, [selectedWeek, projectId, toast]);

  const cmpWeekA = useMemo(() => cmpWeeks.find(w => w.weekNum === parseInt(cmpWeekNumA)), [cmpWeeks, cmpWeekNumA]);
  const cmpWeekB = useMemo(() => cmpWeeks.find(w => w.weekNum === parseInt(cmpWeekNumB)), [cmpWeeks, cmpWeekNumB]);

  useEffect(() => {
    if (!cmpWeekA || !cmpProjectId) return;
    api.getDailyProductivity(cmpProjectId, cmpWeekA.sat, cmpWeekA.thu).then(setCmpDataA).catch(()=>{});
  }, [cmpWeekA, cmpProjectId]);

  useEffect(() => {
    if (!cmpWeekB || !cmpProjectId) return;
    api.getDailyProductivity(cmpProjectId, cmpWeekB.sat, cmpWeekB.thu).then(setCmpDataB).catch(()=>{});
  }, [cmpWeekB, cmpProjectId]);

  const years  = useMemo(() => [...new Set(weeks.map(w=>w.sat.slice(0,4)))].sort(), [weeks]);
  const months = useMemo(() => {
    if (!selectedYear) return [];
    const ms = new Set(weeks.filter(w=>w.sat.startsWith(selectedYear)||w.thu.startsWith(selectedYear)).map(w=>w.sat.slice(5,7)));
    return [...ms].sort();
  }, [weeks, selectedYear]);

  const cmpYears  = useMemo(() => [...new Set(cmpWeeks.map(w=>w.sat.slice(0,4)))].sort(), [cmpWeeks]);
  const cmpMonths = useMemo(() => {
    if (!cmpYear) return [];
    const ms = new Set(cmpWeeks.filter(w=>w.sat.startsWith(cmpYear)||w.thu.startsWith(cmpYear)).map(w=>w.sat.slice(5,7)));
    return [...ms].sort();
  }, [cmpWeeks, cmpYear]);

  const cmpProject = projects.find(p => String(p.id) === String(cmpProjectId));

  const fSel = { background:'#fff', border:'1px solid #bfdbfe', borderRadius:10, padding:'8px 12px', fontSize:13, fontWeight:600, color:'#0f172a', cursor:'pointer', fontFamily:'inherit', outline:'none', height:40, boxShadow:'0 1px 2px rgba(37,99,235,0.08)', transition:'border-color 0.15s, box-shadow 0.15s' };

  // SearchBar rendered inline (not as sub-component) to avoid focus loss on re-render

  return (
    <div className="cpms-report-darkable" style={{ fontFamily:'Inter, Segoe UI, Roboto, Arial, sans-serif', background:'linear-gradient(180deg,#f8fbff 0%,#eef4fb 100%)', minHeight:'100%', padding:'0 0 12px', color:'#0f172a' }}>
      <ReportDarkModeStyle />
      {/* Compact report header */}
      <div style={{ background:'linear-gradient(135deg,#ffffff 0%,#f8fbff 100%)', border:'1px solid #d7e5fb', borderRadius:14, padding:'7px 10px', marginBottom:8, display:'flex', alignItems:'center', gap:12, boxShadow:'0 10px 26px rgba(15,23,42,0.06)' }}>
        <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#1d4ed8,#2563eb)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 8px 18px rgba(37,99,235,0.22)' }}>
          <span style={{ fontSize:17 }}>📊</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontSize:16, fontWeight:850, color:'#0f172a', letterSpacing:'-0.3px', margin:0 }}>Daily Productivity Per Week</h1>
          <p style={{ fontSize:11, color:'#64748b', margin:'2px 0 0 0' }}>
            Installation quantity per item and working day — confirmed site productivity entries
          </p>
        </div>
      </div>

      {/* Floor-style professional tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:10, borderBottom:'1px solid #dbeafe', background:'#f8fbff', padding:'4px', borderRadius:14, boxShadow:'0 4px 14px rgba(15,23,42,0.04)' }}>
        {[
          { id:'single',  label:'Single Week' },
          { id:'compare', label:'Compare Two Weeks' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(''); }} style={{
            padding:'8px 22px', fontSize:13, fontWeight:700, cursor:'pointer',
            border:'none', fontFamily:'inherit',
            background: activeTab===tab.id?'linear-gradient(135deg,#2563eb,#0ea5e9)':'transparent',
            color: activeTab===tab.id?'#fff':'#64748b',
            borderRadius:10,
            marginBottom:0, transition:'all 0.15s',
            boxShadow: activeTab===tab.id?'0 8px 18px rgba(37,99,235,0.16)':'none'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── SINGLE WEEK ── */}
      {activeTab === 'single' && (
        <>
          <WeekFilter projects={projects} projectId={projectId} setProjectId={setProjectId}
            weekNum={weekNum} setWeekNum={setWeekNum} weeks={weeks}
            years={years} months={months}
            selectedYear={selectedYear} setSelectedYear={setSelectedYear}
            selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
            weekInput={weekInput} setWeekInput={setWeekInput}
            selectedWeek={selectedWeek} fSel={fSel} search={search} setSearch={setSearch} />

          {!projectId && <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}><div style={{ fontSize:48, marginBottom:12 }}>📊</div><div style={{ fontSize:15 }}>Select a project to begin</div></div>}
          {projectId && weeks.length === 0 && !loading && <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}><div style={{ fontSize:48, marginBottom:12 }}>📦</div><div style={{ fontSize:15 }}>No confirmed installation productivity records found</div></div>}
          {projectId && weeks.length > 0 && !selectedWeek && !loading && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>👆</div>
              <div style={{ fontSize:14 }}>Enter a week number or select from the dropdown</div>
              <div style={{ fontSize:12, marginTop:4 }}>Project has <strong style={{ color:'#2563eb' }}>{weeks.length}</strong> weeks since first productivity entry on <strong style={{ color:'#2563eb' }}>{formatDate(firstDate)}</strong></div>
            </div>
          )}
          {loading && <div style={{ textAlign:'center', padding:40 }}><div className="spinner" /></div>}

          {!loading && reportData && selectedWeek && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginBottom:16 }}>
                {(() => {
                  const totalInstalled = reportData.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
                  const activeItems = new Set(reportData.daily.map(d=>d.item_id)).size;
                  const days = weekDays(selectedWeek.sat);
                  const activeDays = days.filter(day => reportData.daily.some(d => String(d.transaction_date).slice(0,10) === day.iso && (parseFloat(d.qty_installed)||0) > 0)).length;
                  const avgPerDay = activeDays > 0 ? totalInstalled / activeDays : 0;
                  const itemShare = reportData.items?.length ? (activeItems / reportData.items.length) * 100 : 0;
                  return [
                    { label:'Selected Week', value:`W${selectedWeek.weekNum}`, sub:`${formatDate(selectedWeek.sat)} → ${formatDate(selectedWeek.thu)}`, pct:'100%', tone:'#2563eb', bg:'linear-gradient(135deg,#eff6ff,#dbeafe)' },
                    { label:'Total Installed', value:fmt2(totalInstalled), sub:'Confirmed installation quantity', pct:`${activeDays}/6 days`, tone:'#16a34a', bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
                    { label:'Active Items', value:activeItems, sub:`${reportData.items?.length || 0} planned items`, pct:`${itemShare.toFixed(1)}%`, tone:'#0369a1', bg:'linear-gradient(135deg,#e0f2fe,#cffafe)' },
                    { label:'Avg / Active Day', value:fmt2(avgPerDay), sub:'Daily productivity rate', pct: activeDays ? 'Live' : 'No work', tone:'#7c3aed', bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)' },
                  ].map(k => (
                    <div key={k.label} style={{ background:k.bg, border:`1px solid ${k.tone}33`, borderRadius:16, padding:'14px 16px', boxShadow:'0 12px 24px rgba(15,23,42,0.07)', position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', right:-16, top:-18, width:72, height:72, borderRadius:'50%', background:`${k.tone}18` }} />
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, position:'relative' }}>
                        <div>
                          <div style={{ fontSize:10, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.08em', color:k.tone }}>{k.label}</div>
                          <div style={{ fontSize:22, fontWeight:900, color:'#0f172a', marginTop:5, letterSpacing:'-0.5px' }}>{k.value}</div>
                          <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>{k.sub}</div>
                        </div>
                        <div style={{ border:`1px solid ${k.tone}44`, background:'#fff', color:k.tone, borderRadius:999, padding:'5px 8px', fontSize:11, fontWeight:900, whiteSpace:'nowrap' }}>{k.pct}</div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
              
              <div style={{ background:'var(--card)', border:'1px solid var(--border-light)', borderRadius:14, overflow:'hidden' }}>
                <ProductivityTable items={reportData.items} daily={reportData.daily} selectedWeek={selectedWeek} search={search} />
              </div>
            </>
          )}
        </>
      )}

      {/* ── COMPARE TWO WEEKS ── */}
      {activeTab === 'compare' && (
        <>
          <FilterShell
            title="Compare Two Weeks Filters"
            subtitle="Choose one project and compare two installation productivity weeks with clear W1/W2 colors."
            right={(cmpWeekA && cmpWeekB) ? <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ background:'#eff6ff', border:'1px solid #93c5fd', color:'#1d4ed8', borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:900 }}>W1: Week {cmpWeekA.weekNum}</span>
              <span style={{ background:'#fff7ed', border:'1px solid #fdba74', color:'#c2410c', borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:900 }}>W2: Week {cmpWeekB.weekNum}</span>
            </div> : null}
          >
            <FilterField label="Select Project" span={4}>
              <select value={cmpProjectId} onChange={e => setCmpProjectId(e.target.value)} style={{ ...fSel, width:'100%' }}>
                <option value="">— Select Project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{[p.project_name_en,p.project_name_ar].filter(Boolean).join(' / ')}</option>)}
              </select>
            </FilterField>
            {cmpProjectId && cmpWeeks.length > 0 && (
              <>
                <FilterField label="Week 1 - Blue" span={4}>
                  <div style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1px solid #93c5fd', borderRadius:14, padding:10, boxShadow:'0 8px 18px rgba(29,78,216,0.08)' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'74px 1fr', gap:8 }}>
                      <input type="number" min={1} max={cmpWeeks.length} value={cmpWeekInputA} placeholder="#"
                        onChange={e => { const n=parseInt(e.target.value); setCmpWeekInputA(e.target.value); if(!isNaN(n)&&cmpWeeks.find(w=>w.weekNum===n)) setCmpWeekNumA(String(n)); }}
                        style={{ ...fSel, width:'100%', fontWeight:900, textAlign:'center', border:'1px solid #60a5fa', background:'#fff', color:'#1d4ed8' }} />
                      <select value={cmpWeekNumA} onChange={e => { setCmpWeekNumA(e.target.value); setCmpWeekInputA(e.target.value); }} style={{ ...fSel, width:'100%', border:'1px solid #60a5fa', background:'#fff', color:'#1d4ed8' }}>
                        <option value="">— Week 1 —</option>
                        {cmpWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
                      </select>
                    </div>
                    {cmpWeekA && <div style={{ marginTop:8, color:'#1d4ed8', fontSize:11, fontWeight:800 }}>{formatDate(cmpWeekA.sat)} → {formatDate(cmpWeekA.thu)}</div>}
                  </div>
                </FilterField>
                <FilterField label="Week 2 - Orange" span={4}>
                  <div style={{ background:'linear-gradient(135deg,#fff7ed,#ffedd5)', border:'1px solid #fdba74', borderRadius:14, padding:10, boxShadow:'0 8px 18px rgba(194,65,12,0.08)' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'74px 1fr', gap:8 }}>
                      <input type="number" min={1} max={cmpWeeks.length} value={cmpWeekInputB} placeholder="#"
                        onChange={e => { const n=parseInt(e.target.value); setCmpWeekInputB(e.target.value); if(!isNaN(n)&&cmpWeeks.find(w=>w.weekNum===n)) setCmpWeekNumB(String(n)); }}
                        style={{ ...fSel, width:'100%', fontWeight:900, textAlign:'center', border:'1px solid #fb923c', background:'#fff', color:'#c2410c' }} />
                      <select value={cmpWeekNumB} onChange={e => { setCmpWeekNumB(e.target.value); setCmpWeekInputB(e.target.value); }} style={{ ...fSel, width:'100%', border:'1px solid #fb923c', background:'#fff', color:'#c2410c' }}>
                        <option value="">— Week 2 —</option>
                        {cmpWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
                      </select>
                    </div>
                    {cmpWeekB && <div style={{ marginTop:8, color:'#c2410c', fontSize:11, fontWeight:800 }}>{formatDate(cmpWeekB.sat)} → {formatDate(cmpWeekB.thu)}</div>}
                  </div>
                </FilterField>
                <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', paddingTop:2 }}>
                  <div style={{ fontSize:11, color:'#64748b' }}>Blue = Week 1, Orange = Week 2. The table keeps the same colors for faster reading.</div>
                  <button type="button" onClick={() => { setCmpWeekNumA(''); setCmpWeekInputA(''); setCmpWeekNumB(''); setCmpWeekInputB(''); setCmpDataA(null); setCmpDataB(null); }} style={{ border:'1px solid #bfdbfe', background:'#eff6ff', color:'#1d4ed8', borderRadius:10, padding:'8px 12px', fontSize:12, fontWeight:800, cursor:'pointer' }}>Clear Compare</button>
                </div>
              </>
            )}
          </FilterShell>

          {!cmpProjectId && <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}><div style={{ fontSize:48, marginBottom:12 }}>⚖️</div><div style={{ fontSize:15 }}>Select a project to compare weeks</div></div>}

          {cmpDataA && cmpDataB && cmpWeekA && cmpWeekB && (
            <>
              
              <div style={{ background:'var(--card)', border:'1px solid var(--border-light)', borderRadius:14, overflow:'hidden', marginBottom:8 }}>
                <CompareTable dataA={cmpDataA} dataB={cmpDataB} weekA={cmpWeekA} weekB={cmpWeekB} search={search} />
              </div>
              <SmartInsights dataA={cmpDataA} dataB={cmpDataB} weekA={cmpWeekA} weekB={cmpWeekB} />
            </>
          )}
        </>
      )}
    </div>
  );
}