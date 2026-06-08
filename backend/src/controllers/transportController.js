const prisma = require('../config/database');
const { getFleetScope } = require('../utils/fleetScope');

// Sanitize the fleet-related fields before persisting (empty driverId → null,
// odometer/interval coerced to int). Leaves all other vehicle fields untouched.
function cleanVehicleBody(body) {
  const b = { ...body };
  if ('driverId' in b) b.driverId = b.driverId ? String(b.driverId) : null;
  for (const k of ['currentOdometer', 'oilChangeIntervalKm', 'lastOilChangeOdometer', 'capacity']) {
    if (k in b && b[k] !== undefined && b[k] !== null && b[k] !== '') b[k] = parseInt(b[k], 10) || 0;
  }
  return b;
}

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
    const vehicle = await prisma.vehicle.create({ data: cleanVehicleBody(req.body) });
    res.status(201).json(vehicle);
  } catch (err) {
    next(err);
  }
};

const updateVehicle = async (req, res, next) => {
  try {
    const result = await prisma.vehicle.updateMany({ where: { id: req.params.id }, data: cleanVehicleBody(req.body) });
    if (result.count === 0) return res.status(404).json({ error: 'Vehicle not found' });
    const vehicle = await prisma.vehicle.findFirst({ where: { id: req.params.id } });
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
