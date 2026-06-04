const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { checkQuota } = require('../middleware/quota');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);
router.get('/', requirePermission('bookings', 'view'), ctrl.getAll);
router.get('/:id', requirePermission('bookings', 'view'), ctrl.getOne);
router.post('/', authorize('ADMIN', 'AGENT'), requirePermission('bookings', 'create'), checkQuota('bookings'), ctrl.create);
router.put('/:id', authorize('ADMIN', 'AGENT'), requirePermission('bookings', 'edit'), ctrl.update);
router.patch('/:id/status', authorize('ADMIN', 'AGENT'), requirePermission('bookings', 'edit'), ctrl.updateStatus);
router.post('/:id/passengers', authorize('ADMIN', 'AGENT'), requirePermission('bookings', 'edit'), ctrl.addPassengers);
router.post('/:id/transport', authorize('ADMIN', 'AGENT'), requirePermission('bookings', 'edit'), ctrl.assignTransport);
router.post('/:id/catering', authorize('ADMIN', 'AGENT'), requirePermission('bookings', 'edit'), ctrl.assignCatering);
router.delete('/:id', authorize('ADMIN'), requirePermission('bookings', 'delete'), ctrl.remove);

module.exports = router;
