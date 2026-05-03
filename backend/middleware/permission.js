const pool = require('../db/pool');

// Checks that a non-admin user has the given page_key permission.
// Admin role always passes.
function requirePage(pageKey) {
  return async (req, res, next) => {
    if (req.user.role === 'admin') return next();
    const { rows } = await pool.query(
      'SELECT id FROM cp_user_page_permissions WHERE user_id=$1 AND page_key=$2',
      [req.user.id, pageKey]
    );
    if (!rows[0]) return res.status(403).json({ message: 'No permission for this page' });
    next();
  };
}

// Returns an array of project IDs the user can access.
// Returns null for admins (meaning: unrestricted).
async function getAccessibleProjectIds(userId, role) {
  if (role === 'admin') return null;
  const { rows } = await pool.query(
    'SELECT project_id FROM cp_user_project_access WHERE user_id=$1',
    [userId]
  );
  return rows.map(r => r.project_id);
}

// Middleware: attaches req.projectIds (null = all, [] = none, [id,...] = allowed)
async function attachProjectAccess(req, _res, next) {
  req.projectIds = await getAccessibleProjectIds(req.user.id, req.user.role);
  next();
}

// Helper used in route handlers to verify a specific project is accessible
function canAccessProject(req, projectId) {
  if (req.projectIds === null) return true;
  return req.projectIds.includes(Number(projectId));
}

module.exports = { requirePage, getAccessibleProjectIds, attachProjectAccess, canAccessProject };
