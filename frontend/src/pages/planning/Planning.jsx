import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Empty, Input, Modal, Select, Tag } from 'antd';
import { api } from '../../api/client';
import { useToast } from '../../components/shared/Toast';
import { useAuth } from '../../context/AuthContext';
import t from '../../lang';

const UI = {
  blue: '#2563eb',
  blueDark: '#1d4ed8',
  blueSoft: '#eff6ff',
  blueLine: '#bfdbfe',
  slate: '#0f172a',
  text: '#172033',
  muted: '#64748b',
  border: '#dbe7f5',
  borderSoft: '#e8f0fb',
  page: '#f4f7fb',
  card: '#ffffff',
  rowAlt: '#f8fbff',
  header: '#eaf3ff',
  green: '#16a34a',
  greenSoft: '#f0fdf4',
  orange: '#ea580c',
  orangeSoft: '#fff7ed',
  red: '#dc2626',
  redSoft: '#fef2f2',
};

const STATUS_STYLE = {
  incomplete: { bg: UI.orangeSoft, color: UI.orange, border: '#fed7aa', label: 'Incomplete' },
  saved:      { bg: UI.blueSoft,   color: UI.blue,   border: UI.blueLine, label: 'Saved' },
  approved:   { bg: UI.greenSoft,  color: UI.green,  border: '#bbf7d0', label: 'Approved' },
  draft:      { bg: UI.orangeSoft, color: UI.orange, border: '#fed7aa', label: 'Incomplete' },
};

