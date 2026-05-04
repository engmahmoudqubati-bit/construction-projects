import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Modal      from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import t from '../../lang';

const EMPTY = { company_code: '', name_ar: '', name_en: '', type: 'organization', tax_id: '', parent_id: '' };

function smartSearch(items, q) {
  if (!q) return items;
  const lq = q.toLowerCase();
  return items.filter(c =>
    (c.name_en||'').toLowerCase().includes(lq) ||
    (c.name_ar||'').includes(q) ||
    (c.company_code||'').toLowerCase().includes(lq) ||
    (c.tax_id||'').toLowerCase().includes(lq) ||
    (c.parent_name||'').toLowerCase().includes(lq)
  );
}

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

  const load = () => {
    setLoading(true);
    api.getCompanies().then(setCompanies).catch(() => toast(t.errorOccurred,'error')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const holdings = companies.filter(c => c.type === 'holding');

  function openAdd()  { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(c) {
    setForm({ company_code: c.company_code||'', name_ar: c.name_ar, name_en: c.name_en, type: c.type, tax_id: c.tax_id||'', parent_id: c.parent_id||'' });
    setEditing(c); setModal(true);
  }

  async function handleSave() {
    if (!form.name_ar || !form.name_en) return toast('Arabic and English names are required','error');
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.type === 'organization' && form.parent_id ? Number(form.parent_id) : null };
      if (editing) {
        const u = await api.updateCompany(editing.id, payload);
        setCompanies(cs => cs.map(c => c.id === editing.id ? u : c));
      } else {
        const c = await api.createCompany(payload);
        setCompanies(cs => [...cs, c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch (err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteCompany(delModal.id);
      setCompanies(cs => cs.filter(c => c.id !== delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch (err) { toast(err.message,'error'); }
  }

  // Build tree rows
  function buildTree(all) {
    const rows = [];
    const holdings = all.filter(c => c.type === 'holding');
    const orgs     = all.filter(c => c.type === 'organization');
    holdings.forEach(h => {
      rows.push({ ...h, _level: 0 });
      orgs.filter(o => o.parent_id === h.id).forEach(o => rows.push({ ...o, _level: 1 }));
    });
    orgs.filter(o => !o.parent_id).forEach(o => rows.push({ ...o, _level: 0 }));
    return rows;
  }

  const filtered = smartSearch(companies, search);
  const treeRows = buildTree(filtered);

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
          <RefreshButton onRefresh={load} />
        </div>

        {loading ? <div className="spinner-wrap"><div className="spinner"/></div> : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t.companyCode}</th>
                  <th>{t.companyNameEn}</th>
                  <th>{t.companyNameAr}</th>
                  <th>{t.companyType}</th>
                  <th>{t.taxId}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {treeRows.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>{t.noData}</td></tr>
                ) : treeRows.map(r => (
                  <tr key={r.id} className={r.type === 'holding' ? 'tree-row-parent' : ''}>
                    <td style={{ color:'var(--text-muted)', fontSize:12 }}>{r.company_code || '—'}</td>
                    <td style={{ paddingLeft: r._level > 0 ? 32 : 14 }}>
                      {r._level > 0 && <span style={{ color:'var(--text-muted)', marginRight:6, fontSize:11 }}>└─</span>}
                      {r.name_en}
                    </td>
                    <td style={{ textAlign:"right", direction:"rtl" }}>{r.name_ar}</td>
                    <td><span className={`badge badge-${r.type}`}>{r.type === 'holding' ? t.companyTypeHolding : t.companyTypeOrg}</span></td>
                    <td style={{ fontSize:12 }}>{r.tax_id || '—'}</td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? t.editCompany : t.addCompany} size="md"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.save}</button></>}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.companyType} *</label>
            <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, parent_id: '' }))}>
              <option value="organization">{t.companyTypeOrg}</option>
              <option value="holding">{t.companyTypeHolding}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t.companyCode}</label>
            <input className="form-control" value={form.company_code} onChange={e => setForm(f => ({ ...f, company_code: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.companyNameEn} *</label>
            <input className="form-control" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.companyNameAr} *</label>
            <input className="form-control" dir="rtl" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t.taxId}</label>
            <input className="form-control" value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} />
          </div>
          {form.type === 'organization' && (
            <div className="form-group">
              <label className="form-label">{t.parentCompany}</label>
              <select className="form-control" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                <option value="">{t.noParent}</option>
                {holdings.map(h => <option key={h.id} value={h.id}>{h.name_en}</option>)}
              </select>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={() => setDelModal(null)} title={t.delete} size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setDelModal(null)}>{t.cancel}</button>
          <button className="btn btn-danger" onClick={handleDelete}>{t.delete}</button></>}>
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{ marginTop:8, fontWeight:600 }}>{delModal.name_en}</p>}
      </Modal>
    </div>
  );
}