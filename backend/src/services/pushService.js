const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const logger = require('../config/logger');

// ── Firebase Cloud Messaging (HTTP v1) push service ──────────────────────────
// Sends to Android + iOS (APNs via FCM) from a single API. Configuration is via
// the env var FCM_SERVICE_ACCOUNT — the full service-account JSON (string). When
// it is absent the service is a safe no-op so the app runs fine without push.
//
// Provision: Firebase console → Project settings → Service accounts → Generate
// new private key. Put the JSON (single line) into the FCM_SERVICE_ACCOUNT env
// var on Railway. iOS additionally needs an APNs key uploaded in Firebase.

let _sa = null;            // parsed service account
let _saTried = false;
let _tokenCache = null;    // { accessToken, exp }

function serviceAccount() {
  if (_saTried) return _sa;
  _saTried = true;
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    _sa = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!_sa.client_email || !_sa.private_key || !_sa.project_id) {
      logger.error('[push] FCM_SERVICE_ACCOUNT missing client_email/private_key/project_id');
      _sa = null;
    }
  } catch (e) {
    logger.error(`[push] FCM_SERVICE_ACCOUNT is not valid JSON: ${e.message}`);
    _sa = null;
  }
  return _sa;
}

const isEnabled = () => !!serviceAccount();

// OAuth2 access token for FCM, signed with the service-account key. Cached ~50m.
async function getAccessToken() {
  const sa = serviceAccount();
  if (!sa) return null;
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache && _tokenCache.exp - 60 > now) return _tokenCache.accessToken;

  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' }
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    logger.error(`[push] OAuth token exchange failed: ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
    return null;
  }
  _tokenCache = { accessToken: json.access_token, exp: now + (json.expires_in || 3600) };
  return _tokenCache.accessToken;
}

// FCM data payload values must be strings.
function stringifyData(data = {}) {
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = v == null ? '' : String(v);
  return out;
}

// Send one notification to many tokens. Prunes tokens FCM reports as dead.
async function sendToTokens(tokens, { title, body, data } = {}) {
  const sa = serviceAccount();
  if (!sa || !tokens || tokens.length === 0) return { sent: 0, pruned: 0 };
  const accessToken = await getAccessToken();
  if (!accessToken) return { sent: 0, pruned: 0 };

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0; const dead = [];

  await Promise.all(tokens.map(async (token) => {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: stringifyData(data),
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      });
      if (r.ok) { sent++; return; }
      const err = await r.json().catch(() => ({}));
      const status = err?.error?.details?.[0]?.errorCode || err?.error?.status;
      if (r.status === 404 || status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT') dead.push(token);
      else logger.error(`[push] send failed (${r.status}): ${JSON.stringify(err).slice(0, 160)}`);
    } catch (e) {
      logger.error(`[push] send error: ${e.message}`);
    }
  }));

  let pruned = 0;
  if (dead.length) {
    try { const res = await prisma.device.deleteMany({ where: { token: { in: dead } } }); pruned = res.count; }
    catch { /* ignore */ }
  }
  return { sent, pruned };
}

// Notify all of a user's registered devices. Fire-and-forget friendly — callers
// should not await it on the request critical path (use .catch()).
async function notifyUser(userId, payload) {
  try {
    if (!isEnabled() || !userId) return { sent: 0 };
    const devices = await prisma.device.findMany({ where: { userId }, select: { token: true } });
    return await sendToTokens(devices.map((d) => d.token), payload);
  } catch (e) {
    logger.error(`[push] notifyUser failed: ${e.message}`);
    return { sent: 0 };
  }
}

module.exports = { isEnabled, notifyUser, sendToTokens };
