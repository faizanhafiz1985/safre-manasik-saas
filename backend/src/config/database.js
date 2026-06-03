const { PrismaClient } = require('@prisma/client');
const { getTenantId, isSuperAdmin } = require('./tenantContext');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Models that have a tenantId column. The Prisma middleware below auto-filters
// and auto-injects tenantId for these models so route handlers never have to
// remember to pass it.
const TENANT_MODELS = new Set([
  'User',
  'Customer',
  'CustomerPassenger',
  'Hotel',
  'Package',
  'Booking',
  'Vehicle',
  'Route',
  'CateringVendor',
  'Voucher',
  'Payment',
  'Invoice',
  'SystemConfig',
  // ── CRM module ──────────────────────────────────────────────────────────
  'CrmConfig',
  'CrmLead',
  'CrmLeadActivity',
  'CrmPipeline',
  'CrmPipelineStage',
  'CrmOpportunity',
  'CrmOpportunityActivity',
  'CrmTask',
  'CrmConversation',
  'CrmMessage',
  'CrmIntegration',
  'CrmAutomationRule',
  'CrmNotification',
]);

// Models that have a tenantId but where filtering by it should be optional.
// User is special: login looks up by email globally; the tenant is then
// extracted from the user record. We still inject tenantId on User create.
const OPTIONAL_FILTER_MODELS = new Set(['User', 'SystemConfig']);

prisma.$use(async (params, next) => {
  const tenantId = getTenantId();
  const superAdmin = isSuperAdmin();

  // SUPER_ADMIN bypasses tenant filtering entirely (sees every tenant's data).
  if (superAdmin) return next(params);

  if (!TENANT_MODELS.has(params.model)) return next(params);

  // No tenant in context: only allow when explicitly running outside a request
  // (seed scripts, super-admin internal operations) — in those cases the
  // caller must use runWithoutTenantScope or pass tenantId explicitly.
  if (!tenantId) return next(params);

  // ── Read operations: scope to current tenant ──────────────────────────
  if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
    if (OPTIONAL_FILTER_MODELS.has(params.model) && params.action === 'findUnique') {
      return next(params);
    }
    params.args = params.args || {};
    params.args.where = params.args.where || {};

    // findUnique requires a unique field; convert to findFirst when adding non-unique tenantId.
    if (params.action === 'findUnique') {
      params.action = 'findFirst';
    }

    params.args.where.tenantId = tenantId;
  }

  // ── Update / delete: also scope to current tenant ─────────────────────
  if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
    params.args = params.args || {};
    params.args.where = params.args.where || {};
    if (params.action === 'update' || params.action === 'delete') {
      // Single-record op: convert to ...Many so we can add the non-unique
      // tenantId filter alongside the id. updateMany/deleteMany do not
      // accept `include` or `select`, so strip them — controllers that need
      // the record back should refetch via findFirst after the mutation.
      params.action = params.action + 'Many';
      delete params.args.include;
      delete params.args.select;
      // `data` may contain nested writes via `create` / `update` on relations
      // (e.g. passengers: { create: [...] }). updateMany rejects these.
      if (params.args.data) {
        for (const key of Object.keys(params.args.data)) {
          const val = params.args.data[key];
          if (val && typeof val === 'object' && (val.create || val.update || val.upsert || val.connect || val.disconnect || val.deleteMany || val.createMany)) {
            // Skip relation-write fields; caller must split the mutation.
            delete params.args.data[key];
          }
        }
      }
    }
    params.args.where.tenantId = tenantId;
  }

  // ── Create / upsert: inject tenantId ──────────────────────────────────
  if (params.action === 'create') {
    params.args.data = params.args.data || {};
    if (params.args.data.tenantId === undefined) {
      params.args.data.tenantId = tenantId;
    }
  }
  if (params.action === 'createMany') {
    params.args.data = (params.args.data || []).map((d) => ({
      tenantId: d.tenantId || tenantId,
      ...d,
    }));
  }
  if (params.action === 'upsert') {
    params.args.create = params.args.create || {};
    if (params.args.create.tenantId === undefined) {
      params.args.create.tenantId = tenantId;
    }
    params.args.where = params.args.where || {};
    params.args.where.tenantId = tenantId;
  }

  return next(params);
});

module.exports = prisma;
