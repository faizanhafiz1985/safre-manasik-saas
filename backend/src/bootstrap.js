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

// The standalone Customer directory was retired — customers are now CUSTOMER-role
// Users (the same records bookings use). Drop the orphaned tables. Idempotent:
// DROP ... IF EXISTS is a no-op once they're gone.
async function dropLegacyCustomerTables() {
  try {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS customer_passengers CASCADE`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS customers CASCADE`);
    logger.info('[bootstrap] legacy customers + customer_passengers tables removed');
  } catch (err) {
    logger.error(`[bootstrap] dropLegacyCustomerTables failed: ${err.message}`);
  }
}

// Mobile: device push tokens + rotating refresh tokens (idempotent).
async function ensureMobileTables() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS devices (
        id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"  VARCHAR(36)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "userId"    VARCHAR(36)  NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
        token       TEXT         NOT NULL UNIQUE,
        platform    VARCHAR(12)  NOT NULL DEFAULT 'android',
        "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_devices_user ON devices("userId")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"  VARCHAR(36),
        "userId"    VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "tokenHash" VARCHAR(64)  NOT NULL UNIQUE,
        "expiresAt" TIMESTAMPTZ  NOT NULL,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    // tenantId is nullable (platform/superadmin users have no tenant). Drop the
    // NOT NULL if an earlier deploy created the column as NOT NULL.
    await prisma.$executeRawUnsafe(`ALTER TABLE refresh_tokens ALTER COLUMN "tenantId" DROP NOT NULL`).catch(() => {});
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens("userId")`);
    logger.info('[bootstrap] devices + refresh_tokens tables ready');
  } catch (err) {
    logger.error(`[bootstrap] ensureMobileTables failed: ${err.message}`);
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
    // Multi-trip support: JSON array of trips (hotel or transport) on a voucher.
    await prisma.$executeRawUnsafe(`ALTER TABLE form_vouchers ADD COLUMN IF NOT EXISTS trips JSONB`);
    // VAT rate snapshot (from SystemConfig vat_percentage at issue time).
    await prisma.$executeRawUnsafe(`ALTER TABLE form_vouchers ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,4)`);
    // Payment tracking on direct vouchers (set only via the audited endpoint).
    await prisma.$executeRawUnsafe(`ALTER TABLE form_vouchers ADD COLUMN IF NOT EXISTS "paymentStatus" VARCHAR(12) NOT NULL DEFAULT 'UNPAID'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE form_vouchers ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ`);
    await prisma.$executeRawUnsafe(`ALTER TABLE form_vouchers ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(32)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE form_vouchers ADD COLUMN IF NOT EXISTS "paymentRef" TEXT`);
    // Unified customer registry link (CUSTOMER-role User id; no FK by design).
    await prisma.$executeRawUnsafe(`ALTER TABLE form_vouchers ADD COLUMN IF NOT EXISTS "customerId" VARCHAR(36)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fv_tenant_customer ON form_vouchers("tenantId", "customerId")`);
    logger.info('[bootstrap] hotels.pricePerNight + form_vouchers (+trips,+payment,+customerId) table ready');
  } catch (err) {
    logger.error(`[bootstrap] ensureVoucherFormTables failed: ${err.message}`);
  }
}

async function ensureInvoiceTables() {
  try {
    // Proforma / Actual invoices generated from direct vouchers.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS voucher_invoices (
        id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"    VARCHAR(36)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "voucherId"   VARCHAR(36)  NOT NULL REFERENCES form_vouchers(id) ON DELETE CASCADE,
        "docType"     VARCHAR(12)  NOT NULL,
        number        VARCHAR(32)  NOT NULL,
        status        VARCHAR(12)  NOT NULL DEFAULT 'ACTIVE',
        subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0,
        "vatRate"     DECIMAL(5,4),
        "vatAmount"   DECIMAL(12,2) NOT NULL DEFAULT 0,
        "grandTotal"  DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency      VARCHAR(8)   NOT NULL DEFAULT 'SAR',
        snapshot      JSONB,
        "createdById" VARCHAR(36),
        "cancelledAt" TIMESTAMPTZ,
        "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_voucher_invoice_number UNIQUE ("tenantId", number)
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_vi_voucher ON voucher_invoices("voucherId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_vi_tenant_type ON voucher_invoices("tenantId","docType")`);

    // Atomic per-tenant, per-month document number counter.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS doc_sequences (
        "tenantId"  VARCHAR(36) NOT NULL,
        "docType"   VARCHAR(16) NOT NULL,
        period      VARCHAR(6)  NOT NULL,
        "lastSeq"   INTEGER     NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("tenantId", "docType", period)
      )
    `);
    logger.info('[bootstrap] voucher_invoices + doc_sequences tables ready');
  } catch (err) {
    logger.error(`[bootstrap] ensureInvoiceTables failed: ${err.message}`);
  }
}

async function ensureBookingColumns() {
  try {
    // Package is now optional on a booking — relax the legacy NOT NULL.
    await prisma.$executeRawUnsafe(`ALTER TABLE bookings ALTER COLUMN "packageId" DROP NOT NULL`);
    // Operational tracking flags on transport runs (schedule/transport reports).
    await prisma.$executeRawUnsafe(`ALTER TABLE booking_transports ADD COLUMN IF NOT EXISTS "departureDone" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE booking_transports ADD COLUMN IF NOT EXISTS "transportAvailed" BOOLEAN NOT NULL DEFAULT false`);
    // Direct-Voucher-style itinerary line-items on bookings (hotel + transport).
    await prisma.$executeRawUnsafe(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "hotelTrips" JSONB`);
    await prisma.$executeRawUnsafe(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "transportTrips" JSONB`);
    logger.info('[bootstrap] bookings.packageId nullable + booking_transports tracking flags ready');
  } catch (err) {
    logger.error(`[bootstrap] ensureBookingColumns failed: ${err.message}`);
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
      for (const key of ['ADMIN', 'AGENT', 'CUSTOMER', 'DRIVER']) {
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

async function ensurePlatformCostTables() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_costs (
        id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name              TEXT         NOT NULL,
        category          TEXT,
        url               TEXT,
        "monthlyCost"     DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency          VARCHAR(8)   NOT NULL DEFAULT 'USD',
        "billingCycle"    VARCHAR(12)  NOT NULL DEFAULT 'MONTHLY',
        "nextDueDate"     TIMESTAMPTZ,
        "lastPaymentDate" TIMESTAMPTZ,
        "autoRenew"       BOOLEAN      NOT NULL DEFAULT true,
        notes             TEXT,
        "isActive"        BOOLEAN      NOT NULL DEFAULT true,
        "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_payments (
        id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "platformCostId" VARCHAR(36)  NOT NULL REFERENCES platform_costs(id) ON DELETE CASCADE,
        amount           DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency         VARCHAR(8)   NOT NULL DEFAULT 'USD',
        "paidAt"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "periodLabel"    VARCHAR(16),
        method           VARCHAR(32),
        reference        TEXT,
        notes            TEXT,
        "createdById"    VARCHAR(36),
        "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_pp_cost ON platform_payments("platformCostId")`);

    // Seed the known platform stack once (only if table is empty). Costs/dates
    // are sensible editable defaults — the SUPER_ADMIN adjusts them to reality.
    const existing = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM platform_costs`);
    if ((existing[0]?.n ?? 0) === 0) {
      const now = new Date();
      const firstNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const seed = [
        ['Railway',    'Hosting',    'https://railway.app',          20.00, 'MONTHLY'],
        ['Dynadot',    'Domain',     'https://www.dynadot.com',       1.00, 'YEARLY'],
        ['Cloudflare', 'CDN / DNS',  'https://dash.cloudflare.com',   0.00, 'MONTHLY'],
        ['Resend',     'Email',      'https://resend.com',           20.00, 'MONTHLY'],
        ['GitHub',     'Code / CI',  'https://github.com',            0.00, 'MONTHLY'],
        ['Sentry',     'Monitoring', 'https://sentry.io',             0.00, 'MONTHLY'],
        ['PayPal',     'Payments',   'https://www.paypal.com',        0.00, 'USAGE'],
      ];
      for (const [name, category, url, cost, cycle] of seed) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO platform_costs (id, name, category, url, "monthlyCost", currency, "billingCycle", "nextDueDate")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'USD', $5, $6)`,
          name, category, url, cost, cycle, cycle === 'USAGE' ? null : firstNextMonth
        );
      }
      logger.info(`[bootstrap] Seeded ${seed.length} platform cost rows`);
    }
    logger.info('[bootstrap] platform_costs + platform_payments tables ready');
  } catch (err) {
    logger.error(`[bootstrap] ensurePlatformCostTables failed: ${err.message}`);
  }
}

