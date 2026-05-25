/**
 * CRM Module Router
 * Mounts all CRM sub-routers under /api/crm
 *
 * All routes require:
 *   authenticate  → valid JWT
 *   tenantScope   → injects tenantId into Prisma context
 *   requireTenant → tenant must exist
 *   requireCrm    → plan has crm feature AND CrmConfig.enabled = true
 *
 * Webhook routes are PUBLIC (no auth) — Meta signature validation is performed
 * inside the webhook controller.
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requireCrm } = require('../middleware/crmAccess');

// ── Shared middleware for all protected CRM routes ────────────────────────────
const crmAuth = [authenticate, tenantScope, requireTenant, requireCrm];
const adminOnly = [...crmAuth, authorize('ADMIN', 'SUPER_ADMIN')];

// ── Leads ─────────────────────────────────────────────────────────────────────
const leads = require('../controllers/crmLeadController');
router.get('/leads/stats',      ...crmAuth, leads.getStats);
router.get('/leads',            ...crmAuth, leads.getAll);
router.get('/leads/:id',        ...crmAuth, leads.getOne);
router.post('/leads',           ...crmAuth, leads.create);
router.put('/leads/:id',        ...crmAuth, leads.update);
router.post('/leads/:id/notes', ...crmAuth, leads.addNote);
router.post('/leads/bulk-import', ...adminOnly, leads.bulkImport);
router.delete('/leads/:id',     ...crmAuth, leads.remove);

// ── Pipelines & Opportunities ─────────────────────────────────────────────────
const pipeline = require('../controllers/crmPipelineController');
router.get('/pipelines',                    ...crmAuth, pipeline.listPipelines);
router.post('/pipelines',                   ...adminOnly, pipeline.createPipeline);
router.put('/pipelines/:id',                ...adminOnly, pipeline.updatePipeline);
router.delete('/pipelines/:id',             ...adminOnly, pipeline.deletePipeline);
router.get('/pipelines/:id/kanban',         ...crmAuth, pipeline.getKanban);
router.post('/pipelines/:id/stages',        ...adminOnly, pipeline.addStage);
router.put('/pipelines/:id/stages/:stageId', ...adminOnly, pipeline.updateStage);

router.get('/opportunities',            ...crmAuth, pipeline.listOpportunities);
router.post('/opportunities',           ...crmAuth, pipeline.createOpportunity);
router.put('/opportunities/:id/move',   ...crmAuth, pipeline.moveOpportunity);
router.delete('/opportunities/:id',     ...adminOnly, pipeline.deleteOpportunity);

// ── Tasks ─────────────────────────────────────────────────────────────────────
const tasks = require('../controllers/crmTaskController');
router.get('/tasks/today',    ...crmAuth, tasks.getToday);
router.get('/tasks',          ...crmAuth, tasks.getAll);
router.post('/tasks',         ...crmAuth, tasks.create);
router.put('/tasks/:id',      ...crmAuth, tasks.update);
router.post('/tasks/:id/complete', ...crmAuth, tasks.complete);
router.delete('/tasks/:id',   ...crmAuth, tasks.remove);

// ── Inbox (Conversations & Messages) ─────────────────────────────────────────
const inbox = require('../controllers/crmInboxController');
router.get('/conversations',                    ...crmAuth, inbox.listConversations);
router.get('/conversations/:id',                ...crmAuth, inbox.getConversation);
router.post('/conversations/:id/messages',      ...crmAuth, inbox.sendMessage);
router.post('/conversations/:id/resolve',       ...crmAuth, inbox.resolveConversation);
router.post('/conversations/:id/assign',        ...adminOnly, inbox.assignConversation);
router.post('/conversations/:id/mark-read',     ...crmAuth, inbox.markRead);

// ── Integrations ──────────────────────────────────────────────────────────────
const integrations = require('../controllers/crmIntegrationController');
router.get('/integrations',         ...adminOnly, integrations.getIntegrations);
router.get('/integrations/:id',     ...adminOnly, integrations.getIntegration);
router.post('/integrations',        ...adminOnly, integrations.upsertIntegration);
router.put('/integrations/:id/toggle', ...adminOnly, integrations.toggleIntegration);
router.get('/integrations/logs/webhooks', ...adminOnly, integrations.getWebhookLogs);

// ── Automation Rules ──────────────────────────────────────────────────────────
const automation = require('../controllers/crmAutomationController');
router.get('/automation',           ...adminOnly, automation.getAll);
router.post('/automation',          ...adminOnly, automation.create);
router.put('/automation/:id',       ...adminOnly, automation.update);
router.post('/automation/:id/toggle', ...adminOnly, automation.toggle);
router.delete('/automation/:id',    ...adminOnly, automation.remove);

// ── Notifications ─────────────────────────────────────────────────────────────
const notifs = require('../controllers/crmNotificationController');
router.get('/notifications',              ...crmAuth, notifs.getAll);
router.post('/notifications/:id/read',    ...crmAuth, notifs.markRead);
router.post('/notifications/mark-all-read', ...crmAuth, notifs.markAllRead);

// ── Reports ───────────────────────────────────────────────────────────────────
const reports = require('../controllers/crmReportController');
router.get('/reports/dashboard',    ...crmAuth, reports.getDashboard);
router.get('/reports/leads',        ...crmAuth, reports.getLeadReport);
router.get('/reports/agents',       ...adminOnly, reports.getAgentPerformance);
router.get('/reports/pipeline',     ...crmAuth, reports.getPipelineReport);

module.exports = router;
