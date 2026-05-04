import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Modal      from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import t from '../../lang';

const EMPTY = { classification_code:'', classification_name:'', parent_id:'', is_active:true };

function smartSearch(list, q) {
  if (!q) return list;
  const lq = q.toLowerCase();
  return list.filter(c =>
    (c.classification_name||'').toLowerCase().includes(lq) ||
    (c.classification_code||'').toLowerCase().includes(lq) ||
    (c.parent_name||'').toLowerCase().includes(lq)
  );
}

export default function ItemClassifications() {
  const toast = useToast();
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState('');
  const [delModal,setDelModal]= useState(null);

  const load = () => {
    setLoading(true);
    api.getClassifications().then(setList).catch(() => toast(t.errorOccurred,'error')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const topLevel = list.filter(c => c.parent_id === null);

  function openAdd()  { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(c) {
    setForm({ classification_code:c.classification_code, classification_name:c.classification_name, parent_id:c.parent_id||'', is_active:c.is_active });
    setEditing(c); setModal(true);
  }

  async function handleSave() {
    if (!form.classification_code || !form.classification_name) return toast('Code and name are required','error');
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.parent_id||null, is_active: form.is_active !== false };
      if (editing) {
        const u = await api.updateClassification(editing.id, payload);
        setList(l => l.map(x => x.id === editing.id ? u : x));
      } else {
        const c = await api.createClassification(payload);
        setList(l => [...l, c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch (err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteClassification(delModal.id);
      setList(l => l.filter(x => x.id !== delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch (err) { toast(err.message,'error'); }
  }

  // Build tree
  function buildTree(all) {
    const filtered = smartSearch(all, search);
    const rows = [];
    const parents  = all.filter(c => !c.parent_id);
    const children = all.filter(c => !!c.parent_id);
    parents.forEach(p => {
      if (filtered.some(f => f.id === p.id || f.parent_id === p.id)) {
        rows.push({ ...p, _level:0 });
        children.filter(c => c.parent_id === p.id)
          .filter(c => filtered.some(f => f.id === c.id))
          .forEach(c => rows.push({ ...c, _level:1 }));
      }
    });
    return rows;
  }

  const treeRows = buildTree(list);

  return (
    <div>
      <div className="page-header">
        <h1>{t.itemClassifications}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t.addClassification}</button>
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
              <thead><tr><th>{t.classificationCode}</th><th>{t.classificationName}</th><th>{t.status}</th><th></th></tr></thead>
              <tbody>
                {treeRows.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>{t.noData}</td></tr>
                ) : treeRows.map(r => (
                  <tr key={r.id} className={r._level === 0 && !r.parent_id ? 'tree-row-parent' : ''}>
                    <td style={{ fontSize:12, color:'var(--text-muted)', paddingLeft: r._level > 0 ? 32 : 14 }}>
                      {r._level > 0 && <span style={{ marginRight:6, color:'var(--text-muted)' }}>└─</span>}
                      {r.classification_code}
                    </td>
                    <td style={{ paddingLeft: r._level > 0 ? 32 : 14, fontWeight: r._level === 0 ? 600 : 400 }}>
                      {r.classification_name}
                    </td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? t.editClassification : t.addClassification} size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.save}</button></>}>
        <div className="form-group">
          <label className="form-label">{t.classificationCode} *</label>
          <input className="form-control" value={form.classification_code} onChange={e => setForm(f => ({ ...f, classification_code:e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">{t.classificationName} *</label>
          <input className="form-control" value={form.classification_name} onChange={e => setForm(f => ({ ...f, classification_name:e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">{t.parentClassification}</label>
          <select className="form-control" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id:e.target.value }))}>
            <option value="">{t.topLevel}</option>
            {topLevel.filter(c => !editing || c.id !== editing.id).map(c => (
              <option key={c.id} value={c.id}>{c.classification_name}</option>
            ))}
          </select>
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
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)} title={t.delete} size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setDelModal(null)}>{t.cancel}</button>
          <button className="btn btn-danger" onClick={handleDelete}>{t.delete}</button></>}>
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:600 }}>{delModal.classification_name}</p>}
      </Modal>
    </div>
  );
}