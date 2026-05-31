/**
 * Uptime Monitor — checks app + API endpoints and DNS nameservers every 5 minutes.
 *
 * Sends alerts via:
 *   1. Email        — uses the existing SMTP emailService (Resend/nodemailer)
 *   2. WhatsApp     — CallMeBot (free, no Twilio account needed) OR Twilio WhatsApp
 *   3. SMS          — Twilio SMS
 *
 * Env vars (add to Railway):
 *
 *   UPTIME_CHECK_INTERVAL_MS   How often to check (default: 300000 = 5 min)
 *   UPTIME_ALERT_EMAIL         Comma-separated emails to alert, e.g. admin@safremanasik.com
 *   UPTIME_ALERT_COOLDOWN_MS   Min ms between repeat alerts for same issue (default: 1800000 = 30 min)
 *
 *   -- WhatsApp via CallMeBot (free) --
 *   CALLMEBOT_PHONE            Your WhatsApp number with country code, e.g. +966501234567
 *   CALLMEBOT_APIKEY           Your CallMeBot API key (get from wa.me/+34644592903 saying "I allow callmebot to send me messages")
 *
 *   -- WhatsApp + SMS via Twilio (paid, more reliable) --
 *   TWILIO_ACCOUNT_SID         Twilio Account SID (ACxxxxxxx)
 *   TWILIO_AUTH_TOKEN          Twilio Auth Token
 *   TWILIO_WHATSAPP_FROM       e.g. whatsapp:+14155238886
 *   TWILIO_WHATSAPP_TO         e.g. whatsapp:+966501234567
 *   TWILIO_SMS_FROM            e.g. +12025550100
 *   TWILIO_SMS_TO              e.g. +966501234567
 *
 * Setup CallMeBot (5 minutes, free):
 *   1. Open WhatsApp on your phone
 *   2. Send "I allow callmebot to send me messages" to +34644592903
 *   3. You'll receive your API key in reply
 *   4. Set CALLMEBOT_PHONE and CALLMEBOT_APIKEY in Railway env vars
 */

const https = require('https');
const dns = require('dns').promises;
const logger = require('../config/logger');
const { sendEmail } = require('../services/emailService');

// ── Configuration ──────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = Number(process.env.UPTIME_CHECK_INTERVAL_MS || 5 * 60 * 1000); // 5 min
const ALERT_COOLDOWN_MS = Number(process.env.UPTIME_ALERT_COOLDOWN_MS || 30 * 60 * 1000); // 30 min

const CHECKS = [
  {
    id: 'app_http',
    label: 'Frontend (app.safremanasik.com)',
    type: 'http',
    url: 'https://app.safremanasik.com/',
    expectedStatus: 200,
    timeoutMs: 15000,
  },
  {
    id: 'api_http',
    label: 'Backend API (api.safremanasik.com/health)',
    type: 'http',
    url: 'https://api.safremanasik.com/health',
    expectedStatus: 200,
    timeoutMs: 15000,
  },
  {
    id: 'dns_ns',
    label: 'DNS Nameservers (safremanasik.com)',
    type: 'dns_ns',
    domain: 'safremanasik.com',
    // The correct NS for the active Cloudflare zone
    expectedNS: ['barbara.ns.cloudflare.com', 'casey.ns.cloudflare.com'],
  },
];

// ── State tracking (in-memory, resets on restart) ──────────────────────────────

const state = {};
for (const c of CHECKS) {
  state[c.id] = {
    status: 'unknown',       // 'up' | 'down' | 'unknown'
    lastAlertSent: 0,        // epoch ms of last "down" alert
    lastRecoveryAlertSent: 0,
    downSince: null,         // Date when it went down
  };
}

// ── HTTP check ─────────────────────────────────────────────────────────────────

function httpCheck(url, expectedStatus, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, reason: `Timeout after ${timeoutMs}ms` }), timeoutMs);
    try {
      const req = https.get(url, { timeout: timeoutMs }, (res) => {
        clearTimeout(timer);
        const ok = res.statusCode === expectedStatus;
        res.resume(); // consume body
        resolve({ ok, reason: ok ? null : `HTTP ${res.statusCode} (expected ${expectedStatus})` });
      });
      req.on('error', (err) => {
        clearTimeout(timer);
        resolve({ ok: false, reason: err.message });
      });
      req.on('timeout', () => {
        clearTimeout(timer);
        req.destroy();
        resolve({ ok: false, reason: `Timeout after ${timeoutMs}ms` });
      });
    } catch (err) {
      clearTimeout(timer);
      resolve({ ok: false, reason: err.message });
    }
  });
}

// ── DNS NS check ───────────────────────────────────────────────────────────────

