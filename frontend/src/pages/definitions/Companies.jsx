import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable  from '../../components/shared/DataTable';
import Modal      from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import t from '../../lang';

const EMPTY = { name_ar: '', name_en: '', type: 'organization', tax_id: '', parent_id: '' };

export default function Companies() {
  const toast = useToast();
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [delModal,  setDelModal]  = useState(null);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    api.getCompanies()
      .then(setCompanies)
      .catch(() => toast(t.errorOccurred, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const holdings = companies.filter(c => c.type === 'holding');

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(c) {
    setForm({ name_ar: c.name_ar, name_en: c.name_en, type: c.type, tax_id: c.tax_id || '', parent_id: c.parent_id || '' });
    setEditing(c);
    setModal(true);
  }

  async function handleSave() {
    if (!form.name_ar || !form.name_en) return toast('Arabic and English names are required', 'error');
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.type === 'organization' && form.parent_id ? Number(form.parent_id) : null };
      if (editing) {
        const updated = await api.updateCompany(editing.id, payload);
        setCompanies(cs => cs.map(c => c.id === editing.id ? updated : c));
      } else {
        const created = await api.createCompany(payload);
        setCompanies(cs => [...cs, created]);
      }
      toast(t.saveSuccess);
      setModal(false);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteCompany(delModal.id);
      setCompanies(cs => cs.filter(c => c.id !== delModal.id));
      toast(t.deleteSuccess);
      setDelModal(null);
    } catch (err) { toast(err.message, 'error'); }
  }

  // Build tree display
  function buildTree() {
    const holdingList = companies.filter(c => c.type === 'holding');
    const orgList     = companies.filter(c => c.type === 'organization');
    const standalone  = orgList.filter(c => !c.parent_id);
    const rows = [];
    // Holdings with their children
    holdingList.forEach(h => {
      rows.push({ ...h, _indent: 0 });
      orgList.filter(o => o.parent_id === h.id).forEach(o => {
        rows.push({ ...o, _indent: 1 });
      });
    });
    // Standalone organizations (no parent)
    standalone.forEach(o => rows.push({ ...o, _indent: 0 }));
    return rows;
  }

  const treeRows = buildTree().filter(c =>
    c.name_en.toLowerCase().includes(search.toLowerCase()) ||
    c.name_ar.includes(search)
  );

  const columns = [
    { key: 'name_en', label: t.companyNameEn, render: r => (
      <span style={{ paddingLeft: r._indent * 24, display: 'flex', alignItems: 'center', gap: 6 }}>
        {r._indent > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>└─</span>}
        <span>{r.name_en}</span>
      </span>
    )},
    { key: 'name_ar', label: t.companyNameAr, render: r => <span dir="rtl">{r.name_ar}</span> },
    { key: 'type',    label: t.companyType,   render: r => (
      <span className={`badge badge-${r.type === 'holding' ? 'admin' : 'project_manager'}`}>
        {r.type === 'holding' ? t.companyTypeHolding : t.companyTypeOrg}
      </span>
    )},
    { key: 'tax_id',  label: t.taxId },
    { key: 'actions', label: '', render: r => (
      <div className="td-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>{t.edit}</button>
        <button className="btn btn-danger btn-sm"    onClick={() => setDelModal(r)}>{t.delete}</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="page-header">
        <h1>{t.companies}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t.addCompany}</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <DataTable columns={columns} data={treeRows} loading={loading} />
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? t.editCompany : t.addCompany}
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.save}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">{t.companyType} *</label>
          <select className="form-control" value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value, parent_id: '' }))}>
            <option value="organization">{t.companyTypeOrg}</option>
            <option value="holding">{t.companyTypeHolding}</option>
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.companyNameEn} *</label>
            <input className="form-control" value={form.name_en}
              onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.companyNameAr} *</label>
            <input className="form-control" dir="rtl" value={form.name_ar}
              onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.taxId}</label>
            <input className="form-control" value={form.tax_id}
              onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} />
          </div>
          {form.type === 'organization' && (
            <div className="form-group">
              <label className="form-label">{t.parentCompany}</label>
              <select className="form-control" value={form.parent_id}
                onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                <option value="">{t.noParent}</option>
                {holdings.map(h => (
                  <option key={h.id} value={h.id}>{h.name_en}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!delModal}
        onClose={() => setDelModal(null)}
        title={t.delete}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDelModal(null)}>{t.cancel}</button>
            <button className="btn btn-danger"    onClick={handleDelete}>{t.delete}</button>
          </>
        }
      >
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop: 8, fontWeight: 600 }}>{delModal.name_en}</p>}
      </Modal>
    </div>
  );
}