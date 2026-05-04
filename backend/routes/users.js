const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');

router.use(auth, role('admin'));

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name_ar, u.full_name_en, u.username,
              u.role, u.email, u.is_active, u.photo_url,
              u.position_role_id, u.company_id, u.created_at,
              pr.name_en AS position_role_name,
              co.name_en AS company_name
       FROM cp_users u
       LEFT JOIN cp_position_roles pr ON pr.id = u.position_role_id
       LEFT JOIN cp_companies co ON co.id = u.company_id
       ORDER BY u.id`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  const {
    full_name_ar, full_name_en, username, password,
    email, photo_url, position_role_id, company_id,
    project_access = []
  } = req.body;

  if (!full_name_en || !username)
    return res.status(400).json({ message: 'full_name_en and username are required' });
  if (!position_role_id)
    return res.status(400).json({ message: 'position_role is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get role and page permissions from position role
    const { rows: roleRows } = await client.query(
      'SELECT * FROM cp_position_roles WHERE id=$1', [position_role_id]
    );
    if (!roleRows[0]) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Invalid position role' }); }

    const { rows: permRows } = await client.query(
      `SELECT perm_type, perm_key FROM cp_position_role_permissions WHERE role_id=$1`,
      [position_role_id]
    );
    const pages    = permRows.filter(r => r.perm_type === 'page').map(r => r.perm_key);
    const projPerms = permRows.filter(r => r.perm_type === 'project').map(r => Number(r.perm_key));

    // Determine system role: if has all pages = project_manager, else site_engineer
    // (admin is set separately)
    const sysRole = pages.length >= 5 ? 'project_manager' : 'site_engineer';

    let hash = null;
    if (password) {
      hash = await bcrypt.hash(password, 10);
    } else {
      // null password — user cannot log in until password set
      hash = await bcrypt.hash(Math.random().toString(36), 10);
    }

    const full_name = full_name_en + (full_name_ar ? ` / ${full_name_ar}` : '');

    const { rows } = await client.query(
      `INSERT INTO cp_users (full_name, full_name_ar, full_name_en, username, password, role, email, photo_url, position_role_id, company_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, full_name, full_name_ar, full_name_en, username, role, email, is_active, photo_url, position_role_id, company_id`,
      [full_name, full_name_ar||null, full_name_en, username, hash, sysRole, email||null, photo_url||null, position_role_id, company_id||null]
    );
    const userId = rows[0].id;

    // Save page permissions from position role
    for (const k of pages) {
      await client.query(
        'INSERT INTO cp_user_page_permissions (user_id,page_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [userId, k]
      );
    }
    // Save project access
    const allProjects = [...new Set([...project_access, ...projPerms])];
    for (const pid of allProjects) {
      await client.query(
        'INSERT INTO cp_user_project_access (user_id,project_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [userId, pid]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ message: 'Username already exists' });
    res.status(500).json({ message: err.message });
  } finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const {
    full_name_ar, full_name_en, username, password,
    email, photo_url, position_role_id, company_id,
    project_access = []
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: permRows } = await client.query(
      `SELECT perm_type, perm_key FROM cp_position_role_permissions WHERE role_id=$1`,
      [position_role_id]
    );
    const pages = permRows.filter(r => r.perm_type === 'page').map(r => r.perm_key);
    const projPerms = permRows.filter(r => r.perm_type === 'project').map(r => Number(r.perm_key));
    const sysRole = pages.length >= 5 ? 'project_manager' : 'site_engineer';
    const full_name = full_name_en + (full_name_ar ? ` / ${full_name_ar}` : '');

    let userRow;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      const { rows } = await client.query(
        `UPDATE cp_users SET full_name=$1,full_name_ar=$2,full_name_en=$3,username=$4,password=$5,
         role=$6,email=$7,photo_url=$8,position_role_id=$9,company_id=$10
         WHERE id=$11 RETURNING id,full_name,full_name_ar,full_name_en,username,role,email,is_active,photo_url,position_role_id,company_id`,
        [full_name,full_name_ar||null,full_name_en,username,hash,sysRole,email||null,photo_url||null,position_role_id||null,company_id||null,req.params.id]
      );
      userRow = rows[0];
    } else {
      const { rows } = await client.query(
        `UPDATE cp_users SET full_name=$1,full_name_ar=$2,full_name_en=$3,username=$4,
         role=$5,email=$6,photo_url=$7,position_role_id=$8,company_id=$9
         WHERE id=$10 RETURNING id,full_name,full_name_ar,full_name_en,username,role,email,is_active,photo_url,position_role_id,company_id`,
        [full_name,full_name_ar||null,full_name_en,username,sysRole,email||null,photo_url||null,position_role_id||null,company_id||null,req.params.id]
      );
      userRow = rows[0];
    }
    if (!userRow) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'User not found' }); }

    await client.query('DELETE FROM cp_user_page_permissions WHERE user_id=$1', [req.params.id]);
    await client.query('DELETE FROM cp_user_project_access WHERE user_id=$1',   [req.params.id]);

    for (const k of pages) {
      await client.query(
        'INSERT INTO cp_user_page_permissions (user_id,page_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [req.params.id, k]
      );
    }
    const allProjects = [...new Set([...project_access, ...projPerms])];
    for (const pid of allProjects) {
      await client.query(
        'INSERT INTO cp_user_project_access (user_id,project_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [req.params.id, pid]
      );
    }

    await client.query('COMMIT');
    res.json(userRow);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ message: 'Username already exists' });
    res.status(500).json({ message: err.message });
  } finally { client.release(); }
});

router.patch('/:id/toggle-active', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE cp_users SET is_active = NOT is_active WHERE id=$1
       RETURNING id,full_name_en,username,role,is_active`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete — block if user has transactions
router.delete('/:id', async (req, res) => {
  try {
    const checks = await Promise.all([
      pool.query('SELECT id FROM cp_delivery_transactions WHERE engineer_id=$1 LIMIT 1',     [req.params.id]),
      pool.query('SELECT id FROM cp_installation_transactions WHERE engineer_id=$1 LIMIT 1', [req.params.id]),
      pool.query('SELECT id FROM cp_inspection_transactions WHERE inspector_id=$1 LIMIT 1',  [req.params.id]),
    ]);
    if (checks.some(c => c.rows.length > 0))
      return res.status(409).json({ message: 'Cannot delete: user has existing transactions' });
    const { rowCount } = await pool.query('DELETE FROM cp_users WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id/permissions', async (req, res) => {
  try {
    const [pagesRes, projRes] = await Promise.all([
      pool.query('SELECT page_key FROM cp_user_page_permissions WHERE user_id=$1', [req.params.id]),
      pool.query('SELECT project_id FROM cp_user_project_access WHERE user_id=$1',  [req.params.id]),
    ]);
    res.json({
      pages:    pagesRes.rows.map(r => r.page_key),
      projects: projRes.rows.map(r => r.project_id),
    });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ message: 'Cannot delete: this record is linked to other data. Remove the linked records first.' });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;