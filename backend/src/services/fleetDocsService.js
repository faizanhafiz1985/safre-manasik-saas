// ─────────────────────────────────────────────────────────────────────────
// Vehicle compliance-document expiry tracking.
//
// Each vehicle carries 8 expiry dates + a Nusuk yes/no flag. A document is
// "due" when its expiry date is before today. When any document is due (or
// Nusuk is No), two things happen, de-duplicated so they fire once per
// distinct expiry (never a daily repeat):
//   1. An email to the driver (their linked login) + the tenant Contact Email.
//   2. A "confirm the documents are valid" task (docReviewPending flag), shown
//      in Fleet → Documents, cleared when a user confirms.
//
// The scan runs daily (scheduler in server.js) and immediately on vehicle save.
// ─────────────────────────────────────────────────────────────────────────
const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const { sendEmail } = require('./emailService');
const logger = require('../config/logger');

// Ordered catalog of document date fields (key = Vehicle column, label = UI).
const VEHICLE_DOCS = [
  { key: 'istimaraExpiry', label: 'Istimara' },
  { key: 'iqamaExpiry', label: 'Iqama' },
  { key: 'kartashkeelExpiry', label: 'Kart Tashkeel' },
  { key: 'licenseExpiry', label: 'License' },
  { key: 'bathakaSaicExpiry', label: 'Bathaka SAIC' },
  { key: 'ajeerExpiry', label: 'Ajeer' },
  { key: 'tameenExpiry', label: 'Tameen (Insurance)' },
  { key: 'fahasExpiry', label: 'Fahas (Inspection)' },
];
const DOC_KEYS = VEHICLE_DOCS.map((d) => d.key);

const DAY = 86400000;
const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// Per-document status for a vehicle row: ok | soon (<=30d) | overdue | missing.
function docStatuses(vehicle, now = new Date()) {
  const today = midnight(now);
  return VEHICLE_DOCS.map(({ key, label }) => {
    const raw = vehicle[key];
    const date = raw ? new Date(raw) : null;
    if (!date || isNaN(date.getTime())) return { key, label, date: null, status: 'missing', daysLeft: null };
    const daysLeft = Math.round((midnight(date) - today) / DAY);
    const status = daysLeft < 0 ? 'overdue' : (daysLeft <= 30 ? 'soon' : 'ok');
    return { key, label, date: date.toISOString(), status, daysLeft };
  });
}

