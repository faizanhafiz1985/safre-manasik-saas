const prisma = require('../config/database');

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

module.exports = {
  listTenants, getTenant, updateTenant,
  suspendTenant, activateTenant, deleteTenant,
  platformStats, allBookings,
};
