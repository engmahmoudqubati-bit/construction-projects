import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button, DatePicker, Input, Select, Space, Tag } from 'antd';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
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
    border: active ? '1.5px solid #2563eb' : '1px solid #d9e2ef',
    background: active ? '#2563eb' : '#fff',
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
  saved:      { bg:'#f5f3ff', color:'#2563eb', border:'#ddd6fe', label:'Saved' },
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

  const csvCell = (value) => {
    const text = value == null ? '' : String(value).replace(/\u200B/g, '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const downloadCSV = (csv, filename) => {
    // UTF-8 BOM is required so Excel opens Arabic/special characters correctly.
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  function buildMatrixExportRows() {
    const selectedMonthKey = date ? date.slice(0, 7) : '';
    const normalizedSearch = (search || '').trim().toLowerCase();
    const rowClassKey = (r) => r.parent_classification_name
      ? `${r.parent_classification_name} › ${r.classification_name || ''}`
      : r.classification_name || 'Uncategorized';

    const monthRows = (matrixData || []).filter(r => {
      const dateKey = (r.transaction_date || '').slice(0, 7);
      return selectedMonthKey ? dateKey === selectedMonthKey : true;
    });

    const filteredSourceRows = monthRows.filter(r => {
      if (normalizedSearch) {
        const found =
          (r.item_code || '').toLowerCase().includes(normalizedSearch) ||
          (r.item_name || '').toLowerCase().includes(normalizedSearch) ||
          (r.classification_name || '').toLowerCase().includes(normalizedSearch) ||
          (r.parent_classification_name || '').toLowerCase().includes(normalizedSearch);
        if (!found) return false;
      }
      if (filterClass && rowClassKey(r) !== filterClass) return false;
      if (filterStatus) {
        if (filterStatus === 'no_entry') return !r.transaction_date || !r.tx_status;
        return r.tx_status === filterStatus;
      }
      return true;
    });

    const visibleDates = [...new Set(
      filteredSourceRows
        .filter(r => r.transaction_date && (parseFloat(r.qty_delivered) || 0) > 0)
        .map(r => r.transaction_date)
    )].sort();

    const itemMap = {};
    filteredSourceRows.forEach(r => {
      if (!itemMap[r.item_id]) {
        itemMap[r.item_id] = {
          item_code: r.item_code,
          item_name: r.item_name,
          unit_of_measure: r.unit_of_measure,
          classification: rowClassKey(r),
          planned_qty: parseFloat(r.planned_qty) || 0,
          entries: {},
        };
      }
      const qty = parseFloat(r.qty_delivered) || 0;
      if (r.transaction_date && qty > 0) {
        itemMap[r.item_id].entries[r.transaction_date] = { qty, status: r.tx_status, ref: r.delivery_ref };
      }
    });

    const items = Object.values(itemMap).filter(item =>
      visibleDates.some(d => (item.entries[d]?.qty || 0) > 0)
    );

    return { visibleDates, items };
  }

  function exportCSV() {
    if (activeTab === 'matrix') {
      const { visibleDates, items } = buildMatrixExportRows();
      const headers = ['Item Code','Item Name','Classification','Unit','Planned Qty','Delivered Qty','Progress %', ...visibleDates];
      const csvRows = items.map(item => {
        const delivered = visibleDates.reduce((s, d) => s + (item.entries[d]?.qty || 0), 0);
        const planned = parseFloat(item.planned_qty) || 0;
        const pct = planned > 0 ? Math.min(100, (delivered / planned) * 100) : 0;
        return [
          item.item_code, item.item_name, item.classification, item.unit_of_measure || '',
          fmt2(planned), fmt2(delivered), `${pct.toFixed(1)}%`,
          ...visibleDates.map(d => item.entries[d]?.qty ? fmt2(item.entries[d].qty) : '')
        ].map(csvCell).join(',');
      });
      const csv = [headers.map(csvCell).join(','), ...csvRows].join('\n');
      downloadCSV(csv, `delivery_matrix_${projectId}_${date.slice(0, 7)}.csv`);
      return;
    }

    const headers = ['Item Code','Item Name','Classification','Unit','Planned Qty','Total Delivered','Live Delivered','Remaining','Progress %','Delivery Qty','Ref/PO Number','Notes','Status'];
    const csvRows = filteredRows.map(r => {
      const planned      = parseFloat(r.planned_qty) || 0;
      const deliveredAll = parseFloat(r.total_delivered_all) || 0;
      const dbTodayQty   = parseFloat(r.qty_delivered) || 0;
      const todayQty     = parseFloat(r.qty_input) || 0;
      const liveDelivered = Math.max(0, deliveredAll - dbTodayQty + todayQty);
      const remaining    = Math.max(0, planned - liveDelivered);
      const pct          = planned > 0 ? Math.min(100, (liveDelivered / planned) * 100) : 0;
      const classification = r.parent_classification_name
        ? `${r.parent_classification_name} › ${r.classification_name || ''}`
        : r.classification_name || 'Uncategorized';
      return [
        r.item_code, r.item_name, classification, r.unit_of_measure || '',
        fmt2(planned), fmt2(deliveredAll), fmt2(liveDelivered), fmt2(remaining), `${pct.toFixed(1)}%`,
        r.qty_input || '', r.ref_input || '', r.notes_input || '',
        r.tx_status || '',
      ].map(csvCell).join(',');
    });
    const csv = [headers.map(csvCell).join(','), ...csvRows].join('\n');
    downloadCSV(csv, `delivery_daily_entry_${projectId}_${date}.csv`);
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
        (r.classification_name || '').toLowerCase().includes(q) ||
        (r.parent_classification_name || '').toLowerCase().includes(q)
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

  const btnStyle = (bg, color = '#fff', border = bg) => ({
    display: 'flex', alignItems: 'center', gap: 6, background: bg,
    border: `1px solid ${border}`, borderRadius: 8, padding: '7px 14px',
    fontSize: 12, fontWeight: 700, color, cursor: 'pointer', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  });

  const pageShell = {
    background: '#f4f7fb',
    margin: '-8px',
    padding: '12px',
    minHeight: 'calc(100vh - 90px)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };
  const panelStyle = {
    background: '#fff',
    border: '1px solid #d9e2ef',
    borderRadius: 14,
    boxShadow: '0 10px 28px rgba(15,23,42,0.06)',
  };
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 800, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
  };

  const thStyle = {
    background: '#eaf2ff', color: '#1e3a5f', fontWeight: 800, fontSize: 12,
    padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: '1px solid #cfe0ff', letterSpacing: '0.02em',
  };

  return (
    <div style={pageShell}>
      {/* Compact professional header */}
      <div style={{ ...panelStyle, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,#1f3a5f,#2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 8px 18px rgba(37, 99, 235, 0.22)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 17 }}>🚚</span>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.15 }}>
              {t.delivery}
            </h1>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Daily delivery entry for project materials and site quantities.
            </div>
          </div>
          {rows.length > 0 && (
            <Space size={6} wrap>
              {incompleteCount > 0 && <Tag color="orange" style={{ borderRadius: 8, fontWeight: 700 }}>{incompleteCount} incomplete</Tag>}
              {savedCount > 0 && <Tag color="blue" style={{ borderRadius: 8, fontWeight: 700 }}>{savedCount} saved</Tag>}
              {confirmedCount > 0 && <Tag color="green" style={{ borderRadius: 8, fontWeight: 700 }}>{confirmedCount} approved</Tag>}
            </Space>
          )}
        </div>
      </div>

      {/* Shared advanced filters */}
      <div style={{ ...panelStyle, padding: 12, marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.45fr) 150px minmax(190px, 1fr) minmax(180px, 1fr) 150px auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Project</label>
            <Select
              showSearch
              allowClear
              placeholder={`— ${t.selectProject} —`}
              value={projectId || undefined}
              onChange={(value) => {
                const nextProjectId = value || '';
                setProjectId(nextProjectId);
                setSearch('');
                setFilterClass('');
                setFilterStatus('');
                setPage(1);
                if (!nextProjectId) {
                  setRows([]);
                  rowsRef.current = [];
                  setMatrixData([]);
                  setLoading(false);
                  setMatrixLoading(false);
                }
              }}
              optionFilterProp="label"
              style={{ width: '100%' }}
              size="middle"
              options={projects.map(p => ({ value: String(p.id), label: projectLabel(p) }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Date</label>
            <DatePicker
              value={date ? dayjs(date) : null}
              onChange={(value) => {
                const next = value ? value.format('YYYY-MM-DD') : '';
                if (isFriday(next)) {
                  toast('Friday is a holiday — please select another day', 'error');
                  return;
                }
                setDate(next);
              }}
              style={{ width: '100%' }}
              size="middle"
              status={isFriday(date) ? 'error' : ''}
            />
          </div>

          <div>
            <label style={labelStyle}>Smart Search</label>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Item code, name, classification..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              disabled={!projectId}
              size="middle"
            />
          </div>

          <div>
            <label style={labelStyle}>Classification</label>
            <Select
              allowClear
              showSearch
              placeholder="All Classifications"
              value={filterClass || undefined}
              onChange={(value) => { setFilterClass(value || ''); setPage(1); }}
              disabled={!projectId || classifications.length === 0}
              optionFilterProp="label"
              style={{ width: '100%' }}
              size="middle"
              options={classifications.map(c => ({ value: c, label: c }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <Select
              allowClear
              placeholder="All Status"
              value={filterStatus || undefined}
              onChange={(value) => { setFilterStatus(value || ''); setPage(1); }}
              disabled={!projectId}
              style={{ width: '100%' }}
              size="middle"
              options={[
                { value: 'incomplete', label: 'Incomplete' },
                { value: 'saved', label: 'Saved' },
                { value: 'confirmed', label: 'Approved' },
                { value: 'no_entry', label: 'No Entry' },
              ]}
            />
          </div>

          <Space size={8} style={{ justifyContent: 'flex-end' }}>
            {projectId && date && (
              <Button icon={<ReloadOutlined />} onClick={load}>
                Refresh
              </Button>
            )}
            {rows.length > 0 && (
              <Button type="primary" icon={<DownloadOutlined />} onClick={exportCSV}>
                Export
              </Button>
            )}
          </Space>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
            Filters narrow the delivery rows without changing your original item/classification structure.
          </div>
          {isFriday(date) && <Tag color="red" style={{ borderRadius: 8, fontWeight: 700 }}>Friday is a holiday</Tag>}
        </div>
      </div>

      {/* Tab bar */}
      {projectId && (
        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #dbe7f7', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'entry', label: 'Daily Entry' },
              { id: 'matrix', label: 'Delivery Matrix' },
            ].map(tab => (
              <Button
                key={tab.id}
                size="middle"
                type={activeTab === tab.id ? 'primary' : 'default'}
                onClick={() => setActiveTab(tab.id)}
                style={{ borderRadius: 9, fontWeight: 700 }}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          {rows.length > 0 && activeTab === 'entry' && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Showing <strong style={{ color: '#0f172a' }}>{totalFiltered}</strong> of <strong style={{ color: '#0f172a' }}>{rows.length}</strong> items
            </div>
          )}
        </div>
      )}

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
            <div key={k.label} style={{ flex: '1 1 140px', background: '#fff', border: '1px solid #d9e2ef', borderRadius: 12, padding: '12px 16px', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2563eb', marginBottom: 4 }}>{k.label}</div>
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
        <div style={{ background: '#fff', border: '1px solid #d9e2ef', borderRadius: 14, overflow: 'hidden' }}>
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
                        <td colSpan={4} style={{ background: '#eaf2ff', padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#2563eb', letterSpacing: '0.04em' }}>
                          {group}
                        </td>
                        <td style={{ background: '#eaf2ff', padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#2563eb', textAlign: 'right' }}>{fmt2(gDelivered)}</td>
                        <td style={{ background: '#eaf2ff', padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#2563eb', textAlign: 'right' }}>{fmt2(gRemaining)}</td>
                        <td colSpan={5} style={{ background: '#eaf2ff' }} />
                      </tr>

                      {items.map((row, rowIndex) => {
                        const isConfirmed   = row.tx_status === 'confirmed';
                        const planned       = parseFloat(row.planned_qty) || 0;
                        const deliveredAll  = parseFloat(row.total_delivered_all) || 0;
                        const dbTodayQty    = parseFloat(row.qty_delivered) || 0;
                        const todayQty      = parseFloat(row.qty_input) || 0;
                        // Progress must compare delivered quantity with planning.
                        // total_delivered_all already includes the DB value for the selected day,
                        // so subtract the DB day qty before adding the live input to avoid double counting.
                        const liveDelivered = Math.max(0, deliveredAll - dbTodayQty + todayQty);
                        const remaining     = Math.max(0, planned - liveDelivered);
                        const pct           = planned > 0 ? Math.min(100, (liveDelivered / planned) * 100) : 0;
                        const isComplete    = liveDelivered >= planned && planned > 0;
                        const isOverDel     = !isConfirmed && todayQty > 0 && liveDelivered > planned;

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
                                    background: pct >= 100 ? '#16a34a' : '#2563eb', transition: 'width 0.3s' }} />
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
                <tr style={{ background: '#eaf2ff', borderTop: '2px solid #cfe0ff' }}>
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
                          background: overallPct >= 100 ? '#16a34a' : '#2563eb' }} />
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
                  <button onClick={handleSave} disabled={saving} style={btnStyle('#2563eb')}>
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
          selectedDate={date}
          search={search}
          filterClass={filterClass}
          filterStatus={filterStatus}
        />
      )}

    </div>
  );
}

// ── Delivery Matrix Component ─────────────────────────────────────────────
function DeliveryMatrix({ projectId, data, loading, onRefresh, selectedDate, search, filterClass, filterStatus }) {
  if (!projectId) return <div className="empty-state"><div className="empty-icon">📊</div><p>Select a project to view the matrix</p></div>;
  if (loading)    return <div className="spinner-wrap"><div className="spinner" /></div>;

  const fmt2 = v => (parseFloat(v) || 0).toFixed(2);

  const selectedMonthKey = selectedDate ? selectedDate.slice(0, 7) : '';
  const monthLabel = selectedDate
    ? new Date(`${selectedMonthKey}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : 'selected month';

  const rowClassKey = (r) => r.parent_classification_name
    ? `${r.parent_classification_name} › ${r.classification_name || ''}`
    : r.classification_name || 'Uncategorized';

  const normalizedSearch = (search || '').trim().toLowerCase();

  // Matrix rules:
  // 1) show only days from the selected month.
  // 2) show only days that actually contain delivered quantity after header filters.
  // 3) keep the same item/classification structure, but narrow results using the shared header filters.
  const monthRows = (data || []).filter(r => {
    const dateKey = (r.transaction_date || '').slice(0, 7);
    return selectedMonthKey ? dateKey === selectedMonthKey : true;
  });

  const filteredSourceRows = monthRows.filter(r => {
    if (normalizedSearch) {
      const found =
        (r.item_code || '').toLowerCase().includes(normalizedSearch) ||
        (r.item_name || '').toLowerCase().includes(normalizedSearch) ||
        (r.classification_name || '').toLowerCase().includes(normalizedSearch) ||
        (r.parent_classification_name || '').toLowerCase().includes(normalizedSearch);
      if (!found) return false;
    }
    if (filterClass && rowClassKey(r) !== filterClass) return false;
    if (filterStatus) {
      if (filterStatus === 'no_entry') return !r.transaction_date || !r.tx_status;
      return r.tx_status === filterStatus;
    }
    return true;
  });

  // Only days that contain delivered qty in the selected month and after filters.
  const visibleDates = [...new Set(
    filteredSourceRows
      .filter(r => r.transaction_date && (parseFloat(r.qty_delivered) || 0) > 0)
      .map(r => r.transaction_date)
  )].sort();

  // Build item rows from filtered source rows, while only storing entries for visible dates.
  const itemMap = {};
  filteredSourceRows.forEach(r => {
    if (!itemMap[r.item_id]) {
      itemMap[r.item_id] = {
        item_id: r.item_id,
        item_code: r.item_code,
        item_name: r.item_name,
        unit_of_measure: r.unit_of_measure,
        planned_qty: r.planned_qty,
        classification_name: r.classification_name,
        parent_classification_name: r.parent_classification_name,
        entries: {},
      };
    }
    if (r.transaction_date && visibleDates.includes(r.transaction_date)) {
      const qty = parseFloat(r.qty_delivered) || 0;
      if (qty > 0) {
        itemMap[r.item_id].entries[r.transaction_date] = {
          qty,
          status: r.tx_status,
          ref: r.delivery_ref,
        };
      }
    }
  });

  let items = Object.values(itemMap).filter(item =>
    visibleDates.some(d => (item.entries[d]?.qty || 0) > 0)
  );

  if (visibleDates.length === 0 || items.length === 0) return (
    <div style={{ background: '#fff', border: '1px solid #d9e2ef', borderRadius: 14, padding: 28, textAlign: 'center', color: '#64748b' }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>📅</div>
      <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>No delivered quantities found</div>
      <div style={{ fontSize: 13 }}>
        No delivery quantities match the selected month{filterStatus ? ', status' : ''}{filterClass ? ', classification' : ''}{normalizedSearch ? ', and search' : ''} filters.
      </div>
    </div>
  );

  const statusColorMap = { confirmed: '#16a34a', saved: '#2563eb', incomplete: '#ea580c' };
  const statusSoftMap = { confirmed: '#ecfdf5', saved: '#eff6ff', incomplete: '#fff7ed' };
  const statusColor = (s) => statusColorMap[s] || '#94a3b8';
  const statusSoft = (s) => statusSoftMap[s] || '#f8fafc';
  const statusLabelMap = { confirmed: 'A', saved: 'S', incomplete: 'D' };
  const statusLabel = (s) => statusLabelMap[s] || '';

  const formatDate = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const dateTotals = visibleDates.map(d =>
    items.reduce((s, item) => s + (item.entries[d]?.qty || 0), 0)
  );

  const totalPlanned = items.reduce((s, item) => s + (parseFloat(item.planned_qty) || 0), 0);
  const totalDelivered = items.reduce((s, item) =>
    s + visibleDates.reduce((ds, d) => ds + (item.entries[d]?.qty || 0), 0), 0
  );
  const overallPct = totalPlanned > 0 ? Math.min(100, (totalDelivered / totalPlanned) * 100) : 0;

  const matrixTh = {
    background: '#eaf2ff',
    color: '#1e3a5f',
    fontWeight: 800,
    fontSize: 11,
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '1px solid #cfe0ff',
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      <div style={{
        background: '#fff',
        border: '1px solid #d9e2ef',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        boxShadow: '0 10px 24px rgba(15,23,42,0.04)',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Delivery Matrix — {monthLabel}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Showing only days that contain delivered quantities. Progress compares delivered quantity with planned quantity.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #dbe7f7', borderRadius: 10, padding: '7px 10px' }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Days</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: '#0f172a', fontWeight: 800 }}>{visibleDates.length}</span>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #dbe7f7', borderRadius: 10, padding: '7px 10px' }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Delivered</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: '#0f172a', fontWeight: 800 }}>{fmt2(totalDelivered)}</span>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #dbe7f7', borderRadius: 10, padding: '7px 10px' }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Progress</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: overallPct >= 100 ? '#16a34a' : '#2563eb', fontWeight: 900 }}>{overallPct.toFixed(1)}%</span>
          </div>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 9, fontWeight: 700 }}>
            Refresh
          </Button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #d9e2ef', borderRadius: 14, overflow: 'hidden', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...matrixTh, minWidth: 70, position: 'sticky', left: 0, zIndex: 3 }}>Code</th>
                <th style={{ ...matrixTh, minWidth: 210, position: 'sticky', left: 70, zIndex: 3 }}>Item Name</th>
                <th style={{ ...matrixTh, textAlign: 'center' }}>Unit</th>
                <th style={{ ...matrixTh, textAlign: 'right' }}>Planned</th>
                <th style={{ ...matrixTh, textAlign: 'right' }}>Delivered</th>
                <th style={{ ...matrixTh, minWidth: 120 }}>Progress</th>
                {visibleDates.map(d => (
                  <th key={d} style={{ ...matrixTh, color: '#2563eb', textAlign: 'center', borderLeft: '1px solid #cfe0ff', minWidth: 76 }}>
                    {formatDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const itemDelivered = visibleDates.reduce((s, d) => s + (item.entries[d]?.qty || 0), 0);
                const planned = parseFloat(item.planned_qty) || 0;
                const pct = planned > 0 ? Math.min(100, (itemDelivered / planned) * 100) : 0;
                const rowBg = idx % 2 === 0 ? '#fafbff' : '#fff';
                return (
                  <tr key={item.item_id} style={{ borderBottom: '1px solid #f1f5f9', background: rowBg }}>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 11, position: 'sticky', left: 0, background: rowBg, zIndex: 2 }}>{item.item_code}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a', position: 'sticky', left: 70, background: rowBg, zIndex: 2 }}>
                      {item.item_name}
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{rowClassKey(item)}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', textAlign: 'center' }}>{item.unit_of_measure || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt2(planned)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: itemDelivered >= planned && planned > 0 ? '#16a34a' : '#0f172a' }}>{fmt2(itemDelivered)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 7, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden', minWidth: 58 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#2563eb', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', minWidth: 34, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    {visibleDates.map(d => {
                      const entry = item.entries[d];
                      return (
                        <td key={d} style={{ padding: '8px 10px', textAlign: 'center', borderLeft: '1px solid #eef2f7', background: entry ? statusSoft(entry.status) : rowBg }}>
                          {entry ? (
                            <div title={entry.ref ? `Ref: ${entry.ref}` : ''}>
                              <div style={{ fontWeight: 800, fontSize: 12, color: '#0f172a' }}>{fmt2(entry.qty)}</div>
                              <div style={{ fontSize: 10, color: statusColor(entry.status), fontWeight: 900 }}>{statusLabel(entry.status)}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#cbd5e1', fontSize: 16 }}>·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#eaf2ff', borderTop: '2px solid #cfe0ff' }}>
                <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 900, fontSize: 12, color: '#0f172a' }}>TOTAL — {items.length} item{items.length !== 1 ? 's' : ''}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{fmt2(totalPlanned)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{fmt2(totalDelivered)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 900, color: '#2563eb' }}>{overallPct.toFixed(1)}%</td>
                {dateTotals.map((total, i) => (
                  <td key={i} style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 900, color: '#2563eb', borderLeft: '1px solid #cfe0ff', fontSize: 12 }}>
                    {fmt2(total)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginTop: 10, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
        <span><span style={{ color: '#16a34a', fontWeight: 900 }}>A</span> Approved</span>
        <span><span style={{ color: '#2563eb', fontWeight: 900 }}>S</span> Saved</span>
        <span><span style={{ color: '#ea580c', fontWeight: 900 }}>D</span> Draft</span>
      </div>
    </div>
  );
}
