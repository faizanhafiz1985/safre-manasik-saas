const prisma = require('../config/database');
const { getTenantId, runWithTenant } = require('../config/tenantContext');
const { getTenantQuota } = require('../middleware/quota');
const { invalidateTenantPaypal } = require('../services/paypalClient');
const { purgeTenantData } = require('../utils/tenantPurge');

// Mask the PayPal secret in any response — never return the raw value to the
// browser. We keep a small "tail" so the admin can recognise which key is set.
function maskSecret(s) {
  if (!s) return null;
  if (s.length <= 8) return '••••';
  return '••••••••' + s.slice(-4);
}

function sanitiseTenantForResponse(tenant) {
  if (!tenant) return tenant;
  return { ...tenant, paypalSecret: maskSecret(tenant.paypalSecret) };
}

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
    res.json(sanitiseTenantForResponse(tenant));
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
      'umrahLicenseNumber', 'address', 'city', 'country', 'currency', 'timezone',
      'language', 'logoUrl', 'primaryColor',
      // PayPal config
      'paypalEnabled', 'paypalMode', 'paypalClientId', 'paypalSecret',
    ];
    const data = {};
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }

    // Treat a masked secret as "no change" — when the UI loads the tenant
    // the secret comes back as "••••••••XXXX", and if the admin saves
    // without re-typing it we must NOT overwrite the stored value with
    // bullets.
    if (typeof data.paypalSecret === 'string' && data.paypalSecret.includes('•')) {
      delete data.paypalSecret;
    }
    // Empty string explicitly means "clear the credential" — preserve that.

    if (data.paypalMode && !['sandbox', 'live'].includes(data.paypalMode)) {
      return res.status(400).json({ error: 'paypalMode must be "sandbox" or "live"' });
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

    // Bust the cached PayPal client so the next API call picks up the new keys
    invalidateTenantPaypal(tenantId);

    res.json(sanitiseTenantForResponse(tenant));
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

// Self-service data purge — lets a tenant ADMIN wipe their OWN tenant's
// operational/test data (bookings, packages, vehicles, hotels, customers,
// payments, vouchers, fleet & CRM data, and non-admin users). The tenant
// record, ADMIN logins, system roles and settings are preserved. The tenantId
// is taken from the authenticated context — never from input — so an admin can
// only ever purge their own tenant. Requires body.confirm === 'PURGE'.
const purgeData = async (req, res, next) => {
  try {
    const tenantId = getTenantId();
    if (!tenantId) return res.status(404).json({ error: 'No tenant in context' });
    if ((req.body && req.body.confirm) !== 'PURGE') {
      return res.status(400).json({ error: 'Confirmation required: send { "confirm": "PURGE" }' });
    }
    const results = await purgeTenantData(prisma, tenantId);
    res.json({
      message: 'All operational data has been purged. Your admin logins and settings were preserved.',
      deleted: results,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCurrent, updateCurrent, getCurrentQuota, purgeData };
