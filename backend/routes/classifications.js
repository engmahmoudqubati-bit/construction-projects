const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');
const { requirePage } = require('../middleware/permission');

router.use(auth);

// Returns all classifications with parent info — flat list, sorted for tree rendering
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, p.classification_name AS parent_name
       FROM cp_item_classifications c
       LEFT JOIN cp_item_classifications p ON p.id = c.parent_id
       ORDER BY COALESCE(c.parent_id, c.id), c.id`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', requirePage('definitions_classifications'), role('admin','project_manager'), async (req, res) => {
  const { classification_code, classification_name, parent_id } = req.body;
  if (!classification_code || !classification_name)
    return res.status(400).json({ message: 'classification_code and classification_name are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cp_item_classifications (classification_code, classification_name, parent_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [classification_code, classification_name, parent_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', requirePage('definitions_classifications'), role('admin','project_manager'), async (req, res) => {
  const { classification_code, classification_name, parent_id, is_active } = req.body;
  // Prevent self-referencing
  if (parent_id && Number(parent_id) === Number(req.params.id))
    return res.status(400).json({ message: 'A classification cannot be its own parent' });
  try {
    const { rows } = await pool.query(
      `UPDATE cp_item_classifications
       SET classification_code=$1, classification_name=$2, parent_id=$3, is_active=$4
       WHERE id=$5 RETURNING *`,
      [classification_code, classification_name, parent_id || null, is_active ?? true, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Classification not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', role('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM cp_item_classifications WHERE id=$1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Classification not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
