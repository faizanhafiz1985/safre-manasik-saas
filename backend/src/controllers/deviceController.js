const prisma = require('../config/database');
const push = require('../services/pushService');

// GET /devices/push-status — admin diagnostic: is FCM configured + can it auth?
const pushStatus = async (req, res, next) => {
  try {
    res.json(await push.verify());
  } catch (err) {
    next(err);
  }
};

// POST /devices — register (or refresh) a push token for the current user.
// Upsert on the unique token so re-registering the same device just updates the
// owner/platform. Raw SQL keeps it independent of tenant middleware on upsert.
const register = async (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Device token is required' });
    const platform = ['ios', 'android', 'web'].includes(req.body.platform) ? req.body.platform : 'android';

    await prisma.$executeRawUnsafe(
      `INSERT INTO devices ("tenantId","userId",token,platform,"updatedAt")
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (token) DO UPDATE
         SET "userId"=EXCLUDED."userId", "tenantId"=EXCLUDED."tenantId",
             platform=EXCLUDED.platform, "updatedAt"=NOW()`,
      req.user.tenantId, req.user.id, token, platform
    );
    res.status(201).json({ message: 'Device registered' });
  } catch (err) {
    next(err);
  }
};

// DELETE /devices/:token — unregister on logout / token rotation.
const unregister = async (req, res, next) => {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM devices WHERE token=$1 AND "userId"=$2`,
      req.params.token, req.user.id
    );
    res.json({ message: 'Device unregistered' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, unregister, pushStatus };
