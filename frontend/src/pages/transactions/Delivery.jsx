import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const today = () => new Date().toISOString().slice(0, 10);
const fmt2   = (v) => (parseFloat(v) || 0).toFixed(2);
const fmt3   = (v) => (parseFloat(v) || 0).toFixed(3);

// ── Pagination (same style as DataTable) ─────────────────────────
function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }) {
  const pages = [];
  const start = Math.max(1, page - 2);
  const end   = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  const btn = (active) => ({
    minWidth: 32, height: 32, borderRadius: 8,
    border: active ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
    background: active ? '#3b82f6' : '#fff',
    color: active ? '#fff' : '#374151',
    fontWeight: active ? 600 : 400,
    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 10px', transition: 'all 0.12s',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid #f3f4f6', gap: 8 }}>
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, minWidth: 80 }}>
        <strong style={{ color: '#111827' }}>{total}</strong> rows
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
        <button style={{ ...btn(false), padding: '0 10px' }} onClick={() => onPage(page - 1)} disabled={page === 1}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {start > 1 && <><button style={btn(false)} onClick={() => onPage(1)}>1</button><span style={{ color: '#9ca3af', fontSize: 13, padding: '0 2px' }}>...</span></>}
        {pages.map(p => <button key={p} style={btn(p === page)} onClick={() => onPage(p)}>{p}</button>)}
        {end < totalPages && <><span style={{ color: '#9ca3af', fontSize: 13, padding: '0 2px' }}>...</span><button style={btn(false)} onClick={() => onPage(totalPages)}>{totalPages}</button></>}
        <button style={{ ...btn(false), padding: '0 10px' }} onClick={() => onPage(page + 1)} disabled={page === totalPages}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
        style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#374151', cursor: 'pointer', fontFamily: 'inherit', minWidth: 60 }}>
        {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}

