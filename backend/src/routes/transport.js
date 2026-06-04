const router = require('express').Router();
const ctrl = require('../controllers/transportController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);
router.get('/vehicles', requirePermission('transport', 'view'), ctrl.getVehicles);
router.get('/vehicles/:id', requirePermission('transport', 'view'), ctrl.getVehicle);
router.post('/vehicles', authorize('ADMIN'), requirePermission('transport', 'create'), ctrl.createVehicle);
router.put('/vehicles/:id', authorize('ADMIN'), requirePermission('transport', 'edit'), ctrl.updateVehicle);
router.delete('/vehicles/:id', authorize('ADMIN'), requirePermission('transport', 'delete'), ctrl.deleteVehicle);

router.get('/routes', requirePermission('transport', 'view'), ctrl.getRoutes);
router.post('/routes', authorize('ADMIN'), requirePermission('transport', 'create'), ctrl.createRoute);
router.put('/routes/:id', authorize('ADMIN'), requirePermission('transport', 'edit'), ctrl.updateRoute);
router.delete('/routes/:id', authorize('ADMIN'), requirePermission('transport', 'delete'), ctrl.deleteRoute);

module.exports = router;
