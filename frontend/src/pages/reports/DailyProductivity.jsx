import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';

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
function generateWeeks(firstDateStr) {
  if (!firstDateStr) return [];
  const today = new Date();
  let sat = getWeekSaturday(firstDateStr);
  const weeks = []; let wn = 1;
  while (sat <= today) {
    const thu = addDays(sat, 5);
    weeks.push({ weekNum:wn++, sat:toISO(sat), thu:toISO(thu), label:`Week ${wn-1} — ${formatDate(toISO(sat))} → ${formatDate(toISO(thu))}` });
    sat = addDays(sat, 7);
  }
  return weeks;
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
function WeekFilter({ projects, projectId, setProjectId, weekNum, setWeekNum, weeks, years, months, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, weekInput, setWeekInput, selectedWeek, fSel }) {
  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');
  const monthName = m => new Date(`2000-${m}-01`).toLocaleDateString('en-GB',{month:'long'});
  const filteredWeeks = useMemo(() => {
    let ws = weeks;
    if (selectedYear)  ws = ws.filter(w => w.sat.startsWith(selectedYear)||w.thu.startsWith(selectedYear));
    if (selectedMonth) ws = ws.filter(w => w.sat.slice(0,7)===`${selectedYear}-${selectedMonth}`||w.thu.slice(0,7)===`${selectedYear}-${selectedMonth}`);
    return ws;
  }, [weeks, selectedYear, selectedMonth]);

  return (
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
          <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedMonth(''); setWeekNum(''); setWeekInput(''); }} style={{ ...fSel, minWidth:100 }}>
            <option value="">All</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}
      {selectedYear && months.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🗓️ Month</label>
          <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setWeekNum(''); setWeekInput(''); }} style={{ ...fSel, minWidth:130 }}>
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
            <input type="number" min={1} max={weeks.length} value={weekInput} placeholder={`1–${weeks.length}`}
              onChange={e => { const n=parseInt(e.target.value); setWeekInput(e.target.value); if(!isNaN(n)&&weeks.find(w=>w.weekNum===n)) setWeekNum(String(n)); }}
              style={{ ...fSel, minWidth:85, fontWeight:700, textAlign:'center' }} />
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
          <select value={weekNum} onChange={e => { setWeekNum(e.target.value); setWeekInput(e.target.value); }} style={{ ...fSel, minWidth:320 }}>
            <option value="">— Select Week —</option>
            {filteredWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
          </select>
        </div>
      )}
    </div>
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

  const th = { background:'#f0f7ff', color:'#111827', fontWeight:700, fontSize:11, padding:'10px 12px',
    borderBottom:'2px solid #e0ecff', whiteSpace:'nowrap', letterSpacing:'0.02em', textAlign:'center' };
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
              <th key={d.iso} style={{ ...th, background:'#ede9fe', color:'#7c3aed', borderLeft:'1px solid #e0ecff' }}>
                <div style={{ fontSize:11, fontWeight:700 }}>{d.label}</div>
                <div style={{ fontSize:10, fontWeight:500, color:'#9ca3af', marginTop:2 }}>{d.day}</div>
              </th>
            ))}
            <th style={{ ...th, background:'#1f2937', color:'#fff', borderLeft:'2px solid #374151' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped).map(([group, groupItems]) => {
            const gDayTotals = days.map(d => groupItems.reduce((s,i)=>s+(qtyMap[i.item_id]?.[d.iso]||0),0));
            const gTotal = gDayTotals.reduce((s,v)=>s+v,0);
            return (
              <>
                <tr key={`g-${group}`} style={{ background:'#ede9fe' }}>
                  <td colSpan={3} style={{ padding:'7px 12px', fontSize:11, fontWeight:700, color:'#7c3aed' }}>{group}</td>
                  {gDayTotals.map((gt,i) => (
                    <td key={i} style={{ padding:'7px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:gt>0?'#7c3aed':'#c4b5fd', borderLeft:'1px solid #ddd6fe' }}>
                      {gt > 0 ? fmt2(gt) : '—'}
                    </td>
                  ))}
                  <td style={{ padding:'7px 12px', textAlign:'center', fontWeight:700, fontSize:11, color:'#fff', background:'#6d28d9', borderLeft:'2px solid #5b21b6' }}>{fmt2(gTotal)}</td>
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
                        <td key={i} style={{ ...td, borderLeft:'1px solid #f3f4f6', background:qty>0?'#faf5ff':'transparent' }}>
                          {qty > 0
                            ? <div><div style={{ fontWeight:700, color:'#111827', fontSize:13 }}>{fmt2(qty)}</div>
                                <div style={{ height:3, background:'#ede9fe', borderRadius:99, overflow:'hidden', marginTop:3 }}>
                                  <div style={{ height:'100%', width:`${Math.min(100,(qty/(grandTotal/Math.max(1,activeItems.length)))*100)}%`, background:'#7c3aed', borderRadius:99 }} />
                                </div></div>
                            : <span style={{ color:'#e5e7eb', fontSize:15 }}>·</span>}
                        </td>
                      ))}
                      <td style={{ ...td, fontWeight:700, color:'#fff', background:itemTotal>0?'#1f2937':'#374151', borderLeft:'2px solid #374151', fontSize:13 }}>
                        {itemTotal > 0 ? fmt2(itemTotal) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop:'2px solid #1f2937', background:'#111827' }}>
            <td colSpan={3} style={{ padding:'11px 12px', fontWeight:700, fontSize:12, color:'#fff' }}>Daily Total ({activeItems.length} items)</td>
            {dayTotals.map((total,i) => (
              <td key={i} style={{ padding:'11px 12px', textAlign:'center', fontWeight:700, color:total>0?'#a5f3fc':'#4b5563', fontSize:13, borderLeft:'1px solid #374151' }}>
                {total > 0 ? fmt2(total) : '—'}
              </td>
            ))}
            <td style={{ padding:'11px 12px', textAlign:'center', fontWeight:700, color:'#fbbf24', fontSize:14, borderLeft:'2px solid #374151' }}>{fmt2(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Side-by-Side Comparison Table ─────────────────────────────────────────────
function CompareTable({ dataA, dataB, weekA, weekB, search }) {
  if (!dataA || !dataB || !weekA || !weekB) return null;

  const daysA = weekDays(weekA.sat);
  const daysB = weekDays(weekB.sat);
  const qtyMapA = buildQtyMap(dataA.daily);
  const qtyMapB = buildQtyMap(dataB.daily);

  // All items that appear in either week
  const allItems = dataA.items.filter(item => {
    const hasA = daysA.some(d => (qtyMapA[item.item_id]?.[d.iso]||0) > 0);
    const hasB = daysB.some(d => (qtyMapB[item.item_id]?.[d.iso]||0) > 0);
    return hasA || hasB;
  });

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

  const dayHeaders = daysA.map((dA, i) => ({ dA, dB: daysB[i] }));
  const totalA = dataA.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
  const totalB = dataB.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);

  const thBase = { fontWeight:700, fontSize:10, padding:'8px 8px', borderBottom:'2px solid #e0ecff', whiteSpace:'nowrap', textAlign:'center', letterSpacing:'0.02em' };
  const tdBase = { padding:'9px 8px', verticalAlign:'middle', textAlign:'center', fontSize:11 };

  const deltaColor = d => d > 0 ? '#16a34a' : d < 0 ? '#dc2626' : '#9ca3af';
  const deltaIcon  = d => d > 0 ? '▲' : d < 0 ? '▼' : '=';

  if (filtered.length === 0)
    return <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af' }}>No items found{search?' matching search':''}</div>;

  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', minWidth:300+dayHeaders.length*220+100, borderCollapse:'collapse', fontSize:11, tableLayout:'fixed' }}>
        <colgroup>
          <col style={{ width:70 }} /><col style={{ width:150 }} /><col style={{ width:45 }} />
          {dayHeaders.map((_,i) => <col key={i} style={{ width:100 }} />)}
          {dayHeaders.map((_,i) => <col key={`b${i}`} style={{ width:100 }} />)}
          <col style={{ width:90 }} /><col style={{ width:90 }} /><col style={{ width:80 }} />
        </colgroup>
        <thead>
          {/* Top group row */}
          <tr>
            <th colSpan={3} style={{ ...thBase, background:'#f0f7ff', textAlign:'left' }}></th>
            <th colSpan={daysA.length} style={{ ...thBase, background:'#7c3aed', color:'#fff', borderLeft:'2px solid #6d28d9', fontSize:11 }}>
              ◼ Week {weekA.weekNum} — {formatDate(weekA.sat)} → {formatDate(weekA.thu)}
            </th>
            <th colSpan={daysB.length} style={{ ...thBase, background:'#0369a1', color:'#fff', borderLeft:'2px solid #075985', fontSize:11 }}>
              ◼ Week {weekB.weekNum} — {formatDate(weekB.sat)} → {formatDate(weekB.thu)}
            </th>
            <th colSpan={3} style={{ ...thBase, background:'#1f2937', color:'#fff', borderLeft:'2px solid #374151' }}>Summary</th>
          </tr>
          {/* Day sub-headers */}
          <tr>
            <th style={{ ...thBase, background:'#f0f7ff', textAlign:'left' }}>Code</th>
            <th style={{ ...thBase, background:'#f0f7ff', textAlign:'left' }}>Item Name</th>
            <th style={{ ...thBase, background:'#f0f7ff' }}>Unit</th>
            {daysA.map(d => (
              <th key={d.iso} style={{ ...thBase, background:'#f5f3ff', color:'#7c3aed', borderLeft:'1px solid #ede9fe' }}>
                <div>{d.label}</div><div style={{ fontSize:9, color:'#c4b5fd' }}>{d.day}</div>
              </th>
            ))}
            {daysB.map(d => (
              <th key={d.iso} style={{ ...thBase, background:'#e0f2fe', color:'#0369a1', borderLeft:'1px solid #bae6fd' }}>
                <div>{d.label}</div><div style={{ fontSize:9, color:'#7dd3fc' }}>{d.day}</div>
              </th>
            ))}
            <th style={{ ...thBase, background:'#f5f3ff', color:'#7c3aed', borderLeft:'2px solid #6d28d9' }}>Wk A Total</th>
            <th style={{ ...thBase, background:'#e0f2fe', color:'#0369a1', borderLeft:'1px solid #bae6fd' }}>Wk B Total</th>
            <th style={{ ...thBase, background:'#1f2937', color:'#fbbf24', borderLeft:'2px solid #374151' }}>Δ Change</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped).map(([group, groupItems]) => {
            const grpTotA = groupItems.reduce((s,i) => s+daysA.reduce((ss,d)=>ss+(qtyMapA[i.item_id]?.[d.iso]||0),0),0);
            const grpTotB = groupItems.reduce((s,i) => s+daysB.reduce((ss,d)=>ss+(qtyMapB[i.item_id]?.[d.iso]||0),0),0);
            const grpDelta = grpTotB - grpTotA;
            return (
              <>
                <tr key={`g-${group}`} style={{ background:'#ede9fe' }}>
                  <td colSpan={3} style={{ padding:'7px 10px', fontSize:11, fontWeight:700, color:'#7c3aed' }}>{group}</td>
                  {daysA.map(d => {
                    const gt = groupItems.reduce((s,i)=>s+(qtyMapA[i.item_id]?.[d.iso]||0),0);
                    return <td key={d.iso} style={{ padding:'7px 8px', textAlign:'center', fontSize:10, fontWeight:600, color:gt>0?'#6d28d9':'#c4b5fd', borderLeft:'1px solid #ddd6fe' }}>{gt>0?fmt2(gt):'—'}</td>;
                  })}
                  {daysB.map(d => {
                    const gt = groupItems.reduce((s,i)=>s+(qtyMapB[i.item_id]?.[d.iso]||0),0);
                    return <td key={d.iso} style={{ padding:'7px 8px', textAlign:'center', fontSize:10, fontWeight:600, color:gt>0?'#075985':'#7dd3fc', borderLeft:'1px solid #bae6fd' }}>{gt>0?fmt2(gt):'—'}</td>;
                  })}
                  <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, fontSize:11, color:'#6d28d9', borderLeft:'2px solid #6d28d9' }}>{fmt2(grpTotA)}</td>
                  <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, fontSize:11, color:'#075985', borderLeft:'1px solid #bae6fd' }}>{fmt2(grpTotB)}</td>
                  <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, fontSize:11, color:deltaColor(grpDelta), borderLeft:'2px solid #374151' }}>
                    {grpDelta !== 0 ? `${deltaIcon(grpDelta)} ${Math.abs(grpDelta).toFixed(2)}` : '='}
                  </td>
                </tr>
                {groupItems.map((item, idx) => {
                  const qtysA = daysA.map(d => qtyMapA[item.item_id]?.[d.iso]||0);
                  const qtysB = daysB.map(d => qtyMapB[item.item_id]?.[d.iso]||0);
                  const totA  = qtysA.reduce((s,v)=>s+v,0);
                  const totB  = qtysB.reduce((s,v)=>s+v,0);
                  const delta = totB - totA;
                  return (
                    <tr key={item.item_id} style={{ borderBottom:'1px solid #f3f4f6', background:idx%2===0?'#fafbff':'#fff' }}>
                      <td style={{ ...tdBase, textAlign:'left', fontFamily:'monospace', fontSize:10, color:'#6b7280' }}>{item.item_code}</td>
                      <td style={{ ...tdBase, textAlign:'left', fontWeight:600, color:'#111827', fontSize:11 }}>{item.item_name}</td>
                      <td style={{ ...tdBase, color:'#9ca3af', fontSize:10 }}>{item.unit_of_measure||'—'}</td>
                      {qtysA.map((qty,i) => (
                        <td key={i} style={{ ...tdBase, borderLeft:'1px solid #f3f4f6', background:qty>0?'#faf5ff':'transparent' }}>
                          {qty > 0 ? <span style={{ fontWeight:700, color:'#7c3aed' }}>{fmt2(qty)}</span> : <span style={{ color:'#e5e7eb' }}>·</span>}
                        </td>
                      ))}
                      {qtysB.map((qty,i) => (
                        <td key={i} style={{ ...tdBase, borderLeft:'1px solid #e0f2fe', background:qty>0?'#f0f9ff':'transparent' }}>
                          {qty > 0 ? <span style={{ fontWeight:700, color:'#0369a1' }}>{fmt2(qty)}</span> : <span style={{ color:'#e5e7eb' }}>·</span>}
                        </td>
                      ))}
                      <td style={{ ...tdBase, fontWeight:700, color:'#7c3aed', background:'#faf5ff', borderLeft:'2px solid #6d28d9' }}>{totA>0?fmt2(totA):'—'}</td>
                      <td style={{ ...tdBase, fontWeight:700, color:'#0369a1', background:'#f0f9ff', borderLeft:'1px solid #bae6fd' }}>{totB>0?fmt2(totB):'—'}</td>
                      <td style={{ ...tdBase, fontWeight:700, color:deltaColor(delta), background: delta>0?'#f0fdf4':delta<0?'#fef2f2':'transparent', borderLeft:'2px solid #374151', fontSize:12 }}>
                        {delta !== 0 ? `${deltaIcon(delta)} ${Math.abs(delta).toFixed(2)}` : <span style={{ color:'#9ca3af' }}>=</span>}
                      </td>
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background:'#111827', borderTop:'2px solid #374151' }}>
            <td colSpan={3} style={{ padding:'10px 10px', fontWeight:700, color:'#fff', fontSize:11 }}>Grand Total</td>
            {daysA.map(d => {
              const t = filtered.reduce((s,i)=>s+(qtyMapA[i.item_id]?.[d.iso]||0),0);
              return <td key={d.iso} style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:t>0?'#c4b5fd':'#4b5563', borderLeft:'1px solid #374151', fontSize:11 }}>{t>0?fmt2(t):'—'}</td>;
            })}
            {daysB.map(d => {
              const t = filtered.reduce((s,i)=>s+(qtyMapB[i.item_id]?.[d.iso]||0),0);
              return <td key={d.iso} style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:t>0?'#7dd3fc':'#4b5563', borderLeft:'1px solid #374151', fontSize:11 }}>{t>0?fmt2(t):'—'}</td>;
            })}
            <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:'#c4b5fd', borderLeft:'2px solid #6d28d9', fontSize:12 }}>{fmt2(totalA)}</td>
            <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:'#7dd3fc', borderLeft:'1px solid #374151', fontSize:12 }}>{fmt2(totalB)}</td>
            <td style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:deltaColor(totalB-totalA), borderLeft:'2px solid #374151', fontSize:13 }}>
              {totalB-totalA !== 0 ? `${deltaIcon(totalB-totalA)} ${Math.abs(totalB-totalA).toFixed(2)}` : '='}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── AI Insights Panel ─────────────────────────────────────────────────────────
