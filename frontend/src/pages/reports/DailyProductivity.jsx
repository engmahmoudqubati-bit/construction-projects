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
              <th key={d.iso} style={{ ...th, background:'#eef2ff', color:'#1e3a5f', borderLeft:'1px solid #e0ecff' }}>
                <div style={{ fontSize:11, fontWeight:700 }}>{d.label}</div>
                <div style={{ fontSize:10, fontWeight:500, color:'#9ca3af', marginTop:2 }}>{d.day}</div>
              </th>
            ))}
            <th style={{ ...th, background:'#f5f3ff', color:'#7c3aed', borderLeft:'2px solid #ddd6fe' }}>Total</th>
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
                    <td key={i} style={{ padding:'7px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:gt>0?'#7c3aed':'#ddd6fe', borderLeft:'1px solid #ede9fe' }}>
                      {gt > 0 ? fmt2(gt) : '—'}
                    </td>
                  ))}
                  <td style={{ padding:'7px 12px', textAlign:'center', fontWeight:700, fontSize:11, color:'#7c3aed', background:'#ede9fe', borderLeft:'2px solid #ddd6fe' }}>{fmt2(gTotal)}</td>
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
                            ? <div><div style={{ fontWeight:700, color:'#7c3aed', fontSize:13 }}>{fmt2(qty)}</div>
                                <div style={{ height:3, background:'#ede9fe', borderRadius:99, overflow:'hidden', marginTop:3 }}>
                                  <div style={{ height:'100%', width:`${Math.min(100,(qty/(grandTotal/Math.max(1,activeItems.length)))*100)}%`, background:'#7c3aed', borderRadius:99 }} />
                                </div></div>
                            : <span style={{ color:'#e5e7eb', fontSize:15 }}>·</span>}
                        </td>
                      ))}
                      <td style={{ ...td, fontWeight:700, color:'#7c3aed', background:'#f5f3ff', borderLeft:'2px solid #ddd6fe', fontSize:13 }}>
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
          <tr style={{ borderTop:'2px solid #e0ecff', background:'#f0f7ff' }}>
            <td colSpan={3} style={{ padding:'11px 12px', fontWeight:700, fontSize:12, color:'#374151' }}>Daily Total ({activeItems.length} items)</td>
            {dayTotals.map((total,i) => (
              <td key={i} style={{ padding:'11px 12px', textAlign:'center', fontWeight:700, color:total>0?'#7c3aed':'#c4b5fd', fontSize:13, borderLeft:'1px solid #e0ecff' }}>
                {total > 0 ? fmt2(total) : '—'}
              </td>
            ))}
            <td style={{ padding:'11px 12px', textAlign:'center', fontWeight:700, color:'#7c3aed', background:'#ede9fe', fontSize:14, borderLeft:'2px solid #ddd6fe' }}>{fmt2(grandTotal)}</td>
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
    wA:      '#7c3aed', wAbg:   '#f5f3ff', wAborder:'#ddd6fe',
    wB:      '#0369a1', wBbg:   '#eff6ff', wBborder:'#bfdbfe',
    head:    '#f0f7ff', headBorder:'#e0ecff',
    grp:     '#faf5ff', grpText:'#7c3aed',
    totA:    '#f5f3ff', totB:   '#eff6ff',
    delta:   '#fffbeb', foot:   '#f8faff',
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
                  background: i%2===0?'#eef2ff':'#f0f9ff', color:'#1e3a5f', fontSize:13, fontWeight:800, padding:'7px 4px' }}>
                  {dA.day}
                </th>
              ))}
              <th style={{ ...thBase, background:CLR.wAbg, color:CLR.wA, borderLeft:`2px solid ${CLR.wAborder}` }}>Total</th>
              <th style={{ ...thBase, background:CLR.wBbg, color:CLR.wB, borderLeft:`1px solid ${CLR.wBborder}` }}>Total</th>
              <th style={{ ...thBase, background:'#fffbeb', color:'#b45309', borderLeft:'2px solid #fde68a' }}>Δ</th>
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
              <th style={{ ...thBase, background:'#fffbeb', color:'#b45309', fontSize:10, borderLeft:'2px solid #fde68a' }}>W{weekB.weekNum}−W{weekA.weekNum}</th>
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
            <tr style={{ background:'#f0f7ff', borderTop:`2px solid ${CLR.headBorder}` }}>
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

  const Card = ({ icon, title, children, accent='#7c3aed' }) => (
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
      <span style={{ color:'#7c3aed', fontWeight:600, minWidth:60, textAlign:'right' }}>{valA}{unit}</span>
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
    <div style={{ marginTop:20, borderRadius:14, overflow:'hidden', border:'1.5px solid #7c3aed' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#6d28d9 0%,#7c3aed 100%)', padding:'14px 20px', display:'flex', alignItems:'center', gap:12 }}>
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
          <Card icon="📋" title="Key Metrics" accent="#7c3aed">
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
        <Card icon="🗓️" title="Day-by-Day Breakdown" accent="#7c3aed">
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {r.dayPairs.map(d => {
              const hasBoth = d.tA>0||d.tB>0;
              return (
                <div key={d.day} style={{ flex:'1 1 80px', background:tBg(d.delta), border:`1px solid ${tBorder(d.delta)}`,
                  borderRadius:8, padding:'8px 10px', textAlign:'center', opacity:hasBoth?1:0.4 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:4 }}>{d.day}</div>
                  <div style={{ fontSize:11, color:'#7c3aed', fontWeight:600 }}>W{weekA.weekNum}: {d.tA>0?fmt(d.tA):'—'}</div>
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
                action:  { bg:'#ede9fe', border:'#ddd6fe', color:'#7c3aed', icon:'🎯' },
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
          {/* All filters in one row */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#7c3aed' }}>🏗️ Project</label>
              <select value={cmpProjectId} onChange={e => setCmpProjectId(e.target.value)} style={{ ...fSel, minWidth:260 }}>
                <option value="">— Select Project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{[p.project_name_en,p.project_name_ar].filter(Boolean).join(' / ')}</option>)}
              </select>
            </div>
            {cmpProjectId && cmpWeeks.length > 0 && (
              <>
                {[
                  { label:'Week 1', num:cmpWeekNumA, setNum:setCmpWeekNumA, inp:cmpWeekInputA, setInp:setCmpWeekInputA, color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
                  { label:'Week 2', num:cmpWeekNumB, setNum:setCmpWeekNumB, inp:cmpWeekInputB, setInp:setCmpWeekInputB, color:'#0369a1', bg:'#eff6ff', border:'#bfdbfe' },
                ].map(({ label, num, setNum, inp, setInp, color, bg, border }) => {
                  const selWeek = cmpWeeks.find(w => w.weekNum === parseInt(num));
                  return (
                    <div key={label} style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color }}>📅 {label}</label>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="number" min={1} max={cmpWeeks.length} value={inp} placeholder="#"
                          onChange={e => { const n=parseInt(e.target.value); setInp(e.target.value); if(!isNaN(n)&&cmpWeeks.find(w=>w.weekNum===n)) setNum(String(n)); }}
                          style={{ ...fSel, width:64, minWidth:64, fontWeight:700, textAlign:'center', border:`2px solid ${color}` }} />
                        <select value={num} onChange={e => { setNum(e.target.value); setInp(e.target.value); }}
                          style={{ ...fSel, minWidth:240, border:`2px solid ${color}`, background:bg }}>
                          <option value="">— {label} —</option>
                          {cmpWeeks.map(w => <option key={w.weekNum} value={w.weekNum}>{w.label}</option>)}
                        </select>
                        {selWeek && (
                          <span style={{ fontSize:11, color, fontWeight:600, whiteSpace:'nowrap' }}>
                            {formatDate(selWeek.sat)} → {formatDate(selWeek.thu)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

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
              <SmartInsights dataA={cmpDataA} dataB={cmpDataB} weekA={cmpWeekA} weekB={cmpWeekB} />
            </>
          )}
        </>
      )}
    </div>
  );
}