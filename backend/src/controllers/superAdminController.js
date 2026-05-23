const prisma = require('../config/database');
const { invalidatePlanCache, getTenantQuota } = require('../middleware/quota');
const {
  sendEmail,
  applicationApprovedHtml,
  applicationRejectedHtml,
} = require('../services/emailService');

const slugify = (s) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

// All super-admin endpoints run with isSuperAdmin=true in context (set by middleware),
// so the Prisma middleware does not filter by tenantId.

const listTenants = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { contactEmail: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, bookings: true, packages: true } } },
      }),
      prisma.tenant.count({ where }),
    ]);
    // Mask PayPal secrets across the list
    for (const t of tenants) {
      if (t.paypalSecret) t.paypalSecret = '••••••••' + t.paypalSecret.slice(-4);
    }
    res.json({ data: tenants, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

const getTenant = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, bookings: true, packages: true, vehicles: true, hotels: true } },
        users: { select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } },
      },
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    // Never leak the PayPal secret in API responses
    if (tenant.paypalSecret) tenant.paypalSecret = '••••••••' + tenant.paypalSecret.slice(-4);
    res.json(tenant);
  } catch (err) {
    next(err);
  }
};

const updateTenant = async (req, res, next) => {
  try {
    const allowedFields = [
      'name', 'contactEmail', 'contactPhone', 'plan', 'status',
      'maxUsers', 'maxBookings', 'trialEndsAt', 'umrahLicenseNumber',
      'umrahLicenseExpiry', 'crNumber', 'vatNumber',
    ];
    const data = {};
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    if (data.trialEndsAt) data.trialEndsAt = new Date(data.trialEndsAt);
    if (data.umrahLicenseExpiry) data.umrahLicenseExpiry = new Date(data.umrahLicenseExpiry);

    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
};

const suspendTenant = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: 'SUSPENDED' },
    });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
};

const activateTenant = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
    });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
};

const deleteTenant = async (req, res, next) => {
  try {
    // CASCADE delete handles all child rows
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.json({ message: 'Tenant deleted' });
  } catch (err) {
    next(err);
  }
};

const platformStats = async (req, res, next) => {
  try {
    const [
      totalTenants, activeTenants, trialTenants, suspendedTenants,
      totalUsers, totalBookings, totalRevenue,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'TRIAL' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count(),
      prisma.booking.count(),
      prisma.invoice.aggregate({ _sum: { paidAmount: true } }),
    ]);

    const tenantsByPlan = await prisma.tenant.groupBy({
      by: ['plan'],
      _count: { id: true },
    });

    const recentTenants = await prisma.tenant.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true, status: true, plan: true, createdAt: true },
    });

    res.json({
      stats: {
        totalTenants, activeTenants, trialTenants, suspendedTenants,
        totalUsers, totalBookings,
        totalRevenue: Number(totalRevenue._sum.paidAmount || 0),
      },
      tenantsByPlan,
      recentTenants,
    });
  } catch (err) {
    next(err);
  }
};

const allBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, tenantId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = tenantId ? { tenantId } : {};
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { name: true, slug: true } },
          customer: { select: { name: true, email: true } },
          package: { select: { name: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);
    res.json({ data: bookings, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// ─── Plan configuration ───────────────────────────────────────────────────
// These let the SUPER_ADMIN tune what each plan offers (limits + features)
// at runtime, with no code changes.

const listPlans = async (req, res, next) => {
  try {
    const plans = await prisma.planConfig.findMany({ orderBy: { priceMonthly: 'asc' } });
    // Also include current usage stats per plan
    const tenantCounts = await prisma.tenant.groupBy({
      by: ['plan'],
      _count: { id: true },
    });
    const countByPlan = {};
    for (const t of tenantCounts) countByPlan[t.plan] = t._count.id;
    const enriched = plans.map((p) => ({ ...p, tenantCount: countByPlan[p.plan] || 0 }));
    res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const allowedFields = [
      'displayName', 'description', 'defaultMaxUsers', 'defaultMaxBookings',
      'features', 'priceMonthly', 'priceCurrency', 'isActive',
    ];
    const data = {};
    for (const f of allowedFields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    // Basic validation — keep numeric fields sane
    if (data.defaultMaxUsers !== undefined && (typeof data.defaultMaxUsers !== 'number' || data.defaultMaxUsers < 0)) {
      return res.status(400).json({ error: 'defaultMaxUsers must be a non-negative number' });
    }
    if (data.defaultMaxBookings !== undefined && (typeof data.defaultMaxBookings !== 'number' || data.defaultMaxBookings < 0)) {
      return res.status(400).json({ error: 'defaultMaxBookings must be a non-negative number' });
    }
    if (data.features !== undefined && (typeof data.features !== 'object' || Array.isArray(data.features))) {
      return res.status(400).json({ error: 'features must be an object of key->boolean' });
    }
    // Find by plan key (STARTER/GROWTH/ENTERPRISE) in URL
    const updated = await prisma.planConfig.update({
      where: { plan: req.params.plan },
      data,
    });
    invalidatePlanCache();
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Plan not found' });
    next(err);
  }
};

const tenantUsage = async (req, res, next) => {
  try {
    const tenantId = req.params.id;
    const quota = await getTenantQuota(tenantId);
    if (!quota) return res.status(404).json({ error: 'Tenant not found' });
    const [users, bookings] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.booking.count({ where: { tenantId } }),
    ]);
    res.json({
      tenant: quota.tenant,
      plan: quota.plan,
      status: quota.status,
      features: quota.features,
      usage: {
        users: { current: users, max: quota.maxUsers, percent: quota.maxUsers ? Math.round((users / quota.maxUsers) * 100) : 0 },
        bookings: { current: bookings, max: quota.maxBookings, percent: quota.maxBookings ? Math.round((bookings / quota.maxBookings) * 100) : 0 },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Tenant Applications (approval workflow) ──────────────────────────────
// New signups land as TenantApplication rows with status=PENDING. The
// SUPER_ADMIN sees them here and decides. Approval is what actually creates
// the Tenant + ADMIN user; rejection just records the decision and emails the
// applicant.

const listApplications = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { tenantName: { contains: search, mode: 'insensitive' } },
          { adminEmail: { contains: search, mode: 'insensitive' } },
          { adminName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [apps, total, counts] = await Promise.all([
      prisma.tenantApplication.findMany({
        where, skip, take: Number(limit),
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        // Never return the password hash, even to SUPER_ADMIN
        select: {
          id: true, tenantName: true, contactEmail: true, contactPhone: true,
          crNumber: true, vatNumber: true, umrahLicenseNumber: true, city: true, country: true,
          adminName: true, adminEmail: true,
          status: true, reviewNotes: true, rejectionReason: true,
          reviewedAt: true, reviewedById: true,
          approvedTenantId: true, approvedUserId: true,
          createdAt: true, updatedAt: true,
        },
      }),
      prisma.tenantApplication.count({ where }),
      prisma.tenantApplication.groupBy({ by: ['status'], _count: { id: true } }),
    ]);
    const summary = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const r of counts) summary[r.status] = r._count.id;
    res.json({ data: apps, total, page: Number(page), pages: Math.ceil(total / limit), summary });
  } catch (err) {
    next(err);
  }
};

const approveApplication = async (req, res, next) => {
  try {
    const { notes } = req.body || {};
    const app = await prisma.tenantApplication.findUnique({ where: { id: req.params.id } });
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'PENDING') {
      return res.status(409).json({ error: `Application is already ${app.status.toLowerCase()}` });
    }

    // Generate a unique slug
    let slug = slugify(app.tenantName);
    let suffix = 0;
    while (true) {
      const exists = await prisma.tenant.findUnique({ where: { slug: suffix ? `${slug}-${suffix}` : slug } });
      if (!exists) break;
      suffix++;
    }
    if (suffix) slug = `${slug}-${suffix}`;

    // Atomic: create tenant + user + mark application APPROVED.
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: app.tenantName,
          contactEmail: app.contactEmail || app.adminEmail,
          contactPhone: app.contactPhone,
          crNumber: app.crNumber,
          vatNumber: app.vatNumber,
          umrahLicenseNumber: app.umrahLicenseNumber,
          city: app.city,
          country: app.country || 'Saudi Arabia',
          status: 'ACTIVE',
        },
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: app.adminName,
          email: app.adminEmail,
          password: app.adminPasswordHash,   // already bcrypt-hashed at submit time
          role: 'ADMIN',
          phone: app.contactPhone,
          companyName: app.tenantName,
          crNumber: app.crNumber,
          vatNumber: app.vatNumber,
        },
      });
      const updated = await tx.tenantApplication.update({
        where: { id: app.id },
        data: {
          status: 'APPROVED',
          reviewNotes: notes || null,
          reviewedAt: new Date(),
          reviewedById: req.user.id,
          approvedTenantId: tenant.id,
          approvedUserId: user.id,
        },
      });
      return { tenant, user, application: updated };
    });

    // Email the new admin so they know they can log in.
    const loginUrl = (process.env.FRONTEND_URL || 'https://app.safremanasik.com').replace(/\/$/, '') + '/login';
    sendEmail({
      to: app.adminEmail,
      subject: `Welcome to Safre Manasik — ${app.tenantName} is approved`,
      html: applicationApprovedHtml({
        adminName: app.adminName,
        tenantName: app.tenantName,
        adminEmail: app.adminEmail,
        loginUrl,
      }),
    }).catch(() => {});

    res.json({
      message: 'Application approved. Tenant and admin user created. Welcome email sent.',
      tenant: result.tenant,
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
    });
  } catch (err) {
    next(err);
  }
};

