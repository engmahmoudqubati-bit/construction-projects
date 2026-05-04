const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');

router.use(auth, role('admin'));

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, p.name_en AS parent_name
       FROM cp_companies c
       LEFT JOIN cp_companies p ON p.id = c.parent_id
       ORDER BY c.type DESC, COALESCE(c.parent_id, c.id), c.id`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  const { company_code, name_ar, name_en, type, tax_id, parent_id } = req.body;
  if (!name_ar || !name_en || !type)
    return res.status(400).json({ message: 'name_ar, name_en, type are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cp_companies (company_code, name_ar, name_en, type, tax_id, parent_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [company_code||null, name_ar, name_en, type, tax_id||null, parent_id||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Company code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { company_code, name_ar, name_en, type, tax_id, parent_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE cp_companies SET company_code=$1,name_ar=$2,name_en=$3,type=$4,tax_id=$5,parent_id=$6
       WHERE id=$7 RETURNING *`,
      [company_code||null, name_ar, name_en, type, tax_id||null, parent_id||null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Company not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Company code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM cp_companies WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Company not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ message: 'Cannot delete: this record is linked to other data. Remove the linked records first.' });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;