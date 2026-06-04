const router = require('express').Router();
const ctrl = require('../controllers/voucherController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requireFeature } = require('../middleware/quota');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');

// Accepts token from Authorization header OR ?token= query param (for direct PDF download links)
const flexAuth = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user;
    await new Promise((resolve, reject) => {
      runWithTenant({ isSuperAdmin: true }, async () => {
        try {
          user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, name: true, email: true, role: true, tenantId: true, isActive: true },
          });
          resolve();
        } catch (e) { reject(e); }
      });
    });
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// PDF voucher download requires the 'pdfVouchers' feature flag (gated per plan).
// Preview HTML is always allowed so customers on lower plans still see vouchers
// in-browser; only the polished PDF artifact is plan-gated.
router.get('/preview/:bookingId', flexAuth, tenantScope, requireTenant, ctrl.previewVoucher);
router.get('/download/:id', flexAuth, tenantScope, requireTenant, requireFeature('pdfVouchers'), ctrl.downloadVoucher);

const { requirePermission } = require('../middleware/permission');
router.use(authenticate, tenantScope, requireTenant);
router.get('/', requirePermission('vouchers', 'view'), ctrl.getVouchers);
router.post('/generate', authorize('ADMIN', 'AGENT'), requirePermission('vouchers', 'create'), requireFeature('pdfVouchers'), ctrl.generateVoucher);

module.exports = router;
