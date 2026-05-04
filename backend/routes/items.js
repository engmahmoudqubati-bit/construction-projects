const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');
const { requirePage } = require('../middleware/permission');

router.use(auth);

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*,
              c.classification_name, c.classification_code AS class_code,
              p.classification_name AS parent_classification_name,
              p.classification_code AS parent_code
       FROM cp_items i
       LEFT JOIN cp_item_classifications c ON c.id = i.classification_id
       LEFT JOIN cp_item_classifications p ON p.id = c.parent_id
       ORDER BY p.classification_name NULLS FIRST, c.classification_name, i.item_name`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Generate next item code for a classification
router.get('/next-code/:classificationId', async (req, res) => {
  try {
    const { rows: cls } = await pool.query(
      `SELECT c.classification_code, p.classification_code AS parent_code
       FROM cp_item_classifications c
       LEFT JOIN cp_item_classifications p ON p.id = c.parent_id
       WHERE c.id = $1`, [req.params.classificationId]
    );
    if (!cls[0]) return res.status(404).json({ message: 'Classification not found' });
    const prefix = (cls[0].parent_code || cls[0].classification_code || 'ITM').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const { rows: existing } = await pool.query(
      `SELECT item_code FROM cp_items
       WHERE classification_id = $1
       ORDER BY item_code DESC LIMIT 1`, [req.params.classificationId]
    );
    let seq = 1;
    if (existing[0]) {
      const parts = existing[0].item_code.split('-');
      const last = parseInt(parts[parts.length - 1]);
      if (!isNaN(last)) seq = last + 1;
    }
    const code = `${prefix}-${String(seq).padStart(3, '0')}`;
    res.json({ code });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', requirePage('definitions_items'), role('admin','project_manager'), async (req, res) => {
  const { item_code, item_name, classification_id, unit_of_measure } = req.body;
  if (!item_name) return res.status(400).json({ message: 'item_name is required' });

  let finalCode = item_code;
  if (!finalCode && classification_id) {
    // Auto-generate code
    const { rows: cls } = await pool.query(
      `SELECT c.classification_code, p.classification_code AS parent_code
       FROM cp_item_classifications c
       LEFT JOIN cp_item_classifications p ON p.id = c.parent_id
       WHERE c.id = $1`, [classification_id]
    );
    const prefix = cls[0] ? (cls[0].parent_code || cls[0].classification_code || 'ITM').toUpperCase().replace(/[^A-Z0-9]/g,'') : 'ITM';
    const { rows: existing } = await pool.query(
      `SELECT item_code FROM cp_items WHERE classification_id=$1 ORDER BY item_code DESC LIMIT 1`,
      [classification_id]
    );
    let seq = 1;
    if (existing[0]) {
      const parts = existing[0].item_code.split('-');
      const last = parseInt(parts[parts.length - 1]);
      if (!isNaN(last)) seq = last + 1;
    }
    finalCode = `${prefix}-${String(seq).padStart(3, '0')}`;
  } else if (!finalCode) {
    finalCode = `ITM-${String(Date.now()).slice(-6)}`;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO cp_items (item_code,item_name,classification_id,unit_of_measure)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [finalCode, item_name, classification_id||null, unit_of_measure||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Item code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', requirePage('definitions_items'), role('admin','project_manager'), async (req, res) => {
  const { item_code, item_name, classification_id, unit_of_measure, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE cp_items SET item_code=$1,item_name=$2,classification_id=$3,unit_of_measure=$4,is_active=$5
       WHERE id=$6 RETURNING *`,
      [item_code, item_name, classification_id||null, unit_of_measure||null, is_active??true, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Item code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', role('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM cp_items WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ message: 'Cannot delete: this record is linked to other data. Remove the linked records first.' });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;