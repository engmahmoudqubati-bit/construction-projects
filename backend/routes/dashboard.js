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

// Overview detail payload for executive dashboard
router.get('/overview-details', async (req, res) => {
  const { projectId } = req.query;
  const planningFilter = projectFilter(projectId, req, 'pp');
  const deliveryFilter = projectFilter(projectId, req, 'd');
  const installationFilter = projectFilter(projectId, req, 'it');

  try {
    const [boq, deliveries, installations] = await Promise.all([
      pool.query(
        `SELECT
           pp.project_id,
           pp.item_id,
           i.item_code,
           i.item_name,
           i.unit_of_measure,
           COALESCE(c.classification_name, 'Uncategorized') AS classification_name,
           COALESCE(pc.classification_name, c.classification_name, 'General') AS parent_classification_name,
           SUM(pp.planned_qty) AS planned_qty
         FROM cp_project_planning pp
         JOIN cp_items i ON i.id = pp.item_id
         LEFT JOIN cp_item_classifications c  ON c.id = i.classification_id
         LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
         WHERE 1=1 ${planningFilter.clause}
         GROUP BY pp.project_id, pp.item_id, i.item_code, i.item_name, i.unit_of_measure, c.classification_name, pc.classification_name
         ORDER BY COALESCE(pc.classification_name, c.classification_name, 'General'), COALESCE(c.classification_name, 'Uncategorized'), i.item_name`,
        planningFilter.params,
      ),
      pool.query(
        `SELECT
           d.project_id,
           d.item_id,
           DATE_TRUNC('week', d.transaction_date)::date AS transaction_date,
           SUM(d.qty_delivered) AS qty_delivered
         FROM cp_delivery_transactions d
         WHERE COALESCE(d.tx_status, 'confirmed') = 'confirmed' ${deliveryFilter.clause}
         GROUP BY d.project_id, d.item_id, DATE_TRUNC('week', d.transaction_date)::date
         ORDER BY DATE_TRUNC('week', d.transaction_date)::date`,
        deliveryFilter.params,
      ),
      pool.query(
        `SELECT
           it.project_id,
           it.item_id,
           DATE_TRUNC('week', it.transaction_date)::date AS transaction_date,
           SUM(it.qty_installed) AS qty_installed
         FROM cp_installation_transactions it
         WHERE COALESCE(it.tx_status, 'confirmed') = 'confirmed' ${installationFilter.clause}
         GROUP BY it.project_id, it.item_id, DATE_TRUNC('week', it.transaction_date)::date
         ORDER BY DATE_TRUNC('week', it.transaction_date)::date`,
        installationFilter.params,
      ),
    ]);

    res.json({
      boq: boq.rows,
      deliveries: deliveries.rows,
      installations: installations.rows,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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

// Chart data: per-classification progress (delivery + installation)
router.get('/by-classification', async (req, res) => {
  const { projectId } = req.query;
  const f = projectFilter(projectId, req);
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(pc.classification_name, c.classification_name, 'Uncategorized') AS classification,
         SUM(pp.planned_qty) AS planned_qty,
         COALESCE(SUM(dt.qty_delivered) FILTER (WHERE dt.tx_status='confirmed'), 0) AS delivered_qty,
         COALESCE(SUM(it.qty_installed) FILTER (WHERE it.tx_status='confirmed'), 0) AS installed_qty,
         ROUND(COALESCE(SUM(dt.qty_delivered) FILTER (WHERE dt.tx_status='confirmed'),0) / NULLIF(SUM(pp.planned_qty),0) * 100, 1) AS delivery_pct,
         ROUND(COALESCE(SUM(it.qty_installed) FILTER (WHERE it.tx_status='confirmed'),0) / NULLIF(SUM(pp.planned_qty),0) * 100, 1) AS install_pct
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id = pp.item_id
       LEFT JOIN cp_item_classifications c  ON c.id = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       LEFT JOIN cp_delivery_transactions dt ON dt.project_id=pp.project_id AND dt.item_id=pp.item_id
       LEFT JOIN cp_installation_transactions it ON it.project_id=pp.project_id AND it.item_id=pp.item_id
       WHERE 1=1 ${f.clause}
       GROUP BY COALESCE(pc.classification_name, c.classification_name, 'Uncategorized')
       ORDER BY install_pct DESC NULLS LAST`,
      f.params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Chart data: per-floor/level progress
router.get('/by-floor', async (req, res) => {
  const { projectId } = req.query;
  const f = projectFilter(projectId, req, 'it');
  try {
    const { rows } = await pool.query(
      `SELECT
         lv.level_code,
         lv.level_name,
         lv.sort_order,
         COALESCE(SUM(alloc.suggested_qty), 0) AS suggested_qty,
         COALESCE(SUM(it.qty_installed) FILTER (WHERE it.tx_status='confirmed'), 0) AS installed_qty,
         ROUND(COALESCE(SUM(it.qty_installed) FILTER (WHERE it.tx_status='confirmed'),0) / NULLIF(SUM(alloc.suggested_qty),0) * 100, 1) AS install_pct
       FROM cp_project_levels lv
       LEFT JOIN cp_installation_level_allocation alloc ON alloc.level_id = lv.id
       LEFT JOIN cp_installation_transactions it ON it.level_id = lv.id ${f.clause.replace('AND it.project_id', 'AND lv.project_id')}
       WHERE lv.project_id IS NOT NULL
         ${projectId && projectId !== 'all' ? 'AND lv.project_id = $1' : ''}
       GROUP BY lv.level_code, lv.level_name, lv.sort_order, lv.id
       ORDER BY lv.sort_order, lv.level_code`,
      projectId && projectId !== 'all' ? [projectId] : []
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Per-project summary for comparison chart
router.get('/by-project', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.project_code,
         COALESCE(p.project_name_en, p.project_name_ar, p.project_code) AS project_name,
         COALESCE(SUM(pp.planned_qty), 0) AS planned_qty,
         COALESCE(SUM(dt.qty_delivered) FILTER (WHERE dt.tx_status='confirmed'), 0) AS delivered_qty,
         COALESCE(SUM(it.qty_installed) FILTER (WHERE it.tx_status='confirmed'), 0) AS installed_qty,
         ROUND(COALESCE(SUM(dt.qty_delivered) FILTER (WHERE dt.tx_status='confirmed'),0) / NULLIF(SUM(pp.planned_qty),0) * 100, 1) AS delivery_pct,
         ROUND(COALESCE(SUM(it.qty_installed) FILTER (WHERE it.tx_status='confirmed'),0) / NULLIF(SUM(pp.planned_qty),0) * 100, 1) AS install_pct
       FROM cp_projects p
       LEFT JOIN cp_project_planning pp ON pp.project_id = p.id
       LEFT JOIN cp_delivery_transactions dt ON dt.project_id = p.id
       LEFT JOIN cp_installation_transactions it ON it.project_id = p.id
       GROUP BY p.id, p.project_code, p.project_name_en, p.project_name_ar
       ORDER BY install_pct DESC NULLS LAST`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});