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

// ── Itinerary line-items (Direct-Voucher style) ───────────────────────────────
// Build the persisted hotel/transport trip arrays with server-computed nights
// and line totals, plus their summed value. Hotel line = rooms × nights × price.
function nightsBetween(ci, co) {
  if (!ci || !co) return 0;
  const a = new Date(ci), b = new Date(co);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  const d = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  return d > 0 ? d : 0;
}
function buildBookingTrips(body) {
  const hotelTrips = (Array.isArray(body.hotelTrips) ? body.hotelTrips : [])
    .filter((t) => t && (t.hotelName || t.hotelId || t.checkInDate || t.checkOutDate || t.perNightPrice))
    .map((t) => {
      const nights = nightsBetween(t.checkInDate, t.checkOutDate);
      const rooms = Math.max(1, parseInt(t.rooms, 10) || 1);
      const perNightPrice = Math.max(0, Number(t.perNightPrice) || 0);
      return {
        hotelId: t.hotelId || null,
        hotelName: String(t.hotelName || '').trim(),
        checkInDate: t.checkInDate || null,
        checkOutDate: t.checkOutDate || null,
        rooms, perNightPrice, nights,
        lineTotal: rooms * nights * perNightPrice,
      };
    });
  const transportTrips = (Array.isArray(body.transportTrips) ? body.transportTrips : [])
    .filter((t) => t && (t.vehicleType || t.pickupLocation || t.dropoffLocation || t.travelDate || t.price))
    .map((t) => {
      const price = Math.max(0, Number(t.price) || 0);
      return {
        vehicleType: String(t.vehicleType || '').trim(),
        pickupLocation: String(t.pickupLocation || '').trim(),
        dropoffLocation: String(t.dropoffLocation || '').trim(),
        travelDate: t.travelDate || null,
        passengerCount: t.passengerCount ? Number(t.passengerCount) : null,
        price, lineTotal: price,
      };
    });
  const tripsTotal = [...hotelTrips, ...transportTrips].reduce((s, t) => s + (t.lineTotal || 0), 0);
  return { hotelTrips, transportTrips, tripsTotal };
}

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
    // Package is OPTIONAL — a booking can be ad-hoc (hotel/transport priced
    // manually via totalAmount) without a packaged product.
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

    // Itinerary line-items: when present, they drive the booking total.
    const { hotelTrips, transportTrips, tripsTotal } = buildBookingTrips(req.body);
    const hasTrips = hotelTrips.length > 0 || transportTrips.length > 0;

    let amount;
    if (hasTrips) {
      amount = tripsTotal;
    } else {
      amount = Number(totalAmount);
      if (isNaN(amount) || amount < 0) return res.status(400).json({ error: 'Total amount must be a positive number' });
    }

    const agentIdFinal = req.user.role === 'AGENT' ? req.user.id : agentId;
    const tenantId = getTenantId();

    const bookingRef = await generateBookingRef();

    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        customerId,
        agentId: agentIdFinal,
        packageId: packageId || null,
        priceTierId: packageId ? (priceTierId || null) : null,
        travelDateFrom: dateFrom,
        travelDateTo: dateTo,
        totalPax: pax,
        totalAmount: amount,
        notes,
        hotelTrips: hotelTrips.length ? hotelTrips : undefined,
        transportTrips: transportTrips.length ? transportTrips : undefined,
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
    const { status, notes, travelDateFrom, travelDateTo, totalPax, totalAmount, customerId } = req.body;

    // Switching the linked customer — validate it's a CUSTOMER in this tenant
    // (the tenant middleware scopes the lookup, so cross-tenant ids can't match).
    if (customerId) {
      const cust = await prisma.user.findFirst({ where: { id: customerId, role: 'CUSTOMER' }, select: { id: true } });
      if (!cust) return res.status(400).json({ error: 'Selected customer not found' });
    }

    // If itinerary line-items are supplied, they drive the total.
    const tripsProvided = 'hotelTrips' in req.body || 'transportTrips' in req.body;
    const { hotelTrips, transportTrips, tripsTotal } = buildBookingTrips(req.body);
    const hasTrips = hotelTrips.length > 0 || transportTrips.length > 0;

    const result = await prisma.booking.updateMany({
      where: { id: req.params.id },
      data: {
        ...(customerId && { customerId }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(travelDateFrom && { travelDateFrom: new Date(travelDateFrom) }),
        ...(travelDateTo && { travelDateTo: new Date(travelDateTo) }),
        ...(totalPax && { totalPax: Number(totalPax) }),
        ...(tripsProvided && { hotelTrips: hotelTrips.length ? hotelTrips : null, transportTrips: transportTrips.length ? transportTrips : null }),
        ...(hasTrips ? { totalAmount: tripsTotal } : (totalAmount && { totalAmount })),
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
