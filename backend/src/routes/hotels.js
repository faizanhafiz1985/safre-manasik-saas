const router = require('express').Router();
const ctrl = require('../controllers/hotelController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);
router.get('/', requirePermission('hotels', 'view'), ctrl.getAll);
router.get('/:id', requirePermission('hotels', 'view'), ctrl.getOne);
router.post('/', authorize('ADMIN'), requirePermission('hotels', 'create'), ctrl.create);
router.put('/:id', authorize('ADMIN'), requirePermission('hotels', 'edit'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), requirePermission('hotels', 'delete'), ctrl.remove);

module.exports = router;
