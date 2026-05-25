/**
 * CRM Notification Service
 * Creates in-app CrmNotification records and (future) sends push/email/WhatsApp alerts.
 */

const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');

const NOTIFICATION_TYPES = {
  NEW_LEAD: 'new_lead',
  LEAD_ASSIGNED: 'lead_assigned',
  LEAD_STATUS_CHANGED: 'lead_status_changed',
  TASK_DUE: 'task_due',
  TASK_OVERDUE: 'task_overdue',
  INTEGRATION_ERROR: 'integration_error',
  OPPORTUNITY_MOVED: 'opportunity_moved',
  FOLLOW_UP_DUE: 'follow_up_due',
};

/**
 * Create a CRM in-app notification.
 * @param {Object} opts
 * @param {string} opts.tenantId
 * @param {string|string[]} opts.userIds - recipient user IDs
 * @param {string} opts.type - NOTIFICATION_TYPES value
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} [opts.entityType] - 'lead' | 'task' | 'opportunity'
 * @param {string} [opts.entityId]
 */
const createNotification = async ({ tenantId, userIds, type, title, body, entityType, entityId }) => {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (!ids.length) return;

  await new Promise((resolve, reject) => {
    runWithTenant({ tenantId }, async () => {
      try {
        await prisma.crmNotification.createMany({
          data: ids.map((userId) => ({
            tenantId,
            userId,
            type,
            title,
            body,
            entityType: entityType || null,
            entityId: entityId || null,
          })),
          skipDuplicates: true,
        });
        resolve();
      } catch (e) { reject(e); }
    });
  });
};

/**
 * Notify all ADMIN + AGENT users in a tenant about a new lead.
 */
const notifyNewLead = async (tenantId, lead) => {
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
  const userIds = agents.map((u) => u.id);
  await createNotification({
    tenantId,
    userIds,
    type: NOTIFICATION_TYPES.NEW_LEAD,
    title: 'New Lead',
    body: `${lead.fullName} (${lead.source}) has been added.`,
    entityType: 'lead',
    entityId: lead.id,
  });
};

/**
 * Notify the assigned agent when a lead is assigned to them.
 */
const notifyLeadAssigned = async (tenantId, lead, assignedToId) => {
  if (!assignedToId) return;
  await createNotification({
    tenantId,
    userIds: [assignedToId],
    type: NOTIFICATION_TYPES.LEAD_ASSIGNED,
    title: 'Lead Assigned to You',
    body: `${lead.fullName} has been assigned to you.`,
    entityType: 'lead',
    entityId: lead.id,
  });
};

/**
 * Notify the assigned agent when a task is due soon (called by scheduled job).
 */
const notifyTaskDue = async (tenantId, task) => {
  if (!task.assignedToId) return;
  await createNotification({
    tenantId,
    userIds: [task.assignedToId],
    type: NOTIFICATION_TYPES.TASK_DUE,
    title: 'Task Due Soon',
    body: `"${task.title}" is due soon.`,
    entityType: 'task',
    entityId: task.id,
  });
};

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  notifyNewLead,
  notifyLeadAssigned,
  notifyTaskDue,
};
