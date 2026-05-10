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
              ROUND(COALESCE(SUM(DISTINCT ins.qty_installed),0)/NULLIF(pp.planned_qty,0)*100,1) AS install_pct,
              ROUND(COALESCE(SUM(DISTINCT d.qty_delivered),0)/NULLIF(pp.planned_qty,0)*100,1)   AS delivery_pct
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
              ROUND(COALESCE(SUM(ins.qty_installed),0)/NULLIF(pp.planned_qty,0)*100,1) AS install_pct
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

// ── Weekly Summary Report ─────────────────────────────────────────────────────
router.get('/weekly', async (req, res) => {
  const { projectId, weekStart, weekEnd } = req.query;
  // weekStart = Saturday date (YYYY-MM-DD), weekEnd = Thursday date (YYYY-MM-DD)
  if (!projectId || !weekStart || !weekEnd)
    return res.status(400).json({ message: 'projectId, weekStart, weekEnd required' });

  try {
    const { rows } = await pool.query(
      `WITH
       -- Pre-aggregate delivery per item to avoid Cartesian product
       del AS (
         SELECT item_id,
           COALESCE(SUM(qty_delivered) FILTER (WHERE tx_status='confirmed' AND transaction_date <= $2), 0) AS delivered_to_date,
           COALESCE(SUM(qty_delivered) FILTER (WHERE tx_status='confirmed' AND transaction_date BETWEEN $3 AND $2), 0) AS delivered_this_week
         FROM cp_delivery_transactions
         WHERE project_id = $1
         GROUP BY item_id
       ),
       -- Pre-aggregate installation per item to avoid Cartesian product
       ins AS (
         SELECT item_id,
           COALESCE(SUM(qty_installed) FILTER (WHERE tx_status='confirmed' AND transaction_date BETWEEN $3 AND $2), 0) AS installed_this_week,
           COALESCE(SUM(qty_installed) FILTER (WHERE tx_status='confirmed' AND transaction_date BETWEEN ($3::date - interval '7 days') AND ($3::date - interval '1 day')), 0) AS installed_last_week,
           COALESCE(SUM(qty_installed) FILTER (WHERE tx_status='confirmed' AND transaction_date <= $2), 0) AS installed_to_date
         FROM cp_installation_transactions
         WHERE project_id = $1
         GROUP BY item_id
       )
       SELECT
         pp.item_id,
         pp.planned_qty,
         i.item_code,
         i.item_name,
         COALESCE(m.desc_en, m.unit_code, i.unit_of_measure) AS unit_of_measure,
         c.classification_name,
         pc.classification_name AS parent_classification_name,
         COALESCE(del.delivered_to_date,  0) AS delivered_to_date,
         COALESCE(del.delivered_this_week,0) AS delivered_this_week,
         COALESCE(ins.installed_this_week,0) AS installed_this_week,
         COALESCE(ins.installed_last_week,0) AS installed_last_week,
         COALESCE(ins.installed_to_date,  0) AS installed_to_date
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id = pp.item_id
       LEFT JOIN cp_measurements m          ON m.id  = i.measurement_id
       LEFT JOIN cp_item_classifications c  ON c.id  = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       LEFT JOIN del ON del.item_id = pp.item_id
       LEFT JOIN ins ON ins.item_id = pp.item_id
       WHERE pp.project_id = $1 AND pp.status IN ('approved','saved')
       ORDER BY pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId, weekEnd, weekStart]
    );

    // Also get the project's first delivery date (for week numbering)
    const { rows: firstRows } = await pool.query(
      `SELECT MIN(transaction_date)::text AS first_date
       FROM cp_delivery_transactions
       WHERE project_id=$1 AND tx_status='confirmed'`,
      [projectId]
    );

    res.json({ rows, firstDeliveryDate: firstRows[0]?.first_date || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Daily Productivity Per Week ───────────────────────────────────────────────
router.get('/daily-productivity', async (req, res) => {
  const { projectId, weekStart, weekEnd } = req.query;
  if (!projectId || !weekStart || !weekEnd)
    return res.status(400).json({ message: 'projectId, weekStart, weekEnd required' });
  try {
    // Get all planned items for this project
    const { rows: items } = await pool.query(
      `SELECT pp.item_id, pp.planned_qty,
              i.item_code, i.item_name,
              COALESCE(m.desc_en, m.unit_code, i.unit_of_measure) AS unit_of_measure,
              c.classification_name,
              pc.classification_name AS parent_classification_name
       FROM cp_project_planning pp
       JOIN cp_items i ON i.id = pp.item_id
       LEFT JOIN cp_measurements m ON m.id = i.measurement_id
       LEFT JOIN cp_item_classifications c  ON c.id = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       WHERE pp.project_id=$1 AND pp.status IN ('approved','saved')
       ORDER BY pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId]
    );

    // Get daily installation qty per item per day within the week
    const { rows: daily } = await pool.query(
      `SELECT item_id,
              transaction_date::text AS transaction_date,
              SUM(qty_installed) AS qty_installed
       FROM cp_installation_transactions
       WHERE project_id=$1
         AND tx_status='confirmed'
         AND transaction_date BETWEEN $2 AND $3
       GROUP BY item_id, transaction_date
       ORDER BY transaction_date`,
      [projectId, weekStart, weekEnd]
    );

    // First delivery date for week numbering
    const { rows: firstRows } = await pool.query(
      `SELECT MIN(transaction_date)::text AS first_date
       FROM cp_delivery_transactions
       WHERE project_id=$1 AND tx_status='confirmed'`,
      [projectId]
    );

    res.json({ items, daily, firstDeliveryDate: firstRows[0]?.first_date || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── AI Insight Proxy (avoids CORS — browser can't call Anthropic directly) ────
router.post('/ai-insight', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ message: 'prompt required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ message: 'ANTHROPIC_API_KEY not set on server. Please add it to Railway environment variables.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ message: data.error.message || 'Anthropic API error' });
    if (!data.content) return res.status(500).json({ message: 'Empty response from Anthropic API' });
    res.json(data);
  } catch (err) { res.status(500).json({ message: err.message }); }
});