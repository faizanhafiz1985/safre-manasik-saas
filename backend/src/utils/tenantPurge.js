// Shared tenant data-purge logic.
//
// Purges a tenant's OPERATIONAL / TEST data while KEEPING the tenant record,
// its ADMIN users, the built-in system roles, and its settings
// (system_configs / crm_configs). Used by both the SUPER_ADMIN endpoint
// (purge any tenant) and the tenant ADMIN self-service endpoint (purge own
// tenant only).
//
// Each step is independent so a schema edge case on one table can't abort the
// whole purge; returns a per-table map of rows deleted (or a skip message).

function buildPurgeSteps() {
  // Child / join tables (no direct tenantId) — delete via parent join first.
  const joinSteps = [
    ['password_reset_tokens', `DELETE FROM password_reset_tokens t USING users u WHERE t."userId"=u.id AND u."tenantId"=$1 AND u.role <> 'ADMIN'`],
    ['passengers',            `DELETE FROM passengers x USING bookings b WHERE x."bookingId"=b.id AND b."tenantId"=$1`],
    ['booking_transports',    `DELETE FROM booking_transports x USING bookings b WHERE x."bookingId"=b.id AND b."tenantId"=$1`],
    ['booking_caterings',     `DELETE FROM booking_caterings x USING bookings b WHERE x."bookingId"=b.id AND b."tenantId"=$1`],
    ['price_tiers',           `DELETE FROM price_tiers x USING packages p WHERE x."packageId"=p.id AND p."tenantId"=$1`],
    ['package_hotels',        `DELETE FROM package_hotels x USING packages p WHERE x."packageId"=p.id AND p."tenantId"=$1`],
    ['meal_plans',            `DELETE FROM meal_plans x USING catering_vendors v WHERE x."vendorId"=v.id AND v."tenantId"=$1`],
    ['customer_passengers',   `DELETE FROM customer_passengers x USING customers c WHERE x."customerId"=c.id AND c."tenantId"=$1`],
    ['crm_messages',          `DELETE FROM crm_messages x USING crm_conversations c WHERE x."conversationId"=c.id AND c."tenantId"=$1`],
    ['crm_lead_activities',   `DELETE FROM crm_lead_activities x USING crm_leads l WHERE x."leadId"=l.id AND l."tenantId"=$1`],
    ['crm_opportunity_activities', `DELETE FROM crm_opportunity_activities x USING crm_opportunities o WHERE x."opportunityId"=o.id AND o."tenantId"=$1`],
    ['crm_pipeline_stages',   `DELETE FROM crm_pipeline_stages x USING crm_pipelines pp WHERE x."pipelineId"=pp.id AND pp."tenantId"=$1`],
  ];
  // Tenant-scoped tables (have tenantId) — operational/test data.
  const directTables = [
    'fleet_cash_logs', 'fleet_maintenance', 'fleet_trips',
    'voucher_invoices', 'form_vouchers',
    'crm_notifications', 'crm_tasks', 'crm_opportunities', 'crm_leads',
    'crm_conversations', 'crm_pipelines', 'crm_automation_rules', 'crm_integrations',
    'payments', 'invoices', 'vouchers',
    'bookings', 'packages', 'routes', 'vehicles', 'catering_vendors', 'customers', 'hotels',
  ];
  const directSteps = directTables.map((t) => [t, `DELETE FROM ${t} WHERE "tenantId"=$1`]);
  // Finally: test users (non-admins) and custom (non-system) roles.
  const finalSteps = [
    ['role_permissions', `DELETE FROM role_permissions rp USING tenant_roles tr WHERE rp."roleId"=tr.id AND tr."tenantId"=$1 AND tr."isSystem"=false`],
    ['users',            `DELETE FROM users WHERE "tenantId"=$1 AND role <> 'ADMIN'`],
    ['tenant_roles',     `DELETE FROM tenant_roles WHERE "tenantId"=$1 AND "isSystem"=false`],
  ];
  return [...joinSteps, ...directSteps, ...finalSteps];
}

// Runs the purge for one tenant. `prisma` is the shared client. Returns a
// per-table results object. Never throws on a single failed step.
async function purgeTenantData(prisma, tenantId) {
  const results = {};
  for (const [label, sql] of buildPurgeSteps()) {
    try {
      const n = await prisma.$executeRawUnsafe(sql, tenantId);
      results[label] = n;
    } catch (e) {
      results[label] = `skipped: ${e.message.split('\n')[0]}`;
    }
  }
  return results;
}

module.exports = { purgeTenantData, buildPurgeSteps };
