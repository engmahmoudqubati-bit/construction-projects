const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');
const { attachProjectAccess } = require('../middleware/permission');

router.use(auth, attachProjectAccess);

// ── List projects (filtered by user access) ──────────────────
router.get('/', async (req, res) => {
  try {
    let query = `SELECT p.*, u.full_name AS manager_name
                 FROM cp_projects p
                 LEFT JOIN cp_users u ON u.id = p.manager_id`;
    const params = [];

    if (req.projectIds !== null) {
      if (req.projectIds.length === 0) return res.json([]);
      params.push(req.projectIds);
      query += ` WHERE p.id = ANY($1)`;
    }
    query += ' ORDER BY p.id';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, u.full_name AS manager_name
       FROM cp_projects p LEFT JOIN cp_users u ON u.id=p.manager_id
       WHERE p.id=$1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Project not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', role('admin', 'project_manager'), async (req, res) => {
  const { project_code, project_name_en, project_name_ar, location, client_name,
          start_date, end_date, status, manager_id } = req.body;
  if (!project_code || !project_name_en)
    return res.status(400).json({ message: 'project_code and project_name_en are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cp_projects
         (project_code,project_name_en,project_name_ar,location,client_name,start_date,end_date,status,manager_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [project_code, project_name_en, project_name_ar || null, location || null,
       client_name || null, start_date || null, end_date || null,
       status || 'active', manager_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Project code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', role('admin', 'project_manager'), async (req, res) => {
  const { project_code, project_name_en, project_name_ar, location, client_name,
          start_date, end_date, status, manager_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE cp_projects SET project_code=$1,project_name_en=$2,project_name_ar=$3,
       location=$4,client_name=$5,start_date=$6,end_date=$7,status=$8,manager_id=$9
       WHERE id=$10 RETURNING *`,
      [project_code, project_name_en, project_name_ar || null, location || null,
       client_name || null, start_date || null, end_date || null,
       status, manager_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Project code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', role('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM cp_projects WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