export default function Delivery() {
  const toast = useToast();
  const { canAction } = useAuth();

  const [projects,   setProjects]   = useState([]);
  const [projectId,  setProjectId]  = useState('');
  const [date,       setDate]       = useState(today());
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [confirming,  setConfirming]  = useState(false);
  const [unposting,   setUnposting]   = useState(false);

  // Search / filter / pagination
  const [search,     setSearch]     = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(25);

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  const load = useCallback(async () => {
    if (!projectId || !date) return;
    setLoading(true);
    try {
      const data = await api.getDelivery(projectId, date);
      setRows(data.map(r => ({
        ...r,
        qty_input:   r.qty_delivered != null ? parseFloat(r.qty_delivered).toFixed(2) : '',
        ref_input:   r.delivery_ref  ?? '',
        notes_input: r.notes         ?? '',
      })));
      setPage(1);
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [projectId, date, toast]);

  useEffect(() => { load(); }, [load]);

  function setField(itemId, field, val) {
    setRows(rs => rs.map(r => r.item_id === itemId ? { ...r, [field]: val } : r));
  }

  // Save current qty inputs to backend as draft
  function buildEntries() {
    return rows
      .filter(r => r.qty_input !== '' && parseFloat(r.qty_input) > 0)
      .map(r => ({
        item_id: r.item_id,
        qty_delivered: parseFloat(r.qty_input),
        delivery_ref: r.ref_input || null,
        notes: r.notes_input || null,
      }));
  }

  async function handleDraft() {
    if (!projectId || !date) return toast('Select project and date', 'error');
    setSaving(true);
    try {
      const entries = buildEntries();
      const res = await api.saveDelivery({ project_id: projectId, transaction_date: date, entries, tx_status: 'incomplete' });
      toast(`Status: Incomplete (${res.saved} entries saved)`);
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleSave() {
    if (!projectId || !date) return toast('Select project and date', 'error');
    setSaving(true);
    try {
      const entries = buildEntries();
      const res = await api.saveDelivery({ project_id: projectId, transaction_date: date, entries, tx_status: 'saved' });
      toast(`Status: Saved (${res.saved} entries)`);
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleConfirm() {
    if (!projectId || !date) return;
    setConfirming(true);
    try {
      const res = await api.confirmDelivery(projectId, date);
      toast(`Status: Approved (${res.confirmed} entries)`);
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setConfirming(false); }
  }

  async function handleUnpost() {
    if (!projectId || !date) return;
    setUnposting(true);
    try {
      const res = await api.unpostDelivery(projectId, date);
      toast(`Unposted — ${res.unposted} entries reverted to Incomplete`);
      load();
    } catch (err) { toast(err.message, 'error'); }
    finally { setUnposting(false); }
  }

  function exportCSV() {
    const headers = ['Item Code','Item Name','Unit','Planned Qty','Total Delivered','Remaining','Delivery Qty','Ref/PO Number','Notes','Status'];
    const csvRows = rows.map(r => {
      const planned   = parseFloat(r.planned_qty) || 0;
      const delivered = parseFloat(r.total_delivered_all) || 0;
      const remaining = Math.max(0, planned - delivered);
      return [
        r.item_code, r.item_name, r.unit_of_measure || '',
        fmt2(planned), fmt2(delivered), fmt2(remaining),
        r.qty_input || '', r.ref_input || '', r.notes_input || '',
        r.tx_status || '',
      ].join(',');
    });
    const csv = [headers.join(','), ...csvRows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `delivery_${projectId}_${date}.csv`;
    a.click();
  }

  const projectLabel = p => [p.project_name_en, p.project_name_ar].filter(Boolean).join(' / ');

  // All unique classifications for filter dropdown
  const classifications = useMemo(() => {
    const seen = new Set();
    return rows
      .map(r => r.parent_classification_name
        ? `${r.parent_classification_name} › ${r.classification_name || ''}`
        : r.classification_name || 'Uncategorized')
      .filter(v => { if (seen.has(v)) return false; seen.add(v); return true; });
  }, [rows]);

  // Apply search + filters
  const filteredRows = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        (r.item_code || '').toLowerCase().includes(q) ||
        (r.item_name || '').toLowerCase().includes(q) ||
        (r.classification_name || '').toLowerCase().includes(q)
      );
    }
    if (filterClass) {
      result = result.filter(r => {
        const key = r.parent_classification_name
          ? `${r.parent_classification_name} › ${r.classification_name || ''}`
          : r.classification_name || 'Uncategorized';
        return key === filterClass;
      });
    }
    if (filterStatus === 'incomplete') result = result.filter(r => r.tx_status === 'incomplete');
    if (filterStatus === 'saved')       result = result.filter(r => r.tx_status === 'saved');
    if (filterStatus === 'confirmed') result = result.filter(r => r.tx_status === 'confirmed');
    if (filterStatus === 'no_entry')  result = result.filter(r => !r.tx_id);
    return result;
  }, [rows, search, filterClass, filterStatus]);

  // Pagination on filtered rows
  const totalFiltered = filteredRows.length;
  const totalPages    = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const pagedRows     = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  // Re-group paged rows
  const grouped = pagedRows.reduce((acc, row) => {
    const key = row.parent_classification_name
      ? `${row.parent_classification_name} › ${row.classification_name || ''}`
      : row.classification_name || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const incompleteCount = rows.filter(r => r.tx_id && r.tx_status === 'incomplete').length;
  const savedCount      = rows.filter(r => r.tx_id && r.tx_status === 'saved').length;
  const confirmedCount  = rows.filter(r => r.tx_id && r.tx_status === 'confirmed').length;
  const draftCount      = incompleteCount + savedCount;   // non-confirmed entries (for badge)
  const txRows          = rows.filter(r => r.tx_id);
  const allApproved     = txRows.length > 0 && txRows.every(r => r.tx_status === 'confirmed');
  const hasEditable     = rows.length > 0;
  const hasConfirmed    = confirmedCount > 0;
  const showWorkflow    = hasEditable && !allApproved;
  const canUnpost       = hasConfirmed && canAction('can_confirm');

  // KPI totals — react to active filters
  const totalPlanned   = filteredRows.reduce((s, r) => s + (parseFloat(r.planned_qty) || 0), 0);
  const totalDelivered = filteredRows.reduce((s, r) => s + (parseFloat(r.total_delivered_all) || 0), 0);
  const totalRemaining = Math.max(0, totalPlanned - totalDelivered);
  const totalToday     = filteredRows.reduce((s, r) => s + (parseFloat(r.qty_input) || 0), 0);
  const overallPct     = totalPlanned > 0 ? Math.min(100, (totalDelivered / totalPlanned) * 100) : 0;

  const filterSelectStyle = {
    background: 'var(--card)', border: '2px solid #7c3aed', borderRadius: 10,
    padding: '8px 14px', fontSize: 14, fontWeight: 600, color: 'var(--text)',
    cursor: 'pointer', fontFamily: 'inherit', minWidth: 280, outline: 'none',
    height: 40, transition: 'border-color 0.15s',
  };
  const filterDateStyle = { ...filterSelectStyle, minWidth: 160, cursor: 'default' };

  const btnStyle = (bg, color = '#fff', border = bg) => ({
    display: 'flex', alignItems: 'center', gap: 6, background: bg,
    border: `1px solid ${border}`, borderRadius: 10, padding: '8px 18px',
    fontSize: 13, fontWeight: 600, color, cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  });

  const thStyle = {
    fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase',
    letterSpacing: '0.05em', color: '#1e40af', padding: '10px 12px',
    background: '#f0f7ff', borderBottom: '2px solid #bfdbfe',
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 24 }}>🚚</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', margin: 0 }}>
            {t.delivery}
          </h1>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0 0' }}>
            Delivering construction materials to project sites, ensuring timely supply, accurate quantities, and smooth site operations.
          </p>
        </div>
{/* No action buttons in header — all in table footer like BOQ */}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>🏗️ {t.selectProject}:</label>
          <select value={projectId} onChange={e => { setProjectId(e.target.value); setSearch(''); setFilterClass(''); setFilterStatus(''); }} style={filterSelectStyle}>
            <option value="">— {t.selectProject} —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>📅 {t.selectDate}:</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={filterDateStyle} />
        </div>

        {/* Search */}
        {projectId && (
          <div className="filter-group">
            <label>🔍 Search:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 8, height: 40, paddingLeft: 10, minWidth: 180 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input style={{ border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', background: 'none', width: '100%', padding: '0 8px', fontFamily: 'inherit' }}
                placeholder="Item code / name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0 8px', fontSize: 14 }}>✕</button>}
            </div>
          </div>
        )}

        {/* Classification filter */}
        {projectId && classifications.length > 0 && (
          <div className="filter-group">
            <label>📁 Classification:</label>
            <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }}
              style={{ ...filterDateStyle, minWidth: 180, border: '1.5px solid var(--border)', fontWeight: 400, fontSize: 13 }}>
              <option value="">All Classifications</option>
              {classifications.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Status filter */}
        {projectId && (
          <div className="filter-group">
            <label>📋 Status:</label>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              style={{ ...filterDateStyle, minWidth: 140, border: '1.5px solid var(--border)', fontWeight: 400, fontSize: 13 }}>
              <option value="">All Status</option>
              <option value="incomplete">Incomplete</option>
              <option value="saved">Saved</option>
              <option value="confirmed">Approved</option>
              <option value="no_entry">No Entry</option>
            </select>
          </div>
        )}

        {projectId && date && <RefreshButton onRefresh={load} />}

        {/* Export button */}
        {rows.length > 0 && (
          <button onClick={exportCSV} style={{ ...btnStyle('var(--card)', 'var(--text)', 'var(--border)'), height: 38, alignSelf: 'flex-end', fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        )}

        {rows.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {incompleteCount > 0 && <span style={{background:'#fff7ed',color:'#ea580c',border:'1px solid #fed7aa',borderRadius:6,padding:'3px 8px',fontSize:11,fontWeight:700}}>{incompleteCount} incomplete</span>}
            {savedCount > 0      && <span style={{background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',borderRadius:6,padding:'3px 8px',fontSize:11,fontWeight:700}}>{savedCount} saved</span>}
            {confirmedCount > 0 && <span style={{background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',borderRadius:6,padding:'3px 8px',fontSize:11,fontWeight:700}}>{confirmedCount} approved</span>}
          </div>
        )}
      </div>

      {/* KPI summary cards */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          {[
            { label: 'Planned (Total)',      value: fmt2(totalPlanned),   color: '#6366f1', bg: '#eef2ff' },
            { label: 'Delivered (All Time)', value: fmt2(totalDelivered), color: '#0ea5e9', bg: '#e0f2fe' },
            { label: 'Remaining',            value: fmt2(totalRemaining), color: '#f59e0b', bg: '#fffbeb' },
            { label: "Today's Entries",      value: fmt2(totalToday),     color: '#10b981', bg: '#ecfdf5' },
            { label: 'Overall Progress',     value: `${overallPct.toFixed(1)}%`,
              color: overallPct >= 100 ? '#10b981' : overallPct >= 60 ? '#0ea5e9' : '#f59e0b', bg: '#f0fdf4' },
          ].map(k => (
            <div key={k.label} style={{ flex: '1 1 140px', background: k.bg, border: `1px solid ${k.color}33`, borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: k.color, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {!projectId && <div className="empty-state"><div className="empty-icon">🚚</div><p>{t.selectProject}</p></div>}
      {loading    && <div className="spinner-wrap"><div className="spinner" /></div>}
      {!loading && projectId && rows.length === 0 && (
        <div className="empty-state"><div className="empty-icon">📦</div><p>{t.noItemsLinked}</p></div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrapper">
            <table className="tx-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Item Code</th>
                  <th style={thStyle}>Item Name</th>
                  <th style={thStyle}>Unit</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Planned Qty</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total Delivered</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Remaining</th>
                  <th style={{ ...thStyle, minWidth: 110 }}>Progress</th>
                  <th style={{ ...thStyle, minWidth: 110 }}>Delivery Qty</th>
                  <th style={{ ...thStyle, minWidth: 130 }}>Ref/PO Number</th>
                  <th style={{ ...thStyle, minWidth: 150 }}>Notes</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([group, items]) => {
                  const gPlanned   = items.reduce((s, r) => s + (parseFloat(r.planned_qty) || 0), 0);
                  const gDelivered = items.reduce((s, r) => s + (parseFloat(r.total_delivered_all) || 0), 0);
                  const gRemaining = Math.max(0, gPlanned - gDelivered);
                  return (
                    <>
                      {/* Classification group header */}
                      <tr key={`g-${group}`} style={{ background: '#f0f7ff' }}>
                        <td colSpan={4} style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          📁 {group}
                        </td>
                        <td style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, color: '#0ea5e9', textAlign: 'right' }}>{fmt2(gDelivered)}</td>
                        <td style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, color: '#f59e0b', textAlign: 'right' }}>{fmt2(gRemaining)}</td>
                        <td colSpan={5} />
                      </tr>

                      {items.map(row => {
                        const planned       = parseFloat(row.planned_qty) || 0;
                        const deliveredAll  = parseFloat(row.total_delivered_all) || 0;
                        const deliveredUpTo = parseFloat(row.total_delivered) || 0;
                        const remaining     = Math.max(0, planned - deliveredAll);
                        const pct           = planned > 0 ? Math.min(100, (deliveredUpTo / planned) * 100) : 0;
                        const todayQty      = parseFloat(row.qty_input) || 0;
                        const isConfirmed   = row.tx_status === 'confirmed'; // only confirmed rows are locked
                        const isComplete    = deliveredAll >= planned && planned > 0;
                        const isOverDel     = !isConfirmed && todayQty > 0 && (deliveredAll + todayQty) > planned;

                        return (
                          <tr key={row.item_id} style={{
                            background: isOverDel ? '#fff7ed' : isConfirmed ? 'var(--bg)' : 'var(--card)',
                            opacity: isComplete && !row.tx_id ? 0.5 : 1,
                          }}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{row.item_code}</td>
                            <td style={{ fontWeight: 500 }}>
                              {row.item_name}
                              {isOverDel && <span title="Will exceed planned qty!" style={{ marginLeft: 6, color: '#ea580c', fontSize: 11, fontWeight: 700 }}>⚠ Over</span>}
                            </td>
                            <td style={{ fontSize: 12, color: '#6b7280' }}>{row.unit_of_measure || '—'}</td>

                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#6366f1' }}>{fmt2(planned)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#0ea5e9' }}>{fmt2(deliveredAll)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: isComplete ? '#10b981' : '#f59e0b' }}>
                              {isComplete ? '✓ Done' : fmt2(remaining)}
                            </td>

                            {/* Progress */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden', minWidth: 50 }}>
                                  <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`,
                                    background: pct >= 100 ? '#10b981' : pct >= 60 ? '#0ea5e9' : '#f59e0b', transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{pct.toFixed(0)}%</span>
                              </div>
                            </td>

                            {/* Delivery Qty — white bg, 2 decimal places */}
                            <td>
                              <input type="number" min="0" step="0.01" value={row.qty_input}
                                disabled={isConfirmed}
                                style={{ background: isConfirmed ? 'var(--bg2)' : '#fff', borderColor: isOverDel ? '#f97316' : undefined }}
                                onChange={e => {
                                  const val = e.target.value;
                                  // Allow typing, but round to 2dp on blur
                                  setField(row.item_id, 'qty_input', val);
                                }}
                                onBlur={e => {
                                  const v = parseFloat(e.target.value);
                                  if (!isNaN(v)) setField(row.item_id, 'qty_input', v.toFixed(2));
                                  else if (e.target.value === '') setField(row.item_id, 'qty_input', '');
                                }}
                              />
                            </td>

                            {/* Ref/PO Number — white bg */}
                            <td>
                              <input type="text" value={row.ref_input} disabled={isConfirmed}
                                placeholder="Ref/PO Number"
                                style={{ background: isConfirmed ? 'var(--bg2)' : '#fff' }}
                                onChange={e => setField(row.item_id, 'ref_input', e.target.value)} />
                            </td>

                            {/* Notes — white bg */}
                            <td>
                              <input type="text" value={row.notes_input} disabled={isConfirmed}
                                placeholder="Notes..."
                                style={{ background: isConfirmed ? 'var(--bg2)' : '#fff' }}
                                onChange={e => setField(row.item_id, 'notes_input', e.target.value)} />
                            </td>

                            {/* Status */}
                            <td>
                              {row.tx_id ? (() => {
                                const s = row.tx_status;
                                const cfg = {
                                  incomplete: { bg:'#fff7ed', color:'#ea580c', border:'#fed7aa', label:'Incomplete' },
                                  saved:      { bg:'#eff6ff', color:'#2563eb', border:'#bfdbfe', label:'Saved' },
                                  confirmed:  { bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0', label:'Approved' },
                                }[s] || { bg:'#f3f4f6', color:'#6b7280', border:'#e5e7eb', label: s };
                                return (
                                  <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                                    borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {cfg.label}
                                  </span>
                                );
                              })()
                                : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>

              {/* Summary footer */}
              <tfoot>
                <tr style={{ background: '#f0f7ff', borderTop: '2px solid #bfdbfe' }}>
                  <td colSpan={3} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#1e40af' }}>
                    TOTAL — {totalFiltered} item{totalFiltered !== 1 ? 's' : ''} shown
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>{fmt2(totalPlanned)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0ea5e9' }}>{fmt2(totalDelivered)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fmt2(totalRemaining)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden', minWidth: 50 }}>
                        <div style={{ height: '100%', borderRadius: 99, width: `${overallPct}%`,
                          background: overallPct >= 100 ? '#10b981' : overallPct >= 60 ? '#0ea5e9' : '#f59e0b' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{overallPct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#10b981' }}>{fmt2(totalToday)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            page={page} totalPages={totalPages} total={totalFiltered}
            pageSize={pageSize} onPage={setPage} onPageSize={setPageSize}
          />

          {/* Bottom action bar — matches BOQ: Draft / Save / Confirm / Unpost */}
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'var(--card2)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>{filteredRows.length} of {rows.length} items</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Draft / Save / Approve — hidden when all entries are approved */}
              {showWorkflow && (
                <>
                  <button onClick={handleDraft} disabled={saving} style={btnStyle('var(--card)', 'var(--text)', 'var(--border)')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    {saving ? t.saving : 'Draft'}
                  </button>
                  <button onClick={handleSave} disabled={saving} style={btnStyle('#2563eb')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    {saving ? t.saving : 'Save'}
                  </button>
                  <button onClick={handleConfirm} disabled={confirming} style={btnStyle('#16a34a')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    {confirming ? t.saving : 'Approve'}
                  </button>
                </>
              )}
              {/* Unpost — shown when approved entries exist + permission */}
              {canUnpost && (
                <button onClick={handleUnpost} disabled={unposting} style={btnStyle('#dc2626')}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                  {unposting ? 'Unposting...' : 'Unpost'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}