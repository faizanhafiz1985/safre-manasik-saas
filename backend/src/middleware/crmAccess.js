/**
 * CRM access middleware.
 *
 * requireCrm — checks two things in order:
 *   1. The tenant's plan has the "crm" feature flag enabled (PlanConfig.features.crm).
 *   2. The tenant's CrmConfig record has enabled = true.
 *
 * If no CrmConfig row exists for the tenant yet (first access after the feature
 * is toggled on by Superadmin), it is auto-created with sensible defaults.
 *
 * SUPER_ADMIN bypasses both checks.
 */

const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const { getTenantQuota } = require('./quota');

const requireCrm = async (req, res, next) => {
  try {
    if (req.user?.role === 'SUPER_ADMIN' || req.user?.isImpersonator) return next();

    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'No tenant associated' });

    // 1. Plan-level feature flag
    const quota = await getTenantQuota(tenantId);
    if (!quota) return res.status(404).json({ error: 'Tenant not found' });
    if (quota.status === 'SUSPENDED' || quota.status === 'CANCELLED') {
      return res.status(403).json({ error: `Account is ${quota.status.toLowerCase()}` });
    }
    if (!quota.features?.crm) {
      return res.status(403).json({
        error: 'CRM module is not available on your current plan. Please upgrade.',
        feature: 'crm',
        plan: quota.plan,
      });
    }

    // 2. Per-tenant CrmConfig toggle
    let config = await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try {
          resolve(await prisma.crmConfig.findUnique({ where: { tenantId } }));
        } catch (e) { reject(e); }
      });
    });

    // Auto-init on first access
    if (!config) {
      config = await new Promise((resolve, reject) => {
        runWithTenant({ tenantId }, async () => {
          try {
            resolve(await prisma.crmConfig.create({ data: { tenantId } }));
          } catch (e) { reject(e); }
        });
      });
    }

    if (!config.enabled) {
      return res.status(403).json({
        error: 'CRM module has been disabled for your account. Contact your platform administrator.',
      });
    }

    req.crmConfig = config;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireCrm };
