const prisma = require('../config/database');
const { getTenantId, runWithTenant } = require('../config/tenantContext');

// Get current tenant info (any authenticated user in the tenant)
const getCurrent = async (req, res, next) => {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return res.status(404).json({ error: 'No tenant in context' });

    let tenant;
    await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try {
          tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { _count: { select: { users: true, bookings: true, packages: true } } },
          });
          resolve();
        } catch (e) { reject(e); }
      });
    });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
};

// Update tenant settings (ADMIN only)
const updateCurrent = async (req, res, next) => {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return res.status(404).json({ error: 'No tenant in context' });

    const allowedFields = [
      'name', 'contactEmail', 'contactPhone', 'crNumber', 'vatNumber',
      'umrahLicenseNumber', 'address', 'city', 'currency', 'timezone',
      'language', 'logoUrl', 'primaryColor',
    ];
    const data = {};
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }

    let tenant;
    await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try {
          tenant = await prisma.tenant.update({ where: { id: tenantId }, data });
          resolve();
        } catch (e) { reject(e); }
      });
    });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
};

module.exports = { getCurrent, updateCurrent };
