const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenant');
const validate = require('../middleware/validate');

// Tenant signup: creates a new tenant + admin user
router.post('/signup-tenant',
  [body('tenantName').notEmpty(), body('adminName').notEmpty(), body('adminEmail').isEmail(), body('adminPassword').isLength({ min: 8 })],
  validate, ctrl.signupTenant);

// Customer register (needs tenantSlug to join an existing tenant)
router.post('/register',
  [body('name').notEmpty(), body('email').isEmail(), body('password').isLength({ min: 6 }), body('tenantSlug').notEmpty()],
  validate, ctrl.register);

router.post('/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate, ctrl.login);

router.get('/me', authenticate, tenantScope, ctrl.me);
router.put('/profile', authenticate, tenantScope, ctrl.updateProfile);
router.put('/change-password', authenticate, tenantScope,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 6 })],
  validate, ctrl.changePassword);

module.exports = router;
