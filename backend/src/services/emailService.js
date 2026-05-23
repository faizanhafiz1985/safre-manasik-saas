// Email service — sends transactional emails via SMTP.
//
// Configuration is via env vars. If SMTP_HOST is not set, sendEmail logs the
// would-be message to stdout instead of throwing, so dev / unconfigured
// environments don't break flows that depend on email.
//
// Env vars:
//   SMTP_HOST   e.g. smtp.gmail.com, smtp.postmarkapp.com, smtp.resend.com
//   SMTP_PORT   587 (STARTTLS) or 465 (SSL). Defaults to 587.
//   SMTP_SECURE 'true' to use SSL (port 465). Defaults to false.
//   SMTP_USER   username
//   SMTP_PASS   password / API key
//   SMTP_FROM   from address, e.g. "Safre Manasik <noreply@safremanasik.com>"
//
// To wire up Postmark:   SMTP_HOST=smtp.postmarkapp.com SMTP_USER=<token> SMTP_PASS=<token>
// To wire up Resend:     SMTP_HOST=smtp.resend.com SMTP_USER=resend SMTP_PASS=re_xxx
// To wire up Gmail:      SMTP_HOST=smtp.gmail.com SMTP_USER=you@gmail.com SMTP_PASS=<app-password>

const nodemailer = (() => {
  try { return require('nodemailer'); } catch { return null; }
})();

const logger = require('../config/logger');

const CONFIGURED = !!process.env.SMTP_HOST;
let transporter = null;

if (CONFIGURED && nodemailer) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const DEFAULT_FROM = process.env.SMTP_FROM || '"Safre Manasik" <noreply@safremanasik.com>';

/**
 * Send a transactional email. Always resolves — never throws — so calling code
 * doesn't need to wrap in try/catch.
 *
 * @param {Object} opts
 * @param {string|string[]} opts.to       — recipient(s)
 * @param {string} opts.subject
 * @param {string} opts.html              — HTML body
 * @param {string} [opts.text]            — text body (auto-derived from html if missing)
 * @returns {Promise<{ok: boolean, mode: 'sent'|'logged', error?: string}>}
 */
async function sendEmail({ to, subject, html, text }) {
  const fallbackText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');

  if (!CONFIGURED || !transporter) {
    logger.info(
      `[email:LOGGED] to=${JSON.stringify(to)} subject="${subject}"\n` +
      `(SMTP not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS env vars to actually send.)\n` +
      `--- body ---\n${fallbackText}\n--- end ---`
    );
    return { ok: true, mode: 'logged' };
  }

  try {
    const info = await transporter.sendMail({
      from: DEFAULT_FROM,
      to,
      subject,
      text: fallbackText,
      html,
    });
    logger.info(`[email:sent] messageId=${info.messageId} to=${JSON.stringify(to)} subject="${subject}"`);
    return { ok: true, mode: 'sent' };
  } catch (err) {
    logger.error(`[email:error] to=${JSON.stringify(to)} subject="${subject}" — ${err.message}`);
    return { ok: false, mode: 'sent', error: err.message };
  }
}

// ── Reusable templates ──────────────────────────────────────────────────────

function applicationReceivedHtml({ adminName, tenantName }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1B4B35">
      <div style="background:#1B4B35;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#C9A227">Safre Manasik</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
        <p>Dear ${adminName},</p>
        <p>Thank you for applying to host <strong>${tenantName}</strong> on Safre Manasik.</p>
        <p>Your application has been received and is under review by our team.
           We typically respond within 1 business day. You'll receive another
           email as soon as we make a decision.</p>
        <p>If you need to update any details, simply reply to this email.</p>
        <p style="margin-top:24px;color:#888;font-size:12px">
          Safre Manasik · Umrah Travel Management Platform<br>
          Registered in KSA · CR No. 7053347410
        </p>
      </div>
    </div>`;
}

function applicationApprovedHtml({ adminName, tenantName, loginUrl, adminEmail }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1B4B35">
      <div style="background:#1B4B35;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#C9A227">Safre Manasik</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
        <p>Dear ${adminName},</p>
        <p>Great news — your application for <strong>${tenantName}</strong> has been
           <strong style="color:#2E9E6B">approved</strong>!</p>
        <p>You can now sign in to your workspace:</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${loginUrl}" style="background:#1B4B35;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block">Open Safre Manasik</a>
        </p>
        <p style="background:#F3F8F5;padding:12px 16px;border-radius:6px;border-left:4px solid #C9A227">
          <strong>Login email:</strong> ${adminEmail}<br>
          <strong>Password:</strong> the one you set during signup
        </p>
        <p>Your account is on the <strong>Starter</strong> plan trial. Add packages, hotels, and bookings to get started.</p>
        <p style="margin-top:24px;color:#888;font-size:12px">
          Need help? Reply to this email any time.
        </p>
      </div>
    </div>`;
}

