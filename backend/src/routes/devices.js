const router = require('express').Router();
const ctrl = require('../controllers/deviceController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);

router.get('/push-status', authorize('ADMIN'), ctrl.pushStatus);
router.post('/', ctrl.register);
router.delete('/:token', ctrl.unregister);

module.exports = router;
