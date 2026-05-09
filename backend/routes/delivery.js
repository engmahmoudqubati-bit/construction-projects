const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const { requirePage, attachProjectAccess, canAccessProject } = require('../middleware/permission');

router.use(auth, requirePage('delivery'), attachProjectAccess);

router.get('/', async (req, res) => {
  const { projectId, date } = req.query;
  if (!projectId || !date) return res.status(400).json({ message: 'projectId and date required' });
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access' });
  try {
    const { rows } = await pool.query(
      `SELECT pp.item_id, pp.planned_qty,
              i.item_code, i.item_name,
              COALESCE(m.unit_code, i.unit_of_measure) AS unit_of_measure,
              c.classification_name,
              pc.classification_name AS parent_classification_name,
              t.id AS tx_id, t.qty_delivered, t.delivery_ref, t.notes, t.tx_status,
              COALESCE(SUM(t2.qty_delivered) FILTER (WHERE t2.tx_status='confirmed' AND t2.transaction_date <= $2), 0) AS total_delivered,
              COALESCE(SUM(t2.qty_delivered) FILTER (WHERE t2.tx_status='confirmed'), 0) AS total_delivered_all
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id = pp.item_id
       LEFT JOIN cp_measurements m          ON m.id  = i.measurement_id
       LEFT JOIN cp_item_classifications c  ON c.id  = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       LEFT JOIN cp_delivery_transactions t
         ON t.project_id=pp.project_id AND t.item_id=pp.item_id AND t.transaction_date=$2
       LEFT JOIN cp_delivery_transactions t2
         ON t2.project_id=pp.project_id AND t2.item_id=pp.item_id
       WHERE pp.project_id=$1 AND pp.status IN ('approved','saved')
       GROUP BY pp.item_id, pp.planned_qty, i.item_code, i.item_name, i.unit_of_measure,
                m.unit_code, c.classification_name, pc.classification_name,
                t.id, t.qty_delivered, t.delivery_ref, t.notes, t.tx_status
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
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  try {
    const results = [];
    for (const e of entries) {
      if (!e.qty_delivered || Number(e.qty_delivered) <= 0) continue;
      const { rows } = await pool.query(
        `INSERT INTO cp_delivery_transactions
           (project_id,item_id,transaction_date,qty_delivered,delivery_ref,engineer_id,notes,tx_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'draft')
         ON CONFLICT (project_id,item_id,transaction_date)
         DO UPDATE SET qty_delivered=EXCLUDED.qty_delivered,
                       delivery_ref=EXCLUDED.delivery_ref,
                       notes=EXCLUDED.notes,
                       engineer_id=EXCLUDED.engineer_id
         RETURNING *`,
        [project_id, e.item_id, transaction_date, e.qty_delivered, e.delivery_ref||null, req.user.id, e.notes||null]
      );
      results.push(rows[0]);
    }
    res.json({ saved: results.length, data: results });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/confirm', async (req, res) => {
  const { project_id, transaction_date } = req.body;
  if (!project_id || !transaction_date) return res.status(400).json({ message: 'project_id and transaction_date required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  try {
    const { rowCount } = await pool.query(
      `UPDATE cp_delivery_transactions SET tx_status='confirmed'
       WHERE project_id=$1 AND transaction_date=$2 AND tx_status='draft'`,
      [project_id, transaction_date]
    );
    res.json({ confirmed: rowCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});


// Unpost — revert confirmed entries back to draft (requires can_confirm permission)
router.patch('/unpost', async (req, res) => {
  const { project_id, transaction_date } = req.body;
  if (!project_id || !transaction_date) return res.status(400).json({ message: 'project_id and transaction_date required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  try {
    const userPerms = await pool.query(
      `SELECT perm_key FROM cp_position_role_permissions
       WHERE role_id=(SELECT position_role_id FROM cp_users WHERE id=$1)
         AND perm_type='action' AND perm_key='can_confirm'`,
      [req.user.id]
    );
    if (req.user.role !== 'admin' && userPerms.rows.length === 0)
      return res.status(403).json({ message: 'No permission to unpost' });
    const { rowCount } = await pool.query(
      `UPDATE cp_delivery_transactions SET tx_status='draft'
       WHERE project_id=$1 AND transaction_date=$2 AND tx_status='confirmed'`,
      [project_id, transaction_date]
    );
    res.json({ unposted: rowCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM cp_delivery_transactions WHERE id=$1 AND tx_status='draft'`, [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Record not found or already confirmed' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;