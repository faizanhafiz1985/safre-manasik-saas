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

async function ensurePasswordResetTokensTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId"    VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token       VARCHAR(128) UNIQUE NOT NULL,
        "expiresAt" TIMESTAMPTZ  NOT NULL,
        "usedAt"    TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_prt_token   ON password_reset_tokens(token)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens("userId")`);
    logger.info('[bootstrap] password_reset_tokens table ready');
  } catch (err) {
    logger.error(`[bootstrap] ensurePasswordResetTokensTable failed: ${err.message}`);
  }
}

async function ensureCustomerTables() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS customers (
        id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"        VARCHAR(36)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        type              VARCHAR(8)   NOT NULL DEFAULT 'B2C',
        "firstName"       TEXT         NOT NULL,
        "lastName"        TEXT         NOT NULL,
        mobile            VARCHAR(20)  NOT NULL,
        whatsapp          VARCHAR(20)  NOT NULL,
        passport          TEXT,
        email             TEXT,
        gender            VARCHAR(10),
        "companyName"     TEXT,
        "crNumber"        VARCHAR(10),
        "nationalAddress" TEXT,
        "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers("tenantId")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS customer_passengers (
        id           VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"   VARCHAR(36)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "customerId" VARCHAR(36)  NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        "firstName"  TEXT         NOT NULL,
        "lastName"   TEXT         NOT NULL,
        mobile       VARCHAR(20),
        whatsapp     VARCHAR(20),
        passport     TEXT,
        email        TEXT,
        gender       VARCHAR(10),
        "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cust_pax_tenant   ON customer_passengers("tenantId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_cust_pax_customer ON customer_passengers("customerId")`);
    logger.info('[bootstrap] customers + customer_passengers tables ready');
  } catch (err) {
    logger.error(`[bootstrap] ensureCustomerTables failed: ${err.message}`);
  }
}

