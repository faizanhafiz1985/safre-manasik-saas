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

// Tenant applications (approval workflow)
router.get('/applications', ctrl.listApplications);
router.post('/applications/:id/approve', ctrl.approveApplication);
router.post('/applications/:id/reject', ctrl.rejectApplication);

// Diagnostics — read-only system health check, safe to call anytime
const diagnosticsCtrl = require('../controllers/diagnosticsController');
router.get('/diagnostics', diagnosticsCtrl.diagnostics);

// Hotel seed — populates Makkah & Madinah hotels for a tenant in one click
router.post('/seed-hotels', ctrl.seedHotels);

// ── CRM Management ────────────────────────────────────────────────────────────
router.get('/crm/tenants',            ctrl.listCrmTenants);
router.get('/crm/stats',              ctrl.crmPlatformStats);
router.get('/crm/tenants/:id/config', ctrl.getCrmConfig);
router.put('/crm/tenants/:id/config', ctrl.updateCrmConfig);
router.post('/crm/tenants/:id/enable', (req, res, next) => { req.body.enabled = true;  ctrl.setCrmEnabled(req, res, next); });
router.post('/crm/tenants/:id/disable', (req, res, next) => { req.body.enabled = false; ctrl.setCrmEnabled(req, res, next); });

module.exports = router;
