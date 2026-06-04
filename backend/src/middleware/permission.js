const { getEffectivePermissions } = require('../services/permissionService');

// Express middleware: require a specific permission "feature:action".
// Additive — applied AFTER the existing authorize() backstop. SUPER_ADMIN bypasses.
// Permissions are resolved server-side per request (cached on req for reuse).
const requirePermission = (feature, action = 'view') => async (req, res, next) => {
  try {
    if (req.user?.role === 'SUPER_ADMIN') return next();
    if (!req._permset) req._permset = await getEffectivePermissions(req.user);
    if (req._permset.has(`${feature}:${action}`)) return next();
    return res.status(403).json({ error: 'You do not have permission to perform this action', feature, action });
  } catch (err) { next(err); }
};

module.exports = { requirePermission };
