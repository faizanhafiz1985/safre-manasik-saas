// System diagnostics for SUPER_ADMIN. Self-contained — does not write to the
// DB, only reads. Safe to call any time, including when the system is sick.

const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const { CONFIGURED: SMTP_CONFIGURED, sendEmail } = require('../services/emailService');
const { envConfigured: PAYPAL_PLATFORM_CONFIGURED } = require('../services/paypalClient');
const os = require('os');

const unscoped = (fn) =>
  new Promise((resolve, reject) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try { resolve(await fn()); } catch (e) { reject(e); }
    });
  });

function envFlag(name) {
  const v = process.env[name];
  return {
    name,
    set: !!v,
    // For secrets we only return whether they're set + the last 4 chars.
    valuePreview: v ? (v.length > 8 ? `••••${v.slice(-4)}` : '••••') : null,
  };
}

const diagnostics = async (req, res, next) => {
  const startedAt = Date.now();
  const checks = [];

  const pass = (name, info) => checks.push({ name, status: 'pass', ...info });
  const warn = (name, info) => checks.push({ name, status: 'warn', ...info });
  const fail = (name, info) => checks.push({ name, status: 'fail', ...info });

  // 1. Database connectivity
  try {
    const t0 = Date.now();
    const result = await prisma.$queryRawUnsafe('SELECT 1 as ok');
    pass('database.connection', { latencyMs: Date.now() - t0, detail: 'Postgres reachable, SELECT 1 OK' });
  } catch (err) {
    fail('database.connection', { detail: err.message });
  }

  // 2. Required env vars
  const required = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV', 'FRONTEND_URL'];
  for (const name of required) {
    if (process.env[name]) pass(`env.${name}`, { detail: 'set' });
    else fail(`env.${name}`, { detail: 'NOT SET — system may misbehave' });
  }

  // 3. Optional integrations
  if (SMTP_CONFIGURED) pass('email.smtp', { detail: 'SMTP_HOST configured — outgoing email will be sent' });
  else warn('email.smtp', { detail: 'SMTP not configured — emails will be logged but not sent. Set SMTP_HOST/SMTP_USER/SMTP_PASS to enable.' });

  if (PAYPAL_PLATFORM_CONFIGURED) pass('paypal.platform', { detail: 'Platform PayPal fallback configured' });
  else warn('paypal.platform', { detail: 'No platform PayPal — relying on per-tenant credentials (each tenant must wire their own).' });

  if (process.env.SUPERADMIN_PASSWORD) pass('super_admin.bootstrap', { detail: 'SUPERADMIN_PASSWORD env var set — self-heal active' });
  else warn('super_admin.bootstrap', { detail: 'SUPERADMIN_PASSWORD env var not set — password recovery via env will not work' });

  // 4. Table row counts (sanity check)
  try {
    const [tenants, users, bookings, plans, applications] = await unscoped(() =>
      Promise.all([
        prisma.tenant.count(),
        prisma.user.count(),
        prisma.booking.count(),
        prisma.planConfig.count(),
        prisma.tenantApplication.count(),
      ])
    );
    pass('database.tables', {
      detail: `tenants=${tenants}, users=${users}, bookings=${bookings}, planConfigs=${plans}, applications=${applications}`,
    });
    if (plans === 0) {
      fail('plan_configs.seeded', { detail: 'No PlanConfig rows. Bootstrap should have created STARTER/GROWTH/ENTERPRISE — check backend startup logs.' });
    } else if (plans < 3) {
      warn('plan_configs.seeded', { detail: `Only ${plans} plan config(s). Expected 3 (STARTER/GROWTH/ENTERPRISE).` });
    } else {
      pass('plan_configs.seeded', { detail: `${plans} plans configured` });
    }
  } catch (err) {
    fail('database.tables', { detail: `Count query failed: ${err.message}` });
  }

  // 5. SUPER_ADMIN existence
  try {
    const superAdmins = await unscoped(() => prisma.user.count({ where: { role: 'SUPER_ADMIN' } }));
    if (superAdmins === 0) fail('super_admin.exists', { detail: 'No SUPER_ADMIN user — log in is impossible without one. Set SUPERADMIN_PASSWORD env var and restart.' });
    else pass('super_admin.exists', { detail: `${superAdmins} SUPER_ADMIN user(s)` });
  } catch (err) {
    fail('super_admin.exists', { detail: err.message });
  }

  // 6. Pending tenant applications (informational)
  try {
    const pendingCount = await unscoped(() =>
      prisma.tenantApplication.count({ where: { status: 'PENDING' } })
    );
    if (pendingCount > 0) {
      warn('applications.pending', { detail: `${pendingCount} tenant application(s) awaiting review` });
    } else {
      pass('applications.pending', { detail: 'No applications awaiting review' });
    }
  } catch (err) {
    warn('applications.pending', { detail: `Could not check: ${err.message}` });
  }

  // 7. Sentry error monitoring
  if (process.env.SENTRY_DSN) {
    pass('sentry.monitoring', { detail: 'Sentry DSN configured — backend errors are tracked and alerted in real time' });
  } else {
    warn('sentry.monitoring', { detail: 'SENTRY_DSN not set — errors logged to Railway only, no alerting. Set SENTRY_DSN in Railway env vars to enable.' });
  }

  // 8. Process / runtime info
  const uptimeS = Math.floor(process.uptime());
  pass('runtime', {
    detail: `node ${process.version} · uptime ${Math.floor(uptimeS/3600)}h${Math.floor((uptimeS%3600)/60)}m · mem ${Math.round(process.memoryUsage().rss/1024/1024)}MB · cpus ${os.cpus().length}`,
  });

  // Summarise
  const summary = {
    pass: checks.filter((c) => c.status === 'pass').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    fail: checks.filter((c) => c.status === 'fail').length,
  };
  const overall = summary.fail > 0 ? 'unhealthy' : summary.warn > 0 ? 'degraded' : 'healthy';

  res.json({
    overall,
    summary,
    checks,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      // Don't echo any secret values, just whether they're set
      flags: [
        envFlag('DATABASE_URL'),
        envFlag('JWT_SECRET'),
        envFlag('FRONTEND_URL'),
        envFlag('SUPERADMIN_PASSWORD'),
        envFlag('SMTP_HOST'),
        envFlag('SMTP_USER'),
        envFlag('SMTP_PASS'),
        envFlag('PAYPAL_CLIENT_ID'),
        envFlag('PAYPAL_CLIENT_SECRET'),
        envFlag('SENTRY_DSN'),
      ],
    },
  });
};

