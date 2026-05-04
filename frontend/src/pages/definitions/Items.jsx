import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable   from '../../components/shared/DataTable';
import Modal       from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const EMPTY = { item_code:'', item_name:'', classification_id:'', unit_of_measure:'', is_active:true };

export default function Items() {
  const toast = useToast();
  const [items,   setItems]   = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [delModal,setDelModal]= useState(null);

  useEffect(() => {
    Promise.all([api.getItems(), api.getClassifications()])
      .then(([items, cls]) => { setItems(items); setClasses(cls); })
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  }, []);

  // Build filter fields with dynamic classification options
  const filterFields = [
    { key: 'classification_name', label: 'Classification', type: 'select',
      options: classes.filter(c => !c.parent_id).map(c => ({ value: c.classification_name, label: c.classification_name })) },
    { key: 'unit_of_measure', label: 'Unit', type: 'text' },
    { key: 'is_active', label: 'Status', type: 'select', options: [
      { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
    ]},
  ];

  function openAdd()  { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(i) {
    setForm({ item_code:i.item_code, item_name:i.item_name, classification_id:i.classification_id||'', unit_of_measure:i.unit_of_measure||'', is_active:i.is_active });
    setEditing(i); setModal(true);
  }

  async function handleSave() {
    if (!form.item_code || !form.item_name) return toast('Item code and name are required','error');
    setSaving(true);
    try {
      const payload = { ...form, classification_id: form.classification_id || null, is_active: form.is_active !== false };
      if (editing) {
        const u = await api.updateItem(editing.id, payload);
        setItems(items => items.map(x => x.id === editing.id ? u : x));
      } else {
        const c = await api.createItem(payload);
        setItems(items => [...items, c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch (err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteItem(delModal.id);
      setItems(items => items.filter(x => x.id !== delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch (err) { toast(err.message,'error'); }
  }

  function classLabel(item) {
    return [item.parent_classification_name, item.classification_name].filter(Boolean).join(' › ');
  }

  const parents  = classes.filter(c => !c.parent_id);
  const children = classes.filter(c => !!c.parent_id);

  const columns = [
    { key: 'item_code',   label: t.itemCode, render: r => <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700 }}>{r.item_code}</span> },
    { key: 'item_name',   label: t.itemName },
    { key: 'classification', label: t.classification, render: r => <span style={{ fontSize:12 }}>{classLabel(r) || '—'}</span> },
    { key: 'unit_of_measure', label: t.unitOfMeasure, render: r => <span style={{ fontSize:12 }}>{r.unit_of_measure || '—'}</span> },
    { key: 'is_active',   label: t.status, render: r => <StatusBadge value={r.is_active ? 'active' : 'inactive'} /> },
    { key: 'actions',     label: '', style:{width:120}, render: r => (
      <div className="td-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏ {t.edit}</button>
        <button className="btn btn-danger btn-sm" onClick={() => setDelModal(r)}>🗑</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="page-header"><h1>{t.items}</h1></div>

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        title="Items Management"
        onAdd={openAdd}
        filterFields={filterFields}
      />

      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? t.editItem : t.addItem}
        parentTitle={t.items}
        size="md" onSave={handleSave} saving={saving}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.itemCode} *</label>
            <input className="form-control" value={form.item_code} onChange={e => setForm(f => ({...f,item_code:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.itemName} *</label>
            <input className="form-control" value={form.item_name} onChange={e => setForm(f => ({...f,item_name:e.target.value}))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.classification}</label>
            <select className="form-control" value={form.classification_id} onChange={e => setForm(f => ({...f,classification_id:e.target.value}))}>
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
          <div className="form-group">
            <label className="form-label">{t.unitOfMeasure}</label>
            <input className="form-control" value={form.unit_of_measure} onChange={e => setForm(f => ({...f,unit_of_measure:e.target.value}))} placeholder="e.g. m², pcs, kg" />
          </div>
        </div>
        {editing && (
          <div className="form-group">
            <label className="form-label">{t.status}</label>
            <select className="form-control" value={form.is_active ? 'true' : 'false'}
              onChange={e => setForm(f => ({...f,is_active:e.target.value==='true'}))}>
              <option value="true">{t.active}</option>
              <option value="false">{t.inactive}</option>
            </select>
          </div>
        )}
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)}
        title="Delete Item" parentTitle={t.items}
        size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:700, color:'var(--danger)' }}>{delModal.item_name}</p>}
      </Modal>
    </div>
  );
}
