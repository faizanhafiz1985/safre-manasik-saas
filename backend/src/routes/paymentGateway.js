const router = require('express').Router();
const ctrl = require('../controllers/paymentGatewayController');
const { authenticate } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

// ── PayPal public config (no auth needed — just returns the client ID for the JS SDK) ─
router.get('/paypal/config', ctrl.paypalConfig);

// ── PayPal webhook (PayPal calls this — no user auth, signature verification handled inside) ─
router.post('/paypal/webhook', ctrl.paypalWebhook);

// ── Authenticated payment endpoints ──
router.post('/paypal/create-order',  authenticate, tenantScope, requireTenant, ctrl.paypalCreateOrder);
router.post('/paypal/capture-order', authenticate, tenantScope, requireTenant, ctrl.paypalCaptureOrder);

// ── Legacy Moyasar (stub mode only) ──
router.post('/intent',  authenticate, tenantScope, requireTenant, ctrl.moyasarCreateIntent);
router.post('/webhook', authenticate, tenantScope, requireTenant, ctrl.moyasarWebhook);

module.exports = router;
