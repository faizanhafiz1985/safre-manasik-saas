const prisma = require('../config/database');

const getAll = async (req, res, next) => {
  try {
    const rules = await prisma.crmAutomationRule.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(rules);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, description, trigger, conditions, actions } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!trigger) return res.status(400).json({ error: 'Trigger is required' });

    const VALID_TRIGGERS = ['lead_created', 'lead_status_changed', 'task_overdue', 'lead_inactivity'];
    if (!VALID_TRIGGERS.includes(trigger)) {
      return res.status(400).json({ error: `Invalid trigger. Valid values: ${VALID_TRIGGERS.join(', ')}` });
    }

    const rule = await prisma.crmAutomationRule.create({
      data: {
        tenantId,
        name: name.trim(),
        description,
        trigger,
        conditions: conditions || [],
        actions: actions || [],
        isActive: true,
      },
    });
    res.status(201).json(rule);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { name, description, trigger, conditions, actions, isActive } = req.body;
    const result = await prisma.crmAutomationRule.updateMany({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(trigger !== undefined && { trigger }),
        ...(conditions !== undefined && { conditions }),
        ...(actions !== undefined && { actions }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Rule not found' });
    const rule = await prisma.crmAutomationRule.findFirst({ where: { id: req.params.id } });
    res.json(rule);
  } catch (err) { next(err); }
};

const toggle = async (req, res, next) => {
  try {
    const rule = await prisma.crmAutomationRule.findFirst({ where: { id: req.params.id } });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    await prisma.crmAutomationRule.updateMany({
      where: { id: req.params.id }, data: { isActive: !rule.isActive },
    });
    res.json({ id: rule.id, isActive: !rule.isActive });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const result = await prisma.crmAutomationRule.updateMany({
      where: { id: req.params.id }, data: { isActive: false },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ message: 'Rule deactivated' });
  } catch (err) { next(err); }
};

module.exports = { getAll, create, update, toggle, remove };