async function ensureFleetTables() {
  try {
    // Vehicle type is now a free, configurable string — migrate the legacy enum
    // column to varchar (idempotent; safe to run if already varchar).
    try { await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ALTER COLUMN "type" TYPE VARCHAR(40) USING "type"::text`); } catch (e) { logger.warn(`[bootstrap] vehicle type->varchar: ${e.message}`); }
    // Fleet columns on existing vehicles table (idempotent).
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "driverIqama" VARCHAR(10)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "driverId" VARCHAR(36)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "currentOdometer" INTEGER NOT NULL DEFAULT 0`);
    // Initial odometer (admin-editable baseline). One-time backfill from the
    // current odometer when the column is first added, so existing vehicles
    // keep their reading (current = initial until new trips accumulate).
    const hadInitial = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='initialOdometer'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "initialOdometer" INTEGER NOT NULL DEFAULT 0`);
    if (!hadInitial.length) {
      await prisma.$executeRawUnsafe(`UPDATE vehicles SET "initialOdometer" = "currentOdometer"`);
      logger.info('[bootstrap] backfilled vehicles.initialOdometer from currentOdometer');
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "oilChangeIntervalKm" INTEGER NOT NULL DEFAULT 5000`);
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "lastOilChangeOdometer" INTEGER NOT NULL DEFAULT 0`);
    // Compliance document expiry dates + Nusuk flag + alert/confirmation tracking.
    for (const col of ['istimaraExpiry', 'iqamaExpiry', 'kartashkeelExpiry', 'licenseExpiry', 'bathakaSaicExpiry', 'ajeerExpiry', 'tameenExpiry', 'fahasExpiry', 'docsConfirmedAt']) {
      await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "${col}" TIMESTAMPTZ`);
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "nusuk" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "docAlertState" JSONB`);
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "docReviewPending" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "docsConfirmedById" VARCHAR(36)`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS fleet_trips (
        id            VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"    VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "vehicleId"   VARCHAR(36) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        "driverId"    VARCHAR(36),
        "driverName"  TEXT,
        status        VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS',
        "startedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "endedAt"     TIMESTAMPTZ,
        "startLat"    DECIMAL(10,6), "startLng" DECIMAL(10,6), "startLabel" TEXT,
        "endLat"      DECIMAL(10,6), "endLng"   DECIMAL(10,6), "endLabel"   TEXT,
        "startOdometer" INTEGER, "endOdometer" INTEGER,
        "distanceKm"  DECIMAL(10,2) NOT NULL DEFAULT 0,
        "routePoints" JSONB,
        purpose       TEXT, notes TEXT,
        "createdById" VARCHAR(36),
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ft_tenant_date ON fleet_trips("tenantId","startedAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ft_vehicle ON fleet_trips("vehicleId")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS fleet_cash_logs (
        id            VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"    VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "vehicleId"   VARCHAR(36) REFERENCES vehicles(id) ON DELETE SET NULL,
        "driverId"    VARCHAR(36), "driverName" TEXT,
        "tripId"      VARCHAR(36) REFERENCES fleet_trips(id) ON DELETE SET NULL,
        amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency      VARCHAR(8) NOT NULL DEFAULT 'SAR',
        "logDate"     TIMESTAMPTZ NOT NULL,
        "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes         TEXT, "createdById" VARCHAR(36),
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fc_tenant_date ON fleet_cash_logs("tenantId","logDate")`);
    // Expense column on cash logs (net total = amount - expense). Idempotent.
    await prisma.$executeRawUnsafe(`ALTER TABLE fleet_cash_logs ADD COLUMN IF NOT EXISTS "expense" DECIMAL(10,2) NOT NULL DEFAULT 0`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS fleet_maintenance (
        id                VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId"        VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "vehicleId"       VARCHAR(36) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        type              VARCHAR(16) NOT NULL DEFAULT 'OIL_CHANGE',
        status            VARCHAR(16) NOT NULL DEFAULT 'PENDING',
        "dueAtOdometer"   INTEGER,
        "performedAt"     TIMESTAMPTZ, "performedOdometer" INTEGER,
        "confirmedById"   VARCHAR(36), "confirmedByName" TEXT,
        notes             TEXT,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fm_tenant_vehicle ON fleet_maintenance("tenantId","vehicleId")`);
    // Receipt evidence on maintenance confirmations (after table exists).
    await prisma.$executeRawUnsafe(`ALTER TABLE fleet_maintenance ADD COLUMN IF NOT EXISTS "receiptName" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE fleet_maintenance ADD COLUMN IF NOT EXISTS "receiptData" TEXT`);
    logger.info('[bootstrap] fleet tables (+vehicle odometer cols) ready');
  } catch (err) {
    logger.error(`[bootstrap] ensureFleetTables failed: ${err.message}`);
  }
}

