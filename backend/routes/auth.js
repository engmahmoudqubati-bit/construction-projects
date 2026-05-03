const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password required' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM cp_users WHERE username=$1', [username]
    );
    const user = rows[0];
    if (!user)           return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.is_active) return res.status(403).json({ message: 'Account is inactive' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    // Load permissions for non-admin users
    let pagePermissions = [];
    let projectAccess   = [];

    if (user.role !== 'admin') {
      const [pagesRes, projRes] = await Promise.all([
        pool.query('SELECT page_key FROM cp_user_page_permissions WHERE user_id=$1', [user.id]),
        pool.query('SELECT project_id FROM cp_user_project_access WHERE user_id=$1', [user.id]),
      ]);
      pagePermissions = pagesRes.rows.map(r => r.page_key);
      projectAccess   = projRes.rows.map(r => r.project_id);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id, full_name: user.full_name,
        username: user.username, role: user.role, email: user.email,
      },
      permissions: { pages: pagePermissions, projects: projectAccess },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, full_name, username, role, email, is_active FROM cp_users WHERE id=$1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });

    let pagePermissions = [];
    let projectAccess   = [];
    if (rows[0].role !== 'admin') {
      const [pagesRes, projRes] = await Promise.all([
        pool.query('SELECT page_key FROM cp_user_page_permissions WHERE user_id=$1', [req.user.id]),
        pool.query('SELECT project_id FROM cp_user_project_access WHERE user_id=$1', [req.user.id]),
      ]);
      pagePermissions = pagesRes.rows.map(r => r.page_key);
      projectAccess   = projRes.rows.map(r => r.project_id);
    }

    res.json({
      user: rows[0],
      permissions: { pages: pagePermissions, projects: projectAccess },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
