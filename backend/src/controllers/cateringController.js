const prisma = require('../config/database');

const getVendors = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;
    const where = {
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };
    const vendors = await prisma.cateringVendor.findMany({ where, include: { mealPlans: true }, orderBy: { name: 'asc' } });
    res.json(vendors);
  } catch (err) {
    next(err);
  }
};

const getVendor = async (req, res, next) => {
  try {
    const vendor = await prisma.cateringVendor.findFirst({ where: { id: req.params.id }, include: { mealPlans: true } });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json(vendor);
  } catch (err) {
    next(err);
  }
};

const createVendor = async (req, res, next) => {
  try {
    const { name, contactName, phone, email, address, speciality, mealPlans } = req.body;
    const vendor = await prisma.cateringVendor.create({
      data: { name, contactName, phone, email, address, speciality, mealPlans: mealPlans ? { create: mealPlans } : undefined },
      include: { mealPlans: true },
    });
    res.status(201).json(vendor);
  } catch (err) {
    next(err);
  }
};

const updateVendor = async (req, res, next) => {
  try {
    const { name, contactName, phone, email, address, speciality, isActive } = req.body;
    const result = await prisma.cateringVendor.updateMany({
      where: { id: req.params.id },
      data: { name, contactName, phone, email, address, speciality, isActive },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Vendor not found' });
    const vendor = await prisma.cateringVendor.findFirst({ where: { id: req.params.id }, include: { mealPlans: true } });
    res.json(vendor);
  } catch (err) {
    next(err);
  }
};

const deleteVendor = async (req, res, next) => {
  try {
    const result = await prisma.cateringVendor.updateMany({ where: { id: req.params.id }, data: { isActive: false } });
    if (result.count === 0) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ message: 'Vendor deactivated' });
  } catch (err) {
    next(err);
  }
};

const getMealPlans = async (req, res, next) => {
  try {
    const { vendorId, mealType } = req.query;
    const mealPlans = await prisma.mealPlan.findMany({
      where: { isActive: true, ...(vendorId && { vendorId }), ...(mealType && { mealType }) },
      include: { vendor: { select: { id: true, name: true } } },
    });
    res.json(mealPlans);
  } catch (err) {
    next(err);
  }
};

const createMealPlan = async (req, res, next) => {
  try {
    // Verify the parent vendor belongs to the current tenant
    if (req.body.vendorId) {
      const vendor = await prisma.cateringVendor.findFirst({ where: { id: req.body.vendorId }, select: { id: true } });
      if (!vendor) return res.status(404).json({ error: 'Vendor not found in your tenant' });
    }
    const mealPlan = await prisma.mealPlan.create({ data: req.body, include: { vendor: true } });
    res.status(201).json(mealPlan);
  } catch (err) {
    next(err);
  }
};

const updateMealPlan = async (req, res, next) => {
  try {
    // Verify the meal plan's vendor belongs to the current tenant
    const plan = await prisma.mealPlan.findUnique({ where: { id: req.params.id }, include: { vendor: { select: { tenantId: true } } } });
    if (!plan) return res.status(404).json({ error: 'Meal plan not found' });
    const { getTenantId } = require('../config/tenantContext');
    const ctxTenant = getTenantId();
    if (ctxTenant && plan.vendor.tenantId !== ctxTenant) return res.status(404).json({ error: 'Meal plan not found' });

    const mealPlan = await prisma.mealPlan.update({ where: { id: req.params.id }, data: req.body, include: { vendor: true } });
    res.json(mealPlan);
  } catch (err) {
    next(err);
  }
};

const deleteMealPlan = async (req, res, next) => {
  try {
    const plan = await prisma.mealPlan.findUnique({ where: { id: req.params.id }, include: { vendor: { select: { tenantId: true } } } });
    if (!plan) return res.status(404).json({ error: 'Meal plan not found' });
    const { getTenantId } = require('../config/tenantContext');
    const ctxTenant = getTenantId();
    if (ctxTenant && plan.vendor.tenantId !== ctxTenant) return res.status(404).json({ error: 'Meal plan not found' });

    await prisma.mealPlan.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Meal plan deactivated' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getVendors, getVendor, createVendor, updateVendor, deleteVendor, getMealPlans, createMealPlan, updateMealPlan, deleteMealPlan };
