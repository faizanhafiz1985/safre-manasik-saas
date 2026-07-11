// Fleet Management — trip tracking, cash accountability, maintenance alerts.
// Tenant-scoped (models are in TENANT_MODELS). Drivers are tenant users; an
// admin/agent can also log on a driver's behalf.

const prisma = require('../config/database');
const { getTenantId } = require('../config/tenantContext');
const { getFleetScope } = require('../utils/fleetScope');
const { vehicleDocSummary } = require('../services/fleetDocsService');

// Returns null when the user is fleet-wide (no restriction), otherwise the array
// of vehicle ids assigned to them (driver assignment-scope).
async function myVehicleIds(req) {
  const scope = await getFleetScope(req);
  if (scope.wide) return null;
  const vs = await prisma.vehicle.findMany({ where: { driverId: req.user.id }, select: { id: true } });
  return vs.map((v) => v.id);
}
// True if the user may act on the given vehicle (wide, or it is assigned to them).
async function vehicleAllowed(req, vehicleId) {
  const scope = await getFleetScope(req);
  if (scope.wide) return true;
  if (!vehicleId) return true; // generic (non-vehicle) entry by a driver
  const v = await prisma.vehicle.findFirst({ where: { id: vehicleId }, select: { driverId: true } });
  return !!v && v.driverId === req.user.id;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function routeDistanceKm(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1], p1 = points[i];
    if ([p0?.lat, p0?.lng, p1?.lat, p1?.lng].every((n) => typeof n === 'number')) d += haversineKm(p0, p1);
  }
  return +d.toFixed(2);
}
// Oil-change status from odometer vs interval.
function oilStatus(v) {
  const since = Math.max(0, (v.currentOdometer || 0) - (v.lastOilChangeOdometer || 0));
  const interval = v.oilChangeIntervalKm || 5000;
  const remaining = interval - since;
  let status = 'OK';
  if (remaining <= 0) status = 'DUE';
  else if (remaining <= Math.max(200, interval * 0.1)) status = 'SOON';
  return { kmSinceOil: since, intervalKm: interval, kmRemaining: remaining, status, due: remaining <= 0 };
}
const num = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : Number(v));

// When the odometer crosses the oil-change interval, automatically open a
// PENDING OIL_CHANGE maintenance task (one per vehicle at a time). Returns the
// task if one was created so callers can prompt the driver immediately.
async function autoCreateOilTask(vehicle, tenantId) {
  try {
    if (!oilStatus(vehicle).due) return null;
    const pending = await prisma.fleetMaintenance.findFirst({
      where: { vehicleId: vehicle.id, type: 'OIL_CHANGE', status: 'PENDING' },
    });
    if (pending) return null; // task already open
    return await prisma.fleetMaintenance.create({
      data: {
        tenantId, vehicleId: vehicle.id, type: 'OIL_CHANGE', status: 'PENDING',
        dueAtOdometer: (vehicle.lastOilChangeOdometer || 0) + (vehicle.oilChangeIntervalKm || 5000),
        notes: `Auto-created: odometer ${vehicle.currentOdometer} km reached the oil-change interval.`,
      },
    });
  } catch { return null; }
}
const dayRange = (dateStr) => {
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
  return { start, end };
};

// ── Trips ─────────────────────────────────────────────────────────────────────
const startTrip = async (req, res, next) => {
  try {
    const { vehicleId, startLat, startLng, startLabel, startOdometer, purpose } = req.body;
    if (!vehicleId) return res.status(400).json({ error: 'Vehicle is required' });
    if (!(await vehicleAllowed(req, vehicleId))) return res.status(403).json({ error: 'This vehicle is not assigned to you.' });
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    // Prevent two open trips on the same vehicle.
    const open = await prisma.fleetTrip.findFirst({ where: { vehicleId, status: 'IN_PROGRESS' } });
    if (open) return res.status(409).json({ error: 'This vehicle already has a trip in progress.' });

    const trip = await prisma.fleetTrip.create({
      data: {
        tenantId: getTenantId(), vehicleId,
        driverId: vehicle.driverId || req.user.id,
        driverName: req.user.name,
        status: 'IN_PROGRESS', startedAt: new Date(),
        startLat: num(startLat), startLng: num(startLng), startLabel: startLabel || null,
        startOdometer: num(startOdometer) ?? vehicle.currentOdometer,
        routePoints: (num(startLat) !== null && num(startLng) !== null) ? [{ lat: num(startLat), lng: num(startLng), t: Date.now() }] : [],
        purpose: purpose || null, createdById: req.user.id,
      },
    });
    res.status(201).json(trip);
  } catch (err) { next(err); }
};

