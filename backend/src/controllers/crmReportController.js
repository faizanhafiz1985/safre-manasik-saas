const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');

const getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      totalLeads, newLeadsThisMonth, newLeadsLastMonth,
      leadsByStatus, leadsBySource,
      totalOpps, wonOpps, lostOpps,
      pipelineValue,
      totalTasks, overdueTasks, todayTasks,
      unreadMessages,
    ] = await Promise.all([
      prisma.crmLead.count(),
      prisma.crmLead.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.crmLead.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.crmLead.groupBy({ by: ['status'], _count: true }),
      prisma.crmLead.groupBy({ by: ['source'], _count: true }),
      prisma.crmOpportunity.count(),
      prisma.crmOpportunity.count({ where: { isWon: true } }),
      prisma.crmOpportunity.count({ where: { isLost: true } }),
      prisma.crmOpportunity.aggregate({
        where: { isWon: false, isLost: false },
        _sum: { value: true },
      }),
      prisma.crmTask.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      prisma.crmTask.count({
        where: { dueAt: { lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
      prisma.crmTask.count({
        where: {
          dueAt: { gte: new Date(now.setHours(0, 0, 0, 0)), lt: new Date(now.setHours(23, 59, 59, 999)) },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      prisma.crmMessage.count({ where: { direction: 'INBOUND', isRead: false } }),
    ]);

    const conversionRate = totalLeads > 0
      ? ((leadsByStatus.find((s) => s.status === 'CONVERTED')?._count || 0) / totalLeads * 100).toFixed(1)
      : 0;

    const leadGrowth = newLeadsLastMonth > 0
      ? (((newLeadsThisMonth - newLeadsLastMonth) / newLeadsLastMonth) * 100).toFixed(1)
      : null;

    res.json({
      leads: {
        total: totalLeads,
        thisMonth: newLeadsThisMonth,
        lastMonth: newLeadsLastMonth,
        growthPct: leadGrowth,
        byStatus: leadsByStatus,
        bySource: leadsBySource,
        conversionRate: Number(conversionRate),
      },
      pipeline: {
        total: totalOpps,
        won: wonOpps,
        lost: lostOpps,
        active: totalOpps - wonOpps - lostOpps,
        value: pipelineValue._sum.value || 0,
        winRate: totalOpps > 0 ? (wonOpps / totalOpps * 100).toFixed(1) : 0,
      },
      tasks: {
        total: totalTasks,
        overdue: overdueTasks,
        today: todayTasks,
      },
      inbox: {
        unread: unreadMessages,
      },
    });
  } catch (err) { next(err); }
};

const getLeadReport = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, groupBy = 'source', agentId } = req.query;
    const where = {
      ...(dateFrom && dateTo && { createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) } }),
      ...(agentId && { assignedToId: agentId }),
    };

    const validGroupBy = ['source', 'status', 'priority', 'assignedToId'];
    const field = validGroupBy.includes(groupBy) ? groupBy : 'source';

    const [grouped, conversionFunnel, timeline] = await Promise.all([
      prisma.crmLead.groupBy({ by: [field], where, _count: true, orderBy: { _count: { [field]: 'desc' } } }),
      prisma.crmLead.groupBy({ by: ['status'], where, _count: true }),
      // Monthly timeline (last 6 months)
      prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "createdAt") as month, COUNT(*)::int as count
        FROM crm_leads
        WHERE "tenantId" = ${req.user.tenantId}
          ${dateFrom ? prisma.$raw`AND "createdAt" >= ${new Date(dateFrom)}` : prisma.$raw``}
          ${dateTo ? prisma.$raw`AND "createdAt" <= ${new Date(dateTo)}` : prisma.$raw``}
        GROUP BY 1
        ORDER BY 1
      `.catch(() => []),
    ]);

    res.json({ grouped, conversionFunnel, timeline });
  } catch (err) { next(err); }
};

const getAgentPerformance = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const tenantId = req.user.tenantId;

    const where = {
      ...(dateFrom && dateTo && { createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) } }),
    };

    // Get all agents in this tenant
    const agents = await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try {
          resolve(await prisma.user.findMany({
            where: { tenantId, role: { in: ['ADMIN', 'AGENT'] }, isActive: true },
            select: { id: true, name: true, email: true },
          }));
        } catch (e) { reject(e); }
      });
    });

    const performance = await Promise.all(agents.map(async (agent) => {
      const [assigned, converted, tasks, tasksCompleted] = await Promise.all([
        prisma.crmLead.count({ where: { ...where, assignedToId: agent.id } }),
        prisma.crmLead.count({ where: { ...where, assignedToId: agent.id, status: 'CONVERTED' } }),
        prisma.crmTask.count({ where: { assignedToId: agent.id } }),
        prisma.crmTask.count({ where: { assignedToId: agent.id, status: 'COMPLETED' } }),
      ]);
      return {
        agent,
        leadsAssigned: assigned,
        leadsConverted: converted,
        conversionRate: assigned > 0 ? (converted / assigned * 100).toFixed(1) : 0,
        tasksTotal: tasks,
        tasksCompleted,
        taskCompletionRate: tasks > 0 ? (tasksCompleted / tasks * 100).toFixed(1) : 0,
      };
    }));

    res.json(performance);
  } catch (err) { next(err); }
};

const getPipelineReport = async (req, res, next) => {
  try {
    const pipelines = await prisma.crmPipeline.findMany({
      where: { isActive: true },
      include: {
        stages: {
          orderBy: { position: 'asc' },
          include: {
            opportunities: {
              where: { isWon: false, isLost: false },
              select: { id: true, value: true },
            },
          },
        },
      },
    });

    const result = pipelines.map((p) => ({
      pipeline: { id: p.id, name: p.name },
      stages: p.stages.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        probability: s.probability,
        count: s.opportunities.length,
        value: s.opportunities.reduce((sum, o) => sum + Number(o.value || 0), 0),
      })),
      totalActive: p.stages.reduce((sum, s) => sum + s.opportunities.length, 0),
      totalValue: p.stages.reduce((sum, s) => sum + s.opportunities.reduce((v, o) => v + Number(o.value || 0), 0), 0),
    }));

    res.json(result);
  } catch (err) { next(err); }
};

module.exports = { getDashboard, getLeadReport, getAgentPerformance, getPipelineReport };
