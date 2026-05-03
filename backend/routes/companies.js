const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');

router.use(auth, role('admin'));

// List all companies (tree structure)
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM cp_companies ORDER BY type DESC, id ASC'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create company
router.post('/', async (req, res) => {
  const { name_ar, name_en, type, tax_id, parent_id } = req.body;
  if (!name_ar || !name_en || !type)
    return res.status(400).json({ message: 'name_ar, name_en, type are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cp_companies (name_ar, name_en, type, tax_id, parent_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name_ar, name_en, type, tax_id || null, parent_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update company
router.put('/:id', async (req, res) => {
  const { name_ar, name_en, type, tax_id, parent_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE cp_companies SET name_ar=$1, name_en=$2, type=$3, tax_id=$4, parent_id=$5
       WHERE id=$6 RETURNING *`,
      [name_ar, name_en, type, tax_id || null, parent_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Company not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete company
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM cp_companies WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Company not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;