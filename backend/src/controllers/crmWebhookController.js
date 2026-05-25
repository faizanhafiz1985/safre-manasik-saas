/**
 * CRM Webhook Controller
 *
 * Handles inbound webhooks from WhatsApp Business API, Facebook Lead Ads,
 * and Instagram. All three use the Meta platform webhook format.
 *
 * Verification (GET): Meta sends hub.mode=subscribe, hub.verify_token, hub.challenge.
 * Events (POST):      Meta sends signed payloads with X-Hub-Signature-256.
 *
 * Setup in Meta Developer Console:
 *   Callback URL: https://your-api.railway.app/api/crm/webhooks/{whatsapp|facebook|instagram}
 *   Verify Token: value stored in CrmIntegration.webhookSecret for this tenant
 */

const crypto = require('crypto');
const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const { notifyNewLead } = require('../services/crmNotificationService');
const { runAutomations } = require('../services/crmAutomationEngine');
const logger = require('../config/logger');

// ─── Signature Verification ──────────────────────────────────────────────────

const verifyMetaSignature = (rawBody, signature, secret) => {
  if (!signature || !secret) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
};

// ─── WhatsApp ────────────────────────────────────────────────────────────────

const whatsappVerify = async (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe') {
    // Find tenant whose WhatsApp integration has this verify token
    const integration = await findIntegrationBySecret('WHATSAPP', token);
    if (integration) {
      logger.info(`[webhook] WhatsApp verified for tenant ${integration.tenantId}`);
      return res.send(challenge);
    }
  }
  res.sendStatus(403);
};

const whatsappEvent = async (req, res) => {
  // Acknowledge immediately (Meta requires < 200ms response)
  res.sendStatus(200);

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const signature = req.headers['x-hub-signature-256'];

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entries = body.entry || [];
    for (const entry of entries) {
      for (const change of (entry.changes || [])) {
        const value = change.value;
        if (!value) continue;

        // Find tenant by phone number ID
        const phoneNumberId = value.metadata?.phone_number_id;
        const integration = await findIntegrationByPhoneId('WHATSAPP', phoneNumberId);
        if (!integration) {
          await logWebhook(null, 'whatsapp', 'unmatched', body, 'No matching tenant for phone_number_id');
          continue;
        }

        const tenantId = integration.tenantId;

        // Verify signature
        const creds = integration.credentials || {};
        if (!verifyMetaSignature(rawBody, signature, creds.appSecret || integration.webhookSecret)) {
          logger.warn(`[webhook] WhatsApp signature mismatch for tenant ${tenantId}`);
          await logWebhook(tenantId, 'whatsapp', 'signature_invalid', body, 'Signature mismatch');
          continue;
        }

        await logWebhook(tenantId, 'whatsapp', change.field, body);

        for (const msg of (value.messages || [])) {
          await processWhatsAppMessage(tenantId, msg, value.contacts?.[0]);
        }
      }
    }
  } catch (err) {
    logger.error(`[webhook] WhatsApp error: ${err.message}`);
    await logWebhook(null, 'whatsapp', 'error', req.body, err.message);
  }
};

const processWhatsAppMessage = async (tenantId, msg, contact) => {
  const waId = msg.from; // sender phone
  const contactName = contact?.profile?.name || waId;
  const msgBody = msg.text?.body || (msg.type !== 'text' ? `[${msg.type}]` : '');
  const externalMsgId = msg.id;

  // Find or create conversation
  let conv = await new Promise((resolve, reject) => {
    runWithTenant({ tenantId }, async () => {
      try {
        resolve(await prisma.crmConversation.findFirst({
          where: { tenantId, channel: 'WHATSAPP', externalId: waId },
        }));
      } catch (e) { reject(e); }
    });
  });

  if (!conv) {
    // New conversation — create lead + conversation
    const lead = await new Promise((resolve, reject) => {
      runWithTenant({ tenantId }, async () => {
        try {
          resolve(await prisma.crmLead.create({
            data: {
              tenantId,
              fullName: contactName,
              whatsappNumber: waId,
              source: 'WHATSAPP',
              status: 'NEW',
              sourceRef: externalMsgId,
            },
          }));
        } catch (e) { reject(e); }
      });
    });

    conv = await new Promise((resolve, reject) => {
      runWithTenant({ tenantId }, async () => {
        try {
          resolve(await prisma.crmConversation.create({
            data: {
              tenantId,
              leadId: lead.id,
              channel: 'WHATSAPP',
              externalId: waId,
              participantName: contactName,
              participantPhone: waId,
              lastMessageAt: new Date(),
            },
          }));
        } catch (e) { reject(e); }
      });
    });

    notifyNewLead(tenantId, lead).catch(() => {});
    runAutomations({ tenantId, trigger: 'lead_created', entity: lead }).catch(() => {});
  } else {
    await new Promise((resolve, reject) => {
      runWithTenant({ tenantId }, async () => {
        try {
          resolve(await prisma.crmConversation.updateMany({
            where: { id: conv.id }, data: { lastMessageAt: new Date() },
          }));
        } catch (e) { reject(e); }
      });
    });
  }

  // Store the message
  await new Promise((resolve, reject) => {
    runWithTenant({ tenantId }, async () => {
      try {
        resolve(await prisma.crmMessage.create({
          data: {
            tenantId,
            conversationId: conv.id,
            direction: 'INBOUND',
            channel: 'WHATSAPP',
            body: msgBody,
            externalId: externalMsgId,
            deliveryStatus: 'delivered',
          },
        }));
      } catch (e) { reject(e); }
    });
  });

  // Mark webhook log processed
  await prisma.crmWebhookLog.updateMany({
    where: { tenantId, source: 'whatsapp', processed: false },
    data: { processed: true, processedAt: new Date() },
  });
};