async function dnsNsCheck(domain, expectedNS) {
  try {
    const servers = await dns.resolveNs(domain);
    const normalized = servers.map((s) => s.toLowerCase().replace(/\.$/, '').trim()).sort();
    const expectedNorm = expectedNS.map((s) => s.toLowerCase().replace(/\.$/, '').trim()).sort();
    const ok = JSON.stringify(normalized) === JSON.stringify(expectedNorm);
    if (!ok) {
      return {
        ok: false,
        reason: `NS mismatch — got [${normalized.join(', ')}], expected [${expectedNorm.join(', ')}]. ` +
                `Domain likely pointing to wrong Cloudflare zone. Fix Dynadot nameservers immediately.`,
        actual: normalized,
      };
    }
    return { ok: true, reason: null };
  } catch (err) {
    return { ok: false, reason: `DNS resolve failed: ${err.message}` };
  }
}

// ── WhatsApp via CallMeBot ─────────────────────────────────────────────────────

function sendCallMeBot(message) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apikey) return Promise.resolve({ ok: false, reason: 'CallMeBot not configured' });

  const encoded = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encoded}&apikey=${encodeURIComponent(apikey)}`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      res.resume();
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      resolve({ ok, httpStatus: res.statusCode });
    }).on('error', (err) => resolve({ ok: false, reason: err.message }));
  });
}

// ── Twilio (WhatsApp + SMS) ────────────────────────────────────────────────────

function sendTwilio(to, from, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return Promise.resolve({ ok: false, reason: 'Twilio not configured' });

  const body = new URLSearchParams({ To: to, From: from, Body: message }).toString();
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${sid}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, httpStatus: res.statusCode });
    });
    req.on('error', (err) => resolve({ ok: false, reason: err.message }));
    req.write(body);
    req.end();
  });
}

async function sendWhatsApp(message) {
  // Try CallMeBot first (free), then Twilio WhatsApp
  const cmb = await sendCallMeBot(message);
  if (cmb.ok) {
    logger.info('[monitor] WhatsApp sent via CallMeBot');
    return;
  }

  const waTo = process.env.TWILIO_WHATSAPP_TO;
  const waFrom = process.env.TWILIO_WHATSAPP_FROM;
  if (waTo && waFrom) {
    const result = await sendTwilio(waTo, waFrom, message);
    if (result.ok) logger.info('[monitor] WhatsApp sent via Twilio');
    else logger.warn(`[monitor] Twilio WhatsApp failed: ${JSON.stringify(result)}`);
  }
}

async function sendSMS(message) {
  const smsTo = process.env.TWILIO_SMS_TO;
  const smsFrom = process.env.TWILIO_SMS_FROM;
  if (!smsTo || !smsFrom) return;
  const result = await sendTwilio(smsTo, smsFrom, message);
  if (result.ok) logger.info('[monitor] SMS sent via Twilio');
  else logger.warn(`[monitor] Twilio SMS failed: ${JSON.stringify(result)}`);
}

// ── Alert dispatch ─────────────────────────────────────────────────────────────

function formatDowntime(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

async function sendDownAlert(check, reason) {
  const now = new Date();
  const subject = `🔴 DOWN: ${check.label}`;
  const text = `ALERT: ${check.label} is DOWN\n\nReason: ${reason}\n\nTime: ${now.toISOString()} UTC\n\nCheck immediately at:\n- https://app.safremanasik.com\n- https://api.safremanasik.com/health\n\nIf DNS issue, fix Dynadot nameservers to:\n  barbara.ns.cloudflare.com\n  casey.ns.cloudflare.com`;

  const alertEmails = (process.env.UPTIME_ALERT_EMAIL || '').split(',').map((e) => e.trim()).filter(Boolean);
  if (alertEmails.length > 0) {
    await sendEmail({
      to: alertEmails,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#C0392B;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">🔴 Safre Manasik is DOWN</h2>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
            <p><strong>Service:</strong> ${check.label}</p>
            <p><strong>Reason:</strong> <code style="background:#fee;padding:2px 6px;border-radius:4px">${reason}</code></p>
            <p><strong>Time:</strong> ${now.toUTCString()}</p>
            <hr>
            <p><strong>Quick fixes:</strong></p>
            <ul>
              <li>Check <a href="https://app.safremanasik.com">https://app.safremanasik.com</a></li>
              <li>Check <a href="https://api.safremanasik.com/health">https://api.safremanasik.com/health</a></li>
              <li>If DNS issue: go to <a href="https://www.dynadot.com/account/domain/name/list.html">Dynadot</a> and set nameservers to <strong>barbara.ns.cloudflare.com</strong> + <strong>casey.ns.cloudflare.com</strong></li>
              <li>Check <a href="https://railway.app">Railway</a> for service status</li>
            </ul>
            <p style="color:#888;font-size:12px">Safre Manasik Uptime Monitor</p>
          </div>
        </div>`,
      text,
    });
  }

  const shortMsg = `🔴 Safre Manasik DOWN\n${check.label}\nReason: ${reason}\nTime: ${now.toUTCString().substring(0, 25)}`;
  await sendWhatsApp(shortMsg);
  await sendSMS(shortMsg);
}

async function sendRecoveryAlert(check, downSince) {
  const now = new Date();
  const downtimeMs = now - downSince;
  const subject = `✅ RECOVERED: ${check.label}`;
  const text = `RECOVERY: ${check.label} is back UP\n\nDowntime: ${formatDowntime(downtimeMs)}\nTime: ${now.toISOString()} UTC`;

  const alertEmails = (process.env.UPTIME_ALERT_EMAIL || '').split(',').map((e) => e.trim()).filter(Boolean);
  if (alertEmails.length > 0) {
    await sendEmail({
      to: alertEmails,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#27AE60;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">✅ Safre Manasik Recovered</h2>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
            <p><strong>Service:</strong> ${check.label}</p>
            <p><strong>Status:</strong> <span style="color:#27AE60;font-weight:bold">UP ✅</span></p>
            <p><strong>Downtime duration:</strong> ${formatDowntime(downtimeMs)}</p>
            <p><strong>Recovered at:</strong> ${now.toUTCString()}</p>
            <p style="color:#888;font-size:12px">Safre Manasik Uptime Monitor</p>
          </div>
        </div>`,
      text,
    });
  }

  const shortMsg = `✅ Safre Manasik RECOVERED\n${check.label}\nDowntime: ${formatDowntime(downtimeMs)}`;
  await sendWhatsApp(shortMsg);
  await sendSMS(shortMsg);
}

