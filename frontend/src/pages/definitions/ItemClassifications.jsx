import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable   from '../../components/shared/DataTable';
import Modal       from '../../components/shared/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const FILTER_FIELDS = [
  { key: 'is_active', label: 'Status', type: 'select', options: [
    { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
  ]},
  { key: 'parent_name', label: 'Parent', type: 'text' },
];
const EMPTY = { classification_code:'', classification_name:'', parent_id:'', is_active:true };

export default function ItemClassifications() {
  const toast = useToast();
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [delModal,setDelModal]= useState(null);

  function load() {
    setLoading(true);
    api.getClassifications()
      .then(setList)
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  }
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
      const payload = { ...form, parent_id: form.parent_id || null, is_active: form.is_active !== false };
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

  // Sort: parents first, then children
  const sorted = [
    ...list.filter(c => !c.parent_id),
    ...list.filter(c => !!c.parent_id),
  ];

  const columns = [
    { key: 'classification_code', label: t.classificationCode,
      render: r => <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700 }}>{r.classification_code}</span> },
    { key: 'classification_name', label: t.classificationName,
      render: r => (
        <span>
          {r.parent_id && <span style={{ color:'var(--text-muted)', marginRight:8, fontSize:13 }}>└</span>}
          {r.classification_name}
          {r.parent_name && (
            <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>({r.parent_name})</span>
          )}
        </span>
      )},
    { key: 'is_active', label: t.status, render: r => <StatusBadge value={r.is_active ? 'active' : 'inactive'} /> },
    { key: 'actions', label: '', style:{width:120}, render: r => (
      <div className="td-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏ {t.edit}</button>
        <button className="btn btn-danger btn-sm" onClick={() => setDelModal(r)}>🗑</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="page-header"><h1>{t.itemClassifications}</h1></div>

      <DataTable
        columns={columns}
        data={sorted}
        loading={loading}
        title="Item Classifications"
        onAdd={openAdd}
        filterFields={FILTER_FIELDS}
      />

      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? t.editClassification : t.addClassification}
        parentTitle={t.itemClassifications}
        size="sm" onSave={handleSave} saving={saving}>
        <div className="form-group">
          <label className="form-label">{t.classificationCode} *</label>
          <input className="form-control" value={form.classification_code} onChange={e => setForm(f => ({...f,classification_code:e.target.value}))} />
        </div>
        <div className="form-group">
          <label className="form-label">{t.classificationName} *</label>
          <input className="form-control" value={form.classification_name} onChange={e => setForm(f => ({...f,classification_name:e.target.value}))} />
        </div>
        <div className="form-group">
          <label className="form-label">{t.parentClassification}</label>
          <select className="form-control" value={form.parent_id} onChange={e => setForm(f => ({...f,parent_id:e.target.value}))}>
            <option value="">{t.topLevel}</option>
            {topLevel.filter(c => !editing || c.id !== editing.id).map(c => (
              <option key={c.id} value={c.id}>{c.classification_name}</option>
            ))}
          </select>
        </div>
        {editing && (
          <div className="form-group">
            <label className="form-label">{t.status}</label>
            <select className="form-control" value={form.is_active ? 'true' : 'false'}
              onChange={e => setForm(f => ({...f,is_active: e.target.value === 'true'}))}>
              <option value="true">{t.active}</option>
              <option value="false">{t.inactive}</option>
            </select>
          </div>
        )}
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)}
        title="Delete Classification" parentTitle={t.itemClassifications}
        size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:700, color:'var(--danger)' }}>{delModal.classification_name}</p>}
      </Modal>
    </div>
  );
}
