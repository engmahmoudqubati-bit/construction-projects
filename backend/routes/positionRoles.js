const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');

router.use(auth, role('admin'));

const PAGE_KEYS = [
  'definitions_projects','definitions_classifications','definitions_items',
  'planning','delivery','installation','inspection','reports',
];

const ACTION_KEYS = [
  'can_create','can_save','can_edit','can_delete','can_confirm','can_activate',
];

// List all
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cp_position_roles ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get permissions
router.get('/:id/permissions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT perm_type, perm_key FROM cp_position_role_permissions WHERE role_id=$1',
      [req.params.id]
    );
    const pages    = rows.filter(r => r.perm_type === 'page').map(r => r.perm_key);
    const actions  = rows.filter(r => r.perm_type === 'action').map(r => r.perm_key);
    const projects = rows.filter(r => r.perm_type === 'project').map(r => Number(r.perm_key));
    res.json({ pages, actions, projects });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create
router.post('/', async (req, res) => {
  const { name_ar, name_en, pages = [], actions = [], projects = [] } = req.body;
  if (!name_ar || !name_en)
    return res.status(400).json({ message: 'name_ar and name_en are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO cp_position_roles (name_ar, name_en) VALUES ($1,$2) RETURNING *',
      [name_ar, name_en]
    );
    await savePerms(client, rows[0].id, pages, actions, projects);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally { client.release(); }
});

// Update
router.put('/:id', async (req, res) => {
  const { name_ar, name_en, pages = [], actions = [], projects = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE cp_position_roles SET name_ar=$1,name_en=$2 WHERE id=$3 RETURNING *',
      [name_ar, name_en, req.params.id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Not found' }); }
    await client.query('DELETE FROM cp_position_role_permissions WHERE role_id=$1', [req.params.id]);
    await savePerms(client, req.params.id, pages, actions, projects);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally { client.release(); }
});

// Delete — only if no users assigned
router.delete('/:id', async (req, res) => {
  try {
    const { rows: users } = await pool.query(
      'SELECT id FROM cp_users WHERE position_role_id=$1 LIMIT 1', [req.params.id]
    );
    if (users.length > 0)
      return res.status(409).json({ message: 'Cannot delete: users are assigned to this position role. Reassign them first.' });
    const { rowCount } = await pool.query('DELETE FROM cp_position_roles WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ message: 'Cannot delete: this record is linked to other data. Remove the linked records first.' });
    res.status(500).json({ message: err.message });
  }
});

async function savePerms(client, roleId, pages, actions, projects) {
  for (const k of pages) {
    await client.query(
      'INSERT INTO cp_position_role_permissions (role_id,perm_type,perm_key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [roleId, 'page', k]
    );
  }
  for (const k of actions) {
    await client.query(
      'INSERT INTO cp_position_role_permissions (role_id,perm_type,perm_key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [roleId, 'action', k]
    );
  }
  for (const p of projects) {
    await client.query(
      'INSERT INTO cp_position_role_permissions (role_id,perm_type,perm_key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [roleId, 'project', String(p)]
    );
  }
}

module.exports = router;