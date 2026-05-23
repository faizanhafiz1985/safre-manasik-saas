const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');

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
        select: { id: true, name: true, email: true, role: true, phone: true, companyName: true, isActive: true, createdAt: true },
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
    // Check globally for email uniqueness (email is unique across all tenants)
    let existing;
    await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try { existing = await prisma.user.findUnique({ where: { email } }); resolve(); } catch (e) { reject(e); }
      });
    });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password || 'Temp@1234', 12);
    const allowedRole = ['ADMIN', 'AGENT', 'CUSTOMER'].includes(role) ? role : 'CUSTOMER';
    const user = await prisma.user.create({
      data: { name, email, password: hash, role: allowedRole, phone, companyName, address, customerType, crNumber, vatNumber },
      select: { id: true, name: true, email: true, role: true, phone: true, companyName: true, customerType: true, crNumber: true, vatNumber: true, isActive: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, phone, companyName, address, isActive, role, customerType, crNumber, vatNumber } = req.body;
    const allowedRole = role && ['ADMIN', 'AGENT', 'CUSTOMER'].includes(role) ? role : undefined;
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
    const result = await prisma.user.updateMany({ where: { id: req.params.id }, data: { isActive: false } });
    if (result.count === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
};

const getAgents = async (req, res, next) => {
  try {
    const agents = await prisma.user.findMany({
      where: { role: 'AGENT', isActive: true },
      select: { id: true, name: true, email: true, companyName: true, phone: true },
      orderBy: { name: 'asc' },
    });
    res.json(agents);
  } catch (err) {
    next(err);
  }
};

const getCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        isActive: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: 'asc' },
    });
    res.json({ data: customers, total: customers.length });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, remove, getAgents, getCustomers };
