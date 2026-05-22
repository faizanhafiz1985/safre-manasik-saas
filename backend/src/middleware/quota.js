// Quota & feature-flag enforcement middleware.
// Reads PlanConfig from the database, so SUPER_ADMIN can change limits and
// feature flags at runtime without code changes.
//
// Usage:
//   const { checkQuota, requireFeature } = require('../middleware/quota');
//   router.post('/', checkQuota('users'), ctrl.create);
//   router.get('/pdf', requireFeature('pdfVouchers'), ctrl.downloadPdf);

const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const logger = require('../config/logger');

// In-memory cache for PlanConfig (5s TTL). The data is tiny (3-5 rows) and
// looked up on every quota check, so caching cuts DB round-trips. Cache is
// invalidated automatically by TTL — short window means SUPER_ADMIN edits
// take effect within ~5 seconds.
const PLAN_CACHE_TTL_MS = 5000;
let planCache = { byKey: null, expiresAt: 0 };

async function getPlanConfigs() {
  const now = Date.now();
  if (planCache.byKey && planCache.expiresAt > now) return planCache.byKey;
  // Always read with SUPER_ADMIN context to bypass tenant middleware
  return new Promise((resolve, reject) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try {
        const rows = await prisma.planConfig.findMany();
        const byKey = {};
        for (const r of rows) byKey[r.plan] = r;
        planCache = { byKey, expiresAt: now + PLAN_CACHE_TTL_MS };
        resolve(byKey);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function invalidatePlanCache() {
  planCache = { byKey: null, expiresAt: 0 };
}

// Resolve the effective limits/features for a tenant:
//   - maxUsers / maxBookings: tenant override → falls back to PlanConfig default
//   - features: PlanConfig.features (tenant-level overrides could be added later)
async function getTenantQuota(tenantId) {
  return new Promise((resolve, reject) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, plan: true, status: true, maxUsers: true, maxBookings: true },
        });
        if (!tenant) return resolve(null);
        const plans = await getPlanConfigs();
        const planCfg = plans[tenant.plan] || {};
        const features = (planCfg.features && typeof planCfg.features === 'object') ? planCfg.features : {};
        resolve({
          tenant,
          plan: tenant.plan,
          status: tenant.status,
          // tenant-level overrides win if set (Int columns are never null in schema, so
          // override is "always set" — to opt out, SUPER_ADMIN would set them to the same
          // value as the plan default)
          maxUsers: tenant.maxUsers ?? planCfg.defaultMaxUsers ?? null,
          maxBookings: tenant.maxBookings ?? planCfg.defaultMaxBookings ?? null,
          features,
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Express middleware: enforces a quota for the current tenant.
//   resource: 'users' | 'bookings' (extensible — add new resource keys here)
const checkQuota = (resource) => async (req, res, next) => {
  try {
    // SUPER_ADMIN is platform-wide and has no tenant — never blocked
    if (req.user?.role === 'SUPER_ADMIN') return next();
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'No tenant associated' });

    const quota = await getTenantQuota(tenantId);
    if (!quota) return res.status(404).json({ error: 'Tenant not found' });

    // Suspended/cancelled tenants cannot create anything
    if (quota.status === 'SUSPENDED' || quota.status === 'CANCELLED') {
      return res.status(403).json({
        error: `Your account is ${quota.status.toLowerCase()}. Please contact support.`,
      });
    }

    const limits = {
      users: { max: quota.maxUsers, count: () => prisma.user.count({ where: { tenantId } }) },
      bookings: { max: quota.maxBookings, count: () => prisma.booking.count({ where: { tenantId } }) },
    };
    const cfg = limits[resource];
    if (!cfg) {
      logger.warn(`[quota] unknown resource: ${resource}`);
      return next();
    }
    if (cfg.max === null || cfg.max === undefined) return next(); // no limit configured

    // Use SUPER_ADMIN scope to count across the tenant (the wrapping tenantScope
    // already filters by tenantId, but we want a clean count for safety)
    const current = await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try { resolve(await cfg.count()); } catch (e) { reject(e); }
      });
    });

    if (current >= cfg.max) {
      return res.status(403).json({
        error: `${resource} limit reached (${current}/${cfg.max}) for plan ${quota.plan}. Please upgrade.`,
        quota: { resource, current, max: cfg.max, plan: quota.plan },
      });
    }
    // Stash for downstream handlers that want to render a usage indicator
    req.quotaInfo = { resource, current, max: cfg.max, remaining: cfg.max - current, plan: quota.plan };
    next();
  } catch (err) {
    next(err);
  }
};

// Express middleware: requires a specific feature flag in the tenant's plan.
//   featureKey: e.g. 'pdfVouchers', 'reports', 'apiAccess', 'customBranding'
const requireFeature = (featureKey) => async (req, res, next) => {
  try {
    if (req.user?.role === 'SUPER_ADMIN') return next();
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'No tenant associated' });

    const quota = await getTenantQuota(tenantId);
    if (!quota) return res.status(404).json({ error: 'Tenant not found' });

    if (quota.status === 'SUSPENDED' || quota.status === 'CANCELLED') {
      return res.status(403).json({
        error: `Your account is ${quota.status.toLowerCase()}. Please contact support.`,
      });
    }

    if (!quota.features[featureKey]) {
      return res.status(403).json({
        error: `Feature "${featureKey}" is not available on your ${quota.plan} plan. Please upgrade.`,
        feature: featureKey,
        plan: quota.plan,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { checkQuota, requireFeature, getTenantQuota, getPlanConfigs, invalidatePlanCache };
