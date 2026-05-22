const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');

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

    const existingUser = await runUnscoped(() => prisma.user.findUnique({ where: { email: adminEmail } }));
    if (existingUser) return res.status(409).json({ error: 'Email already registered' });

    let slug = slugify(tenantName);
    let suffix = 0;
    while (true) {
      const exists = await runUnscoped(() => prisma.tenant.findUnique({ where: { slug: suffix ? `${slug}-${suffix}` : slug } }));
      if (!exists) break;
      suffix++;
    }
    if (suffix) slug = `${slug}-${suffix}`;

    const hash = await bcrypt.hash(adminPassword, 12);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const result = await runUnscoped(() =>
      prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug, name: tenantName, contactEmail: contactEmail || adminEmail, contactPhone,
            crNumber, vatNumber, umrahLicenseNumber, city, country: country || 'Saudi Arabia',
            status: 'TRIAL', trialEndsAt,
          },
        });
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: adminName, email: adminEmail, password: hash,
            role: 'ADMIN', phone: contactPhone, companyName: tenantName,
            crNumber, vatNumber,
          },
        });
        return { tenant, user };
      })
    );

    const { password: _, ...safeUser } = result.user;
    res.status(201).json({
      token: generateToken(result.user),
      user: safeUser,
      tenant: result.tenant,
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
        tenant: { select: { id: true, name: true, slug: true, status: true, plan: true, logoUrl: true, primaryColor: true } },
      },
    });
    res.json(user);
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

module.exports = { signupTenant, register, login, me, changePassword, updateProfile };
