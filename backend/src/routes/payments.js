const router = require('express').Router();
const ctrl = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);
router.get('/', ctrl.getPayments);
router.post('/', authorize('ADMIN', 'AGENT'), ctrl.recordPayment);
router.get('/invoice/:bookingId', ctrl.getInvoice);
router.get('/:id/receipt/preview', ctrl.previewReceipt);
router.get('/:id/receipt/download', ctrl.downloadReceipt);

module.exports = router;
