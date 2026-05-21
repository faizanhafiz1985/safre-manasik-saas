const router = require('express').Router();
const ctrl = require('../controllers/configController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);
router.get('/', ctrl.getAll);
router.post('/', authorize('ADMIN'), ctrl.upsert);

module.exports = router;
