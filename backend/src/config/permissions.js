// ── RBAC permission catalog (code-defined, version-controlled) ────────────────
// `feature` keys match the controllable tabs/modules. `plan` ties a feature to a
// PlanConfig feature flag (access also requires the plan to include it).
// `adminOnly` features are governance-sensitive and excluded from custom roles'
// editable surface (only built-in ADMIN gets them).

const FEATURES = {
  dashboard:        { label: 'Dashboard' },
  packages:         { label: 'Packages' },
  bookings:         { label: 'Bookings' },
  vouchers:         { label: 'Vouchers' },
  voucher_forms:    { label: 'Direct Vouchers' },
  hotels:           { label: 'Hotels' },
  transport:        { label: 'Transport' },
  catering:         { label: 'Catering' },
  payments:         { label: 'Payments' },
  customers:        { label: 'Customers' },
  daily_schedule:   { label: 'Daily Schedule', plan: 'reports' },
  transport_report: { label: 'Transport Report', plan: 'reports' },
  crm_overview:     { label: 'CRM Overview', plan: 'crm' },
  crm_leads:        { label: 'CRM Leads', plan: 'crm' },
  crm_pipeline:     { label: 'CRM Pipeline', plan: 'crm' },
  crm_tasks:        { label: 'CRM Tasks', plan: 'crm' },
  crm_inbox:        { label: 'CRM Inbox', plan: 'crm' },
  crm_reports:      { label: 'CRM Reports', plan: 'crm', adminOnly: true },
  crm_settings:     { label: 'CRM Integrations', plan: 'crm', adminOnly: true },
  users:            { label: 'Users', adminOnly: true },
  roles:            { label: 'Roles & Permissions', adminOnly: true },
  tenant_settings:  { label: 'Tenant Settings', adminOnly: true },
  system_config:    { label: 'System Config', adminOnly: true },
};

const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

const FEATURE_KEYS = Object.keys(FEATURES);

// Every possible permission string "feature:action" (ADMIN / SUPER_ADMIN).
const ALL_PERMISSIONS = (() => {
  const s = new Set();
  for (const f of FEATURE_KEYS) for (const a of ACTIONS) s.add(`${f}:${a}`);
  return s;
})();

const perms = (entries) => {
  const s = new Set();
  for (const [feature, actions] of entries) for (const a of actions) s.add(`${feature}:${a}`);
  return s;
};

// Default permission sets — used both to seed the built-in roles' grants AND as
// the fallback when a user has no customRoleId. Derived from the existing
// route `authorize()` rules + Sidebar role arrays so behaviour is unchanged.
const VIEW_ALL_OPERATIONAL = [
  'dashboard', 'packages', 'bookings', 'vouchers', 'voucher_forms', 'hotels',
  'transport', 'catering', 'payments', 'customers', 'daily_schedule',
  'transport_report', 'crm_overview', 'crm_leads', 'crm_pipeline', 'crm_tasks', 'crm_inbox',
];

const DEFAULT_PERMISSIONS = {
  ADMIN: new Set(ALL_PERMISSIONS),
  AGENT: perms([
    ...VIEW_ALL_OPERATIONAL.map((f) => [f, ['view']]),
    // operational create/edit the agent can perform today
    ['bookings', ['create', 'edit']],
    ['customers', ['create', 'edit']],
    ['voucher_forms', ['create', 'edit']],
    ['vouchers', ['create']],          // POST /vouchers/generate (plan-gated)
    ['payments', ['create']],
    ['daily_schedule', ['export']],    // CSV export routes
    ['transport_report', ['export']],
    ['crm_leads', ['create', 'edit']],
    ['crm_tasks', ['create', 'edit']],
    ['crm_pipeline', ['create', 'edit']],
    ['crm_inbox', ['create', 'edit']],
  ]),
  // Customers can READ these modules today (GET routes are open to any
  // authenticated tenant user), so the defaults grant view to avoid any
  // regression. Admins can tighten this with a custom role.
  CUSTOMER: perms([
    ['dashboard', ['view']],
    ['packages', ['view']],
    ['bookings', ['view']],
    ['vouchers', ['view']],
    ['hotels', ['view']],
    ['transport', ['view']],
    ['catering', ['view']],
    ['payments', ['view']],
  ]),
};

module.exports = { FEATURES, ACTIONS, FEATURE_KEYS, ALL_PERMISSIONS, DEFAULT_PERMISSIONS };
