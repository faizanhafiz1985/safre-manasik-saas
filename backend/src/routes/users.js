const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { checkQuota } = require('../middleware/quota');

router.use(authenticate, tenantScope, requireTenant);
router.get('/agents', ctrl.getAgents);
router.get('/customers', authorize('ADMIN', 'AGENT'), ctrl.getCustomers);
router.get('/', authorize('ADMIN'), ctrl.getAll);
router.get('/:id', authorize('ADMIN'), ctrl.getOne);
router.post('/', authorize('ADMIN'), checkQuota('users'), ctrl.create);
router.put('/:id', authorize('ADMIN'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);

module.exports = router;
