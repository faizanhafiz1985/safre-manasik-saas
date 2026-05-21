const router = require('express').Router();
const ctrl = require('../controllers/tenantController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);

router.get('/current', ctrl.getCurrent);
router.put('/current', authorize('ADMIN'), ctrl.updateCurrent);

module.exports = router;
