const prisma = require('../config/database');
const { getTenantId } = require('../config/tenantContext');

// Helper: pad time HH:MM
const fmtTime = (d) => d ? d.toISOString().substring(11, 16) : '';
const fmtDate = (d) => d ? d.toISOString().substring(0, 10) : '';

// ─── Report A — Daily Check-In / Check-Out & Transport Schedule ─────────────
const dailySchedule = async (req, res, next) => {
  try {
    const dateParam = req.query.date || new Date().toISOString().substring(0, 10);
    const date = new Date(dateParam);
    if (isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid date' });

    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const dayEnd   = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

    const { eventType, status, vehicleType } = req.query;

    // 1. Check-ins: bookings whose travelDateFrom falls on the report date
    const checkIns = await prisma.booking.findMany({
      where: {
        travelDateFrom: { gte: dayStart, lte: dayEnd },
        ...(status && { status }),
      },
      include: {
        customer: { select: { name: true } },
        agent: { select: { name: true } },
        package: { include: { packageHotels: { include: { hotel: true } } } },
      },
    });

    // 2. Check-outs: bookings whose travelDateTo falls on the report date
    const checkOuts = await prisma.booking.findMany({
      where: {
        travelDateTo: { gte: dayStart, lte: dayEnd },
        ...(status && { status }),
      },
      include: {
        customer: { select: { name: true } },
        agent: { select: { name: true } },
        package: { include: { packageHotels: { include: { hotel: true } } } },
      },
    });

    // 3. Transport runs: bookingTransport rows where departureAt is on the report date
    const transports = await prisma.bookingTransport.findMany({
      where: { departureAt: { gte: dayStart, lte: dayEnd } },
      include: {
        booking: {
          include: {
            customer: { select: { name: true } },
            agent: { select: { name: true } },
            tenant: { select: { id: true } },
          },
        },
        vehicle: vehicleType ? { where: { type: vehicleType } } : true,
        route: true,
      },
    });

    // Filter transports whose booking belongs to current tenant (defense in depth — middleware doesn't filter through booking)
    const tenantId = getTenantId();
    const tenantTransports = transports.filter((t) =>
      t.booking && (!tenantId || t.booking.tenant?.id === tenantId || t.booking.tenantId === tenantId)
    );

    const events = [];

    if (!eventType || eventType === 'ALL' || eventType === 'CHECK-IN') {
      for (const b of checkIns) {
        const hotelEntry = b.package.packageHotels.find((h) => h.city === 'MADINAH') || b.package.packageHotels[0];
        events.push({
          eventType: 'CHECK-IN',
          time: fmtTime(b.travelDateFrom),
          date: fmtDate(b.travelDateFrom),
          bookingRef: b.bookingRef,
          customerName: b.customer?.name || '—',
          paxCount: b.totalPax,
          hotelName: hotelEntry?.hotel?.name || '—',
          hotelCity: hotelEntry?.city || '—',
          vehicle: null,
          driver: null,
          route: null,
          agent: b.agent?.name || '—',
          status: b.status,
        });
      }
    }

    if (!eventType || eventType === 'ALL' || eventType === 'CHECK-OUT') {
      for (const b of checkOuts) {
        const hotelEntry = b.package.packageHotels.find((h) => h.city === 'MAKKAH') || b.package.packageHotels[0];
        events.push({
          eventType: 'CHECK-OUT',
          time: fmtTime(b.travelDateTo),
          date: fmtDate(b.travelDateTo),
          bookingRef: b.bookingRef,
          customerName: b.customer?.name || '—',
          paxCount: b.totalPax,
          hotelName: hotelEntry?.hotel?.name || '—',
          hotelCity: hotelEntry?.city || '—',
          vehicle: null,
          driver: null,
          route: null,
          agent: b.agent?.name || '—',
          status: b.status,
        });
      }
    }

    if (!eventType || eventType === 'ALL' || eventType === 'TRANSPORT') {
      for (const t of tenantTransports) {
        if (!t.vehicle) continue;  // filtered out by vehicleType
        if (status && t.booking.status !== status) continue;
        events.push({
          eventType: 'TRANSPORT',
          time: fmtTime(t.departureAt),
          date: fmtDate(t.departureAt),
          bookingRef: t.booking.bookingRef,
          customerName: t.booking.customer?.name || '—',
          paxCount: t.booking.totalPax,
          hotelName: null,
          hotelCity: null,
          vehicle: `${t.vehicle.name} (${t.vehicle.plateNumber})`,
          vehicleType: t.vehicle.type,
          driver: `${t.vehicle.driverName} (${t.vehicle.driverPhone})`,
          route: t.route ? `${t.route.fromLocation} → ${t.route.toLocation}` : '—',
          agent: t.booking.agent?.name || '—',
          status: t.booking.status,
          // Operational tracking (transport runs only)
          transportId: t.id,
          departureDone: !!t.departureDone,
          transportAvailed: !!t.transportAvailed,
          departureDoneText: t.departureDone ? 'Done' : 'Pending',
          transportAvailedText: t.transportAvailed ? 'Done' : 'Pending',
        });
      }
    }

    // Sort by time ASC
    events.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    res.json({
      date: fmtDate(date),
      totalEvents: events.length,
      summary: {
        checkIns: events.filter((e) => e.eventType === 'CHECK-IN').length,
        checkOuts: events.filter((e) => e.eventType === 'CHECK-OUT').length,
        transports: events.filter((e) => e.eventType === 'TRANSPORT').length,
      },
      events,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Report B — Transport Details by Date Range ─────────────────────────────
const transportByDate = async (req, res, next) => {
  try {
    const startParam = req.query.startDate || new Date().toISOString().substring(0, 10);
    const endParam = req.query.endDate || startParam;
    const startDate = new Date(startParam);
    const endDate = new Date(endParam);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date(s)' });
    }
    const dayMs = 24 * 60 * 60 * 1000;
    if ((endDate - startDate) / dayMs > 31) {
      return res.status(400).json({ error: 'Date range cannot exceed 31 days' });
    }

    const rangeStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0);
    const rangeEnd   = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);

    const { vehicleType, vehicleId } = req.query;
    const tenantId = getTenantId();

    const transports = await prisma.bookingTransport.findMany({
      where: {
        departureAt: { gte: rangeStart, lte: rangeEnd },
        ...(vehicleId && { vehicleId }),
      },
      include: {
        booking: {
          include: {
            customer: { select: { name: true } },
            tenant: { select: { id: true } },
          },
        },
        vehicle: true,
        route: true,
      },
    });

    // Defense in depth — filter by tenant on the join through bookings
    const filtered = transports.filter((t) =>
      t.booking && (!tenantId || t.booking.tenant?.id === tenantId || t.booking.tenantId === tenantId)
    ).filter((t) => !vehicleType || t.vehicle?.type === vehicleType);

    // Group by (run_date, vehicle, route)
    const groups = new Map();
    for (const t of filtered) {
      const dateKey = fmtDate(t.departureAt);
      const key = `${dateKey}|${t.vehicleId}|${t.routeId || 'none'}|${fmtTime(t.departureAt)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          runDate: dateKey,
          departureTime: fmtTime(t.departureAt),
          arrivalTime: fmtTime(t.arrivalAt),
          vehicleId: t.vehicleId,
          vehicleName: t.vehicle?.name,
          vehiclePlate: t.vehicle?.plateNumber,
          vehicleType: t.vehicle?.type,
          vehicleCapacity: t.vehicle?.capacity || 0,
          driverName: t.vehicle?.driverName,
          driverPhone: t.vehicle?.driverPhone,
          routeFrom: t.route?.fromLocation || '—',
          routeTo: t.route?.toLocation || '—',
          bookingRefs: [],
          passengerCount: 0,
          statuses: new Set(),
          transportIds: [],
          departureDoneAll: true,
          transportAvailedAll: true,
        });
      }
      const g = groups.get(key);
      g.bookingRefs.push(t.booking.bookingRef);
      g.passengerCount += t.booking.totalPax;
      g.statuses.add(t.booking.status);
      g.transportIds.push(t.id);
      if (!t.departureDone) g.departureDoneAll = false;
      if (!t.transportAvailed) g.transportAvailedAll = false;
    }

    const runs = Array.from(groups.values()).map((g) => ({
      ...g,
      bookingRefs: g.bookingRefs.join(', '),
      occupancyPct: g.vehicleCapacity > 0 ? Math.round((g.passengerCount / g.vehicleCapacity) * 1000) / 10 : 0,
      runStatus: g.statuses.size === 1 ? Array.from(g.statuses)[0] : 'MIXED',
      // A run is "Done" only when every assignment in the group is done.
      departureDone: g.departureDoneAll,
      transportAvailed: g.transportAvailedAll,
      departureDoneText: g.departureDoneAll ? 'Done' : 'Pending',
      transportAvailedText: g.transportAvailedAll ? 'Done' : 'Pending',
      statuses: undefined,
      departureDoneAll: undefined,
      transportAvailedAll: undefined,
    }));

    runs.sort((a, b) => (a.runDate + a.departureTime).localeCompare(b.runDate + b.departureTime));

    const summary = {
      totalRuns: runs.length,
      totalPassengers: runs.reduce((sum, r) => sum + r.passengerCount, 0),
      avgOccupancyPct: runs.length ? Math.round((runs.reduce((s, r) => s + r.occupancyPct, 0) / runs.length) * 10) / 10 : 0,
      byVehicleType: runs.reduce((acc, r) => {
        acc[r.vehicleType] = (acc[r.vehicleType] || 0) + 1;
        return acc;
      }, {}),
    };

    res.json({
      startDate: fmtDate(startDate),
      endDate: fmtDate(endDate),
      summary,
      runs,
    });
  } catch (err) {
    next(err);
  }
};

// ─── CSV export helpers ─────────────────────────────────────────────────────
const toCsv = (rows, columns) => {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => c.label).join(',');
  const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(',')).join('\n');
  return header + '\n' + body;
};

const exportDailyScheduleCsv = async (req, res, next) => {
  try {
    // Reuse the dailySchedule handler logic by calling res-less version
    req.query.eventType = req.query.eventType || 'ALL';
    const captureRes = {
      _data: null,
      json(d) { this._data = d; },
      status(c) { this._status = c; return this; },
    };
    await dailySchedule(req, captureRes, next);
    if (!captureRes._data) return; // an error already handled

    const cols = [
      { key: 'eventType', label: 'Event Type' },
      { key: 'time', label: 'Time' },
      { key: 'bookingRef', label: 'Booking Ref' },
      { key: 'customerName', label: 'Customer' },
      { key: 'paxCount', label: 'Pax' },
      { key: 'hotelName', label: 'Hotel' },
      { key: 'hotelCity', label: 'City' },
      { key: 'vehicle', label: 'Vehicle' },
      { key: 'driver', label: 'Driver' },
      { key: 'route', label: 'Route' },
      { key: 'agent', label: 'Agent' },
      { key: 'status', label: 'Status' },
      { key: 'departureDoneText', label: 'Departure Done' },
      { key: 'transportAvailedText', label: 'Transport Availed' },
    ];
    const csv = toCsv(captureRes._data.events, cols);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="daily-schedule-${captureRes._data.date}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

const exportTransportCsv = async (req, res, next) => {
  try {
    const captureRes = {
      _data: null,
      json(d) { this._data = d; },
      status(c) { this._status = c; return this; },
    };
    await transportByDate(req, captureRes, next);
    if (!captureRes._data) return;

    const cols = [
      { key: 'runDate', label: 'Date' },
      { key: 'departureTime', label: 'Departure' },
      { key: 'arrivalTime', label: 'Arrival' },
      { key: 'vehicleName', label: 'Vehicle' },
      { key: 'vehiclePlate', label: 'Plate' },
      { key: 'vehicleType', label: 'Type' },
      { key: 'vehicleCapacity', label: 'Capacity' },
      { key: 'driverName', label: 'Driver' },
      { key: 'driverPhone', label: 'Driver Phone' },
      { key: 'routeFrom', label: 'From' },
      { key: 'routeTo', label: 'To' },
      { key: 'passengerCount', label: 'Pax' },
      { key: 'occupancyPct', label: 'Occupancy %' },
      { key: 'bookingRefs', label: 'Bookings' },
      { key: 'runStatus', label: 'Status' },
      { key: 'departureDoneText', label: 'Departure Done' },
      { key: 'transportAvailedText', label: 'Transport Availed' },
    ];
    const csv = toCsv(captureRes._data.runs, cols);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transport-${captureRes._data.startDate}-to-${captureRes._data.endDate}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

// ─── Toggle operational flags on transport runs ─────────────────────────────
// Body: { ids: [bookingTransportId...], departureDone?: bool, transportAvailed?: bool }
// Daily Schedule sends a single id; the Transport Report sends every id in a run
// group (so the whole grouped run flips together).
const updateTransportStatus = async (req, res, next) => {
  try {
    const { ids, departureDone, transportAvailed } = req.body;
    const idList = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!idList.length) return res.status(400).json({ error: 'At least one transport id is required' });
    if (departureDone === undefined && transportAvailed === undefined) {
      return res.status(400).json({ error: 'Provide departureDone and/or transportAvailed' });
    }
    const tenantId = getTenantId();
    // Only touch rows whose booking belongs to the current tenant (defense in depth).
    const rows = await prisma.bookingTransport.findMany({
      where: { id: { in: idList } },
      select: { id: true, booking: { select: { tenantId: true } } },
    });
    const allowed = rows.filter((r) => !tenantId || r.booking?.tenantId === tenantId).map((r) => r.id);
    if (!allowed.length) return res.status(404).json({ error: 'No matching transport runs' });

    const data = {};
    if (departureDone !== undefined) data.departureDone = !!departureDone;
    if (transportAvailed !== undefined) data.transportAvailed = !!transportAvailed;
    await prisma.bookingTransport.updateMany({ where: { id: { in: allowed } }, data });
    res.json({ updated: allowed.length, ...data });
  } catch (err) { next(err); }
};

module.exports = { dailySchedule, transportByDate, exportDailyScheduleCsv, exportTransportCsv, updateTransportStatus };
