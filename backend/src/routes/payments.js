const router = require('express').Router();
const ctrl = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);
router.get('/', requirePermission('payments', 'view'), ctrl.getPayments);
router.post('/', authorize('ADMIN', 'AGENT'), requirePermission('payments', 'create'), ctrl.recordPayment);
router.get('/invoice/:bookingId', requirePermission('payments', 'view'), ctrl.getInvoice);
router.get('/:id/receipt/preview', requirePermission('payments', 'view'), ctrl.previewReceipt);
router.get('/:id/receipt/download', requirePermission('payments', 'view'), ctrl.downloadReceipt);

module.exports = router;
