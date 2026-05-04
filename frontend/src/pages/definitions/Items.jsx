import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Modal      from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import t from '../../lang';

const EMPTY = { item_code:'', item_name:'', classification_id:'', unit_of_measure:'', is_active:true };

function smartSearch(items, q) {
  if (!q) return items;
  const lq = q.toLowerCase();
  return items.filter(i =>
    (i.item_name||'').toLowerCase().includes(lq) ||
    (i.item_code||'').toLowerCase().includes(lq) ||
    (i.classification_name||'').toLowerCase().includes(lq) ||
    (i.parent_classification_name||'').toLowerCase().includes(lq) ||
    (i.unit_of_measure||'').toLowerCase().includes(lq)
  );
}

export default function Items() {
  const toast = useToast();
  const [items,   setItems]   = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState('');
  const [delModal,setDelModal]= useState(null);
  const [genCode, setGenCode] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.getItems(), api.getClassifications()])
      .then(([its, cls]) => { setItems(its); setClasses(cls); })
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  function openAdd()  { setForm(EMPTY); setEditing(null); setGenCode(true); setModal(true); }
  function openEdit(i) {
    setForm({ item_code:i.item_code, item_name:i.item_name, classification_id:i.classification_id||'', unit_of_measure:i.unit_of_measure||'', is_active:i.is_active });
    setGenCode(false); setEditing(i); setModal(true);
  }

  async function handleClassChange(clsId) {
    setForm(f => ({ ...f, classification_id:clsId, item_code: genCode ? '' : f.item_code }));
    if (genCode && clsId) {
      try {
        const { code } = await api.getNextItemCode(clsId);
        setForm(f => ({ ...f, item_code: code }));
      } catch {}
    }
  }

  async function handleSave() {
    if (!form.item_name) return toast('Item name is required','error');
    setSaving(true);
    try {
      const payload = { ...form, classification_id: form.classification_id||null, is_active: form.is_active !== false };
      if (!payload.item_code) delete payload.item_code;
      if (editing) {
        const u = await api.updateItem(editing.id, payload);
        setItems(its => its.map(x => x.id === editing.id ? u : x));
      } else {
        const c = await api.createItem(payload);
        setItems(its => [...its, c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch (err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteItem(delModal.id);
      setItems(its => its.filter(x => x.id !== delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch (err) { toast(err.message,'error'); }
  }

  const filtered = smartSearch(items, search);

  // Group by parent classification for display
  function buildTree(all) {
    const rows = [];
    const parents = [...new Map(all.filter(i => i.parent_classification_name).map(i => [i.parent_classification_name, i])).keys()];
    const withParent    = all.filter(i => !!i.parent_classification_name);
    const withoutParent = all.filter(i => !i.parent_classification_name);

    const groups = {};
    withParent.forEach(i => {
      const g = i.parent_classification_name + ' › ' + (i.classification_name||'');
      if (!groups[g]) groups[g] = [];
      groups[g].push(i);
    });

    const noGroups = {};
    withoutParent.forEach(i => {
      const g = i.classification_name || 'Uncategorized';
      if (!noGroups[g]) noGroups[g] = [];
      noGroups[g].push(i);
    });

    [...Object.entries(groups), ...Object.entries(noGroups)].forEach(([label, its]) => {
      rows.push({ _header:true, _label:label, id:'h-'+label });
      its.forEach(i => rows.push(i));
    });
    return rows;
  }

  const treeRows = buildTree(filtered);
  const parents  = classes.filter(c => !c.parent_id);
  const children = classes.filter(c => !!c.parent_id);

  return (
    <div>
      <div className="page-header">
        <h1>{t.items}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t.addItem}</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <RefreshButton onRefresh={load} />
        </div>
        {loading ? <div className="spinner-wrap"><div className="spinner"/></div> : (
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>{t.itemCode}</th><th>{t.itemName}</th>
                <th>{t.classification}</th><th>{t.unitOfMeasure}</th>
                <th>{t.status}</th><th></th>
              </tr></thead>
              <tbody>
                {treeRows.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>{t.noData}</td></tr>
                ) : treeRows.map(r => r._header ? (
                  <tr key={r.id} style={{ background:'var(--bg2)' }}>
                    <td colSpan={6} style={{ padding:'6px 14px', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                      {r._label}
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{r.item_code}</td>
                    <td>{r.item_name}</td>
                    <td style={{ fontSize:12 }}>{r.classification_name}</td>
                    <td style={{ fontSize:12 }}>{r.unit_of_measure || '—'}</td>
                    <td><StatusBadge value={r.is_active ? 'active' : 'inactive'} /></td>
                    <td><div className="td-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>{t.edit}</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDelModal(r)}>{t.delete}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? t.editItem : t.addItem} size="md"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.save}</button></>}>
        <div className="form-group">
          <label className="form-label">{t.classification}</label>
          <select className="form-control" value={form.classification_id} onChange={e => handleClassChange(e.target.value)}>
            <option value="">— None —</option>
            {parents.map(p => (
              <optgroup key={p.id} label={p.classification_name}>
                {children.filter(c => c.parent_id === p.id).map(c => (
                  <option key={c.id} value={c.id}>{c.classification_name}</option>
                ))}
              </optgroup>
            ))}
            {classes.filter(c => !c.parent_id && !children.some(ch => ch.parent_id === c.id)).map(c => (
              <option key={`tl-${c.id}`} value={c.id}>{c.classification_name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" style={{ display:'flex', justifyContent:'space-between' }}>
              {t.itemCode} *
              {!editing && (
                <label style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', fontWeight:400 }}>
                  <input type="checkbox" checked={genCode} onChange={e => setGenCode(e.target.checked)} />
                  {t.autoCode}
                </label>
              )}
            </label>
            <input className="form-control" value={form.item_code}
              readOnly={genCode && !editing}
              style={{ background: genCode && !editing ? 'var(--bg2)' : undefined }}
              onChange={e => !genCode && setForm(f => ({ ...f, item_code:e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.itemName} *</label>
            <input className="form-control" value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name:e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.unitOfMeasure}</label>
            <input className="form-control" value={form.unit_of_measure} onChange={e => setForm(f => ({ ...f, unit_of_measure:e.target.value }))} placeholder="e.g. m², pcs, kg" />
          </div>
          {editing && (
            <div className="form-group">
              <label className="form-label">{t.status}</label>
              <select className="form-control" value={form.is_active ? 'true':'false'}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}>
                <option value="true">{t.active}</option>
                <option value="false">{t.inactive}</option>
              </select>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)} title={t.delete} size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setDelModal(null)}>{t.cancel}</button>
          <button className="btn btn-danger" onClick={handleDelete}>{t.delete}</button></>}>
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:600 }}>{delModal.item_name}</p>}
      </Modal>
    </div>
  );
}