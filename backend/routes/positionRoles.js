const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');

router.use(auth, role('admin'));

// List all position roles
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cp_position_roles ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create position role
router.post('/', async (req, res) => {
  const { name_ar, name_en, page_permissions = [] } = req.body;
  if (!name_ar || !name_en)
    return res.status(400).json({ message: 'name_ar and name_en are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO cp_position_roles (name_ar, name_en) VALUES ($1,$2) RETURNING *`,
      [name_ar, name_en]
    );
    const roleId = rows[0].id;
    for (const key of page_permissions) {
      await client.query(
        'INSERT INTO cp_position_role_permissions (role_id, page_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [roleId, key]
      );
    }
    await client.query('COMMIT');
    rows[0].page_permissions = page_permissions;
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally { client.release(); }
});

// Update position role
router.put('/:id', async (req, res) => {
  const { name_ar, name_en, page_permissions = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE cp_position_roles SET name_ar=$1, name_en=$2 WHERE id=$3 RETURNING *`,
      [name_ar, name_en, req.params.id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Not found' }); }
    await client.query('DELETE FROM cp_position_role_permissions WHERE role_id=$1', [req.params.id]);
    for (const key of page_permissions) {
      await client.query(
        'INSERT INTO cp_position_role_permissions (role_id, page_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [req.params.id, key]
      );
    }
    await client.query('COMMIT');
    rows[0].page_permissions = page_permissions;
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally { client.release(); }
});

// Get permissions for a role
router.get('/:id/permissions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT page_key FROM cp_position_role_permissions WHERE role_id=$1', [req.params.id]
    );
    res.json(rows.map(r => r.page_key));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete position role
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM cp_position_roles WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;