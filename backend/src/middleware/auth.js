const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');

// We need to authenticate without the tenant middleware filtering, since the
// user lookup itself determines the tenant. Wrap the lookup in a SUPER_ADMIN
// context so the Prisma middleware doesn't filter by a non-existent tenantId.
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user;
    await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try {
          user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              tenantId: true,
              customRoleId: true,
              isActive: true,
              tenant: { select: { id: true, name: true, slug: true, status: true } },
            },
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Tenant suspended. Contact support.' });
    }
    req.user = user;
    // Proxy login: tokens minted by the SUPER_ADMIN-only impersonate endpoint
    // carry an `impersonatedBy` claim. Such a session acts as the tenant ADMIN
    // (so data stays scoped to that tenant) but is granted full access to every
    // tab/feature/quota — gates check req.user.isImpersonator to bypass.
    if (decoded.impersonatedBy) {
      req.user.isImpersonator = true;
      req.user.impersonatedBy = decoded.impersonatedBy;
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

module.exports = { authenticate, authorize };
