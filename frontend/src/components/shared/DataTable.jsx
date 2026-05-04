import { useState, useMemo, useRef, useEffect } from 'react';

// ── Advanced Search Modal ───────────────────────────────────────
function AdvancedFilter({ open, onClose, fields, values, onChange, onApply, onClear }) {
  const [saved, setSaved] = useState(false);
  if (!open) return null;
  return (
    <div className="adv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adv-modal">
        <div className="adv-header">
          <span className="adv-icon">⚙️</span>
          <span className="adv-title">Advanced Search</span>
          <button
            className={`adv-fav-btn ${saved ? 'saved' : ''}`}
            onClick={() => setSaved(s => !s)}
            title="Save to favorites"
          >
            {saved ? '❤️' : '🤍'}
          </button>
          <button className="adv-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="adv-body">
          <div className="adv-section-title">
            <span>Filters</span>
          </div>
          <div className="adv-fields">
            {fields.map(f => (
              <div key={f.key} className="adv-field">
                <label className="adv-label">{f.label}</label>
                {f.type === 'select' ? (
                  <div className="adv-select-wrap">
                    <select
                      className="adv-select"
                      value={values[f.key] || ''}
                      onChange={e => onChange(f.key, e.target.value)}
                    >
                      <option value=""></option>
                      {(f.options || []).map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <span className="adv-chevron">⌄</span>
                  </div>
                ) : (
                  <input
                    className="adv-input"
                    type={f.type || 'text'}
                    value={values[f.key] || ''}
                    onChange={e => onChange(f.key, e.target.value)}
                    placeholder={f.placeholder || ''}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="adv-footer">
          <button className="adv-clear-btn" onClick={onClear}>
            <span>✕</span> Clear
          </button>
          <button className="adv-apply-btn" onClick={() => { onApply(); onClose(); }}>
            <span>🔍</span> Show Results
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────
function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }) {
  const pages = [];
  const start = Math.max(1, page - 2);
  const end   = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="dt-footer">
      <span className="dt-record-count">Number of Records: <strong>{total}</strong></span>
      <div className="dt-pagination">
        <button className="pg-btn" onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
        {start > 1 && <><button className="pg-btn" onClick={() => onPage(1)}>1</button><span className="pg-ellipsis">…</span></>}
        {pages.map(p => (
          <button key={p} className={`pg-btn${p === page ? ' active' : ''}`} onClick={() => onPage(p)}>{p}</button>
        ))}
        {end < totalPages && <><span className="pg-ellipsis">…</span><button className="pg-btn" onClick={() => onPage(totalPages)}>{totalPages}</button></>}
        <button className="pg-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages}>›</button>
        <select className="pg-size" value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}>
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
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
  filterFields = [],
  emptyText = 'No records found',
  rowKey = 'id',
}) {
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(25);
  const [selected,   setSelected]   = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterVals, setFilterVals] = useState({});
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search, filterVals]);

  // Full-screen toggle
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [fullscreen]);

  // Apply text search
  const searched = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q))
    );
  }, [data, search]);

  // Apply advanced filter
  const filtered = useMemo(() => {
    const active = Object.entries(filterVals).filter(([, v]) => v !== '' && v != null);
    if (!active.length) return searched;
    return searched.filter(row =>
      active.every(([k, v]) =>
        row[k] != null && String(row[k]).toLowerCase().includes(String(v).toLowerCase())
      )
    );
  }, [searched, filterVals]);

  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Checkbox logic
  const allSelected = paginated.length > 0 && paginated.every(r => selected.includes(r[rowKey] ?? r.id));
  function toggleAll() {
    const ids = paginated.map(r => r[rowKey] ?? r.id);
    setSelected(allSelected ? selected.filter(id => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  }
  function toggleRow(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  const hasActiveFilter = Object.values(filterVals).some(v => v !== '' && v != null);

  const wrapClass = `dt-wrapper${fullscreen ? ' dt-fullscreen' : ''}`;

  return (
    <div className={wrapClass} ref={containerRef}>
      {/* Table header toolbar */}
      <div className="dt-toolbar">
        {title && <span className="dt-title">{title}</span>}
        <div className="dt-toolbar-right">
          <div className="dt-search-box">
            <span className="dt-search-icon">🔍</span>
            <input
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="dt-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          {filterFields.length > 0 && (
            <button
              className={`dt-filter-btn${hasActiveFilter ? ' active' : ''}`}
              onClick={() => setFilterOpen(true)}
              title="Advanced Search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" strokeWidth="3"/>
              </svg>
              {hasActiveFilter && <span className="dt-filter-dot" />}
            </button>
          )}

          <button
            className="dt-fs-btn"
            onClick={() => setFullscreen(f => !f)}
            title={fullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {fullscreen
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Table body */}
      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      style={{ accentColor: 'var(--accent)', width: 15, height: 15, cursor: 'pointer' }} />
                  </th>
                  <th style={{ width: 48 }}>#</th>
                  {columns.map(col => (
                    <th key={col.key} style={col.style}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2}>
                      <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <p>{emptyText}</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map((row, i) => {
                  const id = row[rowKey] ?? row.id ?? i;
                  const rowNum = (page - 1) * pageSize + i + 1;
                  const isSelected = selected.includes(id);
                  return (
                    <tr key={id} className={isSelected ? 'dt-row-selected' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(id)}
                          style={{ accentColor: 'var(--accent)', width: 15, height: 15, cursor: 'pointer' }} />
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{rowNum}</td>
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
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPage={p => setPage(Math.max(1, Math.min(totalPages, p)))}
            onPageSize={setPageSize}
          />
        </>
      )}

      {/* Floating action buttons */}
      {onAdd && (
        <div className="dt-float-actions">
          <button className="dt-float-add" onClick={onAdd} title="Add New">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      )}

      {/* Advanced Filter Modal */}
      <AdvancedFilter
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        fields={filterFields}
        values={filterVals}
        onChange={(k, v) => setFilterVals(f => ({ ...f, [k]: v }))}
        onApply={() => {}}
        onClear={() => setFilterVals({})}
      />
    </div>
  );
}
