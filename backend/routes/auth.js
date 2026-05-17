const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

/**
 * Get real client IP address
 */
function getClientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * Save login history in database
 * This function will not stop login if logging fails
 */
async function saveLoginLog(req, userId, username, status) {
  try {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    await pool.query(
      `INSERT INTO user_login_logs 
       (user_id, username, ip_address, user_agent, login_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        username || 'unknown',
        ipAddress,
        userAgent,
        status
      ]
    );
  } catch (err) {
    console.error('Failed to save login log:', err.message);
  }
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    await saveLoginLog(req, null, username, 'failed');
    return res.status(400).json({ message: 'Username and password required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM cp_users WHERE username=$1',
      [username]
    );

    const user = rows[0];

    if (!user) {
      await saveLoginLog(req, null, username, 'failed');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      await saveLoginLog(req, user.id, user.username, 'failed');
      return res.status(403).json({ message: 'Account is inactive' });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      await saveLoginLog(req, user.id, user.username, 'failed');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Save successful login history
    await saveLoginLog(req, user.id, user.username, 'success');

    // Load permissions for non-admin users
    let pagePermissions   = [];
    let projectAccess     = [];
    let actionPermissions = [];

    if (user.role !== 'admin') {
      const pagesRes = await pool.query(
        'SELECT page_key FROM cp_user_page_permissions WHERE user_id=$1',
        [user.id]
      );

      const projRes = await pool.query(
        'SELECT project_id FROM cp_user_project_access WHERE user_id=$1',
        [user.id]
      );

      pagePermissions = pagesRes.rows.map(r => r.page_key);
      projectAccess   = projRes.rows.map(r => r.project_id);

      if (user.position_role_id) {
        const actRes = await pool.query(
          "SELECT perm_key FROM cp_position_role_permissions WHERE role_id=$1 AND perm_type='action'",
          [user.position_role_id]
        );

        actionPermissions = actRes.rows.map(r => r.perm_key);
      }
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
        email: user.email,
      },
      permissions: {
        pages: pagePermissions,
        actions: actionPermissions,
        projects: projectAccess
      },
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

    if (!rows[0]) {
      return res.status(404).json({ message: 'User not found' });
    }

    let pagePermissions   = [];
    let projectAccess     = [];
    let actionPermissions = [];

    if (rows[0].role !== 'admin') {
      const pagesRes = await pool.query(
        'SELECT page_key FROM cp_user_page_permissions WHERE user_id=$1',
        [req.user.id]
      );

      const projRes = await pool.query(
        'SELECT project_id FROM cp_user_project_access WHERE user_id=$1',
        [req.user.id]
      );

      pagePermissions = pagesRes.rows.map(r => r.page_key);
      projectAccess   = projRes.rows.map(r => r.project_id);

      const userRes = await pool.query(
        'SELECT position_role_id FROM cp_users WHERE id=$1',
        [req.user.id]
      );

      if (userRes.rows[0] && userRes.rows[0].position_role_id) {
        const actRes = await pool.query(
          "SELECT perm_key FROM cp_position_role_permissions WHERE role_id=$1 AND perm_type='action'",
          [userRes.rows[0].position_role_id]
        );

        actionPermissions = actRes.rows.map(r => r.perm_key);
      }
    }

    res.json({
      user: rows[0],
      permissions: {
        pages: pagePermissions,
        actions: actionPermissions,
        projects: projectAccess
      },
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;