// Resolve a user's fleet access scope.
//   wide   = fleet-wide manager (sees/acts on ALL vehicles): ADMIN, SUPER_ADMIN,
//            proxy-login, or any user holding `fleet_dashboard:view`.
//   driver = scoped to ONLY vehicles assigned to them (vehicle.driverId === id):
//            a user with fleet trip/cash/maintenance perms but NO dashboard perm.
// This is the assignment-scope layer that sits on top of RBAC feature gating.
const { getEffectivePermissions } = require('../services/permissionService');

async function getFleetScope(req) {
  const u = req.user || {};
  if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' || u.isImpersonator) {
    return { wide: true, driver: false };
  }
  const perms = req._permset || (await getEffectivePermissions(u));
  if (perms.has('fleet_dashboard:view')) return { wide: true, driver: false };
  const isDriver = ['fleet_trips:view', 'fleet_cash:view', 'fleet_maintenance:view'].some((p) => perms.has(p));
  return { wide: false, driver: isDriver, driverId: u.id };
}

module.exports = { getFleetScope };
