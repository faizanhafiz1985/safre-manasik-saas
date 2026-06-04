const { getEffectivePermissions } = require('../services/permissionService');

// Some workflows must READ reference data they don't "own". Assembling a Booking,
// for example, requires listing packages, transport, catering and hotels to fill
// the form's dropdowns. Granting "bookings" therefore implies read-only (view)
// access to those dependencies — but ONLY at the API gate here, NOT in
// getEffectivePermissions, so the sidebar/nav still shows just the Bookings tab.
//
// Map: feature being checked  ->  list of features whose :view implies it.
const IMPLIED_VIEW = {
  packages: ['bookings', 'vouchers', 'voucher_forms'],
  transport: ['bookings', 'voucher_forms', 'daily_schedule', 'transport_report'],
  catering: ['bookings', 'daily_schedule'],
  hotels: ['bookings', 'voucher_forms'],
  customers: ['bookings', 'vouchers', 'voucher_forms'],
};

// Express middleware: require a specific permission "feature:action".
// Additive — applied AFTER the existing authorize() backstop. SUPER_ADMIN bypasses.
// Permissions are resolved server-side per request (cached on req for reuse).
const requirePermission = (feature, action = 'view') => async (req, res, next) => {
  try {
    if (req.user?.role === 'SUPER_ADMIN' || req.user?.isImpersonator) return next();
    if (!req._permset) req._permset = await getEffectivePermissions(req.user);
    if (req._permset.has(`${feature}:${action}`)) return next();
    // Implied read access: a granted dependent workflow unlocks the reference
    // data it needs to read (view only).
    if (action === 'view') {
      for (const src of IMPLIED_VIEW[feature] || []) {
        if (req._permset.has(`${src}:view`)) return next();
      }
    }
    return res.status(403).json({ error: 'You do not have permission to perform this action', feature, action });
  } catch (err) { next(err); }
};

module.exports = { requirePermission };
