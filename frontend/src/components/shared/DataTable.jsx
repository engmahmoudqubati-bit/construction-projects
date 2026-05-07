import { useState, useMemo, useRef, useEffect, useCallback } from 'react';

// ── Save Favorite Modal ──────────────────────────────────────────
function SaveFavoriteModal({ open, onClose, onSave }) {
  const [name, setName] = useState('');
  useEffect(() => { if (open) setName(''); }, [open]);
  if (!open) return null;
  return (
    <div className="adv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--card)', border:'1px solid var(--border-light)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)', width:'100%', maxWidth:380, overflow:'hidden', animation:'modal-in 0.2s cubic-bezier(.34,1.56,.64,1)' }}>
        <div style={{ padding:'16px 20px', background:'var(--card2)', borderBottom:'1px solid var(--border-light)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontWeight:700, fontSize:14 }}>⭐ Save Filter as Favorite</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ padding:20 }}>
          <label style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', display:'block', marginBottom:6 }}>Favorite Name</label>
          <input
            autoFocus
            style={{ width:'100%', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:8, color:'var(--text)', padding:'9px 12px', fontSize:13, outline:'none' }}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); onClose(); } }}
            placeholder="e.g. Active Projects, Q1 Filter..."
          />
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border-light)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={!name.trim()} onClick={() => { onSave(name.trim()); onClose(); }}>⭐ Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Advanced Filter Modal ────────────────────────────────────────
function AdvancedFilter({ open, onClose, fields, values, onChange, onApply, onClear, storageKey }) {
  const [saveFavOpen, setSaveFavOpen] = useState(false);
  const [favOpen,     setFavOpen]     = useState(false);
  const [favorites,   setFavorites]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(`fav_${storageKey}`) || '[]'); } catch { return []; }
  });

  function saveFavorite(name) {
    const fav = { name, values: { ...values }, created: Date.now() };
    const updated = [...favorites.filter(f => f.name !== name), fav];
    setFavorites(updated);
    localStorage.setItem(`fav_${storageKey}`, JSON.stringify(updated));
  }

  function applyFavorite(fav) {
    Object.entries(fav.values).forEach(([k,v]) => onChange(k, v));
    setFavOpen(false);
    onApply();
    onClose();
  }

  function deleteFavorite(name) {
    const updated = favorites.filter(f => f.name !== name);
    setFavorites(updated);
    localStorage.setItem(`fav_${storageKey}`, JSON.stringify(updated));
  }

  if (!open) return null;
  const hasValues = Object.values(values).some(v => v !== '' && v != null);

  return (
    <>
      <div className="adv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="adv-modal">
          <div className="adv-header">
            <span className="adv-icon">⚙️</span>
            <span className="adv-title">Advanced Search</span>
            {favorites.length > 0 && (
              <button className="adv-fav-btn" onClick={() => setFavOpen(v => !v)} title="Load favorite">
                ⭐ <span style={{ fontSize:11 }}>({favorites.length})</span>
              </button>
            )}
            <button className="adv-fav-btn" onClick={() => { if (hasValues) setSaveFavOpen(true); }} title="Save as favorite" style={{ opacity: hasValues ? 1 : 0.4 }}>
              🤍
            </button>
            <button className="adv-close-btn" onClick={onClose}>✕</button>
          </div>

          {/* Favorites dropdown */}
          {favOpen && favorites.length > 0 && (
            <div style={{ borderBottom:'1px solid var(--border-light)', padding:'10px 20px', background:'var(--card2)' }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:8 }}>Saved Favorites</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {favorites.map(fav => (
                  <div key={fav.name} style={{ display:'flex', alignItems:'center', gap:0, background:'var(--accent-light)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                    <button onClick={() => applyFavorite(fav)} style={{ background:'none', border:'none', cursor:'pointer', padding:'5px 10px', fontSize:12, fontWeight:600, color:'var(--accent)' }}>
                      ⭐ {fav.name}
                    </button>
                    <button onClick={() => deleteFavorite(fav.name)} style={{ background:'none', border:'none', cursor:'pointer', padding:'5px 8px', fontSize:11, color:'var(--text-muted)' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="adv-body">
            <div className="adv-section-title">Filters</div>
            <div className="adv-fields">
              {fields.map(f => (
                <div key={f.key} className="adv-field">
                  <label className="adv-label">{f.label}</label>
                  {f.type === 'select' ? (
                    <div className="adv-select-wrap">
                      <select className="adv-select" value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)}>
                        <option value=""></option>
                        {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <span className="adv-chevron">⌄</span>
                    </div>
                  ) : (
                    <input className="adv-input" type={f.type || 'text'} value={values[f.key] || ''}
                      onChange={e => onChange(f.key, e.target.value)} placeholder={f.placeholder || ''} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="adv-footer">
            <button className="adv-clear-btn" onClick={() => { onClear(); }}>
              <span>✕</span> Clear
            </button>
            <button className="adv-apply-btn" onClick={() => { onApply(); onClose(); }}>
              <span>🔍</span> Show Results
            </button>
          </div>
        </div>
      </div>

      <SaveFavoriteModal
        open={saveFavOpen}
        onClose={() => setSaveFavOpen(false)}
        onSave={saveFavorite}
      />
    </>
  );
}

// ── Pagination ──────────────────────────────────────────────────
function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }) {
  const pages = [];
  const start = Math.max(1, page - 2);
  const end   = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  const btnStyle = (active) => ({
    minWidth:32, height:32, borderRadius:8,
    border: active ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
    background: active ? '#3b82f6' : '#fff',
    color: active ? '#fff' : '#374151',
    fontWeight: active ? 600 : 400,
    fontSize:13, cursor:'pointer', fontFamily:'inherit',
    display:'flex', alignItems:'center', justifyContent:'center',
    padding:'0 10px', transition:'all 0.12s',
  });

  return (
    <div style={{ display:'flex', alignItems:'center', padding:'12px 18px', borderTop:'1px solid #f3f4f6', gap:8 }}>
      {/* Left: row count */}
      <span style={{ fontSize:12, color:'#6b7280', fontWeight:500, minWidth:80 }}>
        <strong style={{ color:'#111827' }}>{total}</strong> rows
      </span>

      {/* Center: pagination */}
      <div style={{ display:'flex', alignItems:'center', gap:4, flex:1, justifyContent:'center' }}>
        <button style={{ ...btnStyle(false), padding:'0 10px' }} onClick={() => onPage(page-1)} disabled={page===1}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {start > 1 && <><button style={btnStyle(false)} onClick={() => onPage(1)}>1</button><span style={{ color:'#9ca3af', fontSize:13, padding:'0 2px' }}>...</span></>}
        {pages.map(p => (
          <button key={p} style={btnStyle(p===page)} onClick={() => onPage(p)}>{p}</button>
        ))}
        {end < totalPages && <><span style={{ color:'#9ca3af', fontSize:13, padding:'0 2px' }}>...</span><button style={btnStyle(false)} onClick={() => onPage(totalPages)}>{totalPages}</button></>}
        <button style={{ ...btnStyle(false), padding:'0 10px' }} onClick={() => onPage(page+1)} disabled={page===totalPages}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Right: page size */}
      <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
        style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#374151', cursor:'pointer', fontFamily:'inherit', minWidth:60 }}>
        {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}

// ── Main DataTable ──────────────────────────────────────────────
export default function DataTable({
  columns,
  data = [],
  loading,
  title,
  onAdd,
  onView,
  onExport,
  onRefresh,
  onSelectionChange,
  externalFilterOpen,
  onExternalFilterClose,
  onFilterApplied,
  externalSearch,
  filterFields = [],
  filterStorageKey = 'dt_filter',
  emptyText = 'No records found',
  rowKey = 'id',
}) {
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch !== undefined ? externalSearch : internalSearch;
  const setSearch = externalSearch !== undefined ? () => {} : setInternalSearch;
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(25);
  const [selected,   setSelected]   = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  // Open filter whenever trigger counter increments
  useEffect(() => {
    if (externalFilterOpen) setFilterOpen(true);
  }, [externalFilterOpen]);

  // Persistent filter — stored in sessionStorage keyed by filterStorageKey
  const [filterVals, setFilterVals] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(`filter_${filterStorageKey}`) || '{}'); } catch { return {}; }
  });
  const [filterApplied, setFilterApplied] = useState(() => {
    try { const v = JSON.parse(sessionStorage.getItem(`filter_${filterStorageKey}`) || '{}'); return Object.values(v).some(x => x); } catch { return false; }
  });

  // Persist filter to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem(`filter_${filterStorageKey}`, JSON.stringify(filterVals));
  }, [filterVals, filterStorageKey]);

  useEffect(() => { setPage(1); }, [search, filterVals]);

  // Text search
  const searched = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q))
    );
  }, [data, search]);

  // Advanced filter
  const filtered = useMemo(() => {
    if (!filterApplied) return searched;
    const active = Object.entries(filterVals).filter(([, v]) => v !== '' && v != null);
    if (!active.length) return searched;
    return searched.filter(row =>
      active.every(([k, v]) =>
        row[k] != null && String(row[k]).toLowerCase().includes(String(v).toLowerCase())
      )
    );
  }, [searched, filterVals, filterApplied]);

  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated  = filtered.slice((page-1)*pageSize, page*pageSize);

  const allSelected = paginated.length > 0 && paginated.every(r => selected.includes(r[rowKey] ?? r.id));
  function toggleAll() {
    const ids = paginated.map(r => r[rowKey] ?? r.id);
    const next = allSelected ? selected.filter(id => !ids.includes(id)) : [...new Set([...selected, ...ids])];
    setSelected(next);
    if (onSelectionChange) onSelectionChange(next);
  }
  function toggleRow(id) {
    setSelected(s => {
      const next = s.includes(id) ? s.filter(x => x !== id) : [...s, id];
      if (onSelectionChange) onSelectionChange(next);
      return next;
    });
  }

  const hasActiveFilter = filterApplied && Object.values(filterVals).some(v => v !== '' && v != null);

  function clearFilter() {
    setFilterVals({});
    setFilterApplied(false);
    sessionStorage.removeItem(`filter_${filterStorageKey}`);
  }

  return (
    <div className="dt-wrapper">

      {/* Active filter banner */}
      {hasActiveFilter && (
        <div style={{ padding:'8px 16px', background:'var(--accent-light)', borderBottom:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:10, fontSize:12 }}>
          <span style={{ color:'var(--accent)', fontWeight:600 }}>🔍 Filter active:</span>
          {Object.entries(filterVals).filter(([,v]) => v).map(([k,v]) => (
            <span key={k} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 8px', color:'var(--text)' }}>
              {filterFields.find(f=>f.key===k)?.label || k}: <strong>{v}</strong>
            </span>
          ))}
          <button onClick={clearFilter} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--danger)', fontSize:12, fontWeight:600 }}>✕ Clear Filter</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width:36, textAlign:'center' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      style={{ accentColor:'var(--accent)', width:15, height:15, cursor:'pointer' }} />
                  </th>
                  <th style={{ width:48, textAlign:'center' }}>#</th>
                  {columns.map(col => <th key={col.key} style={col.style}>{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2}>
                      <div className="empty-state"><div className="empty-icon">📋</div><p>{emptyText}</p></div>
                    </td>
                  </tr>
                ) : paginated.map((row, i) => {
                  const id = row[rowKey] ?? row.id ?? i;
                  const rowNum = (page-1)*pageSize + i + 1;
                  const isSelected = selected.includes(id);
                  return (
                    <tr key={id} className={isSelected ? 'dt-row-sel-purple' : ''}>
                      <td style={{ textAlign:'center' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(id)}
                          style={{ accentColor:'var(--accent)', width:15, height:15, cursor:'pointer' }} />
                      </td>
                      <td style={{ color:'var(--text-muted)', fontSize:12, fontWeight:500, textAlign:'center' }}>{rowNum}</td>
                      {columns.map(col => (
                        <td key={col.key} style={col.style}>
                          {col.render ? col.render(row) : row[col.key]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page} totalPages={totalPages} total={total} pageSize={pageSize}
            onPage={p => setPage(Math.max(1, Math.min(totalPages, p)))}
            onPageSize={setPageSize}
          />
        </>
      )}





      {/* Advanced Filter */}
      <AdvancedFilter
        open={filterOpen}
        onClose={() => { setFilterOpen(false); if (onExternalFilterClose) onExternalFilterClose(); }}
        fields={filterFields}
        values={filterVals}
        onChange={(k,v) => setFilterVals(f => ({ ...f, [k]:v }))}
        onApply={() => { setFilterApplied(true); if (onFilterApplied) onFilterApplied(true); }}
        onClear={() => { clearFilter(); if (onFilterApplied) onFilterApplied(false); }}
        storageKey={filterStorageKey}
      />
    </div>
  );
}