// Backfill the unified customer registry for direct vouchers that predate the
// write-time sync (or whose best-effort sync failed). For every FormVoucher with
// no linked customer but a usable mobile, find or create a CUSTOMER-role User in
// the same tenant and set the voucher's customerId — so voucher customers show
// up in the Customers tab. Idempotent and self-limiting (once linked, a voucher
// is skipped forever). Mirrors resolveVoucherCustomer() in formVoucherController.
async function ensureVoucherCustomerBackfill() {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, "tenantId", "firstName", "lastName", "companyName", mobile
      FROM form_vouchers
      WHERE "customerId" IS NULL AND mobile IS NOT NULL AND mobile <> ''
    `);
    if (!rows.length) { logger.info('[bootstrap] voucher customer backfill: nothing to do'); return; }

    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');
    let linked = 0, created = 0;

    for (const v of rows) {
      try {
        const mobile = String(v.mobile).replace(/\s/g, '');
        if (!mobile) continue;

        // Same mobile = same customer, scoped to the voucher's tenant.
        const existing = await prisma.$queryRawUnsafe(
          `SELECT id FROM users WHERE "tenantId" = $1 AND role = 'CUSTOMER' AND phone = $2 LIMIT 1`,
          v.tenantId, mobile,
        );
        let customerId = existing[0]?.id;

        if (!customerId) {
          const name = `${(v.firstName || '').trim()} ${(v.lastName || '').trim()}`.trim() || 'Customer';
          const company = v.companyName ? String(v.companyName).trim() : null;
          const password = await bcrypt.hash(crypto.randomBytes(12).toString('base64url'), 12);
          const insertUser = async (email) => prisma.$queryRawUnsafe(
            `INSERT INTO users (id, name, email, password, role, "tenantId", phone, "companyName", "isActive", "customerType", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, 'CUSTOMER', $4, $5, $6, true, 'B2C', NOW(), NOW())
             RETURNING id`,
            name, email, password, v.tenantId, mobile, company,
          );
          try {
            const ins = await insertUser(`c${mobile}@customers.safremanasik.com`);
            customerId = ins[0].id; created++;
          } catch (e) {
            // Email is globally unique — clash (same mobile in another tenant) → random suffix.
            const ins = await insertUser(`c${mobile}.${crypto.randomBytes(3).toString('hex')}@customers.safremanasik.com`);
            customerId = ins[0].id; created++;
          }
        }

        await prisma.$executeRawUnsafe(`UPDATE form_vouchers SET "customerId" = $1 WHERE id = $2`, customerId, v.id);
        linked++;
      } catch (rowErr) {
        // One bad row must not abort the whole backfill — log and move on.
        logger.warn(`[bootstrap] voucher customer backfill: skipped voucher ${v.id}: ${rowErr.message}`);
      }
    }
    logger.info(`[bootstrap] voucher customer backfill: linked ${linked} voucher(s), created ${created} new customer(s)`);
  } catch (err) {
    logger.error(`[bootstrap] ensureVoucherCustomerBackfill failed: ${err.message}`);
  }
}

async function runBootstrap() {
  logger.info('[bootstrap] Running startup tasks...');
  await purgeAllTenantsIfRequested(); // runs only if PURGE_ALL_TENANTS=true
  await ensureSuperAdmin();
  await ensurePlanConfigs();
  await ensurePasswordResetTokensTable();
  await dropLegacyCustomerTables();
  await ensureMobileTables();
  await ensureVoucherFormTables();
  await ensureInvoiceTables();
  await ensureBookingColumns();
  await ensureRbacTables();
  await ensurePlatformCostTables();
  await ensureFleetTables();
  await ensureVoucherCustomerBackfill();
  logger.info('[bootstrap] Startup tasks complete.');
}

module.exports = { runBootstrap };
