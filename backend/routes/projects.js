const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');
const { attachProjectAccess } = require('../middleware/permission');

router.use(auth, attachProjectAccess);

router.get('/', async (req, res) => {
  try {
    let query = `SELECT p.* FROM cp_projects p`;
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
    const { rows } = await pool.query('SELECT * FROM cp_projects WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Project not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', role('admin', 'project_manager'), async (req, res) => {
  const { project_code, project_name_en, project_name_ar, location, client_name, start_date, end_date, status } = req.body;
  if (!project_code || !project_name_en)
    return res.status(400).json({ message: 'project_code and project_name_en are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cp_projects (project_code,project_name_en,project_name_ar,location,client_name,start_date,end_date,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [project_code, project_name_en, project_name_ar||null, location||null, client_name||null, start_date||null, end_date||null, status||'active']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Project code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', role('admin', 'project_manager'), async (req, res) => {
  const { project_code, project_name_en, project_name_ar, location, client_name, start_date, end_date, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE cp_projects SET project_code=$1,project_name_en=$2,project_name_ar=$3,
       location=$4,client_name=$5,start_date=$6,end_date=$7,status=$8
       WHERE id=$9 RETURNING *`,
      [project_code, project_name_en, project_name_ar||null, location||null, client_name||null, start_date||null, end_date||null, status, req.params.id]
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
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ message: 'Cannot delete: this record is linked to other data. Remove the linked records first.' });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;