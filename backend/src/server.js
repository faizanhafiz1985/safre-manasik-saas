require('dotenv').config();

// ── Sentry (optional — only initialises when SENTRY_DSN env var is set) ──────
const Sentry = (() => { try { return require('@sentry/node'); } catch { return null; } })();
if (Sentry && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1,
    // Capture unhandled promise rejections
    integrations: [new Sentry.Integrations.Http({ tracing: true })],
  });
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const customerRoutes = require('./routes/customers');
const packageRoutes = require('./routes/packages');
const bookingRoutes = require('./routes/bookings');
const transportRoutes = require('./routes/transport');
const cateringRoutes = require('./routes/catering');
const voucherRoutes = require('./routes/vouchers');
const paymentRoutes = require('./routes/payments');
const hotelRoutes = require('./routes/hotels');
const configRoutes = require('./routes/config');
const dashboardRoutes = require('./routes/dashboard');
const tenantRoutes = require('./routes/tenant');
const superAdminRoutes = require('./routes/superAdmin');
const reportRoutes = require('./routes/reports');
const paymentGatewayRoutes = require('./routes/paymentGateway');
const crmRoutes = require('./routes/crm');
const crmWebhookRoutes = require('./routes/crmWebhooks');

const app = express();

// Sentry request handler must be FIRST middleware
if (Sentry && process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
}

// Railway (and most PaaS) sit behind a reverse proxy/CDN. Trust the first hop so
// that req.ip reflects the real client IP for rate limiting and logging.
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
  : ['https://app.safremanasik.com'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // Return a 400-level status instead of 500 for CORS rejections
    const err = new Error(`CORS: origin ${origin} not allowed`);
    err.status = 403;
    callback(err);
  },
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: 'Too many requests' });
app.use('/api', limiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/auth', authLimiter);

app.get('/health', (req, res) => {
  const { getMonitorStatus } = require('./monitor/uptimeMonitor');
  res.json({
    status: 'ok',
    timestamp: new Date(),
    version: process.env.npm_package_version || '2.0.0-saas',
    mode: process.env.NODE_ENV,
    monitor: getMonitorStatus(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payments/gateway', paymentGatewayRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/catering', cateringRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/config', configRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/crm', crmRoutes);
// CRM webhooks are public (Meta signature-verified internally)
app.use('/api/crm/webhooks', crmWebhookRoutes);

app.use(notFound);
// Sentry error handler must come BEFORE the generic error handler
if (Sentry && process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}
app.use(errorHandler);

// Only listen when run directly (not when required by tests)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, async () => {
    logger.info(`Safre Manasik SaaS API running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    try {
      const { runBootstrap } = require('./bootstrap');
      await runBootstrap();
    } catch (err) {
      logger.error(`Bootstrap failed: ${err.message}`);
    }
    // Start uptime monitor after bootstrap
    try {
      const { startUptimeMonitor } = require('./monitor/uptimeMonitor');
      startUptimeMonitor();
    } catch (err) {
      logger.error(`Uptime monitor failed to start: ${err.message}`);
    }
  });
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    try { require('./monitor/uptimeMonitor').stopUptimeMonitor(); } catch {}
    server.close(() => { logger.info('HTTP server closed.'); process.exit(0); });
    setTimeout(() => { logger.warn('Force exit after 10s'); process.exit(1); }, 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