const addPoint = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const trip = await prisma.fleetTrip.findFirst({ where: { id: req.params.id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (!(await vehicleAllowed(req, trip.vehicleId))) return res.status(403).json({ error: 'Not your assigned vehicle.' });
    if (trip.status !== 'IN_PROGRESS') return res.status(409).json({ error: 'Trip is not in progress' });
    const pts = Array.isArray(trip.routePoints) ? trip.routePoints : [];
    if (num(lat) !== null && num(lng) !== null) pts.push({ lat: num(lat), lng: num(lng), t: Date.now() });
    await prisma.fleetTrip.updateMany({ where: { id: trip.id }, data: { routePoints: pts, updatedAt: new Date() } });
    res.json({ points: pts.length });
  } catch (err) { next(err); }
};

const stopTrip = async (req, res, next) => {
  try {
    const { endLat, endLng, endLabel, endOdometer, distanceKm, routePoints, notes } = req.body;
    const trip = await prisma.fleetTrip.findFirst({ where: { id: req.params.id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (!(await vehicleAllowed(req, trip.vehicleId))) return res.status(403).json({ error: 'Not your assigned vehicle.' });
    if (trip.status === 'COMPLETED') return res.status(409).json({ error: 'Trip already completed' });
    const vehicle = await prisma.vehicle.findFirst({ where: { id: trip.vehicleId } });

    const pts = Array.isArray(routePoints) && routePoints.length ? routePoints : (Array.isArray(trip.routePoints) ? trip.routePoints : []);
    const endOdo = num(endOdometer);
    const startOdo = trip.startOdometer;
    // Distance precedence: odometer delta → explicit GPS distance → haversine of points.
    let dist = 0;
    if (endOdo !== null && startOdo !== null && endOdo >= startOdo) dist = endOdo - startOdo;
    else if (num(distanceKm) !== null) dist = num(distanceKm);
    else dist = routeDistanceKm(pts);
    // Odometer integrity: distance can never be negative.
    dist = Math.max(0, +Number(dist).toFixed(2));

    await prisma.fleetTrip.updateMany({
      where: { id: trip.id },
      data: {
        status: 'COMPLETED', endedAt: new Date(),
        endLat: num(endLat), endLng: num(endLng), endLabel: endLabel || null,
        endOdometer: endOdo, distanceKm: dist, routePoints: pts,
        notes: notes || trip.notes, updatedAt: new Date(),
      },
    });

    // Advance the vehicle odometer so maintenance alerts stay accurate.
    let newOdo = vehicle.currentOdometer || 0;
    if (endOdo !== null && endOdo > newOdo) newOdo = endOdo;
    else newOdo = newOdo + dist;
    newOdo = Math.round(newOdo);
    await prisma.vehicle.updateMany({ where: { id: trip.vehicleId }, data: { currentOdometer: newOdo } });

    const updatedVehicle = { ...vehicle, currentOdometer: newOdo };
    const oilTask = await autoCreateOilTask(updatedVehicle, trip.tenantId);
    const completed = await prisma.fleetTrip.findFirst({ where: { id: trip.id } });
    res.json({ trip: completed, oil: oilStatus(updatedVehicle), vehicleOdometer: newOdo, oilTaskCreated: !!oilTask });
  } catch (err) { next(err); }
};

// Manual full-trip entry (no live GPS) — creates a COMPLETED trip directly.
const createTrip = async (req, res, next) => {
  try {
    const { vehicleId, startLabel, endLabel, startOdometer, endOdometer, distanceKm, startedAt, endedAt, purpose, notes } = req.body;
    if (!vehicleId) return res.status(400).json({ error: 'Vehicle is required' });
    // Spec: the driver must enter both locations for a manual trip.
    if (!startLabel || !String(startLabel).trim()) return res.status(400).json({ error: 'From Location is required' });
    if (!endLabel || !String(endLabel).trim()) return res.status(400).json({ error: 'To Location is required' });
    if (!(await vehicleAllowed(req, vehicleId))) return res.status(403).json({ error: 'This vehicle is not assigned to you.' });
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    const startOdo = num(startOdometer), endOdo = num(endOdometer);
    let dist = num(distanceKm);
    if (dist === null && startOdo !== null && endOdo !== null && endOdo >= startOdo) dist = endOdo - startOdo;
    dist = +Number(dist || 0).toFixed(2);
    // Odometer integrity: a trip must add positive distance.
    if (!(dist > 0)) return res.status(400).json({ error: 'Trip distance must be greater than 0 km (or provide valid start/end odometer readings).' });

    const trip = await prisma.fleetTrip.create({
      data: {
        tenantId: getTenantId(), vehicleId, driverId: vehicle.driverId || req.user.id, driverName: req.user.name,
        status: 'COMPLETED', startedAt: startedAt ? new Date(startedAt) : new Date(), endedAt: endedAt ? new Date(endedAt) : new Date(),
        startLabel: startLabel || null, endLabel: endLabel || null, startOdometer: startOdo, endOdometer: endOdo,
        distanceKm: dist, purpose: purpose || null, notes: notes || null, createdById: req.user.id, routePoints: [],
      },
    });
    let newOdo = vehicle.currentOdometer || 0;
    if (endOdo !== null && endOdo > newOdo) newOdo = endOdo; else newOdo += dist;
    newOdo = Math.round(newOdo);
    await prisma.vehicle.updateMany({ where: { id: vehicleId }, data: { currentOdometer: newOdo } });
    const updatedVehicle = { ...vehicle, currentOdometer: newOdo };
    const oilTask = await autoCreateOilTask(updatedVehicle, getTenantId());
    res.status(201).json({ trip, oil: oilStatus(updatedVehicle), vehicleOdometer: newOdo, oilTaskCreated: !!oilTask });
  } catch (err) { next(err); }
};

const listTrips = async (req, res, next) => {
  try {
    const { date, vehicleId, driverId, status, page = 1, limit = 50 } = req.query;
    const ids = await myVehicleIds(req);
    const where = {
      ...(vehicleId && { vehicleId }),
      ...(driverId && { driverId }),
      ...(status && { status }),
      ...(date && { startedAt: (() => { const { start, end } = dayRange(date); return { gte: start, lte: end }; })() }),
    };
    if (ids) where.vehicleId = { in: ids }; // driver: own vehicles only
    const [data, total] = await Promise.all([
      prisma.fleetTrip.findMany({ where, orderBy: { startedAt: 'desc' }, skip: (Number(page) - 1) * Number(limit), take: Number(limit), include: { vehicle: { select: { name: true, plateNumber: true } } } }),
      prisma.fleetTrip.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { next(err); }
};

const removeTrip = async (req, res, next) => {
  try {
    const result = await prisma.fleetTrip.deleteMany({ where: { id: req.params.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json({ message: 'Trip deleted' });
  } catch (err) { next(err); }
};

const removeCash = async (req, res, next) => {
  try {
    const result = await prisma.fleetCashLog.deleteMany({ where: { id: req.params.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Cash entry not found' });
    res.json({ message: 'Cash entry deleted' });
  } catch (err) { next(err); }
};

// ── Cash accountability ─────────────────────────────────────────────────────
const submitCash = async (req, res, next) => {
  try {
    const { vehicleId, tripId, amount, expense, currency, logDate, notes } = req.body;
    if (amount === undefined || isNaN(Number(amount)) || Number(amount) < 0) return res.status(400).json({ error: 'A valid cash amount is required' });
    if (expense !== undefined && expense !== '' && (isNaN(Number(expense)) || Number(expense) < 0)) return res.status(400).json({ error: 'Expense must be a valid non-negative number' });
    if (vehicleId && !(await vehicleAllowed(req, vehicleId))) return res.status(403).json({ error: 'This vehicle is not assigned to you.' });
    const cash = await prisma.fleetCashLog.create({
      data: {
        tenantId: getTenantId(), vehicleId: vehicleId || null, tripId: tripId || null,
        driverId: req.user.id, driverName: req.user.name,
        amount: Number(amount), expense: num(expense) || 0, currency: (currency || 'SAR').toUpperCase().slice(0, 8),
        logDate: logDate ? new Date(logDate) : new Date(), submittedAt: new Date(),
        notes: notes || null, createdById: req.user.id,
      },
    });
    res.status(201).json(cash);
  } catch (err) { next(err); }
};

const listCash = async (req, res, next) => {
  try {
    const { date, vehicleId, driverId } = req.query;
    const ids = await myVehicleIds(req);
    const where = {
      ...(vehicleId && { vehicleId }),
      ...(driverId && { driverId }),
      ...(date && { logDate: (() => { const { start, end } = dayRange(date); return { gte: start, lte: end }; })() }),
    };
    if (ids) where.vehicleId = { in: ids }; // driver: own vehicles only
    const data = await prisma.fleetCashLog.findMany({ where, orderBy: { submittedAt: 'desc' }, take: 100, include: { vehicle: { select: { name: true, plateNumber: true } } } });
    const total = data.reduce((s, c) => s + Number(c.amount || 0), 0);
    const totalExpense = data.reduce((s, c) => s + Number(c.expense || 0), 0);
    res.json({ data, totalAmount: +total.toFixed(2), totalExpense: +totalExpense.toFixed(2), totalNet: +(total - totalExpense).toFixed(2) });
  } catch (err) { next(err); }
};

// ── Maintenance / oil-change alerts ─────────────────────────────────────────
const alerts = async (req, res, next) => {
  try {
    const ids = await myVehicleIds(req);
    const vehicles = await prisma.vehicle.findMany({ where: ids ? { id: { in: ids } } : {}, orderBy: { name: 'asc' } });
    const rows = vehicles.map((v) => ({
      vehicleId: v.id, name: v.name, plateNumber: v.plateNumber,
      currentOdometer: v.currentOdometer || 0, lastOilChangeOdometer: v.lastOilChangeOdometer || 0,
      ...oilStatus(v),
    }));
    res.json({
      dueCount: rows.filter((r) => r.status === 'DUE').length,
      soonCount: rows.filter((r) => r.status === 'SOON').length,
      vehicles: rows,
    });
  } catch (err) { next(err); }
};

// Driver confirms an oil change was done (Yes) or not (No). "Yes" requires the
// odometer reading at service AND an uploaded receipt voucher/invoice as
// evidence (base64 data URL, max ~5MB). Updates the auto-created PENDING task
// when one exists; otherwise creates a record. Both outcomes are logged.
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const confirmMaintenance = async (req, res, next) => {
  try {
    const { vehicleId, completed, performedOdometer, notes, type, receiptData, receiptName } = req.body;
    if (!(await vehicleAllowed(req, vehicleId))) return res.status(403).json({ error: 'This vehicle is not assigned to you.' });
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    let odo = num(performedOdometer);
    if (completed) {
      if (odo === null) return res.status(400).json({ error: 'Current odo meter reading at service is required.' });
      if (!receiptData || !/^data:(image\/|application\/pdf)/.test(String(receiptData))) {
        return res.status(400).json({ error: 'Receipt voucher/invoice upload is required as evidence (image or PDF).' });
      }
      if (String(receiptData).length > MAX_RECEIPT_BYTES * 1.4) {
        return res.status(400).json({ error: 'Receipt file is too large (max 5 MB).' });
      }
    }

    const tenantId = getTenantId();
    const fill = {
      status: completed ? 'COMPLETED' : 'SKIPPED',
      performedAt: completed ? new Date() : null,
      performedOdometer: completed ? odo : null,
      confirmedById: req.user.id, confirmedByName: req.user.name,
      notes: notes || null,
      receiptName: completed ? (receiptName || 'receipt') : null,
      receiptData: completed ? receiptData : null,
      updatedAt: new Date(),
    };
    // Resolve the auto-created PENDING task first so the same task is closed.
    const pending = await prisma.fleetMaintenance.findFirst({
      where: { vehicleId, type: type || 'OIL_CHANGE', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    let record;
    if (pending) {
      await prisma.fleetMaintenance.updateMany({ where: { id: pending.id }, data: fill });
      record = await prisma.fleetMaintenance.findFirst({ where: { id: pending.id } });
    } else {
      record = await prisma.fleetMaintenance.create({
        data: {
          tenantId, vehicleId, type: type || 'OIL_CHANGE',
          dueAtOdometer: (vehicle.lastOilChangeOdometer || 0) + (vehicle.oilChangeIntervalKm || 5000),
          ...fill,
        },
      });
    }
    // If completed, reset the oil-change baseline so the alert clears.
    if (completed) {
      await prisma.vehicle.updateMany({ where: { id: vehicleId }, data: { lastOilChangeOdometer: odo } });
    }
    const updated = await prisma.vehicle.findFirst({ where: { id: vehicleId } });
    const { receiptData: _omit, ...lightRecord } = record;
    res.status(201).json({ record: { ...lightRecord, hasReceipt: !!record.receiptData }, oil: oilStatus(updated) });
  } catch (err) { next(err); }
};

// Fetch the receipt evidence for one maintenance record (own-vehicle scoped).
const getReceipt = async (req, res, next) => {
  try {
    const rec = await prisma.fleetMaintenance.findFirst({ where: { id: req.params.id } });
    if (!rec || !rec.receiptData) return res.status(404).json({ error: 'Receipt not found' });
    if (!(await vehicleAllowed(req, rec.vehicleId))) return res.status(403).json({ error: 'Not your assigned vehicle.' });
    res.json({ receiptName: rec.receiptName, receiptData: rec.receiptData });
  } catch (err) { next(err); }
};

const listMaintenance = async (req, res, next) => {
  try {
    const { vehicleId } = req.query;
    const ids = await myVehicleIds(req);
    const rows = await prisma.fleetMaintenance.findMany({
      where: { ...(vehicleId && { vehicleId }), ...(ids && { vehicleId: { in: ids } }) },
      orderBy: { createdAt: 'desc' }, take: 100,
      include: { vehicle: { select: { name: true, plateNumber: true } } },
    });
    // Strip heavy base64 receipt payloads from list responses.
    const data = rows.map(({ receiptData, ...r }) => ({ ...r, hasReceipt: !!receiptData }));
    res.json({ data });
  } catch (err) { next(err); }
};

// ── Central dashboard — per vehicle/driver for a day ────────────────────────
const dashboard = async (req, res, next) => {
  try {
    const { start, end } = dayRange(req.query.date);
    const ids = await myVehicleIds(req);
    const vehWhere = ids ? { vehicleId: { in: ids } } : {};
    const [trips, cash, vehicles] = await Promise.all([
      prisma.fleetTrip.findMany({ where: { startedAt: { gte: start, lte: end }, ...vehWhere }, include: { vehicle: { select: { name: true, plateNumber: true } } } }),
      prisma.fleetCashLog.findMany({ where: { logDate: { gte: start, lte: end }, ...vehWhere } }),
      prisma.vehicle.findMany({ where: ids ? { id: { in: ids } } : {} }),
    ]);
    const vMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

    // Group by vehicle (driver follows the vehicle/trip).
    const groups = {};
    const keyFor = (vehicleId) => vehicleId || 'unassigned';
    for (const t of trips) {
      const k = keyFor(t.vehicleId);
      groups[k] = groups[k] || { vehicleId: t.vehicleId, vehicleName: t.vehicle?.name, plateNumber: t.vehicle?.plateNumber, driverName: t.driverName, trips: 0, totalKm: 0, cash: 0, routes: [] };
      groups[k].trips += 1;
      groups[k].totalKm += Number(t.distanceKm || 0);
      groups[k].driverName = groups[k].driverName || t.driverName;
      groups[k].routes.push({ id: t.id, status: t.status, from: t.startLabel || (t.startLat ? `${Number(t.startLat).toFixed(3)},${Number(t.startLng).toFixed(3)}` : '—'), to: t.endLabel || (t.endLat ? `${Number(t.endLat).toFixed(3)},${Number(t.endLng).toFixed(3)}` : '—'), km: Number(t.distanceKm || 0), startedAt: t.startedAt, endedAt: t.endedAt });
    }
    for (const c of cash) {
      const k = keyFor(c.vehicleId);
      groups[k] = groups[k] || { vehicleId: c.vehicleId, vehicleName: vMap[c.vehicleId]?.name, plateNumber: vMap[c.vehicleId]?.plateNumber, driverName: c.driverName, trips: 0, totalKm: 0, cash: 0, routes: [] };
      groups[k].cash += Number(c.amount || 0);
    }
    const rows = Object.values(groups).map((g) => ({
      ...g, totalKm: +g.totalKm.toFixed(2), cash: +g.cash.toFixed(2),
      oil: g.vehicleId && vMap[g.vehicleId] ? oilStatus(vMap[g.vehicleId]) : null,
    }));

    const summary = {
      date: start.toISOString().substring(0, 10),
      totalTrips: trips.length,
      totalKm: +trips.reduce((s, t) => s + Number(t.distanceKm || 0), 0).toFixed(2),
      totalCash: +cash.reduce((s, c) => s + Number(c.amount || 0), 0).toFixed(2),
      activeTrips: trips.filter((t) => t.status === 'IN_PROGRESS').length,
      oilDue: vehicles.filter((v) => oilStatus(v).status === 'DUE').length,
    };
    res.json({ summary, rows });
  } catch (err) { next(err); }
};

// ── Vehicle documents (compliance expiry) ─────────────────────────────────────
// Lists each vehicle's document statuses. Drivers see only their assigned vehicles.
const listDocuments = async (req, res, next) => {
  try {
    const ids = await myVehicleIds(req);
    const where = ids ? { id: { in: ids } } : {};
    const vehicles = await prisma.vehicle.findMany({ where, orderBy: { name: 'asc' } });
    const now = new Date();
    const data = vehicles.map((v) => {
      const s = vehicleDocSummary(v, now);
      return {
        id: v.id, name: v.name, plateNumber: v.plateNumber, driverName: v.driverName,
        nusuk: v.nusuk === true, docs: s.docs, overdueCount: s.overdue.length,
        hasIssues: s.hasIssues, docReviewPending: !!v.docReviewPending, docsConfirmedAt: v.docsConfirmedAt,
      };
    });
    res.json({ data });
  } catch (err) { next(err); }
};

// Confirms the documents are valid — clears the open review task (audited).
const confirmDocuments = async (req, res, next) => {
  try {
    const v = await prisma.vehicle.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Vehicle not found' });
    if (!(await vehicleAllowed(req, v.id))) return res.status(403).json({ error: 'This vehicle is not assigned to you.' });
    await prisma.vehicle.updateMany({
      where: { id: v.id },
      data: { docReviewPending: false, docsConfirmedAt: new Date(), docsConfirmedById: req.user.id },
    });
    res.json({ message: 'Documents confirmed' });
  } catch (err) { next(err); }
};

module.exports = {
  startTrip, addPoint, stopTrip, createTrip, listTrips, removeTrip,
  submitCash, listCash, removeCash, alerts, confirmMaintenance, listMaintenance, getReceipt, dashboard,
  listDocuments, confirmDocuments,
};
