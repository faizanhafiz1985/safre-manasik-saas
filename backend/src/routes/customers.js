const router = require('express').Router();
const ctrl = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);

router.get('/', requirePermission('customers', 'view'), ctrl.getAll);
router.get('/:id', requirePermission('customers', 'view'), ctrl.getOne);
router.get('/:id/voucher', requirePermission('customers', 'view'), ctrl.voucherHtml);
router.post('/', authorize('ADMIN', 'AGENT'), requirePermission('customers', 'create'), ctrl.create);
router.put('/:id', authorize('ADMIN', 'AGENT'), requirePermission('customers', 'edit'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), requirePermission('customers', 'delete'), ctrl.remove);

module.exports = router;
