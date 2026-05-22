const router = require('express').Router();
const ctrl = require('../controllers/paymentGatewayController');
const { authenticate } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

// ── PayPal config (returns the client ID + mode for the JS SDK).
// Authenticated + tenant-scoped because each tenant now brings its own PayPal
// credentials — without req.user.tenantId we couldn't return the right
// client ID. Booking detail pages where the PayPal button lives are always
// behind auth anyway, so requiring it here doesn't change UX.
router.get('/paypal/config', authenticate, tenantScope, requireTenant, ctrl.paypalConfig);

// ── PayPal webhook (PayPal calls this — no user auth, signature verification handled inside) ─
router.post('/paypal/webhook', ctrl.paypalWebhook);

// ── Authenticated payment endpoints ──
router.post('/paypal/create-order',  authenticate, tenantScope, requireTenant, ctrl.paypalCreateOrder);
router.post('/paypal/capture-order', authenticate, tenantScope, requireTenant, ctrl.paypalCaptureOrder);

// ── Legacy Moyasar (stub mode only) ──
router.post('/intent',  authenticate, tenantScope, requireTenant, ctrl.moyasarCreateIntent);
router.post('/webhook', authenticate, tenantScope, requireTenant, ctrl.moyasarWebhook);

module.exports = router;
