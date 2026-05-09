const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const { requirePage, attachProjectAccess, canAccessProject } = require('../middleware/permission');

router.use(auth, requirePage('installation'), attachProjectAccess);

// ── GET levels for a project ─────────────────────────────────────────────────
router.get('/levels', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: 'projectId required' });
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access' });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM cp_project_levels WHERE project_id=$1 ORDER BY sort_order, level_code`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Save levels for a project (replace all) ──────────────────────────────────
router.post('/levels', async (req, res) => {
  const { project_id, levels } = req.body;
  if (!project_id || !Array.isArray(levels)) return res.status(400).json({ message: 'project_id and levels[] required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  try {
    for (const [i, lv] of levels.entries()) {
      await pool.query(
        `INSERT INTO cp_project_levels (project_id, level_code, level_name, sort_order)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (project_id, level_code)
         DO UPDATE SET level_name=EXCLUDED.level_name, sort_order=EXCLUDED.sort_order`,
        [project_id, lv.level_code, lv.level_name, i]
      );
    }
    const { rows } = await pool.query(`SELECT * FROM cp_project_levels WHERE project_id=$1 ORDER BY sort_order, level_code`, [project_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE a level ────────────────────────────────────────────────────────────
router.delete('/levels/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM cp_project_levels WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── GET allocation (suggested qty per item per level) ─────────────────────────
router.get('/allocation', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: 'projectId required' });
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access' });
  try {
    const { rows } = await pool.query(
      `SELECT a.item_id, a.level_id, a.suggested_qty
       FROM cp_installation_level_allocation a
       WHERE a.project_id=$1`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Save allocation ───────────────────────────────────────────────────────────
router.post('/allocation', async (req, res) => {
  const { project_id, allocations } = req.body;
  if (!project_id || !Array.isArray(allocations)) return res.status(400).json({ message: 'project_id and allocations[] required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  try {
    for (const a of allocations) {
      if (a.suggested_qty > 0) {
        await pool.query(
          `INSERT INTO cp_installation_level_allocation (project_id, item_id, level_id, suggested_qty)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (project_id, item_id, level_id)
           DO UPDATE SET suggested_qty=EXCLUDED.suggested_qty`,
          [project_id, a.item_id, a.level_id, a.suggested_qty]
        );
      } else {
        await pool.query(
          `DELETE FROM cp_installation_level_allocation WHERE project_id=$1 AND item_id=$2 AND level_id=$3`,
          [project_id, a.item_id, a.level_id]
        );
      }
    }
    res.json({ message: 'Saved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── GET daily installation entries (per level) ────────────────────────────────
router.get('/', async (req, res) => {
  const { projectId, date } = req.query;
  if (!projectId || !date) return res.status(400).json({ message: 'projectId and date required' });
  if (!canAccessProject(req, projectId)) return res.status(403).json({ message: 'No access' });
  try {
    // Get all items from BOQ
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

    // Get all levels (safe if table doesn't exist yet)
    let levels = [], allocs = [];
    try {
      const lv = await pool.query(`SELECT * FROM cp_project_levels WHERE project_id=$1 ORDER BY sort_order, level_code`, [projectId]);
      levels = lv.rows;
      const al = await pool.query(`SELECT item_id, level_id, suggested_qty FROM cp_installation_level_allocation WHERE project_id=$1`, [projectId]);
      allocs = al.rows;
    } catch (e) { /* tables not yet created — return empty */ }

    // Get today's transactions per item+level
    const { rows: todayTx } = await pool.query(
      `SELECT item_id, level_id, id AS tx_id, qty_installed, notes, tx_status
       FROM cp_installation_transactions
       WHERE project_id=$1 AND transaction_date=$2`,
      [projectId, date]
    );

    // Get total installed per item+level (all confirmed, all time)
    const { rows: totals } = await pool.query(
      `SELECT item_id, level_id,
              SUM(qty_installed) FILTER (WHERE tx_status='confirmed') AS total_installed
       FROM cp_installation_transactions
       WHERE project_id=$1
       GROUP BY item_id, level_id`,
      [projectId]
    );

    // Build response: one row per item+level combination that has an allocation
    const result = [];
    for (const item of items) {
      for (const level of levels) {
        const alloc = allocs.find(a => a.item_id === item.item_id && a.level_id === level.id);
        const tx    = todayTx.find(t => t.item_id === item.item_id && t.level_id === level.id);
        const tot   = totals.find(t => t.item_id === item.item_id && t.level_id === level.id);
        result.push({
          ...item,
          level_id:        level.id,
          level_code:      level.level_code,
          level_name:      level.level_name,
          suggested_qty:   alloc ? parseFloat(alloc.suggested_qty) : 0,
          tx_id:           tx?.tx_id || null,
          qty_installed:   tx?.qty_installed || null,
          notes:           tx?.notes || null,
          tx_status:       tx?.tx_status || null,
          total_installed: parseFloat(tot?.total_installed || 0),
        });
      }
    }
    res.json({ items, levels, allocs, rows: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST save daily entries ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { project_id, transaction_date, entries, tx_status = 'incomplete' } = req.body;
  if (!project_id || !transaction_date || !Array.isArray(entries))
    return res.status(400).json({ message: 'project_id, transaction_date, entries[] required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  const status = ['incomplete','saved'].includes(tx_status) ? tx_status : 'incomplete';
  try {
    const results = [];
    for (const e of entries) {
      if (!e.qty_installed || Number(e.qty_installed) <= 0) continue;
      const { rows } = await pool.query(
        `INSERT INTO cp_installation_transactions
           (project_id, item_id, level_id, transaction_date, qty_installed, engineer_id, notes, tx_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (project_id, item_id, level_id, transaction_date)
         DO UPDATE SET qty_installed=EXCLUDED.qty_installed,
                       notes=EXCLUDED.notes,
                       engineer_id=EXCLUDED.engineer_id,
                       tx_status=CASE
                         WHEN cp_installation_transactions.tx_status='confirmed' THEN 'confirmed'
                         ELSE EXCLUDED.tx_status
                       END
         RETURNING *`,
        [project_id, e.item_id, e.level_id, transaction_date, e.qty_installed, req.user.id, e.notes||null, status]
      );
      results.push(rows[0]);
    }
    res.json({ saved: results.length, data: results });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PATCH confirm ─────────────────────────────────────────────────────────────
router.patch('/confirm', async (req, res) => {
  const { project_id, transaction_date } = req.body;
  if (!project_id || !transaction_date) return res.status(400).json({ message: 'required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  try {
    const { rowCount } = await pool.query(
      `UPDATE cp_installation_transactions SET tx_status='confirmed'
       WHERE project_id=$1 AND transaction_date=$2 AND tx_status IN ('incomplete','saved')`,
      [project_id, transaction_date]
    );
    res.json({ confirmed: rowCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PATCH unpost ──────────────────────────────────────────────────────────────
router.patch('/unpost', async (req, res) => {
  const { project_id, transaction_date } = req.body;
  if (!project_id || !transaction_date) return res.status(400).json({ message: 'required' });
  if (!canAccessProject(req, project_id)) return res.status(403).json({ message: 'No access' });
  try {
    const { rowCount } = await pool.query(
      `UPDATE cp_installation_transactions SET tx_status='incomplete'
       WHERE project_id=$1 AND transaction_date=$2 AND tx_status='confirmed'`,
      [project_id, transaction_date]
    );
    res.json({ unposted: rowCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE a single entry ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM cp_installation_transactions WHERE id=$1 AND tx_status IN ('incomplete','saved')`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Not found or already confirmed' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;