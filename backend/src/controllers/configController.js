const prisma = require('../config/database');
const { getTenantId, runWithTenant } = require('../config/tenantContext');

const getAll = async (req, res, next) => {
  try {
    const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    const map = Object.fromEntries(configs.map(({ key, value }) => [key, value]));
    res.json(map);
  } catch (err) {
    next(err);
  }
};

const upsert = async (req, res, next) => {
  try {
    const { configs } = req.body;
    const tenantId = getTenantId();
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    // Use compound unique key. Bypass middleware (which would mangle the where).
    await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try {
          const ops = Object.entries(configs).map(([key, value]) =>
            prisma.systemConfig.upsert({
              where: { tenantId_key: { tenantId, key } },
              update: { value: String(value) },
              create: { tenantId, key, value: String(value) },
            })
          );
          await Promise.all(ops);
          resolve();
        } catch (e) { reject(e); }
      });
    });
    res.json({ message: 'Configuration saved' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, upsert };
