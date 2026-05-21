// PayPal SDK client — switches between sandbox and live based on PAYPAL_MODE.
// Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in environment.

const paypal = require('@paypal/checkout-server-sdk');

const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

let client = null;
let stubMode = false;

if (!clientId || !clientSecret || clientId === 'stub' || clientSecret === 'stub') {
  stubMode = true;
} else {
  const Environment = mode === 'live'
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;
  client = new paypal.core.PayPalHttpClient(new Environment(clientId, clientSecret));
}

module.exports = { paypal, client, stubMode, mode };
