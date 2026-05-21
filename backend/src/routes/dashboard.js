const router = require('express').Router();
const { getStats } = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.get('/stats', authenticate, tenantScope, requireTenant, authorize('ADMIN', 'AGENT'), getStats);

module.exports = router;
