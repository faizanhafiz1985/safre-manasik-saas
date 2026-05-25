const prisma = require('../config/database');

const taskInclude = {
  lead: { select: { id: true, fullName: true, phone: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
};

const getAll = async (req, res, next) => {
  try {
    const { status, priority, assignedToId, leadId, overdue, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    const where = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assignedToId && { assignedToId }),
      ...(leadId && { leadId }),
      ...(overdue === 'true' && {
        dueAt: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      }),
    };

    // Non-admin agents only see their own tasks
    if (req.user.role === 'AGENT') where.assignedToId = req.user.id;

    const [tasks, total] = await Promise.all([
      prisma.crmTask.findMany({ where, skip, take: Number(limit), include: taskInclude, orderBy: { dueAt: 'asc' } }),
      prisma.crmTask.count({ where }),
    ]);
    res.json({ data: tasks, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { leadId, opportunityId, title, description, dueAt, priority, assignedToId, reminderAt } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const task = await prisma.crmTask.create({
      data: {
        tenantId,
        leadId: leadId || null,
        opportunityId: opportunityId || null,
        title: title.trim(),
        description,
        dueAt: dueAt ? new Date(dueAt) : null,
        priority: priority || 'MEDIUM',
        assignedToId: assignedToId || req.user.id,
        createdById: req.user.id,
        reminderAt: reminderAt ? new Date(reminderAt) : null,
      },
      include: taskInclude,
    });
    res.status(201).json(task);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { title, description, dueAt, priority, assignedToId, status, reminderAt } = req.body;
    const data = {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
      ...(priority !== undefined && { priority }),
      ...(assignedToId !== undefined && { assignedToId }),
      ...(status !== undefined && { status }),
      ...(status === 'COMPLETED' && { completedAt: new Date() }),
      ...(reminderAt !== undefined && { reminderAt: reminderAt ? new Date(reminderAt) : null }),
    };
    const result = await prisma.crmTask.updateMany({ where: { id: req.params.id }, data });
    if (result.count === 0) return res.status(404).json({ error: 'Task not found' });
    const task = await prisma.crmTask.findFirst({ where: { id: req.params.id }, include: taskInclude });
    res.json(task);
  } catch (err) { next(err); }
};

const complete = async (req, res, next) => {
  try {
    const result = await prisma.crmTask.updateMany({
      where: { id: req.params.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task completed' });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const result = await prisma.crmTask.updateMany({
      where: { id: req.params.id }, data: { status: 'CANCELLED' },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task cancelled' });
  } catch (err) { next(err); }
};

const getToday = async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const where = {
      dueAt: { gte: today, lt: tomorrow },
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
      ...(req.user.role === 'AGENT' && { assignedToId: req.user.id }),
    };
    const tasks = await prisma.crmTask.findMany({ where, include: taskInclude, orderBy: { dueAt: 'asc' } });
    res.json(tasks);
  } catch (err) { next(err); }
};

module.exports = { getAll, create, update, complete, remove, getToday };
