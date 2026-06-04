const router = require('express').Router();
const ctrl = require('../controllers/packageController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);
router.get('/', requirePermission('packages', 'view'), ctrl.getAll);
router.get('/:id', requirePermission('packages', 'view'), ctrl.getOne);
router.post('/', authorize('ADMIN'), requirePermission('packages', 'create'), ctrl.create);
router.put('/:id', authorize('ADMIN'), requirePermission('packages', 'edit'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), requirePermission('packages', 'delete'), ctrl.remove);

module.exports = router;
