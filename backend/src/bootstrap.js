// Idempotent startup bootstrap. Runs once when the server boots.
// Currently ensures a SUPER_ADMIN user exists in production.
//
// Controlled by env vars:
//   SUPERADMIN_EMAIL          — defaults to superadmin@safremanasik.com
//   SUPERADMIN_PASSWORD       — used ONLY to create the user on first boot.
//                               Changing this var does NOT change an existing
//                               password — use the in-app Change Password UI
//                               or set SUPERADMIN_FORCE_RESET=true for that.
//   SUPERADMIN_FORCE_RESET    — set to "true" to force-overwrite the existing
//                               SUPER_ADMIN password from SUPERADMIN_PASSWORD
//                               (recovery mode). Remove the var after resetting
//                               so normal password changes persist across deploys.
//
// Safe to leave on long-term: only creates the user if no SUPER_ADMIN exists.
// Password changes made via the app UI are never overwritten on restart.

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const logger = require('./config/logger');

const prisma = new PrismaClient();

async function ensureSuperAdmin() {
  try {
    const email = process.env.SUPERADMIN_EMAIL || 'superadmin@safremanasik.com';
    const password = process.env.SUPERADMIN_PASSWORD;
    const forceReset = process.env.SUPERADMIN_FORCE_RESET === 'true';

    // Use raw queries to bypass tenant middleware
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, email FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1`
    );

    if (existing && existing.length > 0) {
      if (forceReset && password) {
        // Explicit recovery mode: operator set SUPERADMIN_FORCE_RESET=true.
        // Overwrite the DB password with the env var value so the operator
        // can regain access after a forgotten password.
        // IMPORTANT: Remove SUPERADMIN_FORCE_RESET from Railway env vars after
        // resetting, otherwise every restart will keep overwriting the password.
        const hash = await bcrypt.hash(password, 12);
        await prisma.$executeRawUnsafe(
          `UPDATE users SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
          hash,
          existing[0].id
        );
        logger.warn(`[bootstrap] SUPER_ADMIN password FORCE-RESET from env var for ${existing[0].email}. Remove SUPERADMIN_FORCE_RESET env var after this deploy.`);
      } else {
        // Normal operation: SUPER_ADMIN already exists, leave their password alone.
        // Password changes made via the in-app UI will persist across restarts.
        logger.info(`[bootstrap] SUPER_ADMIN already exists: ${existing[0].email}`);
      }
      return;
    }

    if (!password) {
      logger.warn(
        '[bootstrap] No SUPER_ADMIN exists and SUPERADMIN_PASSWORD env var is not set — skipping creation.'
      );
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    await prisma.$executeRawUnsafe(
      `INSERT INTO users (id, name, email, password, role, "tenantId", "isActive", "customerType", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, 'SUPER_ADMIN', NULL, true, 'B2C', NOW(), NOW())`,
      'Platform Super Admin',
      email,
      hash
    );
    logger.info(`[bootstrap] SUPER_ADMIN created: ${email}`);
  } catch (err) {
    logger.error(`[bootstrap] ensureSuperAdmin failed: ${err.message}`);
  }
}

async function ensurePlanConfigs() {
  try {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT plan FROM plan_configs`
    );
    const have = new Set((existing || []).map((r) => r.plan));

    // Defaults — SUPER_ADMIN can edit these later via the API.
    // Feature keys are open-ended; add new ones any time.
    const defaults = [
      {
        plan: 'STARTER',
        displayName: 'Starter',
        description: 'For small agencies just getting started.',
        defaultMaxUsers: 5,
        defaultMaxBookings: 50,
        features: { pdfVouchers: false, reports: false, apiAccess: false, customBranding: false },
        priceMonthly: 29.0,
      },
      {
        plan: 'GROWTH',
        displayName: 'Growth',
        description: 'For growing agencies with multiple staff.',
        defaultMaxUsers: 25,
        defaultMaxBookings: 500,
        features: { pdfVouchers: true, reports: true, apiAccess: false, customBranding: false },
        priceMonthly: 99.0,
      },
      {
        plan: 'ENTERPRISE',
        displayName: 'Enterprise',
        description: 'For large agencies and multi-branch operations.',
        defaultMaxUsers: 9999,
        defaultMaxBookings: 99999,
        features: { pdfVouchers: true, reports: true, apiAccess: true, customBranding: true },
        priceMonthly: 299.0,
      },
    ];

    for (const cfg of defaults) {
      if (have.has(cfg.plan)) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO plan_configs
           (id, plan, "displayName", description, "defaultMaxUsers", "defaultMaxBookings",
            features, "priceMonthly", "priceCurrency", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1::"TenantPlan", $2, $3, $4, $5, $6::jsonb, $7, 'SAR', true, NOW(), NOW())`,
        cfg.plan,
        cfg.displayName,
        cfg.description,
        cfg.defaultMaxUsers,
        cfg.defaultMaxBookings,
        JSON.stringify(cfg.features),
        cfg.priceMonthly
      );
      logger.info(`[bootstrap] PlanConfig created: ${cfg.plan}`);
    }
  } catch (err) {
    logger.error(`[bootstrap] ensurePlanConfigs failed: ${err.message}`);
  }
}

async function runBootstrap() {
  logger.info('[bootstrap] Running startup tasks...');
  await ensureSuperAdmin();
  await ensurePlanConfigs();
  logger.info('[bootstrap] Startup tasks complete.');
}

module.exports = { runBootstrap };
