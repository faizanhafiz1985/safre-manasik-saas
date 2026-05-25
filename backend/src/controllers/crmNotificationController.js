const prisma = require('../config/database');

const getAll = async (req, res, next) => {
  try {
    const { isRead, page = 1, limit = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      userId: req.user.id,
      ...(isRead !== undefined && { isRead: isRead === 'true' }),
    };
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.crmNotification.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.crmNotification.count({ where }),
      prisma.crmNotification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);
    res.json({ data: notifications, total, unreadCount, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try {
    await prisma.crmNotification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
};

const markAllRead = async (req, res, next) => {
  try {
    await prisma.crmNotification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};

module.exports = { getAll, markRead, markAllRead };
