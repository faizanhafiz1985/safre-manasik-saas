const router = require('express').Router();
const ctrl = require('../controllers/fleetController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant, authorize('ADMIN', 'AGENT'));

// Trips (GPS / manual)
router.get('/trips', requirePermission('fleet_trips', 'view'), ctrl.listTrips);
router.post('/trips/start', requirePermission('fleet_trips', 'create'), ctrl.startTrip);
router.post('/trips/:id/point', requirePermission('fleet_trips', 'edit'), ctrl.addPoint);
router.post('/trips/:id/stop', requirePermission('fleet_trips', 'edit'), ctrl.stopTrip);
router.post('/trips', requirePermission('fleet_trips', 'create'), ctrl.createTrip);
router.delete('/trips/:id', authorize('ADMIN'), requirePermission('fleet_trips', 'delete'), ctrl.removeTrip);

// Cash accountability
router.get('/cash', requirePermission('fleet_cash', 'view'), ctrl.listCash);
router.post('/cash', requirePermission('fleet_cash', 'create'), ctrl.submitCash);

// Maintenance / oil-change alerts
router.get('/maintenance/alerts', requirePermission('fleet_maintenance', 'view'), ctrl.alerts);
router.get('/maintenance', requirePermission('fleet_maintenance', 'view'), ctrl.listMaintenance);
router.post('/maintenance/confirm', requirePermission('fleet_maintenance', 'edit'), ctrl.confirmMaintenance);

// Central dashboard
router.get('/dashboard', requirePermission('fleet_dashboard', 'view'), ctrl.dashboard);

module.exports = router;
