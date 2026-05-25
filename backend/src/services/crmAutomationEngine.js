/**
 * CRM Automation Engine
 *
 * Rule structure stored in CrmAutomationRule:
 *   trigger: "lead_created" | "lead_status_changed" | "task_overdue" | "lead_inactivity"
 *   conditions: [{ field, operator, value }]  e.g. { field:"source", operator:"eq", value:"WHATSAPP" }
 *   actions:    [{ type, params }]             e.g. { type:"assign_agent", params:{ agentId:"..." } }
 *
 * Supported action types:
 *   assign_agent       — set lead.assignedToId
 *   change_lead_status — set lead.status
 *   create_task        — create a CrmTask linked to the lead
 *   add_tag            — append a tag to lead.tags
 *   send_notification  — create an in-app notification
 */

const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const { createNotification } = require('./crmNotificationService');
const logger = require('../config/logger');

/**
 * Evaluate a single condition against an entity object.
 */
const evalCondition = (cond, entity) => {
  const val = entity[cond.field];
  switch (cond.operator) {
    case 'eq':  return String(val) === String(cond.value);
    case 'neq': return String(val) !== String(cond.value);
    case 'contains': return String(val || '').toLowerCase().includes(String(cond.value).toLowerCase());
    case 'gt':  return Number(val) > Number(cond.value);
    case 'lt':  return Number(val) < Number(cond.value);
    case 'in':  return (cond.value || []).includes(val);
    default:    return true;
  }
};

/**
 * Execute a single automation action.
 */
const executeAction = async (action, entity, tenantId, userId) => {
  const { type, params } = action;

  switch (type) {
    case 'assign_agent': {
      if (!params?.agentId) break;
      await runWithTenant({ tenantId }, async () => {
        await prisma.crmLead.updateMany({
          where: { id: entity.id },
          data: { assignedToId: params.agentId, updatedAt: new Date() },
        });
        await prisma.crmLeadActivity.create({
          data: {
            tenantId,
            leadId: entity.id,
            action: 'auto_assigned',
            description: `Automatically assigned by automation rule`,
          },
        });
      });
      break;
    }
    case 'change_lead_status': {
      if (!params?.status) break;
      await runWithTenant({ tenantId }, async () => {
        await prisma.crmLead.updateMany({
          where: { id: entity.id },
          data: { status: params.status, updatedAt: new Date() },
        });
        await prisma.crmLeadActivity.create({
          data: {
            tenantId,
            leadId: entity.id,
            action: 'auto_status_changed',
            description: `Status automatically changed to ${params.status}`,
          },
        });
      });
      break;
    }
    case 'create_task': {
      const dueAt = params?.dueDays
        ? new Date(Date.now() + Number(params.dueDays) * 86400000)
        : null;
      await runWithTenant({ tenantId }, async () => {
        await prisma.crmTask.create({
          data: {
            tenantId,
            leadId: entity.id,
            title: params?.title || 'Follow-up',
            description: params?.description || null,
            priority: params?.priority || 'MEDIUM',
            assignedToId: entity.assignedToId || null,
            dueAt,
          },
        });
      });
      break;
    }
    case 'add_tag': {
      if (!params?.tag) break;
      const lead = await new Promise((resolve, reject) => {
        runWithTenant({ tenantId }, async () => {
          try { resolve(await prisma.crmLead.findFirst({ where: { id: entity.id } })); }
          catch (e) { reject(e); }
        });
      });
      if (lead && !lead.tags.includes(params.tag)) {
        await runWithTenant({ tenantId }, async () => {
          await prisma.crmLead.updateMany({
            where: { id: entity.id },
            data: { tags: [...lead.tags, params.tag] },
          });
        });
      }
      break;
    }
    case 'send_notification': {
      const agents = await new Promise((resolve, reject) => {
        runWithTenant({ isSuperAdmin: true }, async () => {
          try {
            resolve(await prisma.user.findMany({
              where: { tenantId, role: { in: ['ADMIN', 'AGENT'] }, isActive: true },
              select: { id: true },
            }));
          } catch (e) { reject(e); }
        });
      });
      await createNotification({
        tenantId,
        userIds: agents.map((u) => u.id),
        type: 'automation',
        title: params?.title || 'Automation Alert',
        body: params?.body || `Rule triggered for lead ${entity.fullName}`,
        entityType: 'lead',
        entityId: entity.id,
      });
      break;
    }
    default:
      logger.warn(`[automation] Unknown action type: ${type}`);
  }
};

/**
 * Run all active automation rules for a given trigger and entity.
 * Fire-and-forget — called from controllers without awaiting.
 */
const runAutomations = async ({ tenantId, trigger, entity }) => {
  try {
    const rules = await new Promise((resolve, reject) => {
      runWithTenant({ tenantId }, async () => {
        try {
          resolve(await prisma.crmAutomationRule.findMany({
            where: { tenantId, trigger, isActive: true },
          }));
        } catch (e) { reject(e); }
      });
    });

    for (const rule of rules) {
      const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
      const allMatch = conditions.every((c) => evalCondition(c, entity));
      if (!allMatch) continue;

      const actions = Array.isArray(rule.actions) ? rule.actions : [];
      for (const action of actions) {
        await executeAction(action, entity, tenantId);
      }

      // Update run stats
      await runWithTenant({ tenantId }, async () => {
        await prisma.crmAutomationRule.updateMany({
          where: { id: rule.id },
          data: { runCount: rule.runCount + 1, lastRunAt: new Date() },
        });
      });
    }
  } catch (err) {
    logger.error(`[automation] Error running automations for trigger ${trigger}: ${err.message}`);
  }
};

module.exports = { runAutomations };
