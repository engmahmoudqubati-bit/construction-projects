const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.use(auth);

// Get all items linked to a project
router.get('/:projectId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pi.id, pi.project_id, pi.item_id, pi.planned_qty,
              i.item_code, i.item_name, i.unit_of_measure,
              c.classification_name
       FROM cp_project_items pi
       JOIN cp_items i ON i.id = pi.item_id
       LEFT JOIN cp_item_classifications c ON c.id = i.classification_id
       WHERE pi.project_id = $1
       ORDER BY c.classification_name, i.item_name`,
      [req.params.projectId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add item to project
router.post('/', role('admin', 'project_manager'), async (req, res) => {
  const { project_id, item_id, planned_qty } = req.body;
  if (!project_id || !item_id || !planned_qty) {
    return res.status(400).json({ message: 'project_id, item_id, planned_qty are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO cp_project_items (project_id, item_id, planned_qty)
       VALUES ($1,$2,$3)
       ON CONFLICT (project_id, item_id) DO UPDATE SET planned_qty = EXCLUDED.planned_qty
       RETURNING *`,
      [project_id, item_id, planned_qty]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update planned qty
router.put('/:id', role('admin', 'project_manager'), async (req, res) => {
  const { planned_qty } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE cp_project_items SET planned_qty=$1 WHERE id=$2 RETURNING *',
      [planned_qty, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Project item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Remove item from project
router.delete('/:id', role('admin', 'project_manager'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM cp_project_items WHERE id=$1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Project item not found' });
    res.json({ message: 'Item removed from project' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
