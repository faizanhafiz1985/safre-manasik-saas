const prisma = require('../config/database');

// ─── Pipelines ───────────────────────────────────────────────────────────────

const listPipelines = async (req, res, next) => {
  try {
    const pipelines = await prisma.crmPipeline.findMany({
      include: { stages: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(pipelines);
  } catch (err) { next(err); }
};

const createPipeline = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, description, stages } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Pipeline name is required' });

    const defaultStages = stages || [
      { name: 'New Inquiry', position: 1, color: '#6366F1', probability: 10 },
      { name: 'Contacted', position: 2, color: '#F59E0B', probability: 30 },
      { name: 'Qualified', position: 3, color: '#3B82F6', probability: 50 },
      { name: 'Proposal Sent', position: 4, color: '#8B5CF6', probability: 70 },
      { name: 'Negotiation', position: 5, color: '#EC4899', probability: 85 },
      { name: 'Won', position: 6, color: '#10B981', probability: 100, isWon: true },
      { name: 'Lost', position: 7, color: '#EF4444', probability: 0, isLost: true },
    ];

    const pipeline = await prisma.crmPipeline.create({
      data: {
        tenantId,
        name: name.trim(),
        description,
        stages: {
          create: defaultStages.map((s) => ({
            tenantId,
            name: s.name,
            position: s.position,
            color: s.color || '#1B4B35',
            probability: s.probability ?? 50,
            isWon: s.isWon || false,
            isLost: s.isLost || false,
          })),
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });

    res.status(201).json(pipeline);
  } catch (err) { next(err); }
};

const updatePipeline = async (req, res, next) => {
  try {
    const { name, description, isDefault, isActive } = req.body;
    const result = await prisma.crmPipeline.updateMany({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Pipeline not found' });
    const pipeline = await prisma.crmPipeline.findFirst({
      where: { id: req.params.id },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    res.json(pipeline);
  } catch (err) { next(err); }
};

const deletePipeline = async (req, res, next) => {
  try {
    const count = await prisma.crmOpportunity.count({ where: { pipelineId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({ error: `Cannot delete: ${count} opportunities exist in this pipeline` });
    }
    await prisma.crmPipeline.updateMany({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Pipeline archived' });
  } catch (err) { next(err); }
};

// Kanban board — returns one pipeline with stages + opportunities grouped
const getKanban = async (req, res, next) => {
  try {
    const pipeline = await prisma.crmPipeline.findFirst({
      where: { id: req.params.id },
      include: {
        stages: {
          orderBy: { position: 'asc' },
          include: {
            opportunities: {
              where: { isWon: false, isLost: false },
              include: {
                lead: { select: { id: true, fullName: true, phone: true, source: true } },
                assignedTo: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
    res.json(pipeline);
  } catch (err) { next(err); }
};

// ─── Stages ──────────────────────────────────────────────────────────────────

const addStage = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, color, probability, isWon, isLost } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Stage name is required' });

    const lastStage = await prisma.crmPipelineStage.findFirst({
      where: { pipelineId: req.params.id },
      orderBy: { position: 'desc' },
    });
    const position = (lastStage?.position || 0) + 1;

    const stage = await prisma.crmPipelineStage.create({
      data: {
        tenantId,
        pipelineId: req.params.id,
        name: name.trim(),
        position,
        color: color || '#1B4B35',
        probability: probability ?? 50,
        isWon: isWon || false,
        isLost: isLost || false,
      },
    });
    res.status(201).json(stage);
  } catch (err) { next(err); }
};

const updateStage = async (req, res, next) => {
  try {
    const { name, color, probability, position, isWon, isLost } = req.body;
    const result = await prisma.crmPipelineStage.updateMany({
      where: { id: req.params.stageId },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(probability !== undefined && { probability }),
        ...(position !== undefined && { position }),
        ...(isWon !== undefined && { isWon }),
        ...(isLost !== undefined && { isLost }),
      },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Stage not found' });
    const stage = await prisma.crmPipelineStage.findFirst({ where: { id: req.params.stageId } });
    res.json(stage);
  } catch (err) { next(err); }
};

// ─── Opportunities ────────────────────────────────────────────────────────────

const listOpportunities = async (req, res, next) => {
  try {
    const { pipelineId, stageId, assignedToId, isWon, isLost, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(pipelineId && { pipelineId }),
      ...(stageId && { stageId }),
      ...(assignedToId && { assignedToId }),
      ...(isWon !== undefined && { isWon: isWon === 'true' }),
      ...(isLost !== undefined && { isLost: isLost === 'true' }),
    };

    const [opps, total] = await Promise.all([
      prisma.crmOpportunity.findMany({
        where, skip, take: Number(limit),
        include: {
          lead: { select: { id: true, fullName: true, phone: true } },
          stage: { select: { id: true, name: true, color: true } },
          pipeline: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.crmOpportunity.count({ where }),
    ]);
    res.json({ data: opps, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

const createOpportunity = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { leadId, pipelineId, stageId, title, value, currency, expectedCloseAt, probability, assignedToId, notes } = req.body;
    if (!pipelineId) return res.status(400).json({ error: 'pipelineId is required' });
    if (!stageId) return res.status(400).json({ error: 'stageId is required' });
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const opp = await prisma.crmOpportunity.create({
      data: {
        tenantId, leadId, pipelineId, stageId,
        title: title.trim(),
        value: value ? Number(value) : null,
        currency: currency || 'SAR',
        expectedCloseAt: expectedCloseAt ? new Date(expectedCloseAt) : null,
        probability: probability ?? 50,
        assignedToId: assignedToId || null,
        notes,
      },
      include: {
        lead: { select: { id: true, fullName: true } },
        stage: true,
        pipeline: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    await prisma.crmOpportunityActivity.create({
      data: { tenantId, opportunityId: opp.id, userId: req.user.id, action: 'created', description: `Opportunity "${opp.title}" created` },
    });

    res.status(201).json(opp);
  } catch (err) { next(err); }
};

const moveOpportunity = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { stageId, isWon, isLost, lostReason } = req.body;

    const old = await prisma.crmOpportunity.findFirst({ where: { id: req.params.id }, include: { stage: true } });
    if (!old) return res.status(404).json({ error: 'Opportunity not found' });

    const result = await prisma.crmOpportunity.updateMany({
      where: { id: req.params.id },
      data: {
        ...(stageId && { stageId }),
        ...(isWon !== undefined && { isWon }),
        ...(isLost !== undefined && { isLost }),
        ...(isWon && { wonAt: new Date() }),
        ...(isLost && { lostAt: new Date(), lostReason }),
      },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Not found' });

    const opp = await prisma.crmOpportunity.findFirst({
      where: { id: req.params.id },
      include: { stage: true, pipeline: { select: { id: true, name: true } } },
    });

    if (stageId && stageId !== old.stageId) {
      await prisma.crmOpportunityActivity.create({
        data: {
          tenantId,
          opportunityId: opp.id,
          userId: req.user.id,
          action: 'stage_moved',
          description: `Moved from "${old.stage?.name}" to "${opp.stage?.name}"`,
          metadata: { from: old.stageId, to: stageId },
        },
      });
    }
    if (isWon) {
      await prisma.crmOpportunityActivity.create({
        data: { tenantId, opportunityId: opp.id, userId: req.user.id, action: 'won', description: 'Opportunity marked as Won' },
      });
    }
    if (isLost) {
      await prisma.crmOpportunityActivity.create({
        data: { tenantId, opportunityId: opp.id, userId: req.user.id, action: 'lost', description: `Opportunity lost: ${lostReason || 'No reason given'}` },
      });
    }

    res.json(opp);
  } catch (err) { next(err); }
};

const deleteOpportunity = async (req, res, next) => {
  try {
    const result = await prisma.crmOpportunity.updateMany({
      where: { id: req.params.id }, data: { isLost: true, lostAt: new Date(), lostReason: 'Deleted' },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Opportunity not found' });
    res.json({ message: 'Opportunity closed as lost' });
  } catch (err) { next(err); }
};

module.exports = {
  listPipelines, createPipeline, updatePipeline, deletePipeline, getKanban,
  addStage, updateStage,
  listOpportunities, createOpportunity, moveOpportunity, deleteOpportunity,
};
