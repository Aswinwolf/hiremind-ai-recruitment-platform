const ROLES = { candidate: 1, hr: 2, admin: 3 };
function requireRole(min) {
  return (req, res, next) => {
    const lvl = ROLES[req.user?.role] || 0;
    if (lvl < ROLES[min]) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}
function requireAny(...roles) {
  return (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ message: "Forbidden" });
}
module.exports = { requireRole, requireAny, ROLES };
