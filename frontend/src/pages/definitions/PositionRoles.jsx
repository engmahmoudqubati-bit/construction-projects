import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Modal      from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import RefreshButton from '../../components/shared/RefreshButton';
import t from '../../lang';

const PAGE_KEYS  = Object.keys(t.pageKeys);
const ACTION_KEYS = Object.keys(t.actionKeys);
const EMPTY = { name_ar: '', name_en: '', pages: [], actions: [], projects: [] };

export default function PositionRoles() {
  const toast = useToast();
  const [roles,    setRoles]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [delModal, setDelModal] = useState(null);
  const [search,   setSearch]   = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.getPositionRoles(), api.getProjects()])
      .then(([r, p]) => { setRoles(r); setProjects(p); })
      .catch(() => toast(t.errorOccurred,'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function openEdit(r) {
    const perms = await api.getPositionRolePerms(r.id);
    setForm({ name_ar: r.name_ar, name_en: r.name_en, pages: perms.pages||[], actions: perms.actions||[], projects: perms.projects||[] });
    setEditing(r); setModal(true);
  }

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }

  function toggle(field, key) {
    setForm(f => ({ ...f, [field]: f[field].includes(key) ? f[field].filter(k => k !== key) : [...f[field], key] }));
  }

  function toggleProject(id) {
    setForm(f => ({ ...f, projects: f.projects.includes(id) ? f.projects.filter(p => p !== id) : [...f.projects, id] }));
  }

  async function handleSave() {
    if (!form.name_ar || !form.name_en) return toast('Both names required','error');
    setSaving(true);
    try {
      if (editing) {
        const u = await api.updatePositionRole(editing.id, form);
        setRoles(rs => rs.map(r => r.id === editing.id ? { ...r, ...u } : r));
      } else {
        const c = await api.createPositionRole(form);
        setRoles(rs => [...rs, c]);
      }
      toast(t.saveSuccess); setModal(false);
    } catch (err) { toast(err.message,'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deletePositionRole(delModal.id);
      setRoles(rs => rs.filter(r => r.id !== delModal.id));
      toast(t.deleteSuccess); setDelModal(null);
    } catch (err) { toast(err.message,'error'); }
  }

  const filtered = roles.filter(r =>
    (r.name_en||'').toLowerCase().includes(search.toLowerCase()) ||
    (r.name_ar||'').includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <h1>{t.positionRoles}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t.addPositionRole}</button>
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
              <thead><tr><th>{t.positionRoleNameEn}</th><th>{t.positionRoleNameAr}</th><th></th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>{t.noData}</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id}>
                    <td>{r.name_en}</td>
                    <td dir="rtl">{r.name_ar}</td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? t.editPositionRole : t.addPositionRole} size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>{t.cancel}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.save}</button></>}>
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">{t.positionRoleNameEn} *</label>
            <input className="form-control" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t.positionRoleNameAr} *</label>
            <input className="form-control" dir="rtl" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} />
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
          {/* Page Access */}
          <div className="perm-section">
            <div className="perm-section-title">📄 {t.pagePermissions}</div>
            <div className="perm-grid" style={{ gridTemplateColumns:'1fr' }}>
              {PAGE_KEYS.map(k => (
                <label key={k} className="perm-item">
                  <input type="checkbox" checked={form.pages.includes(k)} onChange={() => toggle('pages', k)} />
                  {t.pageKeys[k]}
                </label>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="perm-section">
            <div className="perm-section-title">⚙️ {t.actionPermissions}</div>
            <div className="perm-grid" style={{ gridTemplateColumns:'1fr' }}>
              {ACTION_KEYS.map(k => (
                <label key={k} className="perm-item">
                  <input type="checkbox" checked={form.actions.includes(k)} onChange={() => toggle('actions', k)} />
                  {t.actionKeys[k]}
                </label>
              ))}
            </div>
          </div>

          {/* Project Access */}
          <div className="perm-section">
            <div className="perm-section-title">🏗️ {t.projectAccess}</div>
            <div className="perm-grid" style={{ gridTemplateColumns:'1fr', maxHeight:240, overflowY:'auto' }}>
              {projects.map(p => (
                <label key={p.id} className="perm-item">
                  <input type="checkbox" checked={form.projects.includes(p.id)} onChange={() => toggleProject(p.id)} />
                  {p.project_name_en}
                </label>
              ))}
              {projects.length === 0 && <span style={{ fontSize:12, color:'var(--text-muted)' }}>No projects yet</span>}
            </div>
          </div>
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
}=>toggleProject(p.id)} />
                  {p.project_name_en}
                </label>
              ))}
              {projects.length===0 && <span style={{fontSize:12,color:'var(--text-muted)'}}>No projects yet</span>}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!delModal} onClose={()=>setDelModal(null)} title="Delete Position Role" parentTitle={t.positionRoles} size="sm" onSave={handleDelete} saveLabel="Delete">
        <p>{t.confirmDelete}</p>
        {delModal && <p style={{marginTop:8,fontWeight:700,color:'var(--danger)'}}>{delModal.name_en}</p>}
      </Modal>

      <Modal open={delSelModal} onClose={()=>setDelSelModal(false)} title={`Delete ${selectedRows.length} Roles`} parentTitle={t.positionRoles} size="sm" onSave={handleDeleteSelected} saveLabel="Delete All">
        <p>Are you sure you want to delete <strong>{selectedRows.length}</strong> selected role(s)? This cannot be undone.</p>
      </Modal>
    </div>
  );
}