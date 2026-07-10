const prisma = require('../config/database');
const { getFleetScope } = require('../utils/fleetScope');
const { DOC_KEYS, checkVehicle } = require('../services/fleetDocsService');

// Sanitize the fleet-related fields before persisting (empty driverId → null,
// odometer/interval coerced to int). Leaves all other vehicle fields untouched.
function cleanVehicleBody(body) {
  const b = { ...body };
  if ('driverId' in b) b.driverId = b.driverId ? String(b.driverId) : null;
  // Vehicle type is a free configurable string — normalise (trim + uppercase).
  if ('type' in b && b.type) b.type = String(b.type).trim().toUpperCase().slice(0, 40);
  // Driver Iqama # — keep digits only, cap at 10 (validated below).
  if ('driverIqama' in b && b.driverIqama != null) b.driverIqama = String(b.driverIqama).replace(/\D/g, '').slice(0, 10);
  for (const k of ['initialOdometer', 'oilChangeIntervalKm', 'lastOilChangeOdometer', 'capacity']) {
    if (k in b && b[k] !== undefined && b[k] !== null && b[k] !== '') b[k] = Math.max(0, parseInt(b[k], 10) || 0);
  }
  // Compliance document expiry dates: 'YYYY-MM-DD' (or ISO) → Date, else null.
  for (const k of DOC_KEYS) {
    if (k in b) b[k] = b[k] ? new Date(b[k]) : null;
  }
  // Nusuk is a yes/no flag.
  if ('nusuk' in b) b.nusuk = b.nusuk === true || b.nusuk === 'true' || b.nusuk === 'yes' || b.nusuk === 1 || b.nusuk === '1';
  // Alert/confirmation tracking is server-managed — never accept from input.
  for (const k of ['docAlertState', 'docReviewPending', 'docsConfirmedAt', 'docsConfirmedById', 'currentOdometer']) delete b[k];
  return b;
}

// Driver Iqama is mandatory and must be exactly 10 digits. Returns an error
// string, or null when valid.
function validateIqama(value) {
  if (!value) return 'Driver Iqama # is required';
  if (!/^\d{10}$/.test(String(value))) return 'Driver Iqama # must be exactly 10 digits';
  return null;
}

// The 8 document expiry dates + Nusuk are mandatory. `data` holds coerced
// values (dates already Date|null, nusuk boolean). Returns an error string or null.
const DOC_LABELS = {
  istimaraExpiry: 'Istimara', iqamaExpiry: 'Iqama', kartashkeelExpiry: 'Kart Tashkeel',
  licenseExpiry: 'License', bathakaSaicExpiry: 'Bathaka SAIC', ajeerExpiry: 'Ajeer',
  tameenExpiry: 'Tameen', fahasExpiry: 'Fahas',
};
function validateVehicleDocs(data) {
  for (const k of DOC_KEYS) {
    const v = data[k];
    if (!v || isNaN(new Date(v).getTime())) return `${DOC_LABELS[k]} date is required`;
  }
  if (typeof data.nusuk !== 'boolean') return 'Nusuk (Yes/No) is required';
  return null;
}

// The document fields are mandatory only for callers that submit them — i.e. the
// web "define vehicle" form (which sends all 8 dates + nusuk). Lighter callers
// that don't touch documents (mobile app, seed/QA tooling) are left untouched, so
// this never breaks vehicle create/edit that isn't about documents.
const bodyHasDocFields = (body) => DOC_KEYS.some((k) => k in body) || 'nusuk' in body;

const getVehicles = async (req, res, next) => {
  try {
    const { type, isAvailable, search } = req.query;
    const where = {
      ...(type && { type }),
      ...(isAvailable !== undefined && { isAvailable: isAvailable === 'true' }),
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { plateNumber: { contains: search, mode: 'insensitive' } }] }),
    };
    // A driver (fleet perms but no fleet-wide access) only sees their assigned vehicles.
    const scope = await getFleetScope(req);
    if (scope.driver) where.driverId = req.user.id;
    const vehicles = await prisma.vehicle.findMany({ where, orderBy: { name: 'asc' } });
    res.json(vehicles);
  } catch (err) {
    next(err);
  }
};

