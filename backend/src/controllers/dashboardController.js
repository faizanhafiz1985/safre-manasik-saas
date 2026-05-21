const prisma = require('../config/database');

const getStats = async (req, res, next) => {
  try {
    const agentFilter = req.user.role === 'AGENT' ? { agentId: req.user.id } : {};
    const isAgent = req.user.role === 'AGENT';

    const [
      totalBookings,
      tentativeBookings,
      confirmedBookings,
      cancelledBookings,
      totalCustomers,
      totalAgents,
      totalPackages,
      recentBookings,
      totalRevenue,
    ] = await Promise.all([
      prisma.booking.count({ where: agentFilter }),
      prisma.booking.count({ where: { status: 'TENTATIVE', ...agentFilter } }),
      prisma.booking.count({ where: { status: 'CONFIRMED', ...agentFilter } }),
      prisma.booking.count({ where: { status: 'CANCELLED', ...agentFilter } }),
      isAgent
        ? prisma.user.count({ where: { role: 'CUSTOMER', bookingsAsCustomer: { some: agentFilter } } })
        : prisma.user.count({ where: { role: 'CUSTOMER' } }),
      isAgent ? Promise.resolve(null) : prisma.user.count({ where: { role: 'AGENT' } }),
      prisma.package.count({ where: { isActive: true } }),
      prisma.booking.findMany({
        where: agentFilter,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true } },
          package: { select: { name: true } },
        },
      }),
      isAgent
        ? prisma.invoice.aggregate({ where: { booking: agentFilter }, _sum: { paidAmount: true } })
        : prisma.invoice.aggregate({ _sum: { paidAmount: true } }),
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const grouped = await prisma.booking.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: sixMonthsAgo }, ...agentFilter },
      _count: { id: true },
    });

    const monthMap = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    grouped.forEach(({ createdAt, _count }) => {
      const d = new Date(createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthMap[key]) monthMap[key] = { month: monthNames[d.getMonth()], month_num: d.getMonth() + 1, count: 0 };
      monthMap[key].count += _count.id;
    });
    const bookingsByMonth = Object.values(monthMap).sort((a, b) => a.month_num - b.month_num);

    res.json({
      stats: {
        totalBookings,
        tentativeBookings,
        confirmedBookings,
        cancelledBookings,
        totalCustomers,
        totalAgents,
        totalPackages,
        totalRevenue: Number(totalRevenue._sum.paidAmount || 0),
      },
      recentBookings,
      bookingsByMonth,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats };
