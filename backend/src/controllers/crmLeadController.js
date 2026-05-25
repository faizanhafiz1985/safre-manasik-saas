const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const { notifyNewLead, notifyLeadAssigned } = require('../services/crmNotificationService');
const { runAutomations } = require('../services/crmAutomationEngine');

const leadInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  activities: { orderBy: { createdAt: 'desc' }, take: 20 },
  tasks: { where: { status: { not: 'COMPLETED' } }, orderBy: { dueAt: 'asc' } },
  opportunities: { include: { stage: true, pipeline: { select: { id: true, name: true } } } },
  conversations: { orderBy: { lastMessageAt: 'desc' }, take: 5 },
};

const getAll = async (req, res, next) => {
  try {
    const {
      status, source, priority, assignedToId, search,
      page = 1, limit = 20, dateFrom, dateTo, tags,
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(status && { status }),
      ...(source && { source }),
      ...(priority && { priority }),
      ...(assignedToId && { assignedToId }),
      ...(dateFrom && dateTo && { createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) } }),
      ...(tags && { tags: { hasSome: tags.split(',') } }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { whatsappNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [leads, total] = await Promise.all([
      prisma.crmLead.findMany({
        where, skip, take: Number(limit),
        include: { assignedTo: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.crmLead.count({ where }),
    ]);

    res.json({ data: leads, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const lead = await prisma.crmLead.findFirst({
      where: { id: req.params.id },
      include: leadInclude,
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      fullName, phone, whatsappNumber, email, country, nationality, city,
      travelInterest, packageInterest, budget, budgetCurrency, numberOfTravelers,
      preferredDateFrom, preferredDateTo, source, status, priority, assignedToId,
      tags, notes, sourceRef, utmCampaign, utmSource, followUpAt,
    } = req.body;

    if (!fullName?.trim()) return res.status(400).json({ error: 'Full name is required' });

    const lead = await prisma.crmLead.create({
      data: {
        tenantId,
        fullName: fullName.trim(),
        phone, whatsappNumber, email, country, nationality, city,
        travelInterest, packageInterest,
        budget: budget ? Number(budget) : null,
        budgetCurrency: budgetCurrency || 'SAR',
        numberOfTravelers: numberOfTravelers ? Number(numberOfTravelers) : null,
        preferredDateFrom: preferredDateFrom ? new Date(preferredDateFrom) : null,
        preferredDateTo: preferredDateTo ? new Date(preferredDateTo) : null,
        source: source || 'MANUAL',
        status: status || 'NEW',
        priority: priority || 'MEDIUM',
        assignedToId: assignedToId || null,
        tags: tags || [],
        notes,
        sourceRef, utmCampaign, utmSource,
        followUpAt: followUpAt ? new Date(followUpAt) : null,
      },
      include: leadInclude,
    });

    // Activity log
    await prisma.crmLeadActivity.create({
      data: {
        tenantId,
        leadId: lead.id,
        userId: req.user.id,
        action: 'lead_created',
        description: `Lead created from ${lead.source}`,
      },
    });

    // Notifications (fire-and-forget)
    notifyNewLead(tenantId, lead).catch(() => {});
    if (assignedToId) notifyLeadAssigned(tenantId, lead, assignedToId).catch(() => {});
    runAutomations({ tenantId, trigger: 'lead_created', entity: lead }).catch(() => {});

    res.status(201).json(lead);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const old = await prisma.crmLead.findFirst({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ error: 'Lead not found' });

    const {
      fullName, phone, whatsappNumber, email, country, nationality, city,
      travelInterest, packageInterest, budget, budgetCurrency, numberOfTravelers,
      preferredDateFrom, preferredDateTo, status, priority, assignedToId,
      tags, notes, followUpAt, lostReason,
    } = req.body;

    const statusChanged = status && status !== old.status;
    const agentChanged = assignedToId !== undefined && assignedToId !== old.assignedToId;

    const result = await prisma.crmLead.updateMany({
      where: { id: req.params.id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(phone !== undefined && { phone }),
        ...(whatsappNumber !== undefined && { whatsappNumber }),
        ...(email !== undefined && { email }),
        ...(country !== undefined && { country }),
        ...(nationality !== undefined && { nationality }),
        ...(city !== undefined && { city }),
        ...(travelInterest !== undefined && { travelInterest }),
        ...(packageInterest !== undefined && { packageInterest }),
        ...(budget !== undefined && { budget: budget ? Number(budget) : null }),
        ...(budgetCurrency !== undefined && { budgetCurrency }),
        ...(numberOfTravelers !== undefined && { numberOfTravelers: numberOfTravelers ? Number(numberOfTravelers) : null }),
        ...(preferredDateFrom !== undefined && { preferredDateFrom: preferredDateFrom ? new Date(preferredDateFrom) : null }),
        ...(preferredDateTo !== undefined && { preferredDateTo: preferredDateTo ? new Date(preferredDateTo) : null }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(tags !== undefined && { tags }),
        ...(notes !== undefined && { notes }),
        ...(followUpAt !== undefined && { followUpAt: followUpAt ? new Date(followUpAt) : null }),
        ...(lostReason !== undefined && { lostReason }),
        ...(status === 'CONVERTED' && { convertedAt: new Date() }),
      },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Lead not found' });

    const lead = await prisma.crmLead.findFirst({ where: { id: req.params.id }, include: leadInclude });

    // Activity logs
    if (statusChanged) {
      await prisma.crmLeadActivity.create({
        data: {
          tenantId,
          leadId: lead.id,
          userId: req.user.id,
          action: 'status_changed',
          description: `Status changed from ${old.status} to ${status}`,
          metadata: { from: old.status, to: status },
        },
      });
      runAutomations({ tenantId, trigger: 'lead_status_changed', entity: lead }).catch(() => {});
    }
    if (agentChanged) {
      await prisma.crmLeadActivity.create({
        data: {
          tenantId,
          leadId: lead.id,
          userId: req.user.id,
          action: 'assigned',
          description: assignedToId ? `Lead assigned` : `Lead unassigned`,
          metadata: { from: old.assignedToId, to: assignedToId },
        },
      });
      if (assignedToId) notifyLeadAssigned(tenantId, lead, assignedToId).catch(() => {});
    }

    res.json(lead);
  } catch (err) { next(err); }
};

const addNote = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ error: 'Note is required' });

    const exists = await prisma.crmLead.findFirst({ where: { id: req.params.id } });
    if (!exists) return res.status(404).json({ error: 'Lead not found' });

    const activity = await prisma.crmLeadActivity.create({
      data: {
        tenantId,
        leadId: req.params.id,
        userId: req.user.id,
        action: 'note_added',
        description: note.trim(),
      },
    });

    // Also update the lead's main notes field with the latest note
    await prisma.crmLead.updateMany({
      where: { id: req.params.id },
      data: { notes: note.trim(), lastContactedAt: new Date() },
    });

    res.status(201).json(activity);
  } catch (err) { next(err); }
};

const bulkImport = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { leads } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'leads array is required' });
    }
    if (leads.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 leads per import' });
    }

    const data = leads.map((l) => ({
      tenantId,
      fullName: l.fullName || l.full_name || 'Unknown',
      phone: l.phone || null,
      whatsappNumber: l.whatsappNumber || l.whatsapp || null,
      email: l.email || null,
      country: l.country || null,
      nationality: l.nationality || null,
      city: l.city || null,
      source: l.source || 'MANUAL',
      status: 'NEW',
      priority: l.priority || 'MEDIUM',
      notes: l.notes || null,
      tags: l.tags || [],
    }));

    const result = await prisma.crmLead.createMany({ data, skipDuplicates: true });
    res.json({ imported: result.count, total: leads.length });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const result = await prisma.crmLead.updateMany({
      where: { id: req.params.id },
      data: { isSpam: true, status: 'SPAM' },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json({ message: 'Lead marked as spam/archived' });
  } catch (err) { next(err); }
};

const getStats = async (req, res, next) => {
  try {
    const [total, byStatus, bySource, byPriority] = await Promise.all([
      prisma.crmLead.count(),
      prisma.crmLead.groupBy({ by: ['status'], _count: true }),
      prisma.crmLead.groupBy({ by: ['source'], _count: true }),
      prisma.crmLead.groupBy({ by: ['priority'], _count: true }),
    ]);
    res.json({ total, byStatus, bySource, byPriority });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, addNote, bulkImport, remove, getStats };