async function ensureVoucherFormTables() {
  try {
    // Add the selling-price column to the existing hotels table (idempotent).
    // We use ALTER ... ADD COLUMN IF NOT EXISTS instead of a Prisma migration so
    // the live DB stays in sync without running `prisma db push` on deploy.
    await prisma.$executeRawUnsafe(`ALTER TABLE hotels ADD COLUMN IF NOT EXISTS "pricePerNight" DECIMAL(10,2)`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS form_vouchers (
        id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"        VARCHAR(36)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "voucherNo"       VARCHAR(32)  NOT NULL,
        type              VARCHAR(12)  NOT NULL,
        status            VARCHAR(12)  NOT NULL DEFAULT 'TENTATIVE',
        hcn               VARCHAR(64),
        "companyName"     TEXT,
        "firstName"       TEXT         NOT NULL,
        "lastName"        TEXT         NOT NULL,
        mobile            VARCHAR(20)  NOT NULL,
        whatsapp          VARCHAR(20),
        passport          TEXT         NOT NULL,
        "hotelId"         VARCHAR(36),
        "hotelName"       TEXT,
        "checkInDate"     TIMESTAMPTZ,
        "checkOutDate"    TIMESTAMPTZ,
        "perNightPrice"   DECIMAL(10,2),
        "vehicleType"     TEXT,
        "pickupLocation"  TEXT,
        "dropoffLocation" TEXT,
        "travelDate"      TIMESTAMPTZ,
        "passengerCount"  INTEGER,
        "transportPrice"  DECIMAL(10,2),
        "totalValue"      DECIMAL(12,2),
        "createdById"     VARCHAR(36),
        "confirmedById"   VARCHAR(36),
        "modifiedById"    VARCHAR(36),
        "confirmedAt"     TIMESTAMPTZ,
        "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_form_voucher_no UNIQUE ("tenantId", "voucherNo")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fv_tenant ON form_vouchers("tenantId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fv_status ON form_vouchers("tenantId", status)`);
    // Multi-trip support: JSON array of hotel trips on a single voucher.
    await prisma.$executeRawUnsafe(`ALTER TABLE form_vouchers ADD COLUMN IF NOT EXISTS trips JSONB`);
    logger.info('[bootstrap] hotels.pricePerNight + form_vouchers (+trips) table ready');
  } catch (err) {
    logger.error(`[bootstrap] ensureVoucherFormTables failed: ${err.message}`);
  }
}

async function ensureRbacTables() {
  const { DEFAULT_PERMISSIONS } = require('./config/permissions');
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tenant_roles (
        id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"  VARCHAR(36)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        key         VARCHAR(64)  NOT NULL,
        name        TEXT         NOT NULL,
        description TEXT,
        "isSystem"  BOOLEAN      NOT NULL DEFAULT false,
        "isActive"  BOOLEAN      NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_tenant_role_key UNIQUE ("tenantId", key)
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_tenant_roles_tenant ON tenant_roles("tenantId")`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id         VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId" VARCHAR(36)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "roleId"   VARCHAR(36)  NOT NULL REFERENCES tenant_roles(id) ON DELETE CASCADE,
        feature    VARCHAR(64)  NOT NULL,
        action     VARCHAR(16)  NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_role_perm UNIQUE ("roleId", feature, action)
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_role_perms_tenant ON role_permissions("tenantId")`);
    await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "customRoleId" VARCHAR(36) REFERENCES tenant_roles(id) ON DELETE SET NULL`);

    // Seed the three built-in system roles + their default grants for every
    // tenant that doesn't have them yet (idempotent, runs on each boot).
    const tenants = await prisma.$queryRawUnsafe(`SELECT id FROM tenants`);
    for (const t of tenants) {
      for (const key of ['ADMIN', 'AGENT', 'CUSTOMER']) {
        const existing = await prisma.$queryRawUnsafe(
          `SELECT id FROM tenant_roles WHERE "tenantId" = $1 AND key = $2 LIMIT 1`, t.id, key,
        );
        let roleId = existing[0]?.id;
        if (!roleId) {
          const ins = await prisma.$queryRawUnsafe(
            `INSERT INTO tenant_roles (id, "tenantId", key, name, "isSystem", "isActive", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, true, true, NOW(), NOW()) RETURNING id`,
            t.id, key, key.charAt(0) + key.slice(1).toLowerCase(),
          );
          roleId = ins[0].id;
          // Seed default grants for this fresh system role
          for (const p of DEFAULT_PERMISSIONS[key]) {
            const [feature, action] = p.split(':');
            await prisma.$executeRawUnsafe(
              `INSERT INTO role_permissions (id, "tenantId", "roleId", feature, action, "createdAt")
               VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
               ON CONFLICT ("roleId", feature, action) DO NOTHING`,
              t.id, roleId, feature, action,
            );
          }
        }
      }
    }
    logger.info('[bootstrap] RBAC tables + per-tenant system roles ready');
  } catch (err) {
    logger.error(`[bootstrap] ensureRbacTables failed: ${err.message}`);
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

/**
 * Purges ALL tenant data when PURGE_ALL_TENANTS=true is set.
 *
 * Safe-guards:
 *   - Only runs if PURGE_ALL_TENANTS env var is exactly "true"
 *   - Logs every step
 *   - Does NOT delete SUPER_ADMIN user or PlanConfigs
 *   - Remove the env var from Railway after the purge to prevent re-running
 */
async function purgeAllTenantsIfRequested() {
  if (process.env.PURGE_ALL_TENANTS !== 'true') return;

  logger.warn('[bootstrap] ⚠️  PURGE_ALL_TENANTS=true — starting full tenant purge...');

  try {
    // Count before
    const tenantCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM tenants`);
    const userCount   = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM users WHERE role != 'SUPER_ADMIN'`);
    const bookingCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM bookings`);

    logger.warn(`[bootstrap] About to delete: ${tenantCount[0].n} tenants, ${userCount[0].n} non-superadmin users, ${bookingCount[0].n} bookings (all cascaded data)`);

    // Delete tenant applications
    const appsDeleted = await prisma.$executeRawUnsafe(`DELETE FROM tenant_applications`);
    logger.warn(`[bootstrap] Deleted ${appsDeleted} tenant applications`);

    // Delete all tenants — CASCADE handles all related data automatically:
    // Users, Packages, Bookings, Hotels, Vehicles, Routes, CateringVendors,
    // Vouchers, Payments, Invoices, SystemConfigs, CrmConfig, CrmLeads, etc.
    const tenantsDeleted = await prisma.$executeRawUnsafe(`DELETE FROM tenants`);
    logger.warn(`[bootstrap] Deleted ${tenantsDeleted} tenants (all cascaded data removed)`);

    // Verify SUPER_ADMIN still exists
    const sa = await prisma.$queryRawUnsafe(`SELECT email FROM users WHERE role = 'SUPER_ADMIN'`);
    logger.warn(`[bootstrap] ✅ Purge complete. SUPER_ADMIN preserved: ${sa[0]?.email}`);
    logger.warn(`[bootstrap] ⚠️  REMOVE PURGE_ALL_TENANTS env var from Railway now to prevent re-running on next deploy!`);
  } catch (err) {
    logger.error(`[bootstrap] purgeAllTenants failed: ${err.message}`);
  }
}

async function runBootstrap() {
  logger.info('[bootstrap] Running startup tasks...');
  await purgeAllTenantsIfRequested(); // runs only if PURGE_ALL_TENANTS=true
  await ensureSuperAdmin();
  await ensurePlanConfigs();
  await ensurePasswordResetTokensTable();
  await ensureCustomerTables();
  await ensureVoucherFormTables();
  await ensureRbacTables();
  logger.info('[bootstrap] Startup tasks complete.');
}

module.exports = { runBootstrap };
