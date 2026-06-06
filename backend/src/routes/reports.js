const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requireFeature } = require('../middleware/quota');
const { requirePermission } = require('../middleware/permission');

// All reports gated behind the 'reports' feature flag — SUPER_ADMIN can flip
// this per plan via PUT /api/super-admin/plans/:plan
router.use(authenticate, tenantScope, requireTenant, authorize('ADMIN', 'AGENT'), requireFeature('reports'));

router.get('/daily-schedule', requirePermission('daily_schedule', 'view'), ctrl.dailySchedule);
router.get('/daily-schedule/export', requirePermission('daily_schedule', 'export'), ctrl.exportDailyScheduleCsv);

router.get('/transport-by-date', requirePermission('transport_report', 'view'), ctrl.transportByDate);
router.get('/transport-by-date/export', requirePermission('transport_report', 'export'), ctrl.exportTransportCsv);

// Toggle operational tracking flags (Departure Done / Transport Availed) on runs.
// Used by both the Daily Schedule and Transport reports.
router.patch('/transport-status', requirePermission('transport_report', 'edit'), ctrl.updateTransportStatus);

module.exports = router;