// A view-model of one vehicle's document compliance (used by the API + emails).
function vehicleDocSummary(vehicle, now = new Date()) {
  const docs = docStatuses(vehicle, now);
  const overdue = docs.filter((d) => d.status === 'overdue');
  const nusukOk = vehicle.nusuk === true;
  return { docs, overdue, nusukOk, hasIssues: overdue.length > 0 || !nusukOk };
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
// Escape user-entered values before interpolating into email HTML (matches
// emailService's own escaping — prevents stored HTML/script leaking into email).
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function alertEmailHtml({ tenantName, vehicle, overdue }) {
  const rows = overdue.map((d) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(d.label)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#DC2626;font-weight:600">Expired ${fmtDate(d.date)} (${Math.abs(d.daysLeft)} day${Math.abs(d.daysLeft) === 1 ? '' : 's'} ago)</td></tr>`).join('');
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b;max-width:600px">
    <h2 style="color:#1B4B35;margin:0 0 4px">Vehicle documents need attention</h2>
    <p style="color:#64748b;margin:0 0 16px">${esc(tenantName || 'Safre Manasik')}</p>
    <p>The following documents for vehicle <strong>${esc(vehicle.name)}</strong> (${esc(vehicle.plateNumber)})
       ${vehicle.driverName ? `— driver <strong>${esc(vehicle.driverName)}</strong>` : ''} have expired:</p>
    <table style="border-collapse:collapse;width:100%;border:1px solid #eee;border-radius:6px">
      <thead><tr style="background:#1B4B35;color:#fff"><th style="text-align:left;padding:8px 10px">Document</th><th style="text-align:left;padding:8px 10px">Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:16px">Please renew the above and confirm the dates are valid in
       <strong>Fleet Management → Documents</strong>.</p>
  </div>`;
}

// Core: evaluate one vehicle and, if a DATE document is newly overdue (expiry <
// today), email + open the review task. De-dup via docAlertState (key → the
// expiry ISO already alerted). Nusuk is a stored compliance flag, not a date, so
// it never triggers alerts (that would flood on every legacy vehicle defaulting
// to Nusuk=false). Best-effort: never throws to the caller-critical path.
async function evaluateVehicle(vehicle, tenant, now = new Date()) {
  const { overdue } = vehicleDocSummary(vehicle, now);
  const state = (vehicle.docAlertState && typeof vehicle.docAlertState === 'object') ? { ...vehicle.docAlertState } : {};

  const newlyOverdue = overdue.filter((d) => state[d.key] !== d.date);
  if (!newlyOverdue.length) return { alerted: false };

  // Recipients: tenant Contact Email + the driver's real login email (skip the
  // synthetic customer placeholder addresses).
  const recipients = new Set();
  if (tenant?.contactEmail) recipients.add(tenant.contactEmail);
  if (vehicle.driverId) {
    const drv = await prisma.user.findFirst({ where: { id: vehicle.driverId }, select: { email: true } }).catch(() => null);
    if (drv?.email && !/@customers\.safremanasik\.com$/i.test(drv.email)) recipients.add(drv.email);
  }
  const to = [...recipients];
  if (to.length) {
    try {
      await sendEmail({
        to,
        subject: `Vehicle documents due — ${vehicle.name} (${vehicle.plateNumber})`,
        html: alertEmailHtml({ tenantName: tenant?.name, vehicle, overdue }),
      });
    } catch (e) { logger.warn(`[fleetdocs] email failed for vehicle ${vehicle.id}: ${e.message}`); }
  } else {
    logger.warn(`[fleetdocs] vehicle ${vehicle.id} due but no recipient email (no tenant contactEmail, no linked driver)`);
  }

  // Record what we alerted on so tomorrow's scan won't repeat it, and open the task.
  for (const d of overdue) state[d.key] = d.date;
  for (const k of DOC_KEYS) { if (!overdue.find((o) => o.key === k)) delete state[k]; } // clear resolved
  await prisma.vehicle.updateMany({
    where: { id: vehicle.id },
    data: { docAlertState: state, docReviewPending: true },
  });
  return { alerted: true, recipients: to.length };
}

// On-save hook (runs inside the request's tenant context). Fire-and-forget.
async function checkVehicle(vehicleId) {
  try {
    const v = await prisma.vehicle.findFirst({ where: { id: vehicleId } });
    if (!v) return;
    const tenant = await prisma.tenant.findFirst({ where: { id: v.tenantId }, select: { id: true, name: true, contactEmail: true } });
    await evaluateVehicle(v, tenant, new Date());
  } catch (e) { logger.warn(`[fleetdocs] checkVehicle ${vehicleId} failed: ${e.message}`); }
}

// Daily cross-tenant scan (runs as super-admin to see every tenant's vehicles).
async function scanAllTenants() {
  return runWithTenant({ isSuperAdmin: true }, async () => {
    try {
      const now = new Date();
      const vehicles = await prisma.vehicle.findMany({});
      const tenantIds = [...new Set(vehicles.map((v) => v.tenantId))];
      const tenants = tenantIds.length
        ? await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, contactEmail: true } })
        : [];
      const tmap = Object.fromEntries(tenants.map((t) => [t.id, t]));
      let alerted = 0;
      for (const v of vehicles) {
        try { if ((await evaluateVehicle(v, tmap[v.tenantId], now)).alerted) alerted++; }
        catch (e) { logger.warn(`[fleetdocs] vehicle ${v.id}: ${e.message}`); }
      }
      logger.info(`[fleetdocs] daily scan: ${vehicles.length} vehicle(s), ${alerted} alerted`);
      return { scanned: vehicles.length, alerted };
    } catch (e) {
      logger.error(`[fleetdocs] scan failed: ${e.message}`);
      return { scanned: 0, alerted: 0 };
    }
  });
}

module.exports = { VEHICLE_DOCS, DOC_KEYS, docStatuses, vehicleDocSummary, evaluateVehicle, checkVehicle, scanAllTenants };
