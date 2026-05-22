const router = require('express').Router();
const ctrl = require('../controllers/superAdminController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenant');

router.use(authenticate, tenantScope, authorize('SUPER_ADMIN'));

router.get('/tenants', ctrl.listTenants);
router.get('/tenants/:id', ctrl.getTenant);
router.put('/tenants/:id', ctrl.updateTenant);
router.post('/tenants/:id/suspend', ctrl.suspendTenant);
router.post('/tenants/:id/activate', ctrl.activateTenant);
router.delete('/tenants/:id', ctrl.deleteTenant);

router.get('/stats', ctrl.platformStats);
router.get('/bookings', ctrl.allBookings);

// Plan configuration (configurable limits + feature flags per plan)
router.get('/plans', ctrl.listPlans);
router.put('/plans/:plan', ctrl.updatePlan);

// Per-tenant usage snapshot (current vs max for users/bookings, active features)
router.get('/tenants/:id/usage', ctrl.tenantUsage);

module.exports = router;
