const prisma = require('../config/database');

const convInclude = {
  lead: { select: { id: true, fullName: true, phone: true, source: true } },
  assignedTo: { select: { id: true, name: true } },
  messages: { orderBy: { sentAt: 'desc' }, take: 1 },
};

const listConversations = async (req, res, next) => {
  try {
    const { channel, isResolved, assignedToId, search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(channel && { channel }),
      ...(isResolved !== undefined && { isResolved: isResolved === 'true' }),
      ...(assignedToId && { assignedToId }),
      ...(search && {
        OR: [
          { participantName: { contains: search, mode: 'insensitive' } },
          { participantPhone: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(req.user.role === 'AGENT' && { assignedToId: req.user.id }),
    };

    const [convs, total] = await Promise.all([
      prisma.crmConversation.findMany({
        where, skip, take: Number(limit), include: convInclude,
        orderBy: { lastMessageAt: 'desc' },
      }),
      prisma.crmConversation.count({ where }),
    ]);
    res.json({ data: convs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

const getConversation = async (req, res, next) => {
  try {
    const conv = await prisma.crmConversation.findFirst({
      where: { id: req.params.id },
      include: {
        ...convInclude,
        messages: { orderBy: { sentAt: 'asc' }, include: { sentBy: { select: { id: true, name: true } } } },
      },
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conv);
  } catch (err) { next(err); }
};

const sendMessage = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { body, channel } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body is required' });

    const conv = await prisma.crmConversation.findFirst({ where: { id: req.params.id } });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const message = await prisma.crmMessage.create({
      data: {
        tenantId,
        conversationId: conv.id,
        direction: 'OUTBOUND',
        channel: channel || conv.channel,
        body: body.trim(),
        sentById: req.user.id,
        deliveryStatus: 'sent',
      },
      include: { sentBy: { select: { id: true, name: true } } },
    });

    // Update conversation lastMessageAt
    await prisma.crmConversation.updateMany({
      where: { id: conv.id },
      data: { lastMessageAt: new Date() },
    });

    // TODO: For WhatsApp/FB/Instagram outbound, call the relevant platform API here
    // The integration credentials are in CrmIntegration for this tenant + channel

    res.status(201).json(message);
  } catch (err) { next(err); }
};

const resolveConversation = async (req, res, next) => {
  try {
    const result = await prisma.crmConversation.updateMany({
      where: { id: req.params.id },
      data: { isResolved: true, resolvedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ message: 'Conversation resolved' });
  } catch (err) { next(err); }
};

const assignConversation = async (req, res, next) => {
  try {
    const { assignedToId } = req.body;
    const result = await prisma.crmConversation.updateMany({
      where: { id: req.params.id },
      data: { assignedToId: assignedToId || null },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ message: 'Conversation assigned' });
  } catch (err) { next(err); }
};

// Mark messages in a conversation as read
const markRead = async (req, res, next) => {
  try {
    await prisma.crmMessage.updateMany({
      where: { conversationId: req.params.id, direction: 'INBOUND', isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
};

module.exports = { listConversations, getConversation, sendMessage, resolveConversation, assignConversation, markRead };
