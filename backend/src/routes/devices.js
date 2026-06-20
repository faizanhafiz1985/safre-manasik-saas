const router = require('express').Router();
const ctrl = require('../controllers/deviceController');
const { authenticate } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);

router.post('/', ctrl.register);
router.delete('/:token', ctrl.unregister);

module.exports = router;
