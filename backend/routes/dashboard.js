const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const { attachProjectAccess } = require('../middleware/permission');

router.use(auth, attachProjectAccess);

// Helper: build project filter clause
function projectFilter(projectId, req, alias = 'pp') {
  if (projectId && projectId !== 'all') {
    return { clause: `AND ${alias}.project_id = $1`, params: [projectId] };
  }
  if (req.projectIds !== null) {
    if (req.projectIds.length === 0) return { clause: 'AND 1=0', params: [] };
    return { clause: `AND ${alias}.project_id = ANY($1)`, params: [req.projectIds] };
  }
  return { clause: '', params: [] };
}

// KPI cards
router.get('/kpis', async (req, res) => {
  const { projectId } = req.query;
  const f = projectFilter(projectId, req);
  try {
    const [planned, installed, delivered, inspected, insp_counts, proj_count] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(planned_qty),0) AS total FROM cp_project_planning pp WHERE 1=1 ${f.clause}`, f.params),
      pool.query(`SELECT COALESCE(SUM(qty_installed),0) AS total FROM cp_installation_transactions pp WHERE 1=1 ${f.clause}`, f.params),
      pool.query(`SELECT COALESCE(SUM(qty_delivered),0) AS total FROM cp_delivery_transactions pp WHERE 1=1 ${f.clause}`, f.params),
      pool.query(`SELECT COALESCE(SUM(qty_inspected),0) AS total FROM cp_inspection_transactions pp WHERE 1=1 ${f.clause}`, f.params),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status='pass')    AS pass_count,
           COUNT(*) FILTER (WHERE status='fail')    AS fail_count,
           COUNT(*) FILTER (WHERE status='pending') AS pending_count
         FROM cp_inspection_transactions pp WHERE 1=1 ${f.clause}`, f.params
      ),
      pool.query(
        `SELECT COUNT(DISTINCT project_id) AS total FROM cp_project_planning pp WHERE 1=1 ${f.clause}`, f.params
      ),
    ]);

    const pl = parseFloat(planned.rows[0].total);
    const ins = parseFloat(installed.rows[0].total);
    const del = parseFloat(delivered.rows[0].total);
    const insp = parseFloat(inspected.rows[0].total);
    const ic = insp_counts.rows[0];

    res.json({
      project_count:    parseInt(proj_count.rows[0].total),
      planned_qty:      pl,
      installed_qty:    ins,
      delivered_qty:    del,
      inspected_qty:    insp,
      installation_pct: pl > 0 ? +((ins / pl) * 100).toFixed(1) : 0,
      delivery_pct:     pl > 0 ? +((del / pl) * 100).toFixed(1) : 0,
      inspection_pct:   pl > 0 ? +((insp / pl) * 100).toFixed(1) : 0,
      pass_count:       parseInt(ic.pass_count),
      fail_count:       parseInt(ic.fail_count),
      pending_count:    parseInt(ic.pending_count),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Installation progress per item
router.get('/installation-progress', async (req, res) => {
  const { projectId } = req.query;
  const f = projectFilter(projectId, req);
  try {
    const { rows } = await pool.query(
      `SELECT i.item_name, i.item_code, i.unit_of_measure,
              SUM(pp.planned_qty) AS planned_qty,
              COALESCE(SUM(t.qty_installed),0) AS installed_qty,
              ROUND(COALESCE(SUM(t.qty_installed),0) / NULLIF(SUM(pp.planned_qty),0) * 100, 1) AS pct
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id=pp.item_id
       LEFT JOIN cp_installation_transactions t
         ON t.project_id=pp.project_id AND t.item_id=pp.item_id
       WHERE 1=1 ${f.clause}
       GROUP BY i.item_name, i.item_code, i.unit_of_measure
       ORDER BY pct DESC NULLS LAST
       LIMIT 20`, f.params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Inspection stats (overall pass/fail/pending breakdown for chart)
router.get('/inspection-stats', async (req, res) => {
  const { projectId } = req.query;
  const f = projectFilter(projectId, req);
  try {
    const { rows } = await pool.query(
      `SELECT i.item_name, i.item_code,
              COALESCE(SUM(t.qty_inspected) FILTER (WHERE t.status='pass'),0)    AS pass_qty,
              COALESCE(SUM(t.qty_inspected) FILTER (WHERE t.status='fail'),0)    AS fail_qty,
              COALESCE(SUM(t.qty_inspected) FILTER (WHERE t.status='pending'),0) AS pending_qty
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id=pp.item_id
       LEFT JOIN cp_inspection_transactions t
         ON t.project_id=pp.project_id AND t.item_id=pp.item_id
       WHERE 1=1 ${f.clause}
       GROUP BY i.item_name, i.item_code
       ORDER BY i.item_name
       LIMIT 20`, f.params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delivery progress per item
router.get('/delivery-progress', async (req, res) => {
  const { projectId } = req.query;
  const f = projectFilter(projectId, req);
  try {
    const { rows } = await pool.query(
      `SELECT i.item_name, i.item_code, i.unit_of_measure,
              SUM(pp.planned_qty) AS planned_qty,
              COALESCE(SUM(t.qty_delivered),0) AS delivered_qty,
              ROUND(COALESCE(SUM(t.qty_delivered),0) / NULLIF(SUM(pp.planned_qty),0) * 100, 1) AS pct
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id=pp.item_id
       LEFT JOIN cp_delivery_transactions t
         ON t.project_id=pp.project_id AND t.item_id=pp.item_id
       WHERE 1=1 ${f.clause}
       GROUP BY i.item_name, i.item_code, i.unit_of_measure
       ORDER BY pct DESC NULLS LAST
       LIMIT 20`, f.params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
