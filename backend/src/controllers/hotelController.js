const prisma = require('../config/database');

const getAll = async (req, res, next) => {
  try {
    const { city, search } = req.query;
    const where = {
      isActive: true,
      ...(city && { city }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };
    const hotels = await prisma.hotel.findMany({ where, orderBy: { name: 'asc' } });
    res.json(hotels);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const hotel = await prisma.hotel.findFirst({ where: { id: req.params.id } });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    next(err);
  }
};

const validateHotelInput = (body) => {
  const { name, city, stars } = body;
  if (!name || !name.trim()) return 'Hotel name is required';
  if (!city || !city.trim()) return 'City is required';
  if (stars !== undefined && stars !== null) {
    const s = Number(stars);
    if (isNaN(s) || s < 1 || s > 5) return 'Stars must be between 1 and 5';
  }
  return null;
};

const create = async (req, res, next) => {
  try {
    const err = validateHotelInput(req.body);
    if (err) return res.status(400).json({ error: err });
    const hotel = await prisma.hotel.create({ data: req.body });
    res.status(201).json(hotel);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const err = validateHotelInput(req.body);
    if (err) return res.status(400).json({ error: err });
    const result = await prisma.hotel.updateMany({ where: { id: req.params.id }, data: req.body });
    if (result.count === 0) return res.status(404).json({ error: 'Hotel not found' });
    const hotel = await prisma.hotel.findFirst({ where: { id: req.params.id } });
    res.json(hotel);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await prisma.hotel.updateMany({ where: { id: req.params.id }, data: { isActive: false } });
    if (result.count === 0) return res.status(404).json({ error: 'Hotel not found' });
    res.json({ message: 'Hotel deactivated' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, remove };
