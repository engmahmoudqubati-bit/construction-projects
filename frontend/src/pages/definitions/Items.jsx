import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable   from '../../components/shared/DataTable';
import Modal       from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const EMPTY = { item_code: '', item_name: '', classification_id: '', unit_of_measure: '', is_active: true };

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

  useEffect(() => {
    Promise.all([api.getItems(), api.getClassifications()])
      .then(([items, cls]) => { setItems(items); setClasses(cls); })
      .catch(() => toast(t.errorOccurred, 'error'))
      .finally(() => setLoading(false));
  }, []);

  function openAdd()  { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(i) {
    setForm({
      item_code: i.item_code, item_name: i.item_name,
      classification_id: i.classification_id || '',
      unit_of_measure: i.unit_of_measure || '',
      is_active: i.is_active,
    });
    setEditing(i);
    setModal(true);
  }

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSave() {
    if (!form.item_code || !form.item_name)
      return toast('Item code and name are required', 'error');
    setSaving(true);
    try {
      const payload = { ...form, classification_id: form.classification_id || null, is_active: form.is_active !== false };
      if (editing) {
        const updated = await api.updateItem(editing.id, payload);
        setItems(items => items.map(x => x.id === editing.id ? updated : x));
      } else {
        const created = await api.createItem(payload);
        setItems(items => [...items, created]);
      }
      toast(t.saveSuccess);
      setModal(false);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteItem(delModal.id);
      setItems(items => items.filter(x => x.id !== delModal.id));
      toast(t.deleteSuccess);
      setDelModal(null);
    } catch (err) { toast(err.message, 'error'); }
  }

  const filtered = items.filter(i =>
    i.item_name.toLowerCase().includes(search.toLowerCase()) ||
    i.item_code.toLowerCase().includes(search.toLowerCase())
  );

  // Build grouped classification label for display
  function classLabel(item) {
    const parts = [item.parent_classification_name, item.classification_name].filter(Boolean);
    return parts.join(' › ');
  }

  // For the select: group by parent
  const parents  = classes.filter(c => !c.parent_id);
  const children = classes.filter(c => !!c.parent_id);

  const columns = [
    { key: 'item_code',    label: t.itemCode },
    { key: 'item_name',    label: t.itemName },
    { key: 'classification', label: t.classification, render: r => classLabel(r) || '—' },
    { key: 'unit_of_measure', label: t.unitOfMeasure },
    { key: 'is_active',    label: t.status, render: r => <StatusBadge value={r.is_active ? 'active' : 'inactive'} /> },
    { key: 'actions',      label: '', render: r => (
      <div className="td-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>{t.edit}</button>
        <button className="btn btn-danger    btn-sm" onClick={() => setDelModal(r)}>{t.delete}</button>
      </div>
    )},
  ];

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
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} />
      </div>

      <Modal
        open={modal} onClose={() => setModal(false)}
        title={editing ? t.editItem : t.addItem}
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
            <button className="btn btn-primary"   onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.save}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.itemCode} *</label>
            <input className="form-control" value={form.item_code} onChange={set('item_code')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.itemName} *</label>
            <input className="form-control" value={form.item_name} onChange={set('item_name')} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.classification}</label>
            <select className="form-control" value={form.classification_id} onChange={set('classification_id')}>
              <option value="">— None —</option>
              {parents.map(p => (
                <optgroup key={p.id} label={p.classification_name}>
                  {children.filter(c => c.parent_id === p.id).map(c => (
                    <option key={c.id} value={c.id}>{c.classification_name}</option>
                  ))}
                </optgroup>
              ))}
              {/* Top-level without children can also be selected */}
              {classes.filter(c => !c.parent_id && !children.some(ch => ch.parent_id === c.id)).map(c => (
                <option key={`tl-${c.id}`} value={c.id}>{c.classification_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t.unitOfMeasure}</label>
            <input className="form-control" value={form.unit_of_measure} onChange={set('unit_of_measure')} placeholder="e.g. m², pcs, kg" />
          </div>
        </div>
        {editing && (
          <div className="form-group">
            <label className="form-label">{t.status}</label>
            <select className="form-control" value={form.is_active ? 'true' : 'false'}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}>
              <option value="true">{t.active}</option>
              <option value="false">{t.inactive}</option>
            </select>
          </div>
        )}
      </Modal>

      <Modal
        open={!!delModal} onClose={() => setDelModal(null)}
        title={t.delete} size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDelModal(null)}>{t.cancel}</button>
            <button className="btn btn-danger"    onClick={handleDelete}>{t.delete}</button>
          </>
        }
      >
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop: 8, fontWeight: 600 }}>{delModal.item_name}</p>}
      </Modal>
    </div>
  );
}
