const prisma = require('../config/database');
const { getTenantId } = require('../config/tenantContext');

// Refs must be globally unique (bookingRef has a DB-level unique index).
// Count ALL bookings/invoices across every tenant so the sequence never
// collides between tenants. Raw SQL bypasses the per-tenant middleware.
const generateBookingRef = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `SAFM${year}${month}`;
  const startOfMonth = new Date(year, now.getMonth(), 1);
  const endOfMonth   = new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999);
  // Use raw SQL to count globally (not scoped to current tenant)
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM bookings
    WHERE "createdAt" >= ${startOfMonth} AND "createdAt" <= ${endOfMonth}
  `;
  const count = rows[0]?.cnt ?? 0;
  return `${prefix}${String(Number(count) + 1).padStart(4, '0')}`;
};

const generateInvoiceNo = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `SAFMINV${year}${month}`;
  const startOfMonth = new Date(year, now.getMonth(), 1);
  const endOfMonth   = new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999);
  // Use raw SQL to count globally (not scoped to current tenant)
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt FROM invoices
    WHERE "createdAt" >= ${startOfMonth} AND "createdAt" <= ${endOfMonth}
  `;
  const count = rows[0]?.cnt ?? 0;
  return `${prefix}${String(Number(count) + 1).padStart(4, '0')}`;
};

const bookingInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  agent: { select: { id: true, name: true, companyName: true } },
  package: { include: { priceTiers: true, packageHotels: { include: { hotel: true } } } },
  passengers: true,
  transports: { include: { vehicle: true, route: true } },
  caterings: { include: { mealPlan: { include: { vendor: true } } } },
  payments: true,
  invoice: true,
};

const getAll = async (req, res, next) => {
  try {
    const { status, search, agentId, customerId, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(status && { status }),
      ...(agentId && { agentId }),
      ...(customerId && { customerId }),
      ...(dateFrom && dateTo && { travelDateFrom: { gte: new Date(dateFrom), lte: new Date(dateTo) } }),
      ...(search && {
        OR: [
          { bookingRef: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    if (req.user.role === 'AGENT') where.agentId = req.user.id;
    if (req.user.role === 'CUSTOMER') where.customerId = req.user.id;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({ where, skip, take: Number(limit), include: bookingInclude, orderBy: { createdAt: 'desc' } }),
      prisma.booking.count({ where }),
    ]);
    res.json({ data: bookings, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id }, include: bookingInclude });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (req.user.role === 'CUSTOMER' && booking.customerId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'AGENT' && booking.agentId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { customerId, agentId, packageId, priceTierId, travelDateFrom, travelDateTo, totalPax, totalAmount, notes, passengers, transports, caterings } = req.body;

    if (!customerId) return res.status(400).json({ error: 'Customer is required' });
    if (!packageId) return res.status(400).json({ error: 'Package is required' });
    if (!travelDateFrom) return res.status(400).json({ error: 'Departure date is required' });
    if (!travelDateTo) return res.status(400).json({ error: 'Return date is required' });

    const dateFrom = new Date(travelDateFrom);
    const dateTo = new Date(travelDateTo);
    if (isNaN(dateFrom.getTime())) return res.status(400).json({ error: 'Invalid departure date' });
    if (isNaN(dateTo.getTime())) return res.status(400).json({ error: 'Invalid return date' });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (dateFrom < today) return res.status(400).json({ error: 'Departure date cannot be in the past' });
    if (dateTo < dateFrom) return res.status(400).json({ error: 'Return date must be on or after departure date' });

    const pax = Number(totalPax);
    if (!pax || pax < 1) return res.status(400).json({ error: 'Total passengers must be at least 1' });

    const amount = Number(totalAmount);
    if (isNaN(amount) || amount < 0) return res.status(400).json({ error: 'Total amount must be a positive number' });

    const agentIdFinal = req.user.role === 'AGENT' ? req.user.id : agentId;
    const tenantId = getTenantId();

    const bookingRef = await generateBookingRef();

    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        customerId,
        agentId: agentIdFinal,
        packageId,
        priceTierId,
        travelDateFrom: dateFrom,
        travelDateTo: dateTo,
        totalPax: pax,
        totalAmount: amount,
        notes,
        passengers: { create: (passengers || []).map((p) => ({
          ...p,
          ...(p.dateOfBirth && { dateOfBirth: new Date(p.dateOfBirth) }),
          ...(p.passportExpiry && { passportExpiry: new Date(p.passportExpiry) }),
        })) },
        transports: transports ? { create: transports } : undefined,
        caterings: caterings ? { create: caterings } : undefined,
      },
      include: bookingInclude,
    });

    const invoiceNo = await generateInvoiceNo();
    await prisma.invoice.create({
      data: {
        bookingId: booking.id,
        invoiceNo,
        totalAmount: booking.totalAmount,
        paidAmount: 0,
        balance: booking.totalAmount,
      },
    });

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { status, notes, travelDateFrom, travelDateTo, totalPax, totalAmount } = req.body;
    const result = await prisma.booking.updateMany({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(travelDateFrom && { travelDateFrom: new Date(travelDateFrom) }),
        ...(travelDateTo && { travelDateTo: new Date(travelDateTo) }),
        ...(totalPax && { totalPax: Number(totalPax) }),
        ...(totalAmount && { totalAmount }),
      },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id }, include: bookingInclude });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await prisma.booking.updateMany({
      where: { id: req.params.id },
      data: { status },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id }, include: bookingInclude });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

const addPassengers = async (req, res, next) => {
  try {
    const { passengers } = req.body;
    // Verify booking ownership first
    const exists = await prisma.booking.findFirst({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Booking not found' });
    await prisma.passenger.createMany({ data: passengers.map((p) => ({ ...p, bookingId: req.params.id })) });
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id }, include: bookingInclude });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

const assignTransport = async (req, res, next) => {
  try {
    const { vehicleId, routeId, departureAt, notes } = req.body;
    const exists = await prisma.booking.findFirst({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Booking not found' });
    await prisma.bookingTransport.create({
      data: { bookingId: req.params.id, vehicleId, routeId, departureAt: departureAt ? new Date(departureAt) : null, notes },
    });
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id }, include: bookingInclude });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

const assignCatering = async (req, res, next) => {
  try {
    const { mealPlanId, paxCount, notes } = req.body;
    const exists = await prisma.booking.findFirst({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Booking not found' });
    await prisma.bookingCatering.create({
      data: { bookingId: req.params.id, mealPlanId, paxCount: Number(paxCount), notes },
    });
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id }, include: bookingInclude });
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await prisma.booking.updateMany({
      where: { id: req.params.id }, data: { status: 'CANCELLED' },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, updateStatus, addPassengers, assignTransport, assignCatering, remove };
