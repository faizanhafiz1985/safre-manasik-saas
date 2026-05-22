// PayPal SDK client factory.
//
// Two layers:
//   1. Per-tenant credentials  — read from the Tenant row (paypalClientId /
//      paypalSecret / paypalMode). Each tenant brings their own PayPal app.
//      A 30-second in-memory cache keeps repeat lookups cheap.
//   2. Platform fallback       — process.env.PAYPAL_CLIENT_ID /
//      PAYPAL_CLIENT_SECRET / PAYPAL_MODE. Used when a tenant hasn't
//      configured PayPal yet.
//
// If neither is set, the gateway operates in "stub mode" — orders look real
// in the UI but no money moves. Useful for local dev and live demos.

const paypal = require('@paypal/checkout-server-sdk');
const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');

// ─── Platform fallback (legacy single-tenant behaviour) ──────────────────
const envMode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
const envClientId = process.env.PAYPAL_CLIENT_ID;
const envSecret = process.env.PAYPAL_CLIENT_SECRET;
const envConfigured = !!(envClientId && envSecret && envClientId !== 'stub' && envSecret !== 'stub');

let envClient = null;
if (envConfigured) {
  const Environment = envMode === 'live' ? paypal.core.LiveEnvironment : paypal.core.SandboxEnvironment;
  envClient = new paypal.core.PayPalHttpClient(new Environment(envClientId, envSecret));
}

// ─── Per-tenant cache ────────────────────────────────────────────────────
const TENANT_CACHE_TTL_MS = 30_000;
const tenantCache = new Map(); // tenantId -> { client, mode, source, expiresAt }

function buildTenantClient(clientId, secret, mode) {
  const Environment = mode === 'live' ? paypal.core.LiveEnvironment : paypal.core.SandboxEnvironment;
  return new paypal.core.PayPalHttpClient(new Environment(clientId, secret));
}

// Force-clear a tenant's cached client (called when admin saves new creds)
function invalidateTenantPaypal(tenantId) {
  tenantCache.delete(tenantId);
}

// Get the PayPal client for a tenant. Returns { client, mode, clientId, source, stubMode }.
// `source` is 'tenant' | 'platform' | 'stub' so callers (and the public config
// endpoint) can tell where the credentials came from.
async function getPaypalForTenant(tenantId) {
  if (!tenantId) {
    return envClient
      ? { client: envClient, mode: envMode, clientId: envClientId, source: 'platform', stubMode: false }
      : { client: null, mode: 'sandbox', clientId: '', source: 'stub', stubMode: true };
  }

  // Cache hit?
  const now = Date.now();
  const cached = tenantCache.get(tenantId);
  if (cached && cached.expiresAt > now) return cached;

  // Look up the tenant under SUPER_ADMIN context so the tenant middleware
  // doesn't block the read with its own where: { tenantId } filter.
  let tenant;
  await new Promise((resolve, reject) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try {
        tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { paypalEnabled: true, paypalMode: true, paypalClientId: true, paypalSecret: true },
        });
        resolve();
      } catch (e) { reject(e); }
    });
  });

  let entry;
  if (tenant?.paypalEnabled && tenant.paypalClientId && tenant.paypalSecret) {
    const mode = (tenant.paypalMode || 'sandbox').toLowerCase();
    entry = {
      client: buildTenantClient(tenant.paypalClientId, tenant.paypalSecret, mode),
      mode,
      clientId: tenant.paypalClientId,
      source: 'tenant',
      stubMode: false,
    };
  } else if (envClient) {
    entry = { client: envClient, mode: envMode, clientId: envClientId, source: 'platform', stubMode: false };
  } else {
    entry = { client: null, mode: 'sandbox', clientId: '', source: 'stub', stubMode: true };
  }
  entry.expiresAt = now + TENANT_CACHE_TTL_MS;
  tenantCache.set(tenantId, entry);
  return entry;
}

module.exports = {
  paypal,                  // expose the SDK so callers can build OrdersCreate/CaptureRequest objects
  getPaypalForTenant,
  invalidateTenantPaypal,
  envConfigured,
};
