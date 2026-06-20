const router = require('express').Router();
const ctrl = require('../controllers/tenantController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);

router.get('/current', ctrl.getCurrent);
router.put('/current', authorize('ADMIN'), ctrl.updateCurrent);
router.get('/current/quota', ctrl.getCurrentQuota);
// Self-service data purge (tenant ADMIN only; always scoped to own tenant).
router.post('/current/purge', authorize('ADMIN'), ctrl.purgeData);

module.exports = router;