// ─── Facebook Lead Ads ────────────────────────────────────────────────────────

const facebookVerify = async (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe') {
    const integration = await findIntegrationBySecret('FACEBOOK', token);
    if (integration) return res.send(challenge);
  }
  res.sendStatus(403);
};

const facebookEvent = async (req, res) => {
  res.sendStatus(200);

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const signature = req.headers['x-hub-signature-256'];

  try {
    const body = req.body;
    if (body.object !== 'page') return;

    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'leadgen') continue;

        const pageId = entry.id;
        const integration = await findIntegrationByPageId('FACEBOOK', pageId);
        if (!integration) {
          await logWebhook(null, 'facebook', 'unmatched', body, 'No matching tenant for pageId');
          continue;
        }

        const tenantId = integration.tenantId;
        const creds = integration.credentials || {};
        if (!verifyMetaSignature(rawBody, signature, creds.appSecret || integration.webhookSecret)) {
          await logWebhook(tenantId, 'facebook', 'signature_invalid', body, 'Signature mismatch');
          continue;
        }

        await logWebhook(tenantId, 'facebook', 'leadgen', body);

        const leadData = change.value;
        await processFacebookLead(tenantId, leadData, creds);
      }
    }
  } catch (err) {
    logger.error(`[webhook] Facebook error: ${err.message}`);
    await logWebhook(null, 'facebook', 'error', req.body, err.message);
  }
};

const processFacebookLead = async (tenantId, leadData, credentials) => {
  // leadData contains: leadgen_id, form_id, page_id, ad_id, ad_name, adset_id, field_data[]
  const fields = {};
  for (const f of (leadData.field_data || [])) {
    fields[f.name.toLowerCase()] = f.values?.[0] || '';
  }

  const lead = await new Promise((resolve, reject) => {
    runWithTenant({ tenantId }, async () => {
      try {
        resolve(await prisma.crmLead.create({
          data: {
            tenantId,
            fullName: fields.full_name || fields.name || `Facebook Lead ${leadData.leadgen_id}`,
            phone: fields.phone_number || fields.phone || null,
            email: fields.email || null,
            city: fields.city || null,
            source: 'FACEBOOK',
            status: 'NEW',
            sourceRef: leadData.leadgen_id,
            utmCampaign: leadData.ad_name || null,
            utmSource: 'facebook',
            notes: `Form ID: ${leadData.form_id} | Ad: ${leadData.ad_name || 'N/A'}`,
          },
        }));
      } catch (e) { reject(e); }
    });
  });

  await new Promise((resolve, reject) => {
    runWithTenant({ tenantId }, async () => {
      try {
        resolve(await prisma.crmLeadActivity.create({
          data: { tenantId, leadId: lead.id, action: 'lead_created', description: `Auto-captured from Facebook Lead Ad: ${leadData.ad_name || 'N/A'}` },
        }));
      } catch (e) { reject(e); }
    });
  });

  notifyNewLead(tenantId, lead).catch(() => {});
  runAutomations({ tenantId, trigger: 'lead_created', entity: lead }).catch(() => {});
};

// ─── Instagram ────────────────────────────────────────────────────────────────

const instagramVerify = async (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe') {
    const integration = await findIntegrationBySecret('INSTAGRAM', token);
    if (integration) return res.send(challenge);
  }
  res.sendStatus(403);
};