function applicationRejectedHtml({ adminName, tenantName, reason }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1B4B35">
      <div style="background:#1B4B35;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#C9A227">Safre Manasik</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
        <p>Dear ${adminName},</p>
        <p>Thank you for your interest in Safre Manasik. After reviewing your
           application for <strong>${tenantName}</strong>, we are unable to
           approve it at this time.</p>
        ${reason ? `<p style="background:#FFF4E6;padding:12px 16px;border-radius:6px;border-left:4px solid #C0392B"><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>If you believe this decision was made in error, or if you'd like to
           provide additional information, please reply to this email.</p>
        <p style="margin-top:24px;color:#888;font-size:12px">Safre Manasik Platform</p>
      </div>
    </div>`;
}

function superAdminNewApplicationHtml({ application }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1B4B35">
      <h3 style="color:#C9A227">New Tenant Application — Action Required</h3>
      <p>A new agency has applied to join Safre Manasik:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:4px 8px;color:#666">Organisation</td><td style="padding:4px 8px"><strong>${application.tenantName}</strong></td></tr>
        <tr><td style="padding:4px 8px;color:#666">Admin</td><td style="padding:4px 8px">${application.adminName} &lt;${application.adminEmail}&gt;</td></tr>
        <tr><td style="padding:4px 8px;color:#666">Phone</td><td style="padding:4px 8px">${application.contactPhone || '—'}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">Country</td><td style="padding:4px 8px">${application.country || '—'}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">City</td><td style="padding:4px 8px">${application.city || '—'}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">CR Number</td><td style="padding:4px 8px">${application.crNumber || '—'}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">VAT Number</td><td style="padding:4px 8px">${application.vatNumber || '—'}</td></tr>
        <tr><td style="padding:4px 8px;color:#666">Umrah Licence</td><td style="padding:4px 8px">${application.umrahLicenseNumber || '—'}</td></tr>
      </table>
      <p style="margin-top:16px">Log in to the platform and visit <strong>Applications</strong> in the Platform Admin section to approve or reject.</p>
    </div>`;
}

function customerWelcomeHtml({ adminName, customerName, email, password, loginUrl, tenantName }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1B4B35">
      <div style="background:#1B4B35;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#C9A227">Safre Manasik</h2>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8)">${tenantName}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
        <p>Dear ${customerName},</p>
        <p>Your account has been created on <strong>${tenantName}</strong>'s Safre Manasik portal by ${adminName}.</p>
        <p style="background:#F3F8F5;padding:14px 18px;border-radius:8px;border-left:4px solid #C9A227">
          <strong>Your login details:</strong><br>
          <span style="color:#555">Email:</span> <strong>${email}</strong><br>
          <span style="color:#555">Password:</span> <strong>${password}</strong>
        </p>
        <p style="text-align:center;margin:24px 0">
          <a href="${loginUrl}" style="background:#1B4B35;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block">Sign In Now</a>
        </p>
        <p style="color:#C0392B;font-size:13px">Please change your password after your first login for security.</p>
        <p style="margin-top:24px;color:#888;font-size:12px">Safre Manasik · Umrah Travel Management Platform</p>
      </div>
    </div>`;
}

function passwordResetHtml({ name, resetUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1B4B35">
      <div style="background:#1B4B35;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#C9A227">Safre Manasik</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
        <p>Dear ${name},</p>
        <p>We received a request to reset the password for your Safre Manasik account.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${resetUrl}" style="background:#1B4B35;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block">Reset My Password</a>
        </p>
        <p style="color:#888;font-size:13px">This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not change.</p>
        <p style="margin-top:24px;color:#888;font-size:12px">Safre Manasik · Umrah Travel Management Platform</p>
      </div>
    </div>`;
}

module.exports = {
  sendEmail,
  applicationReceivedHtml,
  applicationApprovedHtml,
  applicationRejectedHtml,
  superAdminNewApplicationHtml,
  customerWelcomeHtml,
  passwordResetHtml,
  CONFIGURED,
};