function AIInsights({ dataA, dataB, weekA, weekB, projectName }) {
  const [insight, setInsight]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [shown,   setShown]     = useState(false);

  async function generateInsight() {
    if (!dataA || !dataB) return;
    setLoading(true); setShown(true);

    const daysA = weekDays(weekA.sat);
    const daysB = weekDays(weekB.sat);
    const qA = buildQtyMap(dataA.daily);
    const qB = buildQtyMap(dataB.daily);

    const totalA = dataA.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
    const totalB = dataB.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0);
    const delta  = totalB - totalA;
    const deltaPct = totalA > 0 ? ((delta/totalA)*100).toFixed(1) : 'N/A';

    // Build item comparison summary
    const itemSummaries = dataA.items.map(item => {
      const a = daysA.reduce((s,d)=>s+(qA[item.item_id]?.[d.iso]||0),0);
      const b = daysB.reduce((s,d)=>s+(qB[item.item_id]?.[d.iso]||0),0);
      return { name: item.item_name, unit: item.unit_of_measure||'', weekA: a, weekB: b, delta: b-a };
    }).filter(i => i.weekA > 0 || i.weekB > 0);

    // Day-by-day totals
    const dayCompare = daysA.map((dA, i) => {
      const dB = daysB[i];
      const tA = dataA.items.reduce((s,item)=>s+(qA[item.item_id]?.[dA.iso]||0),0);
      const tB = dataB.items.reduce((s,item)=>s+(qB[item.item_id]?.[dB.iso]||0),0);
      return { dayA:`${formatDate(dA.iso)} (${dA.day})`, dayB:`${formatDate(dB.iso)} (${dB.day})`, tA, tB };
    });

    const prompt = `You are a construction project analyst. Analyze this weekly installation productivity comparison and give a concise, professional insight report.

Project: ${projectName || 'Construction Project'}
Week A: Week ${weekA.weekNum} (${formatDate(weekA.sat)} to ${formatDate(weekA.thu)}) — Total installed: ${fmt2(totalA)}
Week B: Week ${weekB.weekNum} (${formatDate(weekB.sat)} to ${formatDate(weekB.thu)}) — Total installed: ${fmt2(totalB)}
Overall change: ${delta >= 0 ? '+' : ''}${fmt2(delta)} (${deltaPct}%)

Day-by-day comparison (Week A day → Week B day):
${dayCompare.map(d => `  ${d.dayA}: ${fmt2(d.tA)} → ${d.dayB}: ${fmt2(d.tB)} (${d.tB-d.tA>=0?'+':''}${fmt2(d.tB-d.tA)})`).join('\n')}

Item breakdown:
${itemSummaries.map(i => `  ${i.name} (${i.unit}): Week A=${fmt2(i.weekA)}, Week B=${fmt2(i.weekB)}, Δ=${i.delta>=0?'+':''}${fmt2(i.delta)}`).join('\n')}

Provide:
1. Overall performance summary (2-3 sentences)
2. Best performing day and worst performing day in each week
3. Top improving items and declining items
4. Key observations about productivity patterns
5. Recommendations for the next week

Be specific with numbers. Keep it concise but insightful. Use bullet points.`;

    try {
      const data = await api.getAIInsight(prompt);
      if (data.message) {
        setInsight('⚠️ ' + data.message);
      } else {
        setInsight(data.content?.map(c=>c.text||'').join('\n') || 'No insight generated.');
      }
    } catch (err) { setInsight('⚠️ ' + (err.message || 'Failed to generate AI insight. Please try again.')); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ marginTop:20, background:'var(--card)', border:'1.5px solid #7c3aed', borderRadius:14, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>🤖</span>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>AI Productivity Insight</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>Powered by Claude — comparing Week {weekA?.weekNum} vs Week {weekB?.weekNum}</div>
          </div>
        </div>
        <button onClick={generateInsight} disabled={loading}
          style={{ background:'rgba(255,255,255,0.2)', border:'1.5px solid rgba(255,255,255,0.4)', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:600, color:'#fff', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
          {loading ? (
            <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />Analyzing...</>
          ) : (
            <><span>✨</span> {shown ? 'Regenerate Insight' : 'Generate AI Insight'}</>
          )}
        </button>
      </div>

      {shown && (
        <div style={{ padding:'20px 24px' }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', gap:12, color:'#7c3aed', fontSize:13 }}>
              <div style={{ width:18, height:18, border:'2.5px solid #ddd6fe', borderTop:'2.5px solid #7c3aed', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
              Analyzing your installation data...
            </div>
          ) : (
            <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
              {insight}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
      const dummy = new Date().toISOString().slice(0,10);
      const data = await api.getDailyProductivity(pid, dummy, dummy);
      if (data.firstDeliveryDate) { setFd(data.firstDeliveryDate); setWks(generateWeeks(data.firstDeliveryDate)); }
      else { setWks([]); setFd(null); }
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

  const fSel = { background:'var(--card)', border:'2px solid #7c3aed', borderRadius:10, padding:'8px 14px', fontSize:13, fontWeight:600, color:'var(--text)', cursor:'pointer', fontFamily:'inherit', outline:'none', height:40 };

  // SearchBar rendered inline (not as sub-component) to avoid focus loss on re-render

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
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'2px solid #ede9fe' }}>
        {[
          { id:'single',  label:'📅 Single Week' },
          { id:'compare', label:'⚖️ Compare Two Weeks' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(''); }} style={{
            padding:'10px 28px', fontSize:13, fontWeight:600, cursor:'pointer',
            background:'none', border:'none', fontFamily:'inherit',
            color: activeTab===tab.id?'#7c3aed':'#6b7280',
            borderBottom: activeTab===tab.id?'2px solid #7c3aed':'2px solid transparent',
            marginBottom:-2, transition:'all 0.15s',
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
            selectedWeek={selectedWeek} fSel={fSel} />

          {!projectId && <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}><div style={{ fontSize:48, marginBottom:12 }}>📊</div><div style={{ fontSize:15 }}>Select a project to begin</div></div>}
          {projectId && weeks.length === 0 && !loading && <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}><div style={{ fontSize:48, marginBottom:12 }}>📦</div><div style={{ fontSize:15 }}>No delivery records found</div></div>}
          {projectId && weeks.length > 0 && !selectedWeek && !loading && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>👆</div>
              <div style={{ fontSize:14 }}>Enter a week number or select from the dropdown</div>
              <div style={{ fontSize:12, marginTop:4 }}>Project has <strong style={{ color:'#7c3aed' }}>{weeks.length}</strong> weeks since first delivery on <strong style={{ color:'#7c3aed' }}>{formatDate(firstDate)}</strong></div>
            </div>
          )}
          {loading && <div style={{ textAlign:'center', padding:40 }}><div className="spinner" /></div>}

          {!loading && reportData && selectedWeek && (
            <>
              <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
                {[
                  { label:'Week', value:`Week ${selectedWeek.weekNum}`, color:'#7c3aed', bg:'#f5f3ff' },
                  { label:'Period Start', value:formatDate(selectedWeek.sat)+' (Sat)', color:'#7c3aed', bg:'#f5f3ff' },
                  { label:'Period End',   value:formatDate(selectedWeek.thu)+' (Thu)', color:'#7c3aed', bg:'#f5f3ff' },
                  { label:'Total Installed', value:fmt2(reportData.daily.reduce((s,d)=>s+(parseFloat(d.qty_installed)||0),0)), color:'#16a34a', bg:'#f0fdf4' },
                  { label:'Active Items', value:new Set(reportData.daily.map(d=>d.item_id)).size, color:'#0369a1', bg:'#e0f2fe' },
                ].map(k => (
                  <div key={k.label} style={{ flex:'1 1 120px', background:k.bg, border:`1px solid ${k.color}33`, borderRadius:12, padding:'11px 14px' }}>
                    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:k.color, marginBottom:3 }}>{k.label}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', alignItems:'center', background:'var(--card)', border:'2px solid #7c3aed', borderRadius:10, height:40, paddingLeft:12, marginBottom:16, maxWidth:420 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input style={{ border:'none', outline:'none', fontSize:13, color:'var(--text)', background:'none', width:'100%', padding:'0 10px', fontFamily:'inherit' }}
                  placeholder="Search by item name or classification..." value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'0 12px', fontSize:14 }}>✕</button>}
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
          {/* Project selector */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🏗️ Project</label>
              <select value={cmpProjectId} onChange={e => setCmpProjectId(e.target.value)} style={{ ...fSel, minWidth:300 }}>
                <option value="">— Select Project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{[p.project_name_en,p.project_name_ar].filter(Boolean).join(' / ')}</option>)}
              </select>
            </div>
          </div>

          {cmpProjectId && cmpWeeks.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
              {[
                { label:'Week A', num:cmpWeekNumA, setNum:setCmpWeekNumA, inp:cmpWeekInputA, setInp:setCmpWeekInputA, color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
                { label:'Week B', num:cmpWeekNumB, setNum:setCmpWeekNumB, inp:cmpWeekInputB, setInp:setCmpWeekInputB, color:'#0369a1', bg:'#e0f2fe', border:'#bae6fd' },
              ].map(({ label, num, setNum, inp, setInp, color, bg, border }) => {
                const selWeek = cmpWeeks.find(w => w.weekNum === parseInt(num));
                return (
                  <div key={label} style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:12, padding:14 }}>
                    <div style={{ fontSize:12, fontWeight:700, color, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <input type="number" min={1} max={cmpWeeks.length} value={inp} placeholder={`1–${cmpWeeks.length}`}
                        onChange={e => { const n=parseInt(e.target.value); setInp(e.target.value); if(!isNaN(n)&&cmpWeeks.find(w=>w.weekNum===n)) setNum(String(n)); }}
                        style={{ ...fSel, minWidth:80, width:80, fontWeight:700, textAlign:'center', border:`2px solid ${color}` }} />
                      <select value={num} onChange={e => { setNum(e.target.value); setInp(e.target.value); }} style={{ ...fSel, flex:1, minWidth:180, border:`2px solid ${color}` }}>
                        <option value="">— Select {label} —</option>
                        {cmpWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
                      </select>
                    </div>
                    {selWeek && <div style={{ fontSize:11, color, fontWeight:600, marginTop:7 }}>📅 {formatDate(selWeek.sat)} (Sat) → {formatDate(selWeek.thu)} (Thu)</div>}
                  </div>
                );
              })}
            </div>
          )}

          {!cmpProjectId && <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}><div style={{ fontSize:48, marginBottom:12 }}>⚖️</div><div style={{ fontSize:15 }}>Select a project to compare weeks</div></div>}

          {cmpDataA && cmpDataB && cmpWeekA && cmpWeekB && (
            <>
              <div style={{ display:'flex', alignItems:'center', background:'var(--card)', border:'2px solid #7c3aed', borderRadius:10, height:40, paddingLeft:12, marginBottom:16, maxWidth:420 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input style={{ border:'none', outline:'none', fontSize:13, color:'var(--text)', background:'none', width:'100%', padding:'0 10px', fontFamily:'inherit' }}
                  placeholder="Filter items by name or classification..." value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'0 12px', fontSize:14 }}>✕</button>}
              </div>
              <div style={{ background:'var(--card)', border:'1px solid var(--border-light)', borderRadius:14, overflow:'hidden', marginBottom:8 }}>
                <CompareTable dataA={cmpDataA} dataB={cmpDataB} weekA={cmpWeekA} weekB={cmpWeekB} search={search} />
              </div>
              <AIInsights dataA={cmpDataA} dataB={cmpDataB} weekA={cmpWeekA} weekB={cmpWeekB} projectName={cmpProject ? [cmpProject.project_name_en, cmpProject.project_name_ar].filter(Boolean).join(' / ') : ''} />
            </>
          )}
        </>
      )}
    </div>
  );
}