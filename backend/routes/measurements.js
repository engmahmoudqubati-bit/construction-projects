const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const role   = require('../middleware/role');

router.use(auth);

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cp_measurements ORDER BY unit_code');
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', role('admin','project_manager'), async (req, res) => {
  const { unit_code, desc_en, desc_ar, is_active } = req.body;
  if (!unit_code || !desc_en) return res.status(400).json({ message: 'Code and English description required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO cp_measurements (unit_code, desc_en, desc_ar, is_active) VALUES ($1,$2,$3,$4) RETURNING *',
      [unit_code, desc_en, desc_ar||null, is_active!==false]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', role('admin','project_manager'), async (req, res) => {
  const { unit_code, desc_en, desc_ar, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE cp_measurements SET unit_code=$1, desc_en=$2, desc_ar=$3, is_active=$4 WHERE id=$5 RETURNING *',
      [unit_code, desc_en, desc_ar||null, is_active!==false, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Code already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', role('admin'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM cp_measurements WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ message: 'Cannot delete: this unit is linked to items.' });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;