const instagramEvent = async (req, res) => {
  res.sendStatus(200);

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const signature = req.headers['x-hub-signature-256'];

  try {
    const body = req.body;
    if (body.object !== 'instagram') return;

    for (const entry of (body.entry || [])) {
      // Instagram DMs come as messaging events
      for (const msgEvent of (entry.messaging || [])) {
        const senderId = msgEvent.sender?.id;
        const msgBody = msgEvent.message?.text || '[media]';
        const msgId = msgEvent.message?.mid;

        // Match tenant by Instagram Page ID
        const integration = await findIntegrationByPageId('INSTAGRAM', entry.id);
        if (!integration) continue;

        const tenantId = integration.tenantId;
        const creds = integration.credentials || {};
        if (!verifyMetaSignature(rawBody, signature, creds.appSecret || integration.webhookSecret)) continue;

        await logWebhook(tenantId, 'instagram', 'message', body);
        await processInstagramDM(tenantId, { senderId, msgBody, msgId });
      }
    }
  } catch (err) {
    logger.error(`[webhook] Instagram error: ${err.message}`);
  }
};

const processInstagramDM = async (tenantId, { senderId, msgBody, msgId }) => {
  let conv = await new Promise((resolve, reject) => {
    runWithTenant({ tenantId }, async () => {
      try {
        resolve(await prisma.crmConversation.findFirst({
          where: { tenantId, channel: 'INSTAGRAM', externalId: senderId },
        }));
      } catch (e) { reject(e); }
    });
  });

  if (!conv) {
    const lead = await new Promise((resolve, reject) => {
      runWithTenant({ tenantId }, async () => {
        try {
          resolve(await prisma.crmLead.create({
            data: { tenantId, fullName: `Instagram User ${senderId}`, source: 'INSTAGRAM', status: 'NEW', sourceRef: senderId },
          }));
        } catch (e) { reject(e); }
      });
    });
    conv = await new Promise((resolve, reject) => {
      runWithTenant({ tenantId }, async () => {
        try {
          resolve(await prisma.crmConversation.create({
            data: { tenantId, leadId: lead.id, channel: 'INSTAGRAM', externalId: senderId, participantName: `Instagram ${senderId}`, lastMessageAt: new Date() },
          }));
        } catch (e) { reject(e); }
      });
    });
    notifyNewLead(tenantId, lead).catch(() => {});
    runAutomations({ tenantId, trigger: 'lead_created', entity: lead }).catch(() => {});
  } else {
    await new Promise((resolve, reject) => {
      runWithTenant({ tenantId }, async () => {
        try { resolve(await prisma.crmConversation.updateMany({ where: { id: conv.id }, data: { lastMessageAt: new Date() } })); }
        catch (e) { reject(e); }
      });
    });
  }

  await new Promise((resolve, reject) => {
    runWithTenant({ tenantId }, async () => {
      try {
        resolve(await prisma.crmMessage.create({
          data: { tenantId, conversationId: conv.id, direction: 'INBOUND', channel: 'INSTAGRAM', body: msgBody, externalId: msgId },
        }));
      } catch (e) { reject(e); }
    });
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const findIntegrationBySecret = async (type, secret) => {
  if (!secret) return null;
  return new Promise((resolve, reject) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try {
        resolve(await prisma.crmIntegration.findFirst({ where: { type, webhookSecret: secret, isEnabled: true } }));
      } catch (e) { reject(e); }
    });
  });
};

const findIntegrationByPhoneId = async (type, phoneNumberId) => {
  if (!phoneNumberId) return null;
  return new Promise((resolve, reject) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try {
        const all = await prisma.crmIntegration.findMany({ where: { type, isEnabled: true } });
        resolve(all.find((i) => i.credentials?.phoneNumberId === phoneNumberId) || null);
      } catch (e) { reject(e); }
    });
  });
};

const findIntegrationByPageId = async (type, pageId) => {
  if (!pageId) return null;
  return new Promise((resolve, reject) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try {
        const all = await prisma.crmIntegration.findMany({ where: { type, isEnabled: true } });
        resolve(all.find((i) => i.credentials?.pageId === pageId) || null);
      } catch (e) { reject(e); }
    });
  });
};

const logWebhook = async (tenantId, source, event, payload, error = null) => {
  try {
    await prisma.crmWebhookLog.create({
      data: { tenantId, source, event, payload, error, processed: !error },
    });
  } catch (e) {
    logger.error(`[webhook] Failed to log: ${e.message}`);
  }
};

module.exports = {
  whatsappVerify, whatsappEvent,
  facebookVerify, facebookEvent,
  instagramVerify, instagramEvent,
};
