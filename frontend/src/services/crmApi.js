/**
 * CRM API service layer
 * All CRM API calls go through this module so URLs are centralised.
 */
import api from './api';

// ── Leads ─────────────────────────────────────────────────────────────────────
export const crmLeads = {
  getAll: (params) => api.get('/crm/leads', { params }),
  getOne: (id) => api.get(`/crm/leads/${id}`),
  create: (data) => api.post('/crm/leads', data),
  update: (id, data) => api.put(`/crm/leads/${id}`, data),
  addNote: (id, note) => api.post(`/crm/leads/${id}/notes`, { note }),
  bulkImport: (leads) => api.post('/crm/leads/bulk-import', { leads }),
  remove: (id) => api.delete(`/crm/leads/${id}`),
  getStats: () => api.get('/crm/leads/stats'),
};

// ── Pipelines ─────────────────────────────────────────────────────────────────
export const crmPipelines = {
  getAll: () => api.get('/crm/pipelines'),
  create: (data) => api.post('/crm/pipelines', data),
  update: (id, data) => api.put(`/crm/pipelines/${id}`, data),
  delete: (id) => api.delete(`/crm/pipelines/${id}`),
  getKanban: (id) => api.get(`/crm/pipelines/${id}/kanban`),
  addStage: (id, data) => api.post(`/crm/pipelines/${id}/stages`, data),
  updateStage: (id, stageId, data) => api.put(`/crm/pipelines/${id}/stages/${stageId}`, data),
};

// ── Opportunities ─────────────────────────────────────────────────────────────
export const crmOpportunities = {
  getAll: (params) => api.get('/crm/opportunities', { params }),
  create: (data) => api.post('/crm/opportunities', data),
  move: (id, data) => api.put(`/crm/opportunities/${id}/move`, data),
  delete: (id) => api.delete(`/crm/opportunities/${id}`),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const crmTasks = {
  getAll: (params) => api.get('/crm/tasks', { params }),
  getToday: () => api.get('/crm/tasks/today'),
  create: (data) => api.post('/crm/tasks', data),
  update: (id, data) => api.put(`/crm/tasks/${id}`, data),
  complete: (id) => api.post(`/crm/tasks/${id}/complete`),
  remove: (id) => api.delete(`/crm/tasks/${id}`),
};

// ── Inbox ─────────────────────────────────────────────────────────────────────
export const crmInbox = {
  getConversations: (params) => api.get('/crm/conversations', { params }),
  getConversation: (id) => api.get(`/crm/conversations/${id}`),
  sendMessage: (id, data) => api.post(`/crm/conversations/${id}/messages`, data),
  resolve: (id) => api.post(`/crm/conversations/${id}/resolve`),
  assign: (id, assignedToId) => api.post(`/crm/conversations/${id}/assign`, { assignedToId }),
  markRead: (id) => api.post(`/crm/conversations/${id}/mark-read`),
};

// ── Integrations ──────────────────────────────────────────────────────────────
export const crmIntegrations = {
  getAll: () => api.get('/crm/integrations'),
  get: (id) => api.get(`/crm/integrations/${id}`),
  upsert: (data) => api.post('/crm/integrations', data),
  toggle: (id, isEnabled) => api.put(`/crm/integrations/${id}/toggle`, { isEnabled }),
  getWebhookLogs: (params) => api.get('/crm/integrations/logs/webhooks', { params }),
};

// ── Automation ────────────────────────────────────────────────────────────────
export const crmAutomation = {
  getAll: () => api.get('/crm/automation'),
  create: (data) => api.post('/crm/automation', data),
  update: (id, data) => api.put(`/crm/automation/${id}`, data),
  toggle: (id) => api.post(`/crm/automation/${id}/toggle`),
  remove: (id) => api.delete(`/crm/automation/${id}`),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const crmNotifications = {
  getAll: (params) => api.get('/crm/notifications', { params }),
  markRead: (id) => api.post(`/crm/notifications/${id}/read`),
  markAllRead: () => api.post('/crm/notifications/mark-all-read'),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const crmReports = {
  getDashboard: () => api.get('/crm/reports/dashboard'),
  getLeadReport: (params) => api.get('/crm/reports/leads', { params }),
  getAgentPerformance: (params) => api.get('/crm/reports/agents', { params }),
  getPipelineReport: () => api.get('/crm/reports/pipeline'),
};