const fmt2 = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const norm = (value) => String(value || '').toLowerCase().trim();

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCSV(filename, headers, rows) {
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Planning() {
  const toast = useToast();
  const { permissions, canAction, isAdmin } = useAuth();
  const [projects,     setProjects]     = useState([]);
  const [projectId,    setProjectId]    = useState('');
  const [rows,         setRows]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [inserting,    setInserting]    = useState(false);
  const [insertModal,  setInsertModal]  = useState(false);
  const [available,    setAvailable]    = useState([]);
  const [selected,     setSelected]     = useState([]);
  const [insertSearch, setInsertSearch] = useState('');
  const [boqSearch,    setBoqSearch]    = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    api.getProjects().then(ps => {
      const allowed = isAdmin() ? ps : ps.filter(p => !permissions?.projects?.length || permissions.projects.includes(p.id));
      setProjects(allowed);
    }).catch(() => {});
  }, []);

  const loadPlanning = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await api.getPlanning(pid);
      setRows(data.map(r => ({ ...r, qty_input: r.planned_qty != null ? Number(r.planned_qty).toFixed(2) : '' })));
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadPlanning(projectId); }, [projectId, loadPlanning]);

  function handleProjectChange(value) {
    const next = value || '';
    setProjectId(next);
    setRows([]);
    setAvailable([]);
    setSelected([]);
    setBoqSearch('');
    setStatusFilter('all');
    setClassificationFilter('all');
    setPage(1);
    if (!next) setInsertModal(false);
  }

  async function openInsert() {
    if (!projectId) return;
    try {
      const items = await api.getAvailableItems(projectId);
      setAvailable(items);
      setSelected([]);
      setInsertSearch('');
      setInsertModal(true);
    } catch (err) { toast(err.message, 'error'); }
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
  function selectAll()  { setSelected(filteredAvailable.map(i => i.id)); }
  function selectNone() { setSelected([]); }

  async function handleInsert() {
    if (!selected.length) return toast('Select at least one item', 'error');
    setInserting(true);
    try {
      await api.insertPlanningItems({ project_id: projectId, item_ids: selected });
      toast(`${selected.length} item(s) inserted`);
      setInsertModal(false);
      loadPlanning(projectId);
    } catch (err) { toast(err.message, 'error'); }
    finally { setInserting(false); }
  }

  async function saveQty() {
    const entries = rows.filter(r => ['incomplete','saved','draft'].includes(r.status))
      .map(r => ({ item_id: r.item_id, planned_qty: parseFloat(r.qty_input) || 0 }));
    await api.savePlanning({ project_id: projectId, entries });
  }

  async function handleDraft() {
    try { await saveQty(); await api.draftPlanning(projectId); toast('Status: Incomplete'); loadPlanning(projectId); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function handleSave() {
    try { await saveQty(); await api.savePlanningStatus(projectId); toast('Status: Saved'); loadPlanning(projectId); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function handleApprove() {
    try { await saveQty(); await api.approvePlanning(projectId); toast('Status: Approved'); loadPlanning(projectId); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function handleUnpost() {
    try { await api.unpostPlanning(projectId); toast('Unposted — status set to Incomplete'); loadPlanning(projectId); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function handleRemove(itemId) {
    try { await api.deletePlanningItem(projectId, itemId); setRows(rs => rs.filter(r => r.item_id !== itemId)); }
    catch (err) { toast(err.message, 'error'); }
  }

  function exportCSV() {
    const headers = ['Item Code','Item Name','Classification','Unit','Planned Qty','Status'];
    const exportRows = filteredRows.map(r => [
      r.item_code,
      r.item_name,
      r.grandparent_classification_name || r.parent_classification_name || r.classification_name || '',
      r.unit_desc_en || r.unit_code || '',
      Number(r.qty_input || r.planned_qty || 0).toFixed(2),
      r.status
    ]);
    downloadCSV('BOQ.csv', headers, exportRows);
  }

  const classificationOptions = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const main = r.grandparent_classification_name || r.parent_classification_name || r.classification_name || 'Uncategorized';
      const leaf = r.grandparent_classification_name
        ? (r.parent_classification_name || r.classification_name || '')
        : r.parent_classification_name
          ? (r.classification_name || '')
          : '';
      const label = leaf ? `${main} › ${leaf}` : main;
      map.set(label, label);
    });
    return Array.from(map.values()).sort().map(v => ({ value: v, label: v }));
  }, [rows]);

  const hasIncomplete = rows.some(r => ['incomplete','draft'].includes(r.status));
  const hasSaved      = rows.some(r => r.status === 'saved');
  const hasApproved   = rows.some(r => r.status === 'approved');
  const hasEditable   = rows.some(r => ['incomplete','saved','draft'].includes(r.status));
  const canEdit       = hasEditable;
  const canUnpost     = hasApproved && canAction('can_confirm');

  const filteredRows = useMemo(() => {
    const q = norm(boqSearch);
    return rows.filter(r => {
      const main = r.grandparent_classification_name || r.parent_classification_name || r.classification_name || 'Uncategorized';
      const leaf = r.grandparent_classification_name
        ? (r.parent_classification_name || r.classification_name || '')
        : r.parent_classification_name
          ? (r.classification_name || '')
          : '';
      const classLabel = leaf ? `${main} › ${leaf}` : main;
      const searchMatch = !q || [
        r.item_name,
        r.item_code,
        r.classification_name,
        r.parent_classification_name,
        r.grandparent_classification_name,
        classLabel,
        r.unit_desc_en,
        r.unit_code,
      ].some(v => norm(v).includes(q));
      const statusMatch = statusFilter === 'all' || r.status === statusFilter || (statusFilter === 'incomplete' && r.status === 'draft');
      const classMatch = classificationFilter === 'all' || classLabel === classificationFilter || main === classificationFilter || leaf === classificationFilter;
      return searchMatch && statusMatch && classMatch;
    });
  }, [rows, boqSearch, statusFilter, classificationFilter]);

  useEffect(() => { setPage(1); }, [boqSearch, statusFilter, classificationFilter, projectId]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const grouped = useMemo(() => paginatedRows.reduce((acc, row) => {
    const main = row.grandparent_classification_name || row.parent_classification_name || row.classification_name || 'Uncategorized';
    const leaf = row.grandparent_classification_name
      ? (row.parent_classification_name || row.classification_name || '')
      : row.parent_classification_name
        ? (row.classification_name || '')
        : '';
    const key = `${main}||${leaf}`;
    if (!acc[key]) acc[key] = { main, leaf, items: [] };
    acc[key].items.push(row);
    return acc;
  }, {}), [paginatedRows]);

  const filteredAvailable = useMemo(() => {
    const q = norm(insertSearch);
    return available.filter(i => !q || [
      i.item_name,
      i.item_code,
      i.classification_name,
      i.parent_classification_name,
      i.grandparent_classification_name,
      i.unit_desc_en,
      i.unit_code,
    ].some(v => norm(v).includes(q)));
  }, [available, insertSearch]);

  const totalPlanned = filteredRows.reduce((s, r) => s + (parseFloat(r.qty_input || r.planned_qty) || 0), 0);
  const approvedCount = rows.filter(r => r.status === 'approved').length;
  const savedCount = rows.filter(r => r.status === 'saved').length;
  const incompleteCount = rows.filter(r => ['incomplete','draft'].includes(r.status)).length;

  const pageStyle = {
    fontFamily: 'Inter, Segoe UI, Roboto, Arial, sans-serif',
    background: UI.page,
    minHeight: '100%',
    margin: -16,
    padding: 16,
    color: UI.text,
  };
  const cardStyle = {
    background: UI.card,
    border: `1px solid ${UI.border}`,
    borderRadius: 16,
    boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
  };
  const labelStyle = { fontSize: 11, fontWeight: 800, color: '#334155', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 7 };
  const btnStyle = (bg, color='#fff', border=bg) => ({
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, background:bg,
    border:`1px solid ${border}`, borderRadius:10, padding:'8px 16px', minHeight:36,
    fontSize:13, fontWeight:700, color, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
  });
  const thStyle = {
    background: UI.header,
    color: '#0f2f5f',
    fontWeight: 800,
    fontSize: 11,
    padding: '11px 12px',
    borderBottom: `1px solid ${UI.blueLine}`,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  };
  const tdStyle = { padding: '11px 12px', borderBottom: `1px solid ${UI.borderSoft}`, fontSize: 13 };

  const pgBtnStyle = (active, disabled=false) => ({
    minWidth:32,
    height:32,
    borderRadius:8,
    border: active ? `1.5px solid ${UI.blue}` : `1px solid ${UI.border}`,
    background: active ? UI.blue : '#fff',
    color: active ? '#fff' : disabled ? '#cbd5e1' : '#334155',
    fontWeight: active ? 800 : 600,
    fontSize:13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily:'inherit',
    display:'inline-flex',
    alignItems:'center',
    justifyContent:'center',
    padding:'0 10px',
    opacity: disabled ? 0.55 : 1,
  });

  function renderPagination() {
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    const pages = [];
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return (
      <div style={{ display:'flex', alignItems:'center', padding:'12px 18px', borderTop:`1px solid ${UI.borderSoft}`, gap:8, background:'#f8fbff', flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color:UI.muted, fontWeight:500, minWidth:90 }}>
          <strong style={{ color:UI.slate }}>{filteredRows.length}</strong> rows
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:4, flex:1, justifyContent:'center' }}>
          <button style={pgBtnStyle(false, currentPage === 1)} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
          {startPage > 1 && <><button style={pgBtnStyle(false)} onClick={() => setPage(1)}>1</button><span style={{ color:'#94a3b8', fontSize:13, padding:'0 2px' }}>...</span></>}
          {pages.map(p => <button key={p} style={pgBtnStyle(p === currentPage)} onClick={() => setPage(p)}>{p}</button>)}
          {endPage < totalPages && <><span style={{ color:'#94a3b8', fontSize:13, padding:'0 2px' }}>...</span><button style={pgBtnStyle(false)} onClick={() => setPage(totalPages)}>{totalPages}</button></>}
          <button style={pgBtnStyle(false, currentPage === totalPages)} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
        </div>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          style={{ border:`1px solid ${UI.border}`, background:'#fff', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#334155', cursor:'pointer', fontFamily:'inherit', minWidth:68 }}>
          {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    );
  }

  const projectOptions = projects.map(p => ({ value: String(p.id), label: p.project_name_en }));

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: UI.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>📋</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: UI.slate, lineHeight: 1.1 }}>Bill of Quantity BOQ</div>
          <div style={{ fontSize: 12, color: UI.muted, marginTop: 4 }}>Planning quantities by project, classification and item.</div>
        </div>
        {projectId && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button onClick={exportCSV} style={{ borderRadius: 10, fontWeight: 700, borderColor: UI.blueLine, color: UI.blue }}>Export</Button>
            <Button type="primary" onClick={openInsert} style={{ borderRadius: 10, fontWeight: 800, background: `linear-gradient(135deg, ${UI.blue} 0%, ${UI.blueDark} 100%)`, borderColor: UI.blue, boxShadow:'0 8px 18px rgba(37,99,235,0.18)' }}>+ Insert Items</Button>
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, padding: 10, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.4fr) minmax(190px, .8fr) minmax(190px, .8fr) minmax(240px, 1fr)', gap: 10, alignItems: 'end' }}>
          <div>
            <div style={labelStyle}>Select Project</div>
            <Select
              allowClear
              showSearch
              placeholder="— Select Project —"
              value={projectId ? String(projectId) : undefined}
              options={projectOptions}
              onChange={handleProjectChange}
              optionFilterProp="label"
              style={{ width: '100%' }}
              size="large"
            />
          </div>
          <div>
            <div style={labelStyle}>Classification</div>
            <Select
              showSearch
              value={classificationFilter}
              onChange={setClassificationFilter}
              optionFilterProp="label"
              disabled={!projectId}
              options={[{ value: 'all', label: 'All Classifications' }, ...classificationOptions]}
              style={{ width: '100%' }}
              size="large"
            />
          </div>
          <div>
            <div style={labelStyle}>Status</div>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              disabled={!projectId}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'incomplete', label: 'Incomplete' },
                { value: 'saved', label: 'Saved' },
                { value: 'approved', label: 'Approved' },
              ]}
              style={{ width: '100%' }}
              size="large"
            />
          </div>
          <div>
            <div style={labelStyle}>Smart Search</div>
            <Input.Search
              allowClear
              placeholder="Search code, item, classification or unit..."
              value={boqSearch}
              onChange={e => setBoqSearch(e.target.value)}
              disabled={!projectId}
              size="large"
            />
          </div>
        </div>
      </div>

      {projectId && (
        <div style={{ ...cardStyle, padding: '9px 12px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: UI.slate }}>BOQ Mode</span>
          <span style={{ fontSize: 12, color: UI.muted }}>Items: <b style={{ color: UI.slate }}>{filteredRows.length}</b> / {rows.length}</span>
          <span style={{ fontSize: 12, color: UI.muted }}>Total Planned: <b style={{ color: UI.blue }}>{fmt2(totalPlanned)}</b></span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: UI.muted }}>Filters narrow the BOQ without changing the original item/classification structure.</span>
          <Tag color="processing">Saved {savedCount}</Tag>
          <Tag color="success">Approved {approvedCount}</Tag>
          <Tag color="warning">Incomplete {incompleteCount}</Tag>
        </div>
      )}

      {!projectId && (
        <div style={{ ...cardStyle, padding: '64px 20px', textAlign: 'center' }}>
          <Empty description={<span style={{ color: UI.muted }}>Select a project to view or build its BOQ</span>} />
        </div>
      )}

      {loading && projectId && (
        <div style={{ ...cardStyle, padding: '56px 20px', textAlign: 'center', color: UI.muted }}>Loading BOQ...</div>
      )}

      {!loading && projectId && rows.length === 0 && (
        <div style={{ ...cardStyle, padding: '56px 20px', textAlign: 'center' }}>
          <Empty description={<span style={{ color: UI.muted }}>No items yet — click Insert Items to start</span>} />
          <Button type="primary" onClick={openInsert} style={{ marginTop: 12, borderRadius: 10, fontWeight: 800, background: `linear-gradient(135deg, ${UI.blue} 0%, ${UI.blueDark} 100%)`, borderColor: UI.blue }}>+ Insert Items</Button>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr>
                  {['#','Item Code','Item Name','Unit','Planned Qty','Status',''].map((h,i) => (
                    <th key={i} style={{ ...thStyle, textAlign: i >= 4 ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(grouped).length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 34, textAlign: 'center', color: UI.muted }}>No BOQ items match the selected filters.</td></tr>
                ) : Object.values(grouped).map(({ main, leaf, items }, gi) => (
                  <>
                    <tr key={`main-${gi}`}>
                      <td colSpan={7} style={{ background: '#f1f7ff', padding: '8px 12px', fontSize: 12, fontWeight: 800, color: UI.blue, borderTop: `1px solid ${UI.borderSoft}`, borderBottom: `1px solid ${UI.borderSoft}` }}>
                        {main}{leaf ? <span style={{ color: UI.muted, fontWeight: 500 }}> › {leaf}</span> : ''}
                      </td>
                    </tr>
                    {items.map((row, ri) => {
                      const editable = ['incomplete','saved','draft'].includes(row.status);
                      const s = STATUS_STYLE[row.status] || STATUS_STYLE.incomplete;
                      return (
                        <tr key={row.item_id} style={{ background: ri % 2 === 0 ? UI.rowAlt : '#fff' }}>
                          <td style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center', width: 44 }}>{ri+1}</td>
                          <td style={{ ...tdStyle, fontSize: 12, fontWeight: 600, color: '#475569' }}>{row.item_code}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: UI.slate }}>{row.item_name}</td>
                          <td style={{ ...tdStyle, fontSize: 12, color: UI.muted, width: 100 }}>{row.unit_desc_en||row.unit_code||'—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'center', width: 150 }}>
                            {editable ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.qty_input}
                                onChange={e=>setRows(rs=>rs.map(r=>r.item_id===row.item_id?{...r,qty_input:e.target.value}:r))}
                                onBlur={e=>{
                                  const val = parseFloat(e.target.value);
                                  const rounded = isNaN(val) ? '' : val.toFixed(2);
                                  setRows(rs=>rs.map(r=>r.item_id===row.item_id?{...r,qty_input:rounded}:r));
                                }}
                                onClick={e=>e.target.select()}
                                onFocus={e=>e.target.select()}
                                style={{ width: 118, textAlign:'center', border:`1.5px solid ${UI.border}`, borderRadius:8, padding:'6px 8px', fontSize:13, fontFamily:'inherit', outline:'none', color: UI.slate, fontWeight: 700 }}
                              />
                            ) : (
                              <span style={{ fontWeight: 800, fontSize: 13 }}>{fmt2(row.planned_qty)}</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign:'center' }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:999, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
                              <span style={{ width:6, height:6, borderRadius:'50%', background:s.color }} />
                              {s.label}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign:'center', width: 56 }}>
                            {row.status === 'incomplete' || row.status === 'draft' ? (
                              <button onClick={()=>handleRemove(row.item_id)} title="Remove item" style={{ width:28, height:28, borderRadius:8, border:'1px solid #fecaca', background:UI.redSoft, color:UI.red, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight: 900 }}>×</button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {renderPagination()}

          <div style={{ padding:'12px 14px', borderTop:`1px solid ${UI.borderSoft}`, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', background:'#f8fbff' }}>
            <span style={{ fontSize:12, color:UI.muted }}>{rows.length} total items</span>
            <span style={{ fontSize:12, color:UI.muted }}>•</span>
            <span style={{ fontSize:12, color:UI.muted }}>{filteredRows.length} visible after filters</span>
            <span style={{ fontSize:12, color:UI.muted }}>•</span>
            <span style={{ fontSize:12, color:UI.muted }}>Page {currentPage} of {totalPages}</span>
            <div style={{ marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap' }}>
              {canEdit && (
                <>
                  <button onClick={handleDraft} style={btnStyle('#fff', UI.text, UI.border)}>Draft</button>
                  <button onClick={handleSave} style={btnStyle(UI.blue)}>Save</button>
                  <button onClick={handleApprove} style={btnStyle(UI.green)}>Approve</button>
                </>
              )}
              {canUnpost && <button onClick={handleUnpost} style={btnStyle(UI.red)}>Unpost</button>}
            </div>
          </div>
        </div>
      )}

      <Modal
        open={insertModal}
        title={null}
        onCancel={() => setInsertModal(false)}
        footer={null}
        width={880}
        destroyOnClose={false}
        centered
        styles={{ body: { padding: 0 }, content: { padding: 0, borderRadius: 16, overflow: 'hidden' } }}
      >
        <div style={{ fontFamily: 'Inter, Segoe UI, Roboto, Arial, sans-serif', overflow: 'hidden', borderRadius: 12 }}>
          <div style={{ background: `linear-gradient(135deg, ${UI.blue} 0%, ${UI.blueDark} 100%)`, padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>BOQ › Insert Items</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Select Items to Add</div>
            </div>
            <Tag style={{ margin: 0, borderRadius: 999, fontWeight: 800 }}>{selected.length} selected</Tag>
          </div>

          <div style={{ padding: 12, borderBottom:`1px solid ${UI.borderSoft}`, display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center', background:'#f8fbff' }}>
            <Input.Search
              allowClear
              placeholder="Search by name, code, classification or unit..."
              value={insertSearch}
              onChange={e=>setInsertSearch(e.target.value)}
              autoFocus
            />
            <Button onClick={selectAll} style={{ borderRadius: 9 }}>Select All</Button>
            <Button onClick={selectNone} style={{ borderRadius: 9 }}>None</Button>
          </div>

          <div style={{ maxHeight:'56vh', overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth: 760 }}>
              <thead style={{ position:'sticky', top:0, zIndex: 1 }}>
                <tr>
                  {['','Code','Item Name','Classification','Unit'].map((h,i)=>(
                    <th key={i} style={{ ...thStyle, textAlign:i===0?'center':'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAvailable.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:40, color:UI.muted, fontSize:13 }}>No available items</td></tr>
                ) : filteredAvailable.map((item, idx) => {
                  const isSelected = selected.includes(item.id);
                  const mainCls = item.grandparent_classification_name || item.parent_classification_name || item.classification_name || '—';
                  const leafCls = item.grandparent_classification_name
                    ? item.parent_classification_name || item.classification_name
                    : item.parent_classification_name
                      ? item.classification_name
                      : '';
                  return (
                    <tr key={item.id} onClick={()=>toggleSelect(item.id)} style={{ borderBottom:`1px solid ${UI.borderSoft}`, cursor:'pointer', background:isSelected?'#eaf3ff':idx%2===0?UI.rowAlt:'#fff' }}>
                      <td style={{ ...tdStyle, textAlign:'center', width:44 }}>
                        <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(item.id)} onClick={e=>e.stopPropagation()} style={{ accentColor:UI.blue, width:14, height:14, cursor:'pointer' }} />
                      </td>
                      <td style={{ ...tdStyle, fontSize:12, fontWeight:600, color:'#475569' }}>{item.item_code}</td>
                      <td style={{ ...tdStyle, fontWeight:700, color:UI.slate }}>{item.item_name}</td>
                      <td style={{ ...tdStyle, fontSize:12, color:UI.muted }}>{mainCls}{leafCls ? <span style={{ color:'#cbd5e1' }}> › </span> : ''}{leafCls || ''}</td>
                      <td style={{ ...tdStyle, fontSize:12, color:UI.muted }}>{item.unit_desc_en||item.unit_code||'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding:'12px 16px', borderTop:`1px solid ${UI.borderSoft}`, display:'flex', justifyContent:'flex-end', gap:8, background:'#f8fbff' }}>
            <Button onClick={()=>setInsertModal(false)} style={{ borderRadius: 9 }}>Cancel</Button>
            <Button type="primary" onClick={handleInsert} disabled={inserting || selected.length === 0} loading={inserting} style={{ borderRadius: 9, fontWeight: 800, background:UI.blue }}>
              Insert ({selected.length})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}