const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const { sendEmail, customerWelcomeHtml } = require('../services/emailService');

const getAll = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, role: true, phone: true, companyName: true,
          crNumber: true, customerType: true, isActive: true, createdAt: true,
          customRoleId: true,
          customRole: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ data: users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, phone: true, companyName: true, address: true, isActive: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, companyName, address, customerType, crNumber, vatNumber } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email is required' });

    // AGENTs may only create CUSTOMER-role users (not admins or other agents)
    let allowedRole = ['ADMIN', 'AGENT', 'CUSTOMER'].includes(role) ? role : 'CUSTOMER';
    if (req.user?.role === 'AGENT') allowedRole = 'CUSTOMER';

    // Check globally for email uniqueness (email is unique across all tenants)
    let existing;
    await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try { existing = await prisma.user.findUnique({ where: { email } }); resolve(); } catch (e) { reject(e); }
      });
    });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const plainPassword = password || 'Temp@1234';
    const hash = await bcrypt.hash(plainPassword, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hash, role: allowedRole, phone, companyName, address, customerType, crNumber, vatNumber },
      select: { id: true, name: true, email: true, role: true, phone: true, companyName: true, customerType: true, crNumber: true, vatNumber: true, isActive: true, createdAt: true, tenantId: true },
    });

    // Send welcome email for CUSTOMER-role users so they know their login details.
    // Fire-and-forget — don't let email failure block the API response.
    if (allowedRole === 'CUSTOMER') {
      // Fetch tenant name for the email greeting
      const tenantRecord = user.tenantId
        ? await prisma.tenant.findFirst({ where: { id: user.tenantId }, select: { name: true } }).catch(() => null)
        : null;
      const loginUrl = `${process.env.FRONTEND_URL || 'https://app.safremanasik.com'}/login`;
      sendEmail({
        to: email,
        subject: `Your Safre Manasik account is ready — ${tenantRecord?.name || 'Safre Manasik'}`,
        html: customerWelcomeHtml({
          adminName: req.user?.name || 'Your administrator',
          customerName: name,
          email,
          password: plainPassword,
          loginUrl,
          tenantName: tenantRecord?.name || 'Safre Manasik',
        }),
      }).catch(() => {});
    }

    const { tenantId: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, phone, companyName, address, isActive, role, customerType, crNumber, vatNumber } = req.body;
    let allowedRole = role && ['ADMIN', 'AGENT', 'CUSTOMER'].includes(role) ? role : undefined;
    // AGENTs can only edit CUSTOMER records — verify the target is a customer first
    if (req.user?.role === 'AGENT') {
      const target = await prisma.user.findFirst({ where: { id: req.params.id }, select: { role: true } });
      if (!target || target.role !== 'CUSTOMER') return res.status(403).json({ error: 'Agents may only edit customer records' });
      allowedRole = undefined; // agents cannot change role
    }
    const result = await prisma.user.updateMany({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(companyName !== undefined && { companyName }),
        ...(address !== undefined && { address }),
        ...(isActive !== undefined && { isActive }),
        ...(allowedRole && { role: allowedRole }),
        ...(customerType !== undefined && { customerType }),
        ...(crNumber !== undefined && { crNumber }),
        ...(vatNumber !== undefined && { vatNumber }),
      },
    });
    if (result.count === 0) return res.status(404).json({ error: 'User not found' });
    const user = await prisma.user.findFirst({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, phone: true, companyName: true, customerType: true, crNumber: true, vatNumber: true, isActive: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
    const target = await prisma.user.findFirst({ where: { id: req.params.id }, select: { id: true, role: true } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    // Lockout protection: never delete the last active administrator.
    if (target.role === 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (admins <= 1) return res.status(409).json({ error: 'Cannot delete the only administrator. Create another admin first.' });
    }
    // Hard delete. If the user is linked to bookings / other records, the FK
    // constraint will reject it — return a friendly message to disable instead.
    try {
      const result = await prisma.user.deleteMany({ where: { id: req.params.id } });
      if (result.count === 0) return res.status(404).json({ error: 'User not found' });
    } catch (e) {
      if (e.code === 'P2003' || e.code === 'P2014') {
        return res.status(409).json({ error: 'This user is linked to bookings or other records and cannot be deleted. Disable the account instead.' });
      }
      throw e;
    }
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

// Returns active staff who can be assigned work (CRM leads, tasks, etc.).
// Includes both ADMIN and AGENT roles so admins can be assignees too.
const getAgents = async (req, res, next) => {
  try {
    const agents = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'AGENT'] }, isActive: true },
      select: { id: true, name: true, email: true, role: true, companyName: true, phone: true },
      orderBy: { name: 'asc' },
    });
    res.json(agents);
  } catch (err) {
    next(err);
  }
};

const getCustomers = async (req, res, next) => {
  try {
    // Booking customer-pickers call this without flags → active customers only,
    // full list (no pagination). The Customers tab passes includeInactive=1 to
    // also show disabled customers and uses the richer fields below.
    const { search, includeInactive, withVouchers } = req.query;
    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(includeInactive ? {} : { isActive: true }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { companyName: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: { id: true, name: true, email: true, phone: true, companyName: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    });

    // Direct-Voucher customers are normally synced into the User registry at
    // voucher-save time (resolveVoucherCustomer) and backfilled on boot. As a
    // guaranteed display fallback — independent of that sync ever running — the
    // Customers tab (?withVouchers=1) also surfaces voucher customers read
    // straight from FormVoucher, deduped by mobile against the real users above.
    // Pickers/booking flows omit the flag, so they still see only real users
    // (no synthetic ids leak into booking/customerId writes).
    const extra = [];
    if (withVouchers === '1' || withVouchers === 'true') {
      const digits = (s) => String(s || '').replace(/\D/g, '');
      const q = search ? String(search).toLowerCase() : '';
      const known = new Set(customers.map((c) => digits(c.phone)).filter(Boolean));
      // mobile is a required (non-null) column, so no `not: null` filter is needed
      // (and Prisma rejects `not: null` on a non-nullable field). Blank mobiles are
      // skipped in the loop below.
      const vouchers = await prisma.formVoucher.findMany({
        select: { firstName: true, lastName: true, companyName: true, mobile: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      const seen = new Set();
      for (const v of vouchers) {
        const d = digits(v.mobile);
        if (!d || known.has(d) || seen.has(d)) continue;
        seen.add(d);
        const name = `${(v.firstName || '').trim()} ${(v.lastName || '').trim()}`.trim() || 'Customer';
        if (q && !(name.toLowerCase().includes(q) || d.includes(digits(search)) || (v.companyName || '').toLowerCase().includes(q))) continue;
        extra.push({
          id: `dv:${d}`, name, email: null, phone: v.mobile, companyName: v.companyName || null,
          isActive: true, createdAt: v.createdAt, source: 'voucher',
        });
      }
    }

    const data = [...customers, ...extra];
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, remove, getAgents, getCustomers };