const getVehicle = async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: req.params.id } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
};

const createVehicle = async (req, res, next) => {
  try {
    const data = cleanVehicleBody(req.body);
    const iqamaErr = validateIqama(data.driverIqama);
    if (iqamaErr) return res.status(400).json({ error: iqamaErr });
    // Enforce mandatory documents only when the caller submits them (web form).
    if (bodyHasDocFields(req.body)) {
      const docErr = validateVehicleDocs(data);
      if (docErr) return res.status(400).json({ error: docErr });
    }
    // New vehicle: current odometer starts at the initial baseline.
    data.currentOdometer = data.initialOdometer || 0;
    const vehicle = await prisma.vehicle.create({ data });
    // Fire an immediate document due-check (email + task if already expired).
    checkVehicle(vehicle.id).catch(() => {});
    res.status(201).json(vehicle);
  } catch (err) {
    next(err);
  }
};

const updateVehicle = async (req, res, next) => {
  try {
    const data = cleanVehicleBody(req.body);
    // Iqama is mandatory; validate whenever it's part of the update payload.
    if ('driverIqama' in data) {
      const iqamaErr = validateIqama(data.driverIqama);
      if (iqamaErr) return res.status(400).json({ error: iqamaErr });
    }
    // Enforce mandatory documents only when the payload includes them (web form).
    // Callers that don't submit document fields (mobile app, tooling) are untouched.
    if (bodyHasDocFields(req.body)) {
      const docErr = validateVehicleDocs(data);
      if (docErr) return res.status(400).json({ error: docErr });
    }
    // Editing the initial baseline shifts the computed current odometer by the
    // same delta, preserving all accumulated trip kms.
    if ('initialOdometer' in data) {
      const old = await prisma.vehicle.findFirst({ where: { id: req.params.id }, select: { initialOdometer: true, currentOdometer: true } });
      if (!old) return res.status(404).json({ error: 'Vehicle not found' });
      const delta = (data.initialOdometer || 0) - (old.initialOdometer || 0);
      if (delta !== 0) data.currentOdometer = Math.max(0, (old.currentOdometer || 0) + delta);
    }
    const result = await prisma.vehicle.updateMany({ where: { id: req.params.id }, data });
    if (result.count === 0) return res.status(404).json({ error: 'Vehicle not found' });
    const vehicle = await prisma.vehicle.findFirst({ where: { id: req.params.id } });
    // Re-check documents on save — clears/opens the review task and alerts on new expiries.
    checkVehicle(vehicle.id).catch(() => {});
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
};

const deleteVehicle = async (req, res, next) => {
  try {
    const result = await prisma.vehicle.deleteMany({ where: { id: req.params.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ message: 'Vehicle deleted' });
  } catch (err) {
    next(err);
  }
};

const getRoutes = async (req, res, next) => {
  try {
    const routes = await prisma.route.findMany({ include: { vehicle: true }, orderBy: { name: 'asc' } });
    res.json(routes);
  } catch (err) {
    next(err);
  }
};

const createRoute = async (req, res, next) => {
  try {
    const route = await prisma.route.create({ data: req.body, include: { vehicle: true } });
    res.status(201).json(route);
  } catch (err) {
    next(err);
  }
};

const updateRoute = async (req, res, next) => {
  try {
    const result = await prisma.route.updateMany({ where: { id: req.params.id }, data: req.body });
    if (result.count === 0) return res.status(404).json({ error: 'Route not found' });
    const route = await prisma.route.findFirst({ where: { id: req.params.id }, include: { vehicle: true } });
    res.json(route);
  } catch (err) {
    next(err);
  }
};

const deleteRoute = async (req, res, next) => {
  try {
    const result = await prisma.route.deleteMany({ where: { id: req.params.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Route not found' });
    res.json({ message: 'Route deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle, getRoutes, createRoute, updateRoute, deleteRoute };
