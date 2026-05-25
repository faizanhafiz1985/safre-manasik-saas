/**
 * CRM Integration Controller
 * Manages WhatsApp / Facebook / Instagram integration configs per tenant.
 * Credentials are stored in CrmIntegration.credentials (JSON).
 * NOTE: For production, credentials should be encrypted at rest — mark as TODO.
 */
const prisma = require('../config/database');
const crypto = require('crypto');

const getIntegrations = async (req, res, next) => {
  try {
    const integrations = await prisma.crmIntegration.findMany({
      orderBy: { type: 'asc' },
    });
    // Mask sensitive credential fields before returning
    const safe = integrations.map((i) => ({
      ...i,
      credentials: maskCredentials(i.credentials),
    }));
    res.json(safe);
  } catch (err) { next(err); }
};

const getIntegration = async (req, res, next) => {
  try {
    const integration = await prisma.crmIntegration.findFirst({ where: { id: req.params.id } });
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    res.json({ ...integration, credentials: maskCredentials(integration.credentials) });
  } catch (err) { next(err); }
};

const upsertIntegration = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { type, credentials, isEnabled } = req.body;
    if (!['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'].includes(type)) {
      return res.status(400).json({ error: 'Invalid integration type' });
    }

    // Generate a webhook secret if creating for the first time
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const frontendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'https://api.safremanasik.com';
    const webhookUrl = `${frontendUrl}/api/crm/webhooks/${type.toLowerCase()}`;

    const existing = await prisma.crmIntegration.findFirst({ where: { tenantId, type } });

    let integration;
    if (existing) {
      await prisma.crmIntegration.updateMany({
        where: { tenantId, type },
        data: {
          ...(credentials !== undefined && { credentials: mergeCredentials(existing.credentials, credentials) }),
          ...(isEnabled !== undefined && { isEnabled }),
          webhookUrl,
          updatedAt: new Date(),
        },
      });
      integration = await prisma.crmIntegration.findFirst({ where: { tenantId, type } });
    } else {
      integration = await prisma.crmIntegration.create({
        data: {
          tenantId, type,
          credentials: credentials || {},
          isEnabled: isEnabled || false,
          webhookUrl,
          webhookSecret,
        },
      });
    }

    res.json({
      ...integration,
      credentials: maskCredentials(integration.credentials),
      webhookUrl: integration.webhookUrl,
      webhookSecret: integration.webhookSecret,
    });
  } catch (err) { next(err); }
};

const toggleIntegration = async (req, res, next) => {
  try {
    const { isEnabled } = req.body;
    const result = await prisma.crmIntegration.updateMany({
      where: { id: req.params.id },
      data: { isEnabled: Boolean(isEnabled) },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Integration not found' });
    const integration = await prisma.crmIntegration.findFirst({ where: { id: req.params.id } });
    res.json({ ...integration, credentials: maskCredentials(integration.credentials) });
  } catch (err) { next(err); }
};

const getWebhookLogs = async (req, res, next) => {
  try {
    const { source, processed, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const tenantId = req.user.tenantId;

    const where = {
      tenantId,
      ...(source && { source: source.toLowerCase() }),
      ...(processed !== undefined && { processed: processed === 'true' }),
    };

    const [logs, total] = await Promise.all([
      prisma.crmWebhookLog.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.crmWebhookLog.count({ where }),
    ]);
    res.json({ data: logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') return {};
  const masked = {};
  for (const [k, v] of Object.entries(credentials)) {
    const sensitiveKeys = ['accessToken', 'appSecret', 'clientSecret', 'apiKey', 'token', 'secret', 'password'];
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
      masked[k] = typeof v === 'string' && v.length > 8 ? `${v.substring(0, 4)}${'*'.repeat(v.length - 8)}${v.substring(v.length - 4)}` : '***';
    } else {
      masked[k] = v;
    }
  }
  return masked;
}

function mergeCredentials(existing, updates) {
  const existingObj = (existing && typeof existing === 'object') ? existing : {};
  const updatesObj = (updates && typeof updates === 'object') ? updates : {};
  // Only update fields that are explicitly provided (non-empty strings)
  const merged = { ...existingObj };
  for (const [k, v] of Object.entries(updatesObj)) {
    if (v !== '' && v !== null && v !== undefined) {
      merged[k] = v;
    }
  }
  return merged;
}

module.exports = { getIntegrations, getIntegration, upsertIntegration, toggleIntegration, getWebhookLogs };
