const router = require('express').Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenant');
const validate = require('../middleware/validate');

// ── Rate limiter for sensitive recovery endpoints.
// 10 attempts per IP per 15 minutes. The previous limit of 3 was too strict —
// a user who mistypes their email or retries a couple of times got locked out
// for 15 minutes, which looked like the feature was broken. 10/15min still
// blocks bulk abuse / email-bombing while allowing normal retries. Offices
// behind a single NAT IP also need the higher ceiling.
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes before trying again.' },
  skipSuccessfulRequests: false,
});

// Tenant signup: creates a new tenant + admin user
// .trim() sanitises the email (strips stray spaces) before validation so a
// space-padded entry isn't rejected outright.
router.post('/signup-tenant',
  [body('tenantName').notEmpty(), body('adminName').notEmpty(), body('adminEmail').trim().isEmail(), body('adminPassword').isLength({ min: 8 })],
  validate, ctrl.signupTenant);

// Customer register (needs tenantSlug to join an existing tenant)
router.post('/register',
  [body('name').notEmpty(), body('email').trim().isEmail(), body('password').isLength({ min: 6 }), body('tenantSlug').notEmpty()],
  validate, ctrl.register);

router.post('/login',
  [body('email').trim().isEmail(), body('password').notEmpty()],
  validate, ctrl.login);

// Mobile session: exchange a refresh token for a fresh access token (rotating).
router.post('/refresh', [body('refreshToken').notEmpty()], validate, ctrl.refresh);
// Revoke a refresh token on logout (idempotent).
router.post('/logout', ctrl.logout);

// ── Forgot Username: user enters email → receives email with their account name
router.post('/forgot-username',
  recoveryLimiter,
  [body('email').trim().isEmail().withMessage('Valid email address is required')],
  validate,
  ctrl.forgotUsername);

// ── Forgot Password: user enters email → receives secure reset link (DB token, single-use, 1h expiry)
router.post('/forgot-password',
  recoveryLimiter,
  [body('email').trim().isEmail().withMessage('Valid email address is required')],
  validate,
  ctrl.forgotPassword);

// ── Reset Password: validates DB token, sets new password, invalidates token
router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  ctrl.resetPassword);

router.get('/me', authenticate, tenantScope, ctrl.me);
router.put('/profile', authenticate, tenantScope, ctrl.updateProfile);
router.put('/change-password', authenticate, tenantScope,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 6 })],
  validate, ctrl.changePassword);

module.exports = router;
