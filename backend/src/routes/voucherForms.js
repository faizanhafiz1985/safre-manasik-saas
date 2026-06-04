const router = require('express').Router();
const ctrl = require('../controllers/formVoucherController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);

router.get('/next-number', requirePermission('voucher_forms', 'view'), ctrl.nextNumber);
router.get('/', requirePermission('voucher_forms', 'view'), ctrl.list);
router.get('/:id', requirePermission('voucher_forms', 'view'), ctrl.getOne);
router.get('/:id/print', requirePermission('voucher_forms', 'view'), ctrl.printHtml);
router.post('/', authorize('ADMIN', 'AGENT'), requirePermission('voucher_forms', 'create'), ctrl.create);
router.patch('/:id/confirm', authorize('ADMIN', 'AGENT'), requirePermission('voucher_forms', 'edit'), ctrl.confirm);
router.delete('/:id', authorize('ADMIN'), requirePermission('voucher_forms', 'delete'), ctrl.remove);

module.exports = router;
