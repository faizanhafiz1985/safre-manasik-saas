const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const { getTenantQuota } = require('../middleware/quota');
const { FEATURES, ALL_PERMISSIONS, DEFAULT_PERMISSIONS } = require('../config/permissions');

// Short-TTL cache of a role's raw grants, keyed by roleId. Invalidated on edit.
const ROLE_CACHE_TTL_MS = 15000;
const roleCache = new Map(); // roleId -> { perms:Set, expiresAt }

function invalidateRoleCache(roleId) {
  if (roleId) roleCache.delete(roleId); else roleCache.clear();
}

async function getRoleGrants(roleId) {
  const now = Date.now();
  const hit = roleCache.get(roleId);
  if (hit && hit.expiresAt > now) return hit.perms;
  const rows = await new Promise((resolve, reject) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try { resolve(await prisma.rolePermission.findMany({ where: { roleId } })); }
      catch (e) { reject(e); }
    });
  });
  const set = new Set(rows.map((r) => `${r.feature}:${r.action}`));
  roleCache.set(roleId, { perms: set, expiresAt: now + ROLE_CACHE_TTL_MS });
  return set;
}

// Remove any permission whose feature is plan-gated and not enabled for the tenant.
// This is the safety ceiling: a custom role can never unlock a paid module.
function intersectWithPlan(permSet, planFeatures) {
  const out = new Set();
  for (const p of permSet) {
    const feature = p.split(':')[0];
    const meta = FEATURES[feature];
    if (meta?.plan && !planFeatures?.[meta.plan]) continue; // plan doesn't include it
    out.add(p);
  }
  return out;
}

/**
 * Resolve a user's effective permission set (Set of "feature:action").
 * Precedence: SUPER_ADMIN → all; customRoleId → its grants; else legacy role default.
 * Always intersected with the tenant's plan features.
 */
async function getEffectivePermissions(user) {
  if (!user) return new Set();
  if (user.role === 'SUPER_ADMIN') return new Set(ALL_PERMISSIONS);
  // Proxy login grants full access (every tab/action) within the target tenant,
  // bypassing custom-role limits and the plan ceiling.
  if (user.isImpersonator) return new Set(ALL_PERMISSIONS);

  let base;
  if (user.customRoleId) {
    base = await getRoleGrants(user.customRoleId);
  } else {
    base = DEFAULT_PERMISSIONS[user.role] || new Set();
  }

  // Plan ceiling
  let planFeatures = {};
  try {
    if (user.tenantId) {
      const quota = await getTenantQuota(user.tenantId);
      planFeatures = quota?.features || {};
    }
  } catch { /* if plan lookup fails, fall back to no plan-gated features */ }

  return intersectWithPlan(base, planFeatures);
}

// Convenience: does the user have a specific permission?
async function hasPermission(user, feature, action = 'view') {
  const set = await getEffectivePermissions(user);
  return set.has(`${feature}:${action}`);
}

module.exports = { getEffectivePermissions, hasPermission, invalidateRoleCache, getRoleGrants };
