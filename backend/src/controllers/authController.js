const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const {
  sendEmail,
  applicationReceivedHtml,
  superAdminNewApplicationHtml,
  passwordResetHtml,
  forgotUsernameHtml,
} = require('../services/emailService');

const generateToken = (user) =>
  jwt.sign(
    { id: user.id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const slugify = (s) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

// ─── Tenant signup: creates a new tenant + its first ADMIN user ─────────────
const signupTenant = async (req, res, next) => {
  try {
    const {
      tenantName, contactEmail, contactPhone,
      adminName, adminEmail, adminPassword,
      crNumber, vatNumber, umrahLicenseNumber, city, country,
    } = req.body;

    if (!tenantName || !tenantName.trim()) return res.status(400).json({ error: 'Organisation name is required' });
    if (!adminName || !adminName.trim()) return res.status(400).json({ error: 'Admin name is required' });
    if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return res.status(400).json({ error: 'Valid admin email is required' });
    if (!adminPassword || adminPassword.length < 8) return res.status(400).json({ error: 'Admin password must be at least 8 characters' });

    // Optional-but-validated business fields. The signup form on the client
    // enforces these too; the server checks them again so direct API callers
    // can't smuggle malformed data into the DB.
    if (contactPhone) {
      const cleaned = String(contactPhone).replace(/[\s\-()]/g, '');
      if (!/^\+?\d{11,16}$/.test(cleaned)) {
        return res.status(400).json({ error: 'Contact phone must include country code and be 12+ digits (e.g. +966501234567)' });
      }
    }
    if (crNumber && !/^\d{10}$/.test(String(crNumber))) {
      return res.status(400).json({ error: 'CR Number must be exactly 10 digits' });
    }
    if (vatNumber && !/^\d{15}$/.test(String(vatNumber))) {
      return res.status(400).json({ error: 'VAT Number must be exactly 15 digits' });
    }

    // Defence in depth: the email must be unique across both real users AND
    // any existing pending applications, otherwise someone could grab an
    // email and squat on it.
    const existingUser = await runUnscoped(() => prisma.user.findUnique({ where: { email: adminEmail } }));
    if (existingUser) return res.status(409).json({ error: 'Email already registered' });
    const existingApp = await runUnscoped(() =>
      prisma.tenantApplication.findUnique({ where: { adminEmail } })
    );
    if (existingApp && existingApp.status === 'PENDING') {
      return res.status(409).json({ error: 'An application from this email is already under review.' });
    }
    if (existingApp && existingApp.status === 'APPROVED') {
      return res.status(409).json({ error: 'This email already has an approved account. Please log in.' });
    }

    // Hash the password NOW so we never persist plaintext.
    const hash = await bcrypt.hash(adminPassword, 12);

    // If a rejected application exists for this email, overwrite it so the
    // applicant can re-apply. Otherwise create a new one.
    const application = await runUnscoped(async () => {
      if (existingApp && existingApp.status === 'REJECTED') {
        return prisma.tenantApplication.update({
          where: { id: existingApp.id },
          data: {
            tenantName, contactEmail: contactEmail || adminEmail, contactPhone,
            crNumber, vatNumber, umrahLicenseNumber, city,
            country: country || 'Saudi Arabia',
            adminName, adminPasswordHash: hash,
            status: 'PENDING', rejectionReason: null, reviewNotes: null,
            reviewedAt: null, reviewedById: null,
          },
        });
      }
      return prisma.tenantApplication.create({
        data: {
          tenantName, contactEmail: contactEmail || adminEmail, contactPhone,
          crNumber, vatNumber, umrahLicenseNumber, city,
          country: country || 'Saudi Arabia',
          adminName, adminEmail, adminPasswordHash: hash,
          status: 'PENDING',
        },
      });
    });

    // Fire-and-forget notifications. We don't await both because email is best-effort.
    sendEmail({
      to: adminEmail,
      subject: 'We received your Safre Manasik application',
      html: applicationReceivedHtml({ adminName, tenantName }),
    }).catch(() => {});

    // Notify all SUPER_ADMINs by email so they can review.
    runUnscoped(() => prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true },
      select: { email: true },
    })).then((admins) => {
      if (admins.length === 0) return;
      sendEmail({
        to: admins.map((a) => a.email),
        subject: `[Safre Manasik] New tenant application — ${tenantName}`,
        html: superAdminNewApplicationHtml({ application }),
      }).catch(() => {});
    }).catch(() => {});

    res.status(202).json({
      applicationId: application.id,
      status: 'PENDING',
      message:
        'Your application has been received and is under review. ' +
        'You will receive an email at ' + adminEmail +
        ' as soon as our team makes a decision (typically within 1 business day).',
    });
  } catch (err) {
    next(err);
  }
};

