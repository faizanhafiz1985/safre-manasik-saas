const router = require('express').Router();
const ctrl = require('../controllers/formVoucherController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);

router.get('/next-number', ctrl.nextNumber);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/:id/print', ctrl.printHtml);
router.post('/', authorize('ADMIN', 'AGENT'), ctrl.create);
router.patch('/:id/confirm', authorize('ADMIN', 'AGENT'), ctrl.confirm);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);

module.exports = router;
