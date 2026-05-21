const { runWithTenant } = require('../config/tenantContext');

// Wraps the request in the tenant context derived from the authenticated user.
// MUST run AFTER authenticate middleware so req.user is populated.
const tenantScope = (req, res, next) => {
  const ctx = {
    tenantId: req.user?.tenantId || null,
    userId: req.user?.id || null,
    isSuperAdmin: req.user?.role === 'SUPER_ADMIN',
  };
  runWithTenant(ctx, () => next());
};

// Explicitly require a tenant in the context — useful for tenant-scoped
// endpoints that should never run without one (every endpoint except SUPER_ADMIN).
const requireTenant = (req, res, next) => {
  if (req.user?.role === 'SUPER_ADMIN') return next();
  if (!req.user?.tenantId) {
    return res.status(403).json({ error: 'No tenant associated with this user' });
  }
  next();
};

module.exports = { tenantScope, requireTenant };
