const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const { requirePage, attachProjectAccess, canAccessProject } = require('../middleware/permission');

router.use(auth, requirePage('installation'), attachProjectAccess);

router.get('/', async (req, res) => {
  const { projectId, date } = req.query;
  if (!projectId || !date) return res.status(400).json({ message: 'projectId and date required' });
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access to this project' });
  try {
    const { rows } = await pool.query(
      `SELECT pp.item_id, pp.planned_qty,
              i.item_code, i.item_name, i.unit_of_measure,
              c.classification_name,
              pc.classification_name AS parent_classification_name,
              t.id AS tx_id, t.qty_installed, t.notes,
              COALESCE(SUM(t2.qty_installed), 0) AS total_installed
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id = pp.item_id
       LEFT JOIN cp_item_classifications c  ON c.id  = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       LEFT JOIN cp_installation_transactions t
         ON t.project_id=pp.project_id AND t.item_id=pp.item_id AND t.transaction_date=$2
       LEFT JOIN cp_installation_transactions t2
         ON t2.project_id=pp.project_id AND t2.item_id=pp.item_id
       WHERE pp.project_id=$1
       GROUP BY pp.item_id, pp.planned_qty, i.item_code, i.item_name, i.unit_of_measure,
                c.classification_name, pc.classification_name,
                t.id, t.qty_installed, t.notes
       ORDER BY pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId, date]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  const { project_id, transaction_date, entries } = req.body;
  if (!project_id || !transaction_date || !Array.isArray(entries))
    return res.status(400).json({ message: 'project_id, transaction_date, entries[] required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access to this project' });
  try {
    const results = [];
    for (const e of entries) {
      if (!e.qty_installed || Number(e.qty_installed) <= 0) continue;
      const { rows } = await pool.query(
        `INSERT INTO cp_installation_transactions
           (project_id,item_id,transaction_date,qty_installed,engineer_id,notes)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (project_id,item_id,transaction_date)
         DO UPDATE SET qty_installed=EXCLUDED.qty_installed,
                       notes=EXCLUDED.notes,
                       engineer_id=EXCLUDED.engineer_id
         RETURNING *`,
        [project_id, e.item_id, transaction_date, e.qty_installed, req.user.id, e.notes || null]
      );
      results.push(rows[0]);
    }
    res.json({ saved: results.length, data: results });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM cp_installation_transactions WHERE id=$1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
