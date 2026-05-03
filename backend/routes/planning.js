const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');
const { requirePage, attachProjectAccess, canAccessProject } = require('../middleware/permission');

router.use(auth, requirePage('planning'), attachProjectAccess);

// Get all planned items for a project (shows ALL items, planned_qty may be null if not yet set)
router.get('/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!canAccessProject(req, projectId))
    return res.status(403).json({ message: 'No access to this project' });
  try {
    const { rows } = await pool.query(
      `SELECT i.id AS item_id, i.item_code, i.item_name, i.unit_of_measure,
              c.classification_name,
              pc.classification_name AS parent_classification_name,
              pp.id AS planning_id, pp.planned_qty
       FROM cp_items i
       LEFT JOIN cp_item_classifications c  ON c.id  = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       LEFT JOIN cp_project_planning pp
         ON pp.item_id = i.id AND pp.project_id = $1
       WHERE i.is_active = true
       ORDER BY pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Bulk upsert planning rows for a project
router.post('/', role('admin','project_manager'), async (req, res) => {
  const { project_id, entries } = req.body;
  // entries: [{ item_id, planned_qty }]  — null/0 = remove
  if (!project_id || !Array.isArray(entries))
    return res.status(400).json({ message: 'project_id and entries[] required' });
  if (!canAccessProject(req, project_id))
    return res.status(403).json({ message: 'No access to this project' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let saved = 0;
    for (const e of entries) {
      if (!e.planned_qty || Number(e.planned_qty) <= 0) {
        // Remove if qty cleared
        await client.query(
          'DELETE FROM cp_project_planning WHERE project_id=$1 AND item_id=$2',
          [project_id, e.item_id]
        );
      } else {
        await client.query(
          `INSERT INTO cp_project_planning (project_id, item_id, planned_qty)
           VALUES ($1,$2,$3)
           ON CONFLICT (project_id, item_id) DO UPDATE SET planned_qty=EXCLUDED.planned_qty`,
          [project_id, e.item_id, e.planned_qty]
        );
        saved++;
      }
    }
    await client.query('COMMIT');
    res.json({ saved });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally { client.release(); }
});

module.exports = router;
