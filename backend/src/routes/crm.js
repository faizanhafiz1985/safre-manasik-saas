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
const { requirePermission } = require('../middleware/permission');

// ── Shared middleware for all protected CRM routes ────────────────────────────
// crmAuth covers JWT + tenant + plan/CRM-enabled. Granular feature permissions
// are then enforced per-route with P(feature, action) so a tenant's custom roles
// actually govern CRM access (SUPER_ADMIN / proxy-login bypass inside requirePermission).
const crmAuth = [authenticate, tenantScope, requireTenant, requireCrm];
const adminOnly = [...crmAuth, authorize('ADMIN', 'SUPER_ADMIN')];
const P = (feature, action) => requirePermission(feature, action);

// ── Leads ─────────────────────────────────────────────────────────────────────
const leads = require('../controllers/crmLeadController');
router.get('/leads/stats',      ...crmAuth, P('crm_leads', 'view'), leads.getStats);
router.get('/leads',            ...crmAuth, P('crm_leads', 'view'), leads.getAll);
router.get('/leads/:id',        ...crmAuth, P('crm_leads', 'view'), leads.getOne);
router.post('/leads',           ...crmAuth, P('crm_leads', 'create'), leads.create);
router.put('/leads/:id',        ...crmAuth, P('crm_leads', 'edit'), leads.update);
router.post('/leads/:id/notes', ...crmAuth, P('crm_leads', 'edit'), leads.addNote);
router.post('/leads/bulk-import', ...adminOnly, P('crm_leads', 'create'), leads.bulkImport);
router.delete('/leads/:id',     ...crmAuth, P('crm_leads', 'delete'), leads.remove);

// ── Pipelines & Opportunities ─────────────────────────────────────────────────
const pipeline = require('../controllers/crmPipelineController');
router.get('/pipelines',                    ...crmAuth, P('crm_pipeline', 'view'), pipeline.listPipelines);
router.post('/pipelines',                   ...adminOnly, P('crm_pipeline', 'create'), pipeline.createPipeline);
router.put('/pipelines/:id',                ...adminOnly, P('crm_pipeline', 'edit'), pipeline.updatePipeline);
router.delete('/pipelines/:id',             ...adminOnly, P('crm_pipeline', 'delete'), pipeline.deletePipeline);
router.get('/pipelines/:id/kanban',         ...crmAuth, P('crm_pipeline', 'view'), pipeline.getKanban);
router.post('/pipelines/:id/stages',        ...adminOnly, P('crm_pipeline', 'edit'), pipeline.addStage);
router.put('/pipelines/:id/stages/:stageId', ...adminOnly, P('crm_pipeline', 'edit'), pipeline.updateStage);

router.get('/opportunities',            ...crmAuth, P('crm_pipeline', 'view'), pipeline.listOpportunities);
router.post('/opportunities',           ...crmAuth, P('crm_pipeline', 'create'), pipeline.createOpportunity);
router.put('/opportunities/:id/move',   ...crmAuth, P('crm_pipeline', 'edit'), pipeline.moveOpportunity);
router.delete('/opportunities/:id',     ...adminOnly, P('crm_pipeline', 'delete'), pipeline.deleteOpportunity);

// ── Tasks ─────────────────────────────────────────────────────────────────────
const tasks = require('../controllers/crmTaskController');
router.get('/tasks/today',    ...crmAuth, P('crm_tasks', 'view'), tasks.getToday);
router.get('/tasks',          ...crmAuth, P('crm_tasks', 'view'), tasks.getAll);
router.post('/tasks',         ...crmAuth, P('crm_tasks', 'create'), tasks.create);
router.put('/tasks/:id',      ...crmAuth, P('crm_tasks', 'edit'), tasks.update);
router.post('/tasks/:id/complete', ...crmAuth, P('crm_tasks', 'edit'), tasks.complete);
router.delete('/tasks/:id',   ...crmAuth, P('crm_tasks', 'delete'), tasks.remove);

// ── Inbox (Conversations & Messages) ─────────────────────────────────────────
const inbox = require('../controllers/crmInboxController');
router.get('/conversations',                    ...crmAuth, P('crm_inbox', 'view'), inbox.listConversations);
router.get('/conversations/:id',                ...crmAuth, P('crm_inbox', 'view'), inbox.getConversation);
router.post('/conversations/:id/messages',      ...crmAuth, P('crm_inbox', 'create'), inbox.sendMessage);
router.post('/conversations/:id/resolve',       ...crmAuth, P('crm_inbox', 'edit'), inbox.resolveConversation);
router.post('/conversations/:id/assign',        ...adminOnly, P('crm_inbox', 'edit'), inbox.assignConversation);
router.post('/conversations/:id/mark-read',     ...crmAuth, P('crm_inbox', 'view'), inbox.markRead);

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
// Dashboard powers the CRM overview/landing page (crm_overview); the detailed
// report endpoints below require crm_reports.
router.get('/reports/dashboard',    ...crmAuth, P('crm_overview', 'view'), reports.getDashboard);
router.get('/reports/leads',        ...crmAuth, P('crm_reports', 'view'), reports.getLeadReport);
router.get('/reports/agents',       ...adminOnly, P('crm_reports', 'view'), reports.getAgentPerformance);
router.get('/reports/pipeline',     ...crmAuth, P('crm_reports', 'view'), reports.getPipelineReport);

module.exports = router;
