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
      `WITH
       boq AS (
         SELECT
           pp.project_id,
           pp.item_id,
           SUM(COALESCE(pp.planned_qty, 0))::numeric AS planned_qty
         FROM cp_project_planning pp
         WHERE pp.project_id = $1
           AND COALESCE(LOWER(TRIM(pp.status)), 'approved') IN ('approved', 'saved')
         GROUP BY pp.project_id, pp.item_id
       ),
       delivery AS (
         SELECT
           d.project_id,
           d.item_id,
           SUM(COALESCE(d.qty_delivered, 0))::numeric AS delivered_qty
         FROM cp_delivery_transactions d
         WHERE d.project_id = $1
           AND LOWER(TRIM(COALESCE(d.tx_status, ''))) = 'confirmed'
         GROUP BY d.project_id, d.item_id
       ),
       installation AS (
         SELECT
           it.project_id,
           it.item_id,
           SUM(COALESCE(it.qty_installed, 0))::numeric AS installed_qty
         FROM cp_installation_transactions it
         WHERE it.project_id = $1
           AND LOWER(TRIM(COALESCE(it.tx_status, ''))) = 'confirmed'
         GROUP BY it.project_id, it.item_id
       )
       SELECT
         b.item_id,
         i.item_code,
         i.item_name,
         COALESCE(m.desc_en, m.unit_code, i.unit_of_measure) AS unit_of_measure,
         c.classification_name,
         pc.classification_name AS parent_classification_name,

         COALESCE(b.planned_qty, 0) AS planned_qty,
         COALESCE(b.planned_qty, 0) AS planning_qty,

         COALESCE(d.delivered_qty, 0) AS total_delivered,
         COALESCE(d.delivered_qty, 0) AS delivered_qty,

         COALESCE(ins.installed_qty, 0) AS total_installed,
         COALESCE(ins.installed_qty, 0) AS installed_qty,

         GREATEST(COALESCE(b.planned_qty, 0) - COALESCE(ins.installed_qty, 0), 0) AS remaining_qty,
         GREATEST(COALESCE(d.delivered_qty, 0) - COALESCE(ins.installed_qty, 0), 0) AS delivered_not_installed_qty,

         ROUND(COALESCE(d.delivered_qty, 0) / NULLIF(b.planned_qty, 0) * 100, 1) AS delivery_pct,
         ROUND(COALESCE(ins.installed_qty, 0) / NULLIF(b.planned_qty, 0) * 100, 1) AS install_pct,
         ROUND(COALESCE(ins.installed_qty, 0) / NULLIF(b.planned_qty, 0) * 100, 1) AS installation_pct
       FROM boq b
       JOIN cp_items i ON i.id = b.item_id
       LEFT JOIN cp_measurements m ON m.id = i.measurement_id
       LEFT JOIN cp_item_classifications c ON c.id = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       LEFT JOIN delivery d ON d.project_id = b.project_id AND d.item_id = b.item_id
       LEFT JOIN installation ins ON ins.project_id = b.project_id AND ins.item_id = b.item_id
       ORDER BY pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId]
    );

    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Tab 2 — Project-level progress summary
router.get('/projects-summary', async (req, res) => {
  const { projectId } = req.query;

  try {
    const params = [];
    const where = [];

    if (projectId) {
      if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access to this project' });
      params.push(projectId);
      where.push(`p.id = $${params.length}`);
    }

    if (req.projectIds !== null) {
      if (req.projectIds.length === 0) return res.json([]);
      params.push(req.projectIds);
      where.push(`p.id = ANY($${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `WITH
       boq AS (
         SELECT
           pp.project_id,
           SUM(COALESCE(pp.planned_qty, 0))::numeric AS planned_qty,
           COUNT(DISTINCT pp.item_id)::int AS item_count
         FROM cp_project_planning pp
         WHERE COALESCE(LOWER(TRIM(pp.status)), 'approved') IN ('approved', 'saved')
         GROUP BY pp.project_id
       ),
       delivery AS (
         SELECT
           d.project_id,
           SUM(COALESCE(d.qty_delivered, 0))::numeric AS delivered_qty
         FROM cp_delivery_transactions d
         WHERE LOWER(TRIM(COALESCE(d.tx_status, ''))) = 'confirmed'
         GROUP BY d.project_id
       ),
       installation AS (
         SELECT
           it.project_id,
           SUM(COALESCE(it.qty_installed, 0))::numeric AS installed_qty
         FROM cp_installation_transactions it
         WHERE LOWER(TRIM(COALESCE(it.tx_status, ''))) = 'confirmed'
         GROUP BY it.project_id
       )
       SELECT
         p.id,
         p.project_code,
         p.project_name_en,
         p.project_name_ar,
         p.status,
         p.start_date::text AS start_date,
         p.end_date::text AS end_date,

         COALESCE(boq.item_count, 0) AS item_count,
         COALESCE(boq.planned_qty, 0) AS planned_qty,
         COALESCE(boq.planned_qty, 0) AS planning_qty,

         COALESCE(delivery.delivered_qty, 0) AS delivered_qty,
         COALESCE(delivery.delivered_qty, 0) AS total_delivered,

         COALESCE(installation.installed_qty, 0) AS installed_qty,
         COALESCE(installation.installed_qty, 0) AS total_installed,

         GREATEST(COALESCE(boq.planned_qty, 0) - COALESCE(installation.installed_qty, 0), 0) AS remaining_qty,
         GREATEST(COALESCE(delivery.delivered_qty, 0) - COALESCE(installation.installed_qty, 0), 0) AS delivered_not_installed_qty,

         ROUND(COALESCE(delivery.delivered_qty, 0) / NULLIF(boq.planned_qty, 0) * 100, 1) AS delivery_pct,
         ROUND(COALESCE(installation.installed_qty, 0) / NULLIF(boq.planned_qty, 0) * 100, 1) AS install_pct,
         ROUND(COALESCE(installation.installed_qty, 0) / NULLIF(boq.planned_qty, 0) * 100, 1) AS installation_pct
       FROM cp_projects p
       LEFT JOIN boq ON boq.project_id = p.id
       LEFT JOIN delivery ON delivery.project_id = p.id
       LEFT JOIN installation ON installation.project_id = p.id
       ${whereSql}
       ORDER BY p.id`,
      params
    );

    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Tab 3 — Item tracking across accessible projects
router.get('/item-tracking', async (req, res) => {
  const { projectId, itemId } = req.query;

  try {
    const params = [];
    const where = [];

    if (projectId) {
      if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access to this project' });
      params.push(projectId);
      where.push(`pp.project_id = $${params.length}`);
    }

    if (itemId) {
      params.push(itemId);
      where.push(`pp.item_id = $${params.length}`);
    }

    if (req.projectIds !== null) {
      if (req.projectIds.length === 0) return res.json([]);
      params.push(req.projectIds);
      where.push(`pp.project_id = ANY($${params.length})`);
    }

    where.push(`COALESCE(LOWER(TRIM(pp.status)), 'approved') IN ('approved', 'saved')`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `WITH
       boq AS (
         SELECT
           pp.project_id,
           pp.item_id,
           SUM(COALESCE(pp.planned_qty, 0))::numeric AS planned_qty
         FROM cp_project_planning pp
         ${whereSql}
         GROUP BY pp.project_id, pp.item_id
       ),
       delivery AS (
         SELECT
           d.project_id,
           d.item_id,
           SUM(COALESCE(d.qty_delivered, 0))::numeric AS delivered_qty
         FROM cp_delivery_transactions d
         WHERE LOWER(TRIM(COALESCE(d.tx_status, ''))) = 'confirmed'
         GROUP BY d.project_id, d.item_id
       ),
       installation AS (
         SELECT
           it.project_id,
           it.item_id,
           SUM(COALESCE(it.qty_installed, 0))::numeric AS installed_qty
         FROM cp_installation_transactions it
         WHERE LOWER(TRIM(COALESCE(it.tx_status, ''))) = 'confirmed'
         GROUP BY it.project_id, it.item_id
       ),
       inspection AS (
         SELECT
           insp.project_id,
           insp.item_id,
           SUM(COALESCE(insp.qty_inspected, 0))::numeric AS inspected_qty
         FROM cp_inspection_transactions insp
         GROUP BY insp.project_id, insp.item_id
       )
       SELECT
         p.id AS project_id,
         p.project_code,
         p.project_name_en,
         p.project_name_ar,
         p.start_date::text AS start_date,
         p.end_date::text AS end_date,

         b.item_id,
         i.item_code,
         i.item_name,
         COALESCE(m.desc_en, m.unit_code, i.unit_of_measure) AS unit_of_measure,
         c.classification_name,
         pc.classification_name AS parent_classification_name,

         COALESCE(b.planned_qty, 0) AS planned_qty,
         COALESCE(b.planned_qty, 0) AS planning_qty,

         COALESCE(delivery.delivered_qty, 0) AS total_delivered,
         COALESCE(delivery.delivered_qty, 0) AS delivered_qty,

         COALESCE(installation.installed_qty, 0) AS total_installed,
         COALESCE(installation.installed_qty, 0) AS installed_qty,

         COALESCE(inspection.inspected_qty, 0) AS total_inspected,
         COALESCE(inspection.inspected_qty, 0) AS inspected_qty,

         GREATEST(COALESCE(b.planned_qty, 0) - COALESCE(installation.installed_qty, 0), 0) AS remaining_qty,
         GREATEST(COALESCE(delivery.delivered_qty, 0) - COALESCE(installation.installed_qty, 0), 0) AS delivered_not_installed_qty,

         ROUND(COALESCE(delivery.delivered_qty, 0) / NULLIF(b.planned_qty, 0) * 100, 1) AS delivery_pct,
         ROUND(COALESCE(installation.installed_qty, 0) / NULLIF(b.planned_qty, 0) * 100, 1) AS install_pct,
         ROUND(COALESCE(installation.installed_qty, 0) / NULLIF(b.planned_qty, 0) * 100, 1) AS installation_pct
       FROM boq b
       JOIN cp_projects p ON p.id = b.project_id
       JOIN cp_items i ON i.id = b.item_id
       LEFT JOIN cp_measurements m ON m.id = i.measurement_id
       LEFT JOIN cp_item_classifications c ON c.id = i.classification_id
       LEFT JOIN cp_item_classifications pc ON pc.id = c.parent_id
       LEFT JOIN delivery ON delivery.project_id = b.project_id AND delivery.item_id = b.item_id
       LEFT JOIN installation ON installation.project_id = b.project_id AND installation.item_id = b.item_id
       LEFT JOIN inspection ON inspection.project_id = b.project_id AND inspection.item_id = b.item_id
       ORDER BY p.project_code, pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      params
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
      `SELECT i.item_code, i.item_name,
              COALESCE(m.desc_en, m.unit_code, i.unit_of_measure) AS unit_of_measure,
              t.transaction_date,
              t.qty_inspected, t.status, t.remarks,
              u.full_name AS inspector_name
       FROM cp_inspection_transactions t
       JOIN cp_items i ON i.id=t.item_id
       LEFT JOIN cp_measurements m ON m.id=i.measurement_id
       LEFT JOIN cp_users u ON u.id=t.inspector_id
       WHERE t.project_id=$1
       ORDER BY t.transaction_date DESC, i.item_name`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

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
           COALESCE(SUM(qty_delivered) FILTER (WHERE LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed' AND transaction_date <= $2), 0) AS delivered_to_date,
           COALESCE(SUM(qty_delivered) FILTER (WHERE LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed' AND transaction_date BETWEEN $3 AND $2), 0) AS delivered_this_week
         FROM cp_delivery_transactions
         WHERE project_id = $1
         GROUP BY item_id
       ),
       -- Pre-aggregate installation per item to avoid Cartesian product
       ins AS (
         SELECT item_id,
           COALESCE(SUM(qty_installed) FILTER (WHERE LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed' AND transaction_date BETWEEN $3 AND $2), 0) AS installed_this_week,
           COALESCE(SUM(qty_installed) FILTER (WHERE LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed' AND transaction_date BETWEEN ($3::date - interval '7 days') AND ($3::date - interval '1 day')), 0) AS installed_last_week,
           COALESCE(SUM(qty_installed) FILTER (WHERE LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed' AND transaction_date <= $2), 0) AS installed_to_date
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
       WHERE pp.project_id = $1 AND COALESCE(LOWER(TRIM(pp.status)), 'approved') IN ('approved','saved')
       ORDER BY pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId, weekEnd, weekStart]
    );

    // Week numbering should follow confirmed installation activity.
    const { rows: firstRows } = await pool.query(
      `SELECT MIN(transaction_date)::text AS first_date,
              MAX(transaction_date)::text AS last_date
       FROM cp_installation_transactions
       WHERE project_id=$1
         AND LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed'`,
      [projectId]
    );

    res.json({
      rows,
      firstInstallationDate: firstRows[0]?.first_date || null,
      lastInstallationDate: firstRows[0]?.last_date || null,
      firstDeliveryDate: firstRows[0]?.first_date || null
    });
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
       WHERE pp.project_id=$1 AND COALESCE(LOWER(TRIM(pp.status)), 'approved') IN ('approved','saved')
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
         AND LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed'
         AND transaction_date BETWEEN $2 AND $3
       GROUP BY item_id, transaction_date
       ORDER BY transaction_date`,
      [projectId, weekStart, weekEnd]
    );

    // Week numbering should follow confirmed installation activity.
    const { rows: firstRows } = await pool.query(
      `SELECT MIN(transaction_date)::text AS first_date,
              MAX(transaction_date)::text AS last_date
       FROM cp_installation_transactions
       WHERE project_id=$1
         AND LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed'`,
      [projectId]
    );

    res.json({
      items,
      daily,
      firstInstallationDate: firstRows[0]?.first_date || null,
      lastInstallationDate: firstRows[0]?.last_date || null,
      firstDeliveryDate: firstRows[0]?.first_date || null
    });
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

// ── Item Logs — incomplete/saved/no-entry across all processes ────────────────
router.get('/item-logs', async (req, res) => {
  const { projectId, process, status, dateFrom, dateTo } = req.query;
  if (!projectId) return res.status(400).json({ message: 'projectId required' });
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access' });
  try {
    const rows = [];

    // Planning logs (no date column on cp_project_planning — show status only)
    if (!process || process === 'planning') {
      // Only show planning rows if status filter is not a transaction status
      if (!status || status === 'incomplete' || status === 'saved') {
        // Map planning statuses: 'incomplete'→'incomplete', 'saved'→'saved'
        const planStatus = status === 'incomplete' ? 'incomplete'
                         : status === 'saved'      ? 'saved'
                         : null; // show all non-approved
        const { rows: planRows } = await pool.query(
          `SELECT 'planning' AS process,
                  pp.item_id, i.item_code, i.item_name,
                  COALESCE(m.desc_en, m.unit_code, i.unit_of_measure) AS unit_of_measure,
                  pp.planned_qty AS qty,
                  pp.status,
                  NULL AS event_date,
                  NULL AS notes
           FROM cp_project_planning pp
           JOIN cp_items i ON i.id = pp.item_id
           LEFT JOIN cp_measurements m ON m.id = i.measurement_id
           WHERE pp.project_id = $1
             AND pp.status NOT IN ('approved')
             ${planStatus ? `AND pp.status = '${planStatus}'` : ''}
           ORDER BY i.item_name`,
          [projectId]
        );
        rows.push(...planRows);
      }
    }

    // Delivery logs
    if (!process || process === 'delivery') {
      const { rows: delRows } = await pool.query(
        `SELECT 'delivery' AS process,
                d.item_id, i.item_code, i.item_name,
                COALESCE(m.desc_en, m.unit_code, i.unit_of_measure) AS unit_of_measure,
                d.qty_delivered AS qty,
                d.tx_status AS status,
                d.transaction_date::text AS event_date,
                d.notes
         FROM cp_delivery_transactions d
         JOIN cp_items i ON i.id = d.item_id
         LEFT JOIN cp_measurements m ON m.id = i.measurement_id
         WHERE d.project_id = $1
           AND d.tx_status != 'confirmed'
           ${status ? `AND d.tx_status = $2` : ''}
           ${dateFrom ? `AND d.transaction_date >= '${dateFrom}'::date` : ''}
           ${dateTo   ? `AND d.transaction_date <= '${dateTo}'::date`   : ''}
         ORDER BY d.transaction_date DESC`,
        status ? [projectId, status] : [projectId]
      );
      rows.push(...delRows);
    }

    // Installation logs
    if (!process || process === 'installation') {
      const { rows: insRows } = await pool.query(
        `SELECT 'installation' AS process,
                it.item_id, i.item_code, i.item_name,
                COALESCE(m.desc_en, m.unit_code, i.unit_of_measure) AS unit_of_measure,
                it.qty_installed AS qty,
                it.tx_status AS status,
                it.transaction_date::text AS event_date,
                it.notes
         FROM cp_installation_transactions it
         JOIN cp_items i ON i.id = it.item_id
         LEFT JOIN cp_measurements m ON m.id = i.measurement_id
         WHERE it.project_id = $1
           AND it.tx_status != 'confirmed'
           ${status ? `AND it.tx_status = $2` : ''}
           ${dateFrom ? `AND it.transaction_date >= '${dateFrom}'::date` : ''}
           ${dateTo   ? `AND it.transaction_date <= '${dateTo}'::date`   : ''}
         ORDER BY it.transaction_date DESC`,
        status ? [projectId, status] : [projectId]
      );
      rows.push(...insRows);
    }

    // No-entry items (planned but no transactions in any process)
    if (!process || process === 'no_entry') {
      if (!status || status === 'no_entry') {
        const { rows: noEntryRows } = await pool.query(
          `SELECT 'no_entry' AS process,
                  pp.item_id, i.item_code, i.item_name,
                  COALESCE(m.desc_en, m.unit_code, i.unit_of_measure) AS unit_of_measure,
                  pp.planned_qty AS qty,
                  'no_entry' AS status,
                  NULL AS event_date,
                  NULL AS notes
           FROM cp_project_planning pp
           JOIN cp_items i ON i.id = pp.item_id
           LEFT JOIN cp_measurements m ON m.id = i.measurement_id
           WHERE pp.project_id = $1
             AND COALESCE(LOWER(TRIM(pp.status)), 'approved') = 'approved'
             AND NOT EXISTS (
               SELECT 1 FROM cp_delivery_transactions d WHERE d.project_id=pp.project_id AND d.item_id=pp.item_id
             )
             AND NOT EXISTS (
               SELECT 1 FROM cp_installation_transactions it WHERE it.project_id=pp.project_id AND it.item_id=pp.item_id
             )`,
          [projectId]
        );
        rows.push(...noEntryRows);
      }
    }

    // Sort all by event_date descending (nulls last)
    rows.sort((a,b) => {
      if (!a.event_date && !b.event_date) return 0;
      if (!a.event_date) return 1;
      if (!b.event_date) return -1;
      return b.event_date.localeCompare(a.event_date);
    });

    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});



// ── Entry Logs — BOQ / Delivery / Installation actions and entries ───────────
router.get('/entry-logs', async (req, res) => {
  const { projectId, process, action, dateFrom, dateTo } = req.query;
  if (!projectId) return res.json([]);
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access to this project' });

  const params = [projectId];
  const addParam = (value) => { params.push(value); return `$${params.length}`; };

  const processFilter = String(process || '').toLowerCase();
  const actionFilter = String(action || '').toLowerCase();

  const dateConditions = (alias) => {
    const cond = [];
    if (dateFrom) cond.push(`COALESCE(${alias}.created_at, ${alias}.transaction_date::timestamp) >= ${addParam(dateFrom)}::date`);
    if (dateTo) cond.push(`COALESCE(${alias}.created_at, ${alias}.transaction_date::timestamp) < (${addParam(dateTo)}::date + interval '1 day')`);
    return cond.length ? ` AND ${cond.join(' AND ')}` : '';
  };

  try {
    const rows = [];

    // If a real audit table exists, read it first. This captures future create/update/delete/confirm history when the optional SQL is installed.
    const auditCheck = await pool.query(`SELECT to_regclass('public.cp_entry_audit_logs') AS table_name`);
    if (auditCheck.rows[0]?.table_name) {
      const auditParams = [projectId];
      const auditWhere = [`l.project_id = $1`];
      if (processFilter) { auditParams.push(processFilter); auditWhere.push(`LOWER(l.process) = $${auditParams.length}`); }
      if (actionFilter) { auditParams.push(`%${actionFilter}%`); auditWhere.push(`LOWER(l.action) LIKE $${auditParams.length}`); }
      if (dateFrom) { auditParams.push(dateFrom); auditWhere.push(`l.created_at >= $${auditParams.length}::date`); }
      if (dateTo) { auditParams.push(dateTo); auditWhere.push(`l.created_at < ($${auditParams.length}::date + interval '1 day')`); }

      const { rows: auditRows } = await pool.query(
        `SELECT
           l.id,
           INITCAP(l.process) AS process,
           l.action,
           p.project_code,
           p.project_name_en,
           i.item_code,
           i.item_name,
           NULL::text AS level_code,
           NULL::text AS level_name,
           l.transaction_date::text AS transaction_date,
           l.qty,
           l.status_to AS status,
           COALESCE(u.full_name_en, u.full_name, u.username, 'System') AS user_name,
           l.details AS notes,
           to_char(l.created_at, 'YYYY-MM-DD HH24:MI:SS') AS action_datetime,
           l.created_at AS sort_time
         FROM cp_entry_audit_logs l
         LEFT JOIN cp_projects p ON p.id = l.project_id
         LEFT JOIN cp_items i ON i.id = l.item_id
         LEFT JOIN cp_users u ON u.id = l.user_id
         WHERE ${auditWhere.join(' AND ')}
         ORDER BY l.created_at DESC
         LIMIT 1000`, auditParams
      );
      rows.push(...auditRows);
    }

    // Existing BOQ rows. The original BOQ table does not store user/date history, so this shows the current BOQ status.
    if (!processFilter || processFilter === 'boq' || processFilter === 'planning') {
      const boqWhere = [`pp.project_id = $1`];
      if (actionFilter) {
        if (actionFilter === 'confirm') boqWhere.push(`LOWER(COALESCE(pp.status,'')) = 'approved'`);
        if (actionFilter === 'save') boqWhere.push(`LOWER(COALESCE(pp.status,'')) = 'saved'`);
        if (actionFilter === 'entry') boqWhere.push(`LOWER(COALESCE(pp.status,'')) IN ('incomplete','draft','prepared')`);
      }
      const { rows: boqRows } = await pool.query(
        `SELECT
           'BOQ' AS process,
           CASE
             WHEN LOWER(COALESCE(pp.status,'')) = 'approved' THEN 'Confirm BOQ'
             WHEN LOWER(COALESCE(pp.status,'')) = 'saved' THEN 'Save BOQ'
             ELSE 'Entry BOQ'
           END AS action,
           p.project_code,
           p.project_name_en,
           i.item_code,
           i.item_name,
           NULL::text AS level_code,
           NULL::text AS level_name,
           NULL::text AS transaction_date,
           pp.planned_qty AS qty,
           pp.status,
           'Not captured' AS user_name,
           'BOQ current status only. Historical user/time requires the optional audit SQL.' AS notes,
           NULL::text AS action_datetime,
           NULL::timestamp AS sort_time
         FROM cp_project_planning pp
         JOIN cp_projects p ON p.id = pp.project_id
         JOIN cp_items i ON i.id = pp.item_id
         WHERE ${boqWhere.join(' AND ')}
         ORDER BY i.item_name`, params.slice(0,1)
      );
      rows.push(...boqRows);
    }

    if (!processFilter || processFilter === 'delivery') {
      const delWhere = [`d.project_id = $1`];
      if (actionFilter) {
        if (actionFilter === 'confirm') delWhere.push(`LOWER(COALESCE(d.tx_status,'')) = 'confirmed'`);
        if (actionFilter === 'save') delWhere.push(`LOWER(COALESCE(d.tx_status,'')) = 'saved'`);
        if (actionFilter === 'entry') delWhere.push(`LOWER(COALESCE(d.tx_status,'')) = 'incomplete'`);
      }
      const dateSql = dateConditions('d');
      const { rows: delRows } = await pool.query(
        `SELECT
           'Delivery' AS process,
           CASE
             WHEN LOWER(COALESCE(d.tx_status,'')) = 'confirmed' THEN 'Confirm Delivery'
             WHEN LOWER(COALESCE(d.tx_status,'')) = 'saved' THEN 'Save Delivery'
             ELSE 'Entry Delivery'
           END AS action,
           p.project_code,
           p.project_name_en,
           i.item_code,
           i.item_name,
           NULL::text AS level_code,
           NULL::text AS level_name,
           d.transaction_date::text AS transaction_date,
           d.qty_delivered AS qty,
           d.tx_status AS status,
           COALESCE(u.full_name_en, u.full_name, u.username, 'Unknown User') AS user_name,
           d.notes,
           to_char(COALESCE(d.created_at, d.transaction_date::timestamp), 'YYYY-MM-DD HH24:MI:SS') AS action_datetime,
           COALESCE(d.created_at, d.transaction_date::timestamp) AS sort_time
         FROM cp_delivery_transactions d
         JOIN cp_projects p ON p.id = d.project_id
         JOIN cp_items i ON i.id = d.item_id
         LEFT JOIN cp_users u ON u.id = d.engineer_id
         WHERE ${delWhere.join(' AND ')}${dateSql}
         ORDER BY COALESCE(d.created_at, d.transaction_date::timestamp) DESC`, params
      );
      rows.push(...delRows);
    }

    if (!processFilter || processFilter === 'installation') {
      const insWhere = [`it.project_id = $1`];
      if (actionFilter) {
        if (actionFilter === 'confirm') insWhere.push(`LOWER(COALESCE(it.tx_status,'')) = 'confirmed'`);
        if (actionFilter === 'save') insWhere.push(`LOWER(COALESCE(it.tx_status,'')) = 'saved'`);
        if (actionFilter === 'entry') insWhere.push(`LOWER(COALESCE(it.tx_status,'')) = 'incomplete'`);
      }
      const dateSql = dateConditions('it');
      const { rows: insRows } = await pool.query(
        `SELECT
           'Installation' AS process,
           CASE
             WHEN LOWER(COALESCE(it.tx_status,'')) = 'confirmed' THEN 'Confirm Installation'
             WHEN LOWER(COALESCE(it.tx_status,'')) = 'saved' THEN 'Save Installation'
             ELSE 'Entry Installation'
           END AS action,
           p.project_code,
           p.project_name_en,
           i.item_code,
           i.item_name,
           l.level_code,
           l.level_name,
           it.transaction_date::text AS transaction_date,
           it.qty_installed AS qty,
           it.tx_status AS status,
           COALESCE(u.full_name_en, u.full_name, u.username, 'Unknown User') AS user_name,
           it.notes,
           to_char(COALESCE(it.created_at, it.transaction_date::timestamp), 'YYYY-MM-DD HH24:MI:SS') AS action_datetime,
           COALESCE(it.created_at, it.transaction_date::timestamp) AS sort_time
         FROM cp_installation_transactions it
         JOIN cp_projects p ON p.id = it.project_id
         JOIN cp_items i ON i.id = it.item_id
         LEFT JOIN cp_project_levels l ON l.id = it.level_id
         LEFT JOIN cp_users u ON u.id = it.engineer_id
         WHERE ${insWhere.join(' AND ')}${dateSql}
         ORDER BY COALESCE(it.created_at, it.transaction_date::timestamp) DESC`, params
      );
      rows.push(...insRows);
    }

    rows.sort((a, b) => {
      const aa = a.sort_time ? new Date(a.sort_time).getTime() : 0;
      const bb = b.sort_time ? new Date(b.sort_time).getTime() : 0;
      return bb - aa;
    });

    res.json(rows.slice(0, 1500));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Floor Weekly Productivity ─────────────────────────────────────────────────
// Returns confirmed installation qty per item per level for a week (Sat–Thu)
router.get('/floor-weekly', async (req, res) => {
  const { projectId, weekStart, weekEnd } = req.query;
  if (!projectId || !weekStart || !weekEnd)
    return res.status(400).json({ message: 'projectId, weekStart, weekEnd required' });
  try {
    // Items from BOQ
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
       WHERE pp.project_id=$1 AND COALESCE(LOWER(TRIM(pp.status)), 'approved') IN ('approved','saved')
       ORDER BY pc.classification_name NULLS LAST, c.classification_name, i.item_name`,
      [projectId]
    );

    // Levels
    const { rows: levels } = await pool.query(
      `SELECT * FROM cp_project_levels WHERE project_id=$1 ORDER BY sort_order, level_code`,
      [projectId]
    );

    // Allocations
    const { rows: allocs } = await pool.query(
      `SELECT item_id, level_id, suggested_qty FROM cp_installation_level_allocation WHERE project_id=$1`,
      [projectId]
    );

    // Confirmed installation qty per item per level for this week
    const { rows: weekTx } = await pool.query(
      `SELECT item_id, level_id,
              SUM(qty_installed) AS qty_this_week
       FROM cp_installation_transactions
       WHERE project_id=$1
         AND LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed'
         AND transaction_date BETWEEN $2 AND $3
       GROUP BY item_id, level_id`,
      [projectId, weekStart, weekEnd]
    );

    // Total confirmed installed per item per level (all time)
    const { rows: totalTx } = await pool.query(
      `SELECT item_id, level_id,
              SUM(qty_installed) AS qty_total
       FROM cp_installation_transactions
       WHERE project_id=$1 AND LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed'
       GROUP BY item_id, level_id`,
      [projectId]
    );

    // First/last CONFIRMED INSTALLATION dates for week numbering.
    // Floor Weekly Productivity must be driven by installation activity, not delivery.
    const { rows: installRangeRows } = await pool.query(
      `SELECT
          MIN(transaction_date)::text AS first_installation_date,
          MAX(transaction_date)::text AS last_installation_date
       FROM cp_installation_transactions
       WHERE project_id=$1
         AND LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed'`,
      [projectId]
    );

    // Optional list of actual installation week starts.
    // Kept in the response for frontend/reporting flexibility.
    const { rows: installationWeekRows } = await pool.query(
      `SELECT DISTINCT
          (
            transaction_date::date -
            (
              CASE
                WHEN EXTRACT(DOW FROM transaction_date::date)::int = 6 THEN 0
                ELSE EXTRACT(DOW FROM transaction_date::date)::int + 1
              END
            )
          )::date::text AS week_start,
          (
            transaction_date::date -
            (
              CASE
                WHEN EXTRACT(DOW FROM transaction_date::date)::int = 6 THEN 0
                ELSE EXTRACT(DOW FROM transaction_date::date)::int + 1
              END
            )
            + INTERVAL '6 days'
          )::date::text AS week_end
       FROM cp_installation_transactions
       WHERE project_id=$1
         AND LOWER(TRIM(COALESCE(tx_status, ''))) = 'confirmed'
       ORDER BY week_start`,
      [projectId]
    );

    const firstInstallationDate = installRangeRows[0]?.first_installation_date || null;
    const lastInstallationDate  = installRangeRows[0]?.last_installation_date || null;

    res.json({
      items,
      levels,
      allocs,
      weekTx,
      totalTx,

      // Correct fields
      firstInstallationDate,
      lastInstallationDate,
      installationWeeks: installationWeekRows,

      // Backward compatibility for older frontend code.
      // It now intentionally mirrors installation date, not delivery date.
      firstDeliveryDate: firstInstallationDate
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
