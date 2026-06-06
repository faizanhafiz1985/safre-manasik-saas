const router = require('express').Router();
const ctrl = require('../controllers/formVoucherController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);

router.get('/next-number', requirePermission('voucher_forms', 'view'), ctrl.nextNumber);
router.get('/', requirePermission('voucher_forms', 'view'), ctrl.list);
router.get('/:id', requirePermission('voucher_forms', 'view'), ctrl.getOne);
router.get('/:id/print', requirePermission('voucher_forms', 'view'), ctrl.printHtml);
// Invoices (Proforma / Actual) — auto-generated; viewable + printable
router.get('/:id/invoices', requirePermission('voucher_forms', 'view'), ctrl.listInvoices);
router.get('/:id/invoice/:docType/print', requirePermission('voucher_forms', 'view'), ctrl.invoicePrintHtml);
router.post('/', authorize('ADMIN', 'AGENT'), requirePermission('voucher_forms', 'create'), ctrl.create);
router.put('/:id', authorize('ADMIN', 'AGENT'), requirePermission('voucher_forms', 'edit'), ctrl.update);
router.patch('/:id/confirm', authorize('ADMIN', 'AGENT'), requirePermission('voucher_forms', 'edit'), ctrl.confirm);
router.patch('/:id/cancel', authorize('ADMIN', 'AGENT'), requirePermission('voucher_forms', 'edit'), ctrl.cancel);
// Record a payment against a confirmed direct voucher (audited, write-once)
router.patch('/:id/payment', authorize('ADMIN', 'AGENT'), requirePermission('payments', 'create'), ctrl.recordPayment);
// Invoice lifecycle: cancel / delete
router.patch('/invoices/:invoiceId/cancel', authorize('ADMIN', 'AGENT'), requirePermission('voucher_forms', 'edit'), ctrl.cancelInvoice);
router.delete('/invoices/:invoiceId', authorize('ADMIN'), requirePermission('voucher_forms', 'delete'), ctrl.deleteInvoice);
router.delete('/:id', authorize('ADMIN'), requirePermission('voucher_forms', 'delete'), ctrl.remove);

module.exports = router;
