const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');
const { requirePage, attachProjectAccess, canAccessProject } = require('../middleware/permission');

router.use(auth, requirePage('planning'), attachProjectAccess);

// Get available items (not yet in BOQ for this project)
router.get('/available-items/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access' });
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.item_code, i.item_name,
              m.unit_code, m.desc_en AS unit_desc_en,
              c.classification_name,
              pc.classification_name  AS parent_classification_name,
              gpc.classification_name AS grandparent_classification_name
       FROM cp_items i
       LEFT JOIN cp_measurements m          ON m.id   = i.measurement_id
       LEFT JOIN cp_item_classifications c  ON c.id   = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id  = c.parent_id
       LEFT JOIN cp_item_classifications gpc ON gpc.id = pc.parent_id
       LEFT JOIN cp_project_planning pp ON pp.item_id = i.id AND pp.project_id = $1
       WHERE i.is_active = true AND pp.id IS NULL
       ORDER BY COALESCE(gpc.classification_name, pc.classification_name, c.classification_name),
                c.classification_name, i.item_code`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get BOQ for a project
router.get('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access' });
  try {
    const { rows } = await pool.query(
      `SELECT pp.id AS planning_id, pp.item_id, pp.planned_qty, pp.status,
              i.item_code, i.item_name,
              m.unit_code, m.desc_en AS unit_desc_en,
              c.classification_name,
              pc.classification_name  AS parent_classification_name,
              gpc.classification_name AS grandparent_classification_name
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id = pp.item_id
       LEFT JOIN cp_measurements m          ON m.id   = i.measurement_id
       LEFT JOIN cp_item_classifications c  ON c.id   = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id  = c.parent_id
       LEFT JOIN cp_item_classifications gpc ON gpc.id = pc.parent_id
       WHERE pp.project_id = $1
       ORDER BY COALESCE(gpc.classification_name, pc.classification_name, c.classification_name) NULLS LAST,
                c.classification_name NULLS LAST,
                i.item_code`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Insert items into BOQ — new items always start as incomplete
router.post('/insert-items', async (req, res) => {
  const { project_id, item_ids } = req.body;
  if (!project_id || !Array.isArray(item_ids)) return res.status(400).json({ message: 'project_id and item_ids[] required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const id of item_ids) {
      await client.query(
        `INSERT INTO cp_project_planning (project_id, item_id, planned_qty, status)
         VALUES ($1,$2,0,'incomplete') ON CONFLICT (project_id,item_id) DO NOTHING`,
        [project_id, id]
      );
    }
    await client.query('COMMIT');
    res.json({ inserted: item_ids.length });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: err.message }); }
  finally { client.release(); }
});

// Save qty — only for incomplete and saved rows
router.post('/', async (req, res) => {
  const { project_id, entries } = req.body;
  if (!project_id || !Array.isArray(entries)) return res.status(400).json({ message: 'project_id and entries[] required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of entries) {
      await client.query(
        `UPDATE cp_project_planning SET planned_qty=$1
         WHERE project_id=$2 AND item_id=$3 AND status IN ('incomplete','saved')`,
        [e.planned_qty ?? 0, project_id, e.item_id]
      );
    }
    await client.query('COMMIT');
    res.json({ saved: entries.length });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: err.message }); }
  finally { client.release(); }
});

// Draft — set status to incomplete
router.patch('/draft/:projectId', async (req, res) => {
  if (!canAccessProject(req, req.params.projectId)) return res.status(403).json({ message: 'No access' });
  try {
    await pool.query(
      `UPDATE cp_project_planning SET status='incomplete' WHERE project_id=$1 AND status IN ('incomplete','saved')`,
      [req.params.projectId]
    );
    res.json({ message: 'Saved as incomplete' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Save — set status to saved
router.patch('/save/:projectId', async (req, res) => {
  if (!canAccessProject(req, req.params.projectId)) return res.status(403).json({ message: 'No access' });
  try {
    await pool.query(
      `UPDATE cp_project_planning SET status='saved' WHERE project_id=$1 AND status IN ('incomplete','saved')`,
      [req.params.projectId]
    );
    res.json({ message: 'Saved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Approve — set status to approved
router.patch('/approve/:projectId', async (req, res) => {
  if (!canAccessProject(req, req.params.projectId)) return res.status(403).json({ message: 'No access' });
  try {
    await pool.query(
      `UPDATE cp_project_planning SET status='approved' WHERE project_id=$1 AND status IN ('incomplete','saved')`,
      [req.params.projectId]
    );
    res.json({ message: 'Approved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Unpost — approved back to incomplete (requires can_confirm permission)
router.patch('/unpost/:projectId', async (req, res) => {
  if (!canAccessProject(req, req.params.projectId)) return res.status(403).json({ message: 'No access' });
  // Check action permission
  try {
    const userPerms = await pool.query(
      `SELECT perm_key FROM cp_position_role_permissions
       WHERE role_id=(SELECT position_role_id FROM cp_users WHERE id=$1) AND perm_type='action' AND perm_key='can_confirm'`,
      [req.user.id]
    );
    if (req.user.role !== 'admin' && userPerms.rows.length === 0)
      return res.status(403).json({ message: 'No permission to unpost' });
    await pool.query(
      `UPDATE cp_project_planning SET status='incomplete' WHERE project_id=$1 AND status='approved'`,
      [req.params.projectId]
    );
    res.json({ message: 'Unposted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete a row (only incomplete)
router.delete('/:projectId/:itemId', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM cp_project_planning WHERE project_id=$1 AND item_id=$2 AND status='incomplete'`,
      [req.params.projectId, req.params.itemId]
    );
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;