const rejectApplication = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A rejection reason is required so we can tell the applicant why.' });
    }
    const app = await prisma.tenantApplication.findUnique({ where: { id: req.params.id } });
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'PENDING') {
      return res.status(409).json({ error: `Application is already ${app.status.toLowerCase()}` });
    }

    const updated = await prisma.tenantApplication.update({
      where: { id: app.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        reviewedAt: new Date(),
        reviewedById: req.user.id,
      },
    });

    sendEmail({
      to: app.adminEmail,
      subject: `Update on your Safre Manasik application — ${app.tenantName}`,
      html: applicationRejectedHtml({
        adminName: app.adminName,
        tenantName: app.tenantName,
        reason: reason.trim(),
      }),
    }).catch(() => {});

    res.json({ message: 'Application rejected. Applicant has been notified.', application: updated });
  } catch (err) {
    next(err);
  }
};

// ─── Hotel seed data ─────────────────────────────────────────────────────────
// Curated list of 4★/5★ hotels near Masjid al-Haram (Makkah) and
// Masjid an-Nabawi (Madinah) — the properties Umrah agencies book most often.
const HOTEL_SEED_DATA = [
  // ── MAKKAH ──────────────────────────────────────────────────────────────
  { name: 'Fairmont Makkah Clock Royal Tower',       city: 'MAKKAH', stars: 5, distanceToHaramMeters: 50,  address: 'Abraj Al Bait Towers, Makkah 24231', amenities: ['Direct Haram view','Shuttle','Multiple restaurants','Prayer rooms','Concierge','Spa','Pool','Laundry'] },
  { name: 'Raffles Makkah Palace',                   city: 'MAKKAH', stars: 5, distanceToHaramMeters: 100, address: 'Abraj Al Bait Towers, Makkah 24231', amenities: ['Haram view','Butler service','Fine dining','Spa','Prayer rooms','Concierge'] },
  { name: 'Pullman ZamZam Makkah',                   city: 'MAKKAH', stars: 5, distanceToHaramMeters: 50,  address: 'Abraj Al Bait Towers, Makkah 24231', amenities: ['Haram view','Shuttle','Restaurants','Prayer rooms','Fitness centre','Concierge'] },
  { name: 'Mövenpick Hotel & Residences Hajar Tower Makkah', city: 'MAKKAH', stars: 5, distanceToHaramMeters: 150, address: 'Abraj Al Bait Towers, Makkah 24231', amenities: ['Haram view','Shuttle','Swiss restaurant','Prayer rooms','Business centre'] },
  { name: 'Swissôtel Makkah',                        city: 'MAKKAH', stars: 5, distanceToHaramMeters: 150, address: 'Abraj Al Bait Towers, Makkah 24231', amenities: ['Haram view','Multiple outlets','Prayer rooms','Fitness centre','Concierge'] },
  { name: 'Conrad Makkah',                           city: 'MAKKAH', stars: 5, distanceToHaramMeters: 200, address: 'Jabal Omar, Makkah 24231',           amenities: ['Shuttle','Rooftop pool','Multiple restaurants','Prayer rooms','Spa'] },
  { name: 'Hilton Suites Makkah',                    city: 'MAKKAH', stars: 5, distanceToHaramMeters: 300, address: 'Jabal Omar, Makkah 24231',           amenities: ['Shuttle','Kitchen suites','Prayer rooms','Fitness centre','Concierge'] },
  { name: 'Al Marwa Rayhaan by Rotana Makkah',       city: 'MAKKAH', stars: 5, distanceToHaramMeters: 300, address: 'Ibrahim Al Khalil Street, Makkah',   amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness','Concierge'] },
  { name: 'Anjum Hotel Makkah',                      city: 'MAKKAH', stars: 5, distanceToHaramMeters: 400, address: 'Ibrahim Al Khalil Street, Makkah',   amenities: ['Shuttle','Multiple restaurants','Prayer rooms','Spa','Pool','Fitness'] },
  { name: 'InterContinental Dar Al Tawhid Makkah',   city: 'MAKKAH', stars: 5, distanceToHaramMeters: 400, address: 'Ibrahim Al Khalil Street, Makkah',   amenities: ['Shuttle','Fine dining','Prayer rooms','Business centre','Concierge'] },
  { name: 'Millennium Makkah Al Naseem Hotel',       city: 'MAKKAH', stars: 5, distanceToHaramMeters: 400, address: 'Ajyad Street, Makkah 24231',         amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness','Concierge'] },
  { name: 'Grand Millennium Makkah',                 city: 'MAKKAH', stars: 5, distanceToHaramMeters: 500, address: 'Ibrahim Al Khalil Road, Makkah',     amenities: ['Shuttle','Multiple restaurants','Prayer rooms','Spa','Pool'] },
  { name: 'Jabal Omar Marriott Hotel Makkah',        city: 'MAKKAH', stars: 5, distanceToHaramMeters: 600, address: 'Jabal Omar, Makkah 24231',           amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness','Pool','Concierge'] },
  { name: 'Hyatt Regency Makkah Jabal Omar',         city: 'MAKKAH', stars: 5, distanceToHaramMeters: 700, address: 'Jabal Omar, Makkah 24231',           amenities: ['Shuttle','Rooftop restaurant','Prayer rooms','Fitness','Spa','Concierge'] },
  { name: 'Le Méridien Towers Makkah',               city: 'MAKKAH', stars: 5, distanceToHaramMeters: 800, address: 'Ajyad Street, Makkah 24231',         amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness','Concierge'] },
  { name: 'Sheraton Makkah Jabal Al Kaaba Hotel',    city: 'MAKKAH', stars: 4, distanceToHaramMeters: 700, address: 'Jabal Al Kaaba, Makkah 24231',       amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness','Concierge'] },
  { name: 'Radisson Blu Hotel Makkah',               city: 'MAKKAH', stars: 4, distanceToHaramMeters: 600, address: 'Al Haram District, Makkah',          amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness'] },
  { name: 'Al Safwah Royale Orchid Hotel',           city: 'MAKKAH', stars: 4, distanceToHaramMeters: 500, address: 'Ajyad Street, Makkah',               amenities: ['Shuttle','Restaurant','Prayer rooms','Fitness'] },
  { name: 'Elaf Ajyad Hotel',                        city: 'MAKKAH', stars: 4, distanceToHaramMeters: 500, address: 'Ajyad Street, Makkah 24231',         amenities: ['Shuttle','Restaurant','Prayer rooms'] },
  { name: 'Elaf Al Mashaer Hotel',                   city: 'MAKKAH', stars: 4, distanceToHaramMeters: 800, address: 'Jarwal District, Makkah',            amenities: ['Shuttle','Restaurant','Prayer rooms'] },
  { name: 'Al Shohada Hotel Makkah',                 city: 'MAKKAH', stars: 4, distanceToHaramMeters: 600, address: 'Al Shohada Street, Makkah',          amenities: ['Shuttle','Restaurant','Prayer rooms','Fitness'] },
  { name: 'Dorar Dar Diyafah Hotel',                 city: 'MAKKAH', stars: 4, distanceToHaramMeters: 700, address: 'Ajyad Street, Makkah',               amenities: ['Shuttle','Restaurant','Prayer rooms'] },
  { name: 'Dar Al Tawhid Ajyad Hotel',               city: 'MAKKAH', stars: 3, distanceToHaramMeters: 400, address: 'Ajyad Street, Makkah',               amenities: ['Shuttle','Restaurant','Prayer rooms'] },
  { name: 'Al Khozama Makkah Hotel',                 city: 'MAKKAH', stars: 3, distanceToHaramMeters: 900, address: 'Ajyad Street, Makkah',               amenities: ['Restaurant','Prayer rooms'] },

  // ── MADINAH ─────────────────────────────────────────────────────────────
  { name: 'The Oberoi Madinah',                      city: 'MADINAH', stars: 5, distanceToHaramMeters: 300, address: 'Al Jamia Al Islamiya Street, Madinah 42311', amenities: ['Butler service','Fine dining','Prayer rooms','Spa','Concierge','Fitness'] },
  { name: 'Pullman Zamzam Madinah',                  city: 'MADINAH', stars: 5, distanceToHaramMeters: 200, address: 'King Fahd Street, Madinah 42311',   amenities: ['Nabawi view','Shuttle','Restaurants','Prayer rooms','Fitness','Concierge'] },
  { name: 'Anwar Al Madinah Mövenpick Hotel',        city: 'MADINAH', stars: 5, distanceToHaramMeters: 300, address: 'King Fahd Road, Madinah',            amenities: ['Shuttle','Multiple restaurants','Prayer rooms','Fitness','Concierge'] },
  { name: 'Crowne Plaza Madinah',                    city: 'MADINAH', stars: 5, distanceToHaramMeters: 500, address: 'King Fahd Road, Madinah',            amenities: ['Shuttle','Restaurants','Prayer rooms','Business centre','Fitness'] },
  { name: 'InterContinental Dar Al Iman Madinah',    city: 'MADINAH', stars: 5, distanceToHaramMeters: 400, address: 'King Fahd Road, Madinah',            amenities: ['Shuttle','Fine dining','Prayer rooms','Fitness','Concierge'] },
  { name: 'Hilton Madinah',                          city: 'MADINAH', stars: 5, distanceToHaramMeters: 400, address: 'King Fahd Street, Madinah',          amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness','Pool','Concierge'] },
  { name: 'Rua Al Madinah Hotel',                    city: 'MADINAH', stars: 5, distanceToHaramMeters: 600, address: 'Abi Bakr Al Siddiq Road, Madinah',  amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness','Concierge'] },
  { name: 'Dar Al Taqwa Hotel',                      city: 'MADINAH', stars: 4, distanceToHaramMeters: 200, address: 'Al Sitteen Street, Madinah',         amenities: ['Shuttle','Nabawi view','Restaurant','Prayer rooms'] },
  { name: 'Al Eiman Royal Hotel',                    city: 'MADINAH', stars: 4, distanceToHaramMeters: 300, address: 'Al Haram District, Madinah',         amenities: ['Shuttle','Restaurant','Prayer rooms'] },
  { name: 'Frontel Al Harithia Hotel',               city: 'MADINAH', stars: 4, distanceToHaramMeters: 600, address: 'Al Harithia District, Madinah',      amenities: ['Shuttle','Restaurant','Prayer rooms','Fitness'] },
  { name: 'Sheraton Al Noor Madinah Hotel',          city: 'MADINAH', stars: 4, distanceToHaramMeters: 500, address: 'Syed Al Shuhada Street, Madinah',    amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness','Concierge'] },
  { name: 'Dallah Taibah Hotel',                     city: 'MADINAH', stars: 4, distanceToHaramMeters: 500, address: 'King Fahd Road, Madinah',            amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness'] },
  { name: 'Grand Plaza Hotel Madinah',               city: 'MADINAH', stars: 4, distanceToHaramMeters: 600, address: 'Madinah 42311, Saudi Arabia',        amenities: ['Shuttle','Restaurant','Prayer rooms','Fitness'] },
  { name: 'Novotel Madinah',                         city: 'MADINAH', stars: 4, distanceToHaramMeters: 700, address: 'Al Manakhah District, Madinah',      amenities: ['Shuttle','Restaurants','Prayer rooms','Fitness','Business centre'] },
  { name: 'Centro Shaheen Madinah by Rotana',        city: 'MADINAH', stars: 4, distanceToHaramMeters: 700, address: 'Shaheen Street, Madinah',            amenities: ['Shuttle','Restaurant','Prayer rooms','Fitness'] },
  { name: 'Al Nakheel Hotel Madinah',                city: 'MADINAH', stars: 4, distanceToHaramMeters: 800, address: 'Madinah 42311, Saudi Arabia',        amenities: ['Shuttle','Restaurant','Prayer rooms'] },
  { name: 'Safia Hotel Madinah',                     city: 'MADINAH', stars: 4, distanceToHaramMeters: 800, address: 'Madinah 42311, Saudi Arabia',        amenities: ['Shuttle','Restaurant','Prayer rooms'] },
  { name: 'Madinah Concorde Hotel',                  city: 'MADINAH', stars: 3, distanceToHaramMeters: 800, address: 'Madinah 42311, Saudi Arabia',        amenities: ['Shuttle','Restaurant','Prayer rooms'] },
  { name: 'Al Rawda Royal Inn',                      city: 'MADINAH', stars: 3, distanceToHaramMeters: 700, address: 'Al Rawda District, Madinah',         amenities: ['Shuttle','Restaurant','Prayer rooms'] },
  { name: 'Braira Hotel Madinah',                    city: 'MADINAH', stars: 4, distanceToHaramMeters: 1000, address: 'Madinah 42311, Saudi Arabia',       amenities: ['Shuttle','Restaurant','Prayer rooms','Fitness'] },
];

const seedHotels = async (req, res, next) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Skip hotels that already exist for this tenant
    const existing = await prisma.hotel.findMany({ where: { tenantId }, select: { name: true } });
    const existingNames = new Set(existing.map((h) => h.name));
    const toCreate = HOTEL_SEED_DATA.filter((h) => !existingNames.has(h.name));

    if (toCreate.length === 0) {
      return res.json({ message: 'All seed hotels already exist', created: 0, skipped: HOTEL_SEED_DATA.length, total: HOTEL_SEED_DATA.length });
    }

    await prisma.hotel.createMany({ data: toCreate.map((h) => ({ ...h, tenantId })) });

    const makkahCount  = toCreate.filter((h) => h.city === 'MAKKAH').length;
    const madinahCount = toCreate.filter((h) => h.city === 'MADINAH').length;

    res.json({
      message: `Seeded ${toCreate.length} hotels for "${tenant.name}" (${makkahCount} Makkah · ${madinahCount} Madinah)`,
      created: toCreate.length,
      skipped: existingNames.size,
      total: HOTEL_SEED_DATA.length,
      breakdown: { MAKKAH: makkahCount, MADINAH: madinahCount },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listTenants, getTenant, updateTenant,
  suspendTenant, activateTenant, deleteTenant,
  platformStats, allBookings,
  listPlans, updatePlan, tenantUsage,
  // Approval workflow
  listApplications, approveApplication, rejectApplication,
  // Hotel seed
  seedHotels,
};
