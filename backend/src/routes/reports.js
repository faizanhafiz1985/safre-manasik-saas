const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requireFeature } = require('../middleware/quota');

// All reports gated behind the 'reports' feature flag — SUPER_ADMIN can flip
// this per plan via PUT /api/super-admin/plans/:plan
router.use(authenticate, tenantScope, requireTenant, authorize('ADMIN', 'AGENT'), requireFeature('reports'));

router.get('/daily-schedule', ctrl.dailySchedule);
router.get('/daily-schedule/export', ctrl.exportDailyScheduleCsv);

router.get('/transport-by-date', ctrl.transportByDate);
router.get('/transport-by-date/export', ctrl.exportTransportCsv);

module.exports = router;
