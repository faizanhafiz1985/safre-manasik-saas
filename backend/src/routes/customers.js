const router = require('express').Router();
const ctrl = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.get('/:id/voucher', ctrl.voucherHtml);
router.post('/', authorize('ADMIN', 'AGENT'), ctrl.create);
router.put('/:id', authorize('ADMIN', 'AGENT'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);

module.exports = router;
