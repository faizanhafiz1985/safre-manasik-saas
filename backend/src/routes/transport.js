const router = require('express').Router();
const ctrl = require('../controllers/transportController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);
router.get('/vehicles', ctrl.getVehicles);
router.get('/vehicles/:id', ctrl.getVehicle);
router.post('/vehicles', authorize('ADMIN'), ctrl.createVehicle);
router.put('/vehicles/:id', authorize('ADMIN'), ctrl.updateVehicle);
router.delete('/vehicles/:id', authorize('ADMIN'), ctrl.deleteVehicle);

router.get('/routes', ctrl.getRoutes);
router.post('/routes', authorize('ADMIN'), ctrl.createRoute);
router.put('/routes/:id', authorize('ADMIN'), ctrl.updateRoute);
router.delete('/routes/:id', authorize('ADMIN'), ctrl.deleteRoute);

module.exports = router;
