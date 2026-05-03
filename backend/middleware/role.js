// Usage: role('admin') or role('admin', 'project_manager')
module.exports = (...allowed) => (req, res, next) => {
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};
