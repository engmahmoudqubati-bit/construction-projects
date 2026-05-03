const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const { requirePage, attachProjectAccess, canAccessProject } = require('../middleware/permission');

router.use(auth, requirePage('reports'), attachProjectAccess);

// Tab 1 — Planning vs Delivery vs Installation (per item, for a project)
router.get('/progress', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: 'projectId required' });
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access to this project' });
  try {
    const { rows } = await pool.query(
      `SELECT i.item_code, i.item_name, i.unit_of_measure,
              c.classification_name,
              pc.classification_name AS parent_classification_name,
              pp.planned_qty,
              COALESCE(SUM(DISTINCT d.qty_delivered),0)   AS total_delivered,
              COALESCE(SUM(DISTINCT ins.qty_installed),0) AS total_installed,
              ROUND(COALESCE(SUM(DISTINCT ins.qty_installed),0)/pp.planned_qty*100,1) AS install_pct,
              ROUND(COALESCE(SUM(DISTINCT d.qty_delivered),0)/pp.planned_qty*100,1)   AS delivery_pct
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id=pp.item_id
       LEFT JOIN cp_item_classifications c  ON c.id  = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       LEFT JOIN cp_delivery_transactions d
         ON d.project_id=pp.project_id AND d.item_id=pp.item_id
       LEFT JOIN cp_installation_transactions ins
         ON ins.project_id=pp.project_id AND ins.item_id=pp.item_id
       WHERE pp.project_id=$1
       GROUP BY i.item_code,i.item_name,i.unit_of_measure,c.classification_name,
                pc.classification_name,pp.planned_qty
       ORDER BY pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Tab 2 — Project-level progress summary (all accessible projects)
router.get('/projects-summary', async (req, res) => {
  try {
    let clause = '';
    const params = [];
    if (req.projectIds !== null) {
      if (req.projectIds.length === 0) return res.json([]);
      params.push(req.projectIds);
      clause = 'WHERE p.id = ANY($1)';
    }
    const { rows } = await pool.query(
      `SELECT p.id, p.project_code, p.project_name_en, p.project_name_ar, p.status,
              COALESCE(SUM(pp.planned_qty),0) AS planned_qty,
              COALESCE(SUM(ins.qty_installed),0) AS installed_qty,
              COALESCE(SUM(d.qty_delivered),0)   AS delivered_qty,
              ROUND(COALESCE(SUM(ins.qty_installed),0)/NULLIF(SUM(pp.planned_qty),0)*100,1) AS install_pct
       FROM cp_projects p
       LEFT JOIN cp_project_planning pp ON pp.project_id=p.id
       LEFT JOIN cp_installation_transactions ins ON ins.project_id=p.id
       LEFT JOIN cp_delivery_transactions d ON d.project_id=p.id
       ${clause}
       GROUP BY p.id,p.project_code,p.project_name_en,p.project_name_ar,p.status
       ORDER BY p.id`, params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Tab 3 — Item tracking across accessible projects
router.get('/item-tracking', async (req, res) => {
  const { projectId, itemId } = req.query;
  try {
    let clause = 'WHERE 1=1';
    const params = [];
    if (projectId) { params.push(projectId); clause += ` AND pp.project_id=$${params.length}`; }
    if (itemId)    { params.push(itemId);    clause += ` AND pp.item_id=$${params.length}`; }
    if (req.projectIds !== null) {
      if (req.projectIds.length === 0) return res.json([]);
      params.push(req.projectIds);
      clause += ` AND pp.project_id=ANY($${params.length})`;
    }
    const { rows } = await pool.query(
      `SELECT p.project_code, p.project_name_en, p.project_name_ar,
              i.item_code, i.item_name, i.unit_of_measure,
              pp.planned_qty,
              COALESCE(SUM(d.qty_delivered),0)   AS total_delivered,
              COALESCE(SUM(ins.qty_installed),0) AS total_installed,
              COALESCE(SUM(insp.qty_inspected),0) AS total_inspected,
              ROUND(COALESCE(SUM(ins.qty_installed),0)/pp.planned_qty*100,1) AS install_pct
       FROM cp_project_planning pp
       JOIN cp_projects p ON p.id=pp.project_id
       JOIN cp_items i ON i.id=pp.item_id
       LEFT JOIN cp_delivery_transactions d ON d.project_id=pp.project_id AND d.item_id=pp.item_id
       LEFT JOIN cp_installation_transactions ins ON ins.project_id=pp.project_id AND ins.item_id=pp.item_id
       LEFT JOIN cp_inspection_transactions insp ON insp.project_id=pp.project_id AND insp.item_id=pp.item_id
       ${clause}
       GROUP BY p.project_code,p.project_name_en,p.project_name_ar,
                i.item_code,i.item_name,i.unit_of_measure,pp.planned_qty
       ORDER BY p.project_code, i.item_name`, params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Tab 4 — Inspection report
router.get('/inspection', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: 'projectId required' });
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access to this project' });
  try {
    const { rows } = await pool.query(
      `SELECT i.item_code, i.item_name, i.unit_of_measure,
              t.transaction_date,
              t.qty_inspected, t.status, t.remarks,
              u.full_name AS inspector_name
       FROM cp_inspection_transactions t
       JOIN cp_items i ON i.id=t.item_id
       LEFT JOIN cp_users u ON u.id=t.inspector_id
       WHERE t.project_id=$1
       ORDER BY t.transaction_date DESC, i.item_name`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
