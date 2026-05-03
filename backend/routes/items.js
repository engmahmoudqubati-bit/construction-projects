const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');
const { requirePage } = require('../middleware/permission');

router.use(auth);

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*,
              c.classification_name,
              p.classification_name AS parent_classification_name
       FROM cp_items i
       LEFT JOIN cp_item_classifications c ON c.id = i.classification_id
       LEFT JOIN cp_item_classifications p ON p.id = c.parent_id
       ORDER BY c.classification_name, i.item_name`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', requirePage('definitions_items'), role('admin','project_manager'), async (req, res) => {
  const { item_code, item_name, classification_id, unit_of_measure } = req.body;
  if (!item_code || !item_name)
    return res.status(400).json({ message: 'item_code and item_name are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cp_items (item_code,item_name,classification_id,unit_of_measure)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [item_code, item_name, classification_id || null, unit_of_measure || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Item code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', requirePage('definitions_items'), role('admin','project_manager'), async (req, res) => {
  const { item_code, item_name, classification_id, unit_of_measure, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE cp_items SET item_code=$1,item_name=$2,classification_id=$3,
       unit_of_measure=$4,is_active=$5 WHERE id=$6 RETURNING *`,
      [item_code, item_name, classification_id || null, unit_of_measure || null, is_active ?? true, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Item code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', role('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM cp_items WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
