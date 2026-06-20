const router = require('express').Router();
const ctrl = require('../controllers/importController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);

// Per-entity role enforcement happens inside the controller (registry-driven);
// the route gate keeps this to staff roles. Templates are readable by any
// staff role so they can prepare a file before an admin uploads it.
router.get('/', ctrl.listEntities);
router.get('/:entity/template', ctrl.getTemplate);
router.post('/:entity', authorize('ADMIN', 'AGENT'), ctrl.bulkImport);

module.exports = router;