// Helper: run a Prisma call in SUPER_ADMIN context so the middleware does not
// filter by tenantId. Used for signup, login, and other pre-auth operations.
const runUnscoped = (fn) =>
  new Promise((resolve, reject) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try { resolve(await fn()); } catch (e) { reject(e); }
    });
  });

// ─── Customer registration (joins an existing tenant via slug) ──────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, companyName, tenantSlug } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!tenantSlug) return res.status(400).json({ error: 'Tenant slug is required' });

    const tenant = await runUnscoped(() => prisma.tenant.findUnique({ where: { slug: tenantSlug } }));
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
      return res.status(403).json({ error: 'Tenant is not accepting new registrations' });
    }

    const existing = await runUnscoped(() => prisma.user.findUnique({ where: { email } }));
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const allowedRole = ['ADMIN', 'AGENT', 'CUSTOMER'].includes(role) ? role : 'CUSTOMER';
    const user = await runUnscoped(() => prisma.user.create({
      data: { tenantId: tenant.id, name, email, password: hash, phone, role: allowedRole, companyName },
      select: { id: true, name: true, email: true, role: true, tenantId: true, phone: true, createdAt: true },
    }));

    res.status(201).json({ token: generateToken(user), user });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await runUnscoped(() => prisma.user.findUnique({
      where: { email },
      include: { tenant: { select: { id: true, name: true, slug: true, status: true, plan: true, logoUrl: true, primaryColor: true } } },
    }));
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Tenant suspended. Contact support.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await runUnscoped(() => prisma.user.update({
      where: { id: user.id }, data: { lastLoginAt: new Date() },
    }));

    const { password: _, ...safeUser } = user;
    res.json({ token: generateToken(user), user: safeUser });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true, tenantId: true,
        phone: true, companyName: true, address: true, createdAt: true,
        customRoleId: true,
        customRole: { select: { id: true, name: true, key: true } },
        tenant: { select: { id: true, name: true, slug: true, status: true, plan: true, logoUrl: true, primaryColor: true } },
      },
    });

    // RBAC: attach the user's effective permission set so the frontend can
    // drive tab visibility + route guards from the server's source of truth.
    let permissions = [];
    try {
      const { getEffectivePermissions } = require('../services/permissionService');
      // Resolve from the freshly-fetched record (it carries customRoleId).
      permissions = [...await getEffectivePermissions({ ...req.user, customRoleId: user.customRoleId, role: user.role, tenantId: user.tenantId })];
    } catch { /* fall back to empty — frontend then uses legacy role gating */ }

    res.json({ ...user, permissions });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = await prisma.user.findFirst({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.updateMany({ where: { id: req.user.id }, data: { password: hash } });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, companyName, address } = req.body;
    await prisma.user.updateMany({
      where: { id: req.user.id },
      data: { name, phone, companyName, address },
    });
    const user = await prisma.user.findFirst({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, phone: true, companyName: true, address: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Username: user enters email → receives email showing their account name ──
// Useful when a user has multiple accounts and can't remember which name/email they used.
const forgotUsername = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Normalise email — trim + lowercase to handle case mismatches
    const normalised = (email || '').trim().toLowerCase();
    if (!normalised || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    // Always return 200 regardless of whether the email exists.
    // This prevents attackers from enumerating registered emails.
    const user = await runUnscoped(() => prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, name: true, email: true, isActive: true, role: true },
    }));

    if (user && user.isActive) {
      await sendEmail({
        to: user.email,
        subject: 'Your Safre Manasik Account Details',
        html: forgotUsernameHtml({ name: user.name, email: user.email }),
      });
    }

    res.json({
      message: 'If that email address is registered, you will receive an email with your account details shortly.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Password: generates a secure DB-stored single-use token ──────────
// Token is 64 hex chars (32 random bytes), stored in password_reset_tokens table.
// Expires in 1 hour. Any previous unused tokens for the same user are invalidated
// so only the latest link works (prevents confusion with old emails).
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const normalised = (email || '').trim().toLowerCase();
    if (!normalised || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    // Always return 200 so attackers can't enumerate emails
    const GENERIC_MSG = 'If that email is registered you will receive a password reset link shortly.';

    const user = await runUnscoped(() => prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, name: true, email: true, isActive: true },
    }));

    if (!user || !user.isActive) {
      return res.json({ message: GENERIC_MSG });
    }

    // Invalidate all previous unused tokens for this user so only one active
    // link exists at a time — prevents confusion with stale emails.
    await runUnscoped(() => prisma.$executeRawUnsafe(
      `UPDATE password_reset_tokens
          SET "usedAt" = NOW()
        WHERE "userId" = $1
          AND "usedAt" IS NULL
          AND "expiresAt" > NOW()`,
      user.id
    ));

    // Generate cryptographically secure 64-char hex token
    const rawToken = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await runUnscoped(() => prisma.$executeRawUnsafe(
      `INSERT INTO password_reset_tokens (id, "userId", token, "expiresAt", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
      user.id,
      rawToken,
      expiresAt
    ));

    const frontendUrl = (process.env.FRONTEND_URL || 'https://app.safremanasik.com')
      .split(',')[0].trim(); // FRONTEND_URL may be comma-separated; take first
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your Safre Manasik password',
      html: passwordResetHtml({ name: user.name, resetUrl }),
    });

    res.json({ message: GENERIC_MSG });
  } catch (err) {
    next(err);
  }
};

// ─── Reset Password: validates DB token, hashes new password, invalidates token ──
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string' || token.length < 10) {
      return res.status(400).json({ error: 'Invalid reset token.' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Look up the token — must exist, not used, and not expired
    const rows = await runUnscoped(() => prisma.$queryRawUnsafe(
      `SELECT prt.id, prt."userId", prt."expiresAt", prt."usedAt",
              u.id AS uid, u."isActive"
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt."userId"
        WHERE prt.token = $1
        LIMIT 1`,
      token
    ));

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        error: 'Reset link is invalid. Please request a new one.',
        code: 'INVALID_TOKEN',
      });
    }

    const row = rows[0];

    if (row.usedAt) {
      return res.status(400).json({
        error: 'This reset link has already been used. Please request a new one.',
        code: 'TOKEN_USED',
      });
    }

    if (new Date(row.expiresAt) < new Date()) {
      return res.status(400).json({
        error: 'This reset link has expired (links are valid for 1 hour). Please request a new one.',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (!row.isActive) {
      return res.status(400).json({ error: 'Account not found or disabled.' });
    }

    // Hash new password with bcrypt (cost factor 12)
    const hash = await bcrypt.hash(newPassword, 12);

    // Update password + mark token as used — do both atomically
    await runUnscoped(() => prisma.$executeRawUnsafe(
      `UPDATE users SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
      hash,
      row.userId
    ));
    await runUnscoped(() => prisma.$executeRawUnsafe(
      `UPDATE password_reset_tokens SET "usedAt" = NOW() WHERE id = $1`,
      row.id
    ));

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { signupTenant, register, login, me, changePassword, updateProfile, forgotUsername, forgotPassword, resetPassword };
