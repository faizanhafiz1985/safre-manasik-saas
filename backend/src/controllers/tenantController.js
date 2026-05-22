const prisma = require('../config/database');
const { getTenantId, runWithTenant } = require('../config/tenantContext');
const { getTenantQuota } = require('../middleware/quota');

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

// Read-only quota/feature snapshot for the current tenant. Used by the
// frontend to show "Users 5/10" badges and gate UI elements behind feature
// flags (e.g. hide the "Download PDF" button if pdfVouchers === false).
const getCurrentQuota = async (req, res, next) => {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return res.status(404).json({ error: 'No tenant in context' });
    const quota = await getTenantQuota(tenantId);
    if (!quota) return res.status(404).json({ error: 'Tenant not found' });
    let users = 0, bookings = 0;
    await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try {
          [users, bookings] = await Promise.all([
            prisma.user.count({ where: { tenantId } }),
            prisma.booking.count({ where: { tenantId } }),
          ]);
          resolve();
        } catch (e) { reject(e); }
      });
    });
    res.json({
      plan: quota.plan,
      status: quota.status,
      features: quota.features,
      usage: {
        users: { current: users, max: quota.maxUsers, remaining: quota.maxUsers != null ? Math.max(0, quota.maxUsers - users) : null },
        bookings: { current: bookings, max: quota.maxBookings, remaining: quota.maxBookings != null ? Math.max(0, quota.maxBookings - bookings) : null },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCurrent, updateCurrent, getCurrentQuota };
