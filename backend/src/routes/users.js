const router = require('express').Router();
const ctrl = require('../controllers/userController');
const stmtCtrl = require('../controllers/customerStatementController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { checkQuota } = require('../middleware/quota');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);
// NOTE: /agents and /customers are lookup endpoints used across the app (staff
// dropdowns, customer pickers) by both ADMIN and AGENT — not the Users tab — so
// they keep their existing role gate without a users-permission requirement.
router.get('/agents', ctrl.getAgents);
router.get('/customers', authorize('ADMIN', 'AGENT'), ctrl.getCustomers);
// Customer account statement (bookings + vouchers + payments ledger, date-ranged).
router.get('/customers/:id/statement', authorize('ADMIN', 'AGENT'), stmtCtrl.getStatement);
router.get('/customers/:id/statement/print', authorize('ADMIN', 'AGENT'), stmtCtrl.printStatement);
// The Users-management surface (list/detail/delete) is gated by the 'users' permission.
router.get('/', authorize('ADMIN'), requirePermission('users', 'view'), ctrl.getAll);
router.get('/:id', authorize('ADMIN'), requirePermission('users', 'view'), ctrl.getOne);
// AGENT may create CUSTOMER-role users only (enforced in controller). We do NOT
// gate create/update with users:* so agents can keep creating customers.
router.post('/', authorize('ADMIN', 'AGENT'), checkQuota('users'), ctrl.create);
router.put('/:id', authorize('ADMIN', 'AGENT'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), requirePermission('users', 'delete'), ctrl.remove);

module.exports = router;
