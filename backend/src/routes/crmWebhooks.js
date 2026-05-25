/**
 * CRM Webhook Routes — PUBLIC (no JWT auth)
 * Meta validates via hub.verify_token (GET) and X-Hub-Signature-256 (POST).
 * We capture rawBody here so signature verification can work.
 */

const router = require('express').Router();
const wh = require('../controllers/crmWebhookController');

// Capture raw body for HMAC signature verification before JSON parsing
const rawBodyCapture = (req, res, next) => {
  let data = '';
  req.on('data', (chunk) => { data += chunk; });
  req.on('end', () => { req.rawBody = data; next(); });
};

// WhatsApp Business API
router.get('/whatsapp', wh.whatsappVerify);
router.post('/whatsapp', rawBodyCapture, wh.whatsappEvent);

// Facebook Lead Ads
router.get('/facebook', wh.facebookVerify);
router.post('/facebook', rawBodyCapture, wh.facebookEvent);

// Instagram
router.get('/instagram', wh.instagramVerify);
router.post('/instagram', rawBodyCapture, wh.instagramEvent);

module.exports = router;
