const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');
const { requirePage, attachProjectAccess, canAccessProject } = require('../middleware/permission');

router.use(auth, requirePage('planning'), attachProjectAccess);

// Get available items for a project (not yet planned)
router.get('/available-items/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!canAccessProject(req, projectId))
    return res.status(403).json({ message: 'No access to this project' });
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.item_code, i.item_name, i.unit_of_measure,
              c.classification_name, p.classification_name AS parent_classification_name
       FROM cp_items i
       LEFT JOIN cp_item_classifications c  ON c.id  = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       LEFT JOIN cp_project_planning pp ON pp.item_id = i.id AND pp.project_id = $1
       WHERE i.is_active = true AND pp.id IS NULL
       ORDER BY p.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get planned items for a project
router.get('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!canAccessProject(req, projectId))
    return res.status(403).json({ message: 'No access to this project' });
  try {
    const { rows } = await pool.query(
      `SELECT i.id AS item_id, i.item_code, i.item_name, i.unit_of_measure,
              c.classification_name,
              pc.classification_name AS parent_classification_name,
              pp.id AS planning_id, pp.planned_qty, pp.status
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id = pp.item_id
       LEFT JOIN cp_item_classifications c  ON c.id  = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       WHERE pp.project_id = $1
       ORDER BY pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Insert items into planning
router.post('/insert-items', role('admin','project_manager'), async (req, res) => {
  const { project_id, item_ids } = req.body;
  if (!project_id || !Array.isArray(item_ids))
    return res.status(400).json({ message: 'project_id and item_ids[] required' });
  if (!canAccessProject(req, project_id))
    return res.status(403).json({ message: 'No access to this project' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const id of item_ids) {
      await client.query(
        `INSERT INTO cp_project_planning (project_id, item_id, planned_qty, status)
         VALUES ($1,$2,0,'draft') ON CONFLICT (project_id,item_id) DO NOTHING`,
        [project_id, id]
      );
    }
    await client.query('COMMIT');
    res.json({ inserted: item_ids.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally { client.release(); }
});

// Save planning (update qty, keep draft status)
router.post('/', role('admin','project_manager'), async (req, res) => {
  const { project_id, entries } = req.body;
  if (!project_id || !Array.isArray(entries))
    return res.status(400).json({ message: 'project_id and entries[] required' });
  if (!canAccessProject(req, project_id))
    return res.status(403).json({ message: 'No access to this project' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of entries) {
      if (e.planned_qty !== null && Number(e.planned_qty) > 0) {
        await client.query(
          `UPDATE cp_project_planning SET planned_qty=$1 WHERE project_id=$2 AND item_id=$3 AND status='draft'`,
          [e.planned_qty, project_id, e.item_id]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ saved: entries.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally { client.release(); }
});

// Prepare planning (draft -> prepared)
router.patch('/prepare/:projectId', role('admin','project_manager'), async (req, res) => {
  if (!canAccessProject(req, req.params.projectId))
    return res.status(403).json({ message: 'No access to this project' });
  try {
    await pool.query(
      `UPDATE cp_project_planning SET status='prepared' WHERE project_id=$1 AND status='draft' AND planned_qty > 0`,
      [req.params.projectId]
    );
    res.json({ message: 'Planning prepared' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Confirm planning (prepared -> confirmed)
router.patch('/confirm/:projectId', role('admin','project_manager'), async (req, res) => {
  if (!canAccessProject(req, req.params.projectId))
    return res.status(403).json({ message: 'No access to this project' });
  try {
    await pool.query(
      `UPDATE cp_project_planning SET status='confirmed' WHERE project_id=$1 AND status='prepared'`,
      [req.params.projectId]
    );
    res.json({ message: 'Planning confirmed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete a planning row
router.delete('/:projectId/:itemId', role('admin','project_manager'), async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM cp_project_planning WHERE project_id=$1 AND item_id=$2 AND status='draft'`,
      [req.params.projectId, req.params.itemId]
    );
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;