// ── Run one check cycle ────────────────────────────────────────────────────────

async function runCheck(check) {
  let result;
  if (check.type === 'http') {
    result = await httpCheck(check.url, check.expectedStatus, check.timeoutMs);
  } else if (check.type === 'dns_ns') {
    result = await dnsNsCheck(check.domain, check.expectedNS);
  } else {
    return;
  }

  const s = state[check.id];
  const now = Date.now();

  if (!result.ok) {
    // Service is DOWN
    const wasUp = s.status !== 'down';
    if (wasUp) s.downSince = new Date();
    s.status = 'down';

    const cooldownExpired = (now - s.lastAlertSent) >= ALERT_COOLDOWN_MS;
    if (wasUp || cooldownExpired) {
      s.lastAlertSent = now;
      logger.warn(`[monitor] DOWN: ${check.label} — ${result.reason}`);
      try { await sendDownAlert(check, result.reason); } catch (err) {
        logger.error(`[monitor] Failed to send down alert: ${err.message}`);
      }
    }
  } else {
    // Service is UP
    if (s.status === 'down' && s.downSince) {
      // Just recovered
      logger.info(`[monitor] RECOVERED: ${check.label}`);
      s.lastRecoveryAlertSent = now;
      try { await sendRecoveryAlert(check, s.downSince); } catch (err) {
        logger.error(`[monitor] Failed to send recovery alert: ${err.message}`);
      }
      s.downSince = null;
    } else if (s.status === 'unknown') {
      logger.info(`[monitor] UP: ${check.label}`);
    }
    s.status = 'up';
  }
}

async function runAllChecks() {
  for (const check of CHECKS) {
    try {
      await runCheck(check);
    } catch (err) {
      logger.error(`[monitor] Unexpected error in check ${check.id}: ${err.message}`);
    }
  }
}

// ── Start ──────────────────────────────────────────────────────────────────────

let monitorInterval = null;

function startUptimeMonitor() {
  const isEnabled = process.env.UPTIME_MONITOR_ENABLED !== 'false';
  const hasAlertTarget = process.env.UPTIME_ALERT_EMAIL ||
    process.env.CALLMEBOT_PHONE ||
    process.env.TWILIO_ACCOUNT_SID;

  if (!isEnabled) {
    logger.info('[monitor] Uptime monitor disabled (UPTIME_MONITOR_ENABLED=false)');
    return;
  }

  if (!hasAlertTarget) {
    logger.warn('[monitor] Uptime monitor: no alert targets configured. Set UPTIME_ALERT_EMAIL, CALLMEBOT_PHONE, or TWILIO_ACCOUNT_SID. Monitor will still check but cannot send alerts.');
  }

  logger.info(`[monitor] Uptime monitor starting — checking every ${CHECK_INTERVAL_MS / 1000}s`);

  // Run immediately on startup after a short delay (let the server finish booting)
  setTimeout(async () => {
    await runAllChecks();
    monitorInterval = setInterval(runAllChecks, CHECK_INTERVAL_MS);
  }, 15000); // 15s delay so server is fully ready
}

function stopUptimeMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('[monitor] Uptime monitor stopped.');
  }
}

// Expose current status for health endpoint
function getMonitorStatus() {
  return CHECKS.map((c) => ({
    id: c.id,
    label: c.label,
    status: state[c.id].status,
    downSince: state[c.id].downSince,
  }));
}

module.exports = { startUptimeMonitor, stopUptimeMonitor, getMonitorStatus };
