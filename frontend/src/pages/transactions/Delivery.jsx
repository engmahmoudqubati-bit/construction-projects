import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const today = () => {
  const d = new Date();
  // If today is Friday (5), go back to Thursday
  if (d.getDay() === 5) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Returns true if a date string is a Friday
const isFriday = (dateStr) => dateStr && new Date(dateStr).getDay() === 5;
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
    border: active ? '1.5px solid #7c3aed' : '1px solid #e5e7eb',
    background: active ? '#7c3aed' : '#fff',
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



// Status badge helper — avoids IIFE in JSX which causes Vite minifier TDZ errors
const TX_STATUS_CFG = {
  incomplete: { bg:'#fff7ed', color:'#ea580c', border:'#fed7aa', label:'Incomplete' },
  saved:      { bg:'#f5f3ff', color:'#7c3aed', border:'#ddd6fe', label:'Saved' },
  confirmed:  { bg:'#f0fdf4', color:'#16a34a', border:'#bbf7d0', label:'Approved' },
};
function StatusBadge({ status }) {
  if (!status) return <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>;
  const cfg = TX_STATUS_CFG[status] || { bg:'#f3f4f6', color:'#6b7280', border:'#e5e7eb', label: status };
  return (
    <span style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`,
      borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
      {cfg.label}
    </span>
  );
}

export default function Delivery() {
  const toast = useToast();
  const { canAction } = useAuth();

  const [projects,   setProjects]   = useState([]);
  const [projectId,  setProjectId]  = useState('');
  const [date,       setDate]       = useState(today());
  const [rows,       setRows]       = useState([]);
  const rowsRef = useRef([]);  // always holds latest rows, avoids stale closure in handlers
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [activeTab,  setActiveTab]  = useState('entry');  // 'entry' | 'matrix'
  const [matrixData, setMatrixData] = useState([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [confirming,  setConfirming]  = useState(false);
  const [unposting,   setUnposting]   = useState(false);

  // Search / filter / pagination
  const [search,     setSearch]     = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(25);

  useEffect(() => { api.getProjects().then(setProjects).catch(() => {}); }, []);

  // Full reload — resets all inputs from DB (used on project/date change only)
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

  // Soft refresh — merges DB data into state WITHOUT resetting qty_input/ref/notes the user typed
  const softRefresh = useCallback(async () => {
    if (!projectId || !date) return;
    try {
      const data = await api.getDelivery(projectId, date);
      setRows(prev => data.map(r => {
        const existing = prev.find(p => p.item_id === r.item_id);
        // Always keep what the user typed — never overwrite input fields from DB
        return {
          ...r,
          qty_input:            existing ? existing.qty_input    : (r.qty_delivered != null ? parseFloat(r.qty_delivered).toFixed(2) : ''),
          ref_input:            existing ? existing.ref_input    : (r.delivery_ref  ?? ''),
          notes_input:          existing ? existing.notes_input  : (r.notes         ?? ''),
          // Only refresh DB metadata
          tx_id:                r.tx_id,
          tx_status:            r.tx_status,
          total_delivered:      r.total_delivered,
          total_delivered_all:  r.total_delivered_all,
          planned_qty:          r.planned_qty,
        };
      }));
    } catch (err) { /* silent */ }
  }, [projectId, date]);

  const loadMatrix = useCallback(async () => {
    if (!projectId) return;
    setMatrixLoading(true);
    try {
      const data = await api.getDeliveryMatrix(projectId);
      setMatrixData(data);
    } catch (err) { toast(err.message, 'error'); }
    finally { setMatrixLoading(false); }
  }, [projectId, toast]);

  useEffect(() => {
    if (activeTab === 'matrix' && projectId) loadMatrix();
  }, [activeTab, projectId, loadMatrix]);

  function setField(itemId, field, val) {
    setRows(rs => {
      const updated = rs.map(r => r.item_id === itemId ? { ...r, [field]: val } : r);
      rowsRef.current = updated;
      return updated;
    });
  }

  // Keep rowsRef current whenever setRows is called from load/softRefresh
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Save current qty inputs to backend as draft
  function buildEntries() {
    const current = rowsRef.current;
    // Rows with a valid qty to save/update
    const toSave = current
      .filter(r => r.qty_input !== '' && parseFloat(r.qty_input) > 0)
      .map(r => ({
        item_id: r.item_id,
        qty_delivered: parseFloat(r.qty_input),
        delivery_ref: r.ref_input || null,
        notes: r.notes_input || null,
      }));
    // Rows cleared to 0 or blank that already exist in DB — must be deleted
    const toDelete = current.filter(r =>
      r.tx_id &&
      r.tx_status !== 'confirmed' &&
      (r.qty_input === '' || parseFloat(r.qty_input) <= 0)
    );
    return { toSave, toDelete };
  }

  async function handleDraft() {
    if (!projectId || !date) return toast('Select project and date', 'error');
    setSaving(true);
    try {
      const { toSave, toDelete } = buildEntries();
      for (const r of toDelete) await api.deleteDelivery(r.tx_id);
      const res = await api.saveDelivery({ project_id: projectId, transaction_date: date, entries: toSave, tx_status: 'incomplete' });
      toast(`Status: Incomplete (${res.saved} saved, ${toDelete.length} cleared)`);
      await softRefresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleSave() {
    if (!projectId || !date) return toast('Select project and date', 'error');
    setSaving(true);
    try {
      const { toSave, toDelete } = buildEntries();
      for (const r of toDelete) await api.deleteDelivery(r.tx_id);
      const res = await api.saveDelivery({ project_id: projectId, transaction_date: date, entries: toSave, tx_status: 'saved' });
      toast(`Status: Saved (${res.saved} saved, ${toDelete.length} cleared)`);
      await softRefresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleConfirm() {
    if (!projectId || !date) return;
    setConfirming(true);
    try {
      const res = await api.confirmDelivery(projectId, date);
      toast(`Status: Approved (${res.confirmed} entries)`);
      await softRefresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { setConfirming(false); }
  }

  async function handleUnpost() {
    if (!projectId || !date) return;
    setUnposting(true);
    try {
      const res = await api.unpostDelivery(projectId, date);
      toast(`Unposted — ${res.unposted} entries reverted to Incomplete`);
      await softRefresh();
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
    background: '#f0f7ff', color: '#111827', fontWeight: 700, fontSize: 12,
    padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: '1px solid #e0ecff', letterSpacing: '0.02em',
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

      {/* Tab bar */}
      {projectId && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 18, borderBottom: '2px solid #ede9fe' }}>
          {[
            { id: 'entry',  label: '📋 Daily Entry' },
            { id: 'matrix', label: '📊 Delivery Matrix' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', fontFamily: 'inherit',
              color: activeTab === tab.id ? '#7c3aed' : '#6b7280',
              borderBottom: activeTab === tab.id ? '2px solid #7c3aed' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s',
            }}>{tab.label}</button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar" style={{ display: activeTab === 'entry' ? undefined : 'none' }}>
        <div className="filter-group">
          <label>🏗️ {t.selectProject}:</label>
          <select value={projectId} onChange={e => { setProjectId(e.target.value); setSearch(''); setFilterClass(''); setFilterStatus(''); }} style={filterSelectStyle}>
            <option value="">— {t.selectProject} —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{projectLabel(p)}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>📅 {t.selectDate}:</label>
          <input type="date" value={date}
            onChange={e => {
              if (isFriday(e.target.value)) {
                toast('Friday is a holiday — please select another day', 'error');
                return;
              }
              setDate(e.target.value);
            }}
            style={{ ...filterDateStyle, borderColor: isFriday(date) ? '#dc2626' : '#7c3aed' }} />
          {isFriday(date) && <span style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>⛔ Friday is a holiday</span>}
        </div>

        {/* Search */}
        {projectId && (
          <div className="filter-group">
            <label>🔍 Search:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'var(--card)', border: '2px solid #7c3aed', borderRadius: 10, height: 40, paddingLeft: 10, minWidth: 180 }}>
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
              style={{ ...filterDateStyle, minWidth: 180, border: '2px solid #7c3aed', fontWeight: 400, fontSize: 13 }}>
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
              style={{ ...filterDateStyle, minWidth: 140, border: '2px solid #7c3aed', fontWeight: 400, fontSize: 13 }}>
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
          <button onClick={exportCSV} style={{ ...btnStyle('#7c3aed'), height: 38, alignSelf: 'flex-end', fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        )}

        {rows.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {incompleteCount > 0 && <span style={{background:'#fff7ed',color:'#ea580c',border:'1px solid #fed7aa',borderRadius:6,padding:'3px 8px',fontSize:11,fontWeight:700}}>{incompleteCount} incomplete</span>}
            {savedCount > 0      && <span style={{background:'#f5f3ff',color:'#7c3aed',border:'1px solid #ddd6fe',borderRadius:6,padding:'3px 8px',fontSize:11,fontWeight:700}}>{savedCount} saved</span>}
            {confirmedCount > 0 && <span style={{background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',borderRadius:6,padding:'3px 8px',fontSize:11,fontWeight:700}}>{confirmedCount} approved</span>}
          </div>
        )}
      </div>

      {/* ── ENTRY TAB ── */}
      {activeTab === 'entry' && <>

      {/* KPI summary cards */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          {[
            { label: 'Planned (Total)',      value: fmt2(totalPlanned)   },
            { label: 'Delivered (All Time)', value: fmt2(totalDelivered) },
            { label: 'Remaining',            value: fmt2(totalRemaining) },
            { label: "Today's Entries",      value: fmt2(totalToday)     },
            { label: 'Overall Progress',     value: `${overallPct.toFixed(1)}%` },
          ].map(k => (
            <div key={k.label} style={{ flex: '1 1 140px', background: 'var(--card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7c3aed', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{k.value}</div>
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
        <div style={{ background: 'var(--card)', border: '1px solid var(--border-light)', borderRadius: 14, overflow: 'hidden' }}>
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
                      <tr key={`g-${group}`}>
                        <td colSpan={4} style={{ background: '#ede9fe', padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#7c3aed', letterSpacing: '0.04em' }}>
                          {group}
                        </td>
                        <td style={{ background: '#ede9fe', padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#7c3aed', textAlign: 'right' }}>{fmt2(gDelivered)}</td>
                        <td style={{ background: '#ede9fe', padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#7c3aed', textAlign: 'right' }}>{fmt2(gRemaining)}</td>
                        <td colSpan={5} style={{ background: '#ede9fe' }} />
                      </tr>

                      {items.map((row, rowIndex) => {
                        const isConfirmed   = row.tx_status === 'confirmed';
                        const planned       = parseFloat(row.planned_qty) || 0;
                        const deliveredAll  = parseFloat(row.total_delivered_all) || 0;
                        const deliveredUpTo = parseFloat(row.total_delivered) || 0;
                        const remaining     = Math.max(0, planned - deliveredAll);
                        const todayQty      = parseFloat(row.qty_input) || 0;
                        const liveDelivered = isConfirmed ? deliveredUpTo : deliveredUpTo + todayQty;
                        const pct           = planned > 0 ? Math.min(100, (liveDelivered / planned) * 100) : 0;
                        const isComplete    = deliveredAll >= planned && planned > 0;
                        const isOverDel     = !isConfirmed && todayQty > 0 && (deliveredAll + todayQty) > planned;

                        return (
                          <tr key={row.item_id} style={{
                            borderBottom: '1px solid #f3f4f6',
                            background: isOverDel ? '#fffbeb' : rowIndex % 2 === 0 ? '#fafbff' : '#fff',
                            opacity: isComplete && !row.tx_id ? 0.5 : 1,
                          }}>
                            <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>{row.item_code}</td>
                            <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                              {row.item_name}
                              {isOverDel && <span title="Will exceed planned qty!" style={{ marginLeft: 6, color: '#ea580c', fontSize: 11, fontWeight: 700 }}>⚠ Over</span>}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>{row.unit_of_measure || '—'}</td>

                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmt2(planned)}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmt2(deliveredAll)}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: isComplete ? '#16a34a' : '#111827' }}>
                              {isComplete ? '✓ Done' : fmt2(remaining)}
                            </td>

                            {/* Progress */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden', minWidth: 50 }}>
                                  <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`,
                                    background: pct >= 100 ? '#16a34a' : '#7c3aed', transition: 'width 0.3s' }} />
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
                              <StatusBadge status={row.tx_id ? row.tx_status : null} />
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
                <tr style={{ background: '#f0f7ff', borderTop: '2px solid #e0ecff' }}>
                  <td colSpan={3} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#111827' }}>
                    TOTAL — {totalFiltered} item{totalFiltered !== 1 ? 's' : ''} shown
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{fmt2(totalPlanned)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{fmt2(totalDelivered)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{fmt2(totalRemaining)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden', minWidth: 50 }}>
                        <div style={{ height: '100%', borderRadius: 99, width: `${overallPct}%`,
                          background: overallPct >= 100 ? '#16a34a' : '#7c3aed' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{overallPct.toFixed(1)}%</span>
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

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Draft / Save / Approve — hidden when all entries are approved */}
              {showWorkflow && (
                <>
                  <button onClick={handleDraft} disabled={saving} style={btnStyle('var(--card)', 'var(--text)', 'var(--border)')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    {saving ? t.saving : 'Draft'}
                  </button>
                  <button onClick={handleSave} disabled={saving} style={btnStyle('#7c3aed')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    {saving ? t.saving : 'Save'}
                  </button>
                  {savedCount > 0 && (
                    <button onClick={handleConfirm} disabled={confirming} style={btnStyle('#16a34a')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      {confirming ? t.saving : 'Approve'}
                    </button>
                  )}
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

      </> /* end entry tab */}

      {/* ── MATRIX TAB ── */}
      {activeTab === 'matrix' && projectId && (
        <DeliveryMatrix
          projectId={projectId}
          data={matrixData}
          loading={matrixLoading}
          onRefresh={loadMatrix}
        />
      )}

    </div>
  );
}

// ── Delivery Matrix Component ─────────────────────────────────────────────
function DeliveryMatrix({ projectId, data, loading, onRefresh }) {
  const [search, setSearch] = useState('');

  if (!projectId) return <div className="empty-state"><div className="empty-icon">📊</div><p>Select a project to view the matrix</p></div>;
  if (loading)    return <div className="spinner-wrap"><div className="spinner" /></div>;

  // Build list of unique dates (columns), sorted
  const allDates = [...new Set(data.filter(r => r.transaction_date).map(r => r.transaction_date))].sort();

  // Build list of unique items (rows)
  const itemMap = {};
  data.forEach(r => {
    if (!itemMap[r.item_id]) {
      itemMap[r.item_id] = {
        item_id: r.item_id, item_code: r.item_code, item_name: r.item_name,
        unit_of_measure: r.unit_of_measure, planned_qty: r.planned_qty,
        classification_name: r.classification_name,
        parent_classification_name: r.parent_classification_name,
        entries: {},
      };
    }
    if (r.transaction_date) {
      itemMap[r.item_id].entries[r.transaction_date] = {
        qty: parseFloat(r.qty_delivered) || 0,
        status: r.tx_status,
        ref: r.delivery_ref,
      };
    }
  });

  let items = Object.values(itemMap);

  // Search filter
  if (search.trim()) {
    const q = search.toLowerCase();
    items = items.filter(r =>
      (r.item_code || '').toLowerCase().includes(q) ||
      (r.item_name || '').toLowerCase().includes(q)
    );
  }

  if (allDates.length === 0) return (
    <div className="empty-state"><div className="empty-icon">📅</div><p>No delivery entries recorded yet for this project</p></div>
  );

  const fmt2 = v => (parseFloat(v) || 0).toFixed(2);

  const statusColorMap = { confirmed: '#16a34a', saved: '#7c3aed', incomplete: '#ea580c' };
  const statusColor = (s) => statusColorMap[s] || '#9ca3af';

  const statusLabelMap = { confirmed: 'A', saved: 'S', incomplete: 'D' };
  const statusLabel = (s) => statusLabelMap[s] || '';

  const formatDate = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  // Column totals per date
  const dateTotals = allDates.map(d =>
    items.reduce((s, item) => s + (item.entries[d]?.qty || 0), 0)
  );

  return (
    <div>
      {/* Matrix toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '2px solid #7c3aed', borderRadius: 10, height: 38, paddingLeft: 10, minWidth: 200 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input style={{ border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', background: 'none', width: '100%', padding: '0 8px', fontFamily: 'inherit' }}
            placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0 8px' }}>✕</button>}
        </div>
        <button onClick={onRefresh} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', color:'var(--text)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          Refresh
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: '#6b7280' }}>
          <span><span style={{ color: '#16a34a', fontWeight: 700 }}>A</span> = Approved</span>
          <span><span style={{ color: '#7c3aed', fontWeight: 700 }}>S</span> = Saved</span>
          <span><span style={{ color: '#ea580c', fontWeight: 700 }}>D</span> = Draft/Incomplete</span>
        </div>
      </div>

      {/* Matrix table */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border-light)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ background: '#f0f7ff', color: '#111827', fontWeight: 700, fontSize: 11, padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid #e0ecff', whiteSpace: 'nowrap', minWidth: 60, position: 'sticky', left: 0, zIndex: 2 }}>Code</th>
                <th style={{ background: '#f0f7ff', color: '#111827', fontWeight: 700, fontSize: 11, padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid #e0ecff', whiteSpace: 'nowrap', minWidth: 160, position: 'sticky', left: 60, zIndex: 2 }}>Item Name</th>
                <th style={{ background: '#f0f7ff', color: '#111827', fontWeight: 700, fontSize: 11, padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #e0ecff', whiteSpace: 'nowrap' }}>Unit</th>
                <th style={{ background: '#f0f7ff', color: '#111827', fontWeight: 700, fontSize: 11, padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid #e0ecff', whiteSpace: 'nowrap' }}>Planned</th>
                <th style={{ background: '#f0f7ff', color: '#111827', fontWeight: 700, fontSize: 11, padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid #e0ecff', whiteSpace: 'nowrap' }}>Total Del.</th>
                {allDates.map(d => (
                  <th key={d} style={{ background: '#f0f7ff', color: '#7c3aed', fontWeight: 700, fontSize: 11, padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e0ecff', borderLeft: '1px solid #e0ecff', whiteSpace: 'nowrap', minWidth: 70 }}>
                    {formatDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const totalDel = Object.values(item.entries).reduce((s, e) => s + (e.qty || 0), 0);
                const planned  = parseFloat(item.planned_qty) || 0;
                const pct      = planned > 0 ? Math.min(100, (totalDel / planned) * 100) : 0;
                return (
                  <tr key={item.item_id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fafbff' : '#fff' }}>
                    <td style={{ padding: '10px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11, position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fafbff' : '#fff', zIndex: 1 }}>{item.item_code}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827', position: 'sticky', left: 60, background: idx % 2 === 0 ? '#fafbff' : '#fff', zIndex: 1 }}>
                      {item.item_name}
                      <div style={{ marginTop: 3, height: 3, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden', width: 100 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#7c3aed', borderRadius: 99 }} />
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#6b7280', textAlign: 'center' }}>{item.unit_of_measure || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmt2(planned)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: totalDel >= planned && planned > 0 ? '#16a34a' : '#111827' }}>{fmt2(totalDel)}</td>
                    {allDates.map(d => {
                      const entry = item.entries[d];
                      return (
                        <td key={d} style={{ padding: '8px 10px', textAlign: 'center', borderLeft: '1px solid #f3f4f6', background: entry ? (entry.status === 'confirmed' ? '#f0fdf4' : entry.status === 'saved' ? '#f5f3ff' : '#fff7ed') : 'transparent' }}>
                          {entry ? (
                            <div title={entry.ref ? `Ref: ${entry.ref}` : ''}>
                              <div style={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>{fmt2(entry.qty)}</div>
                              <div style={{ fontSize: 10, color: statusColor(entry.status), fontWeight: 700 }}>{statusLabel(entry.status)}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#e5e7eb', fontSize: 16 }}>·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {/* Date totals footer */}
            <tfoot>
              <tr style={{ background: '#f0f7ff', borderTop: '2px solid #e0ecff' }}>
                <td colSpan={4} style={{ padding: '10px 14px', fontWeight: 700, fontSize: 12, color: '#111827' }}>DAILY TOTAL</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                  {fmt2(dateTotals.reduce((s, v) => s + v, 0))}
                </td>
                {dateTotals.map((total, i) => (
                  <td key={i} style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, color: '#7c3aed', borderLeft: '1px solid #e0ecff', fontSize: 12 }}>
                    {total > 0 ? fmt2(total) : <span style={{ color: '#e5e7eb' }}>—</span>}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}