// SUPER_ADMIN-only: perform a real send and return the provider's exact result
// so we can see WHY emails aren't arriving (e.g. unverified domain). No secrets
// are returned — only whether they're set and a 3-char prefix to identify Resend.
const testEmail = async (req, res, next) => {
  try {
    const to = (req.body && req.body.to && String(req.body.to).trim()) || null;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Provide a valid { "to": "address@example.com" }' });
    }
    const result = await sendEmail({
      to,
      subject: 'Safre Manasik — Email Diagnostic Test',
      html: '<p>This is a diagnostic test email from Safre Manasik.</p><p>If you received this, outgoing email is working correctly.</p>',
    });
    const smtpPass = process.env.SMTP_PASS || '';
    res.json({
      requestedTo: to,
      from: process.env.SMTP_FROM || 'Safre Manasik <noreply@safremanasik.com>',
      transport: {
        usingResendHttpApi: !!(process.env.RESEND_API_KEY || smtpPass.startsWith('re_')),
        smtpHost: process.env.SMTP_HOST || null,
        smtpUser: process.env.SMTP_USER || null,
        smtpPassPrefix: smtpPass ? smtpPass.slice(0, 3) : null,
        resendKeySet: !!process.env.RESEND_API_KEY,
      },
      result, // { ok, mode: 'sent'|'logged', error?, id? }
    });
  } catch (err) { next(err); }
};

module.exports = { diagnostics, testEmail };
