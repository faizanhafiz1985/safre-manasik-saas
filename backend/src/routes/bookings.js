const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { checkQuota } = require('../middleware/quota');

router.use(authenticate, tenantScope, requireTenant);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', authorize('ADMIN', 'AGENT'), checkQuota('bookings'), ctrl.create);
router.put('/:id', authorize('ADMIN', 'AGENT'), ctrl.update);
router.patch('/:id/status', authorize('ADMIN', 'AGENT'), ctrl.updateStatus);
router.post('/:id/passengers', authorize('ADMIN', 'AGENT'), ctrl.addPassengers);
router.post('/:id/transport', authorize('ADMIN', 'AGENT'), ctrl.assignTransport);
router.post('/:id/catering', authorize('ADMIN', 'AGENT'), ctrl.assignCatering);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);

module.exports = router;
