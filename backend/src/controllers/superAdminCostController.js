// Platform Cost Monitor — SUPER_ADMIN only.
// Tracks the SaaS owner's own running costs (Railway, Dynadot, Resend, …),
// their due dates, payment status and history. Platform-level data (no tenant).

const prisma = require('../config/database');

const VALID_CYCLES = ['MONTHLY', 'YEARLY', 'ONE_TIME', 'USAGE'];

// Derive payment status + days-to-due from the stored due date.
// OVERDUE (red) = due date passed · DUE_SOON (yellow) = within 7 days ·
// PAID (green) = due date comfortably in the future (current cycle settled) ·
// USAGE/PENDING (grey) = usage-based or no schedule.
function deriveStatus(p, now = new Date()) {
  if (p.billingCycle === 'USAGE') return { status: 'USAGE', daysUntilDue: null };
  if (!p.nextDueDate) return { status: 'PENDING', daysUntilDue: null };
  const days = Math.ceil((new Date(p.nextDueDate) - now) / 86400000);
  let status;
  if (days < 0) status = 'OVERDUE';
  else if (days <= 7) status = 'DUE_SOON';
  else status = 'PAID';
  return { status, daysUntilDue: days };
}

// Normalise any billing cycle to a monthly figure for totals.
function monthlyEquivalent(p) {
  const c = Number(p.monthlyCost || 0);
  if (p.billingCycle === 'YEARLY') return +(c / 12).toFixed(2);
  if (p.billingCycle === 'ONE_TIME') return 0;
  return c; // MONTHLY or USAGE (usage entered as monthly estimate)
}

function advanceDueDate(date, cycle) {
  const d = new Date(date);
  if (cycle === 'YEARLY') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1); // MONTHLY default
  return d;
}

// GET /super-admin/costs — full dashboard payload (overview + platform rows)
const list = async (req, res, next) => {
  try {
    const now = new Date();
    const platforms = await prisma.platformCost.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { payments: { orderBy: { paidAt: 'desc' }, take: 1 } },
    });

    const rows = platforms.map((p) => {
      const { status, daysUntilDue } = deriveStatus(p, now);
      return {
        id: p.id, name: p.name, category: p.category, url: p.url,
        monthlyCost: Number(p.monthlyCost || 0), currency: p.currency,
        billingCycle: p.billingCycle, nextDueDate: p.nextDueDate,
        lastPaymentDate: p.lastPaymentDate, autoRenew: p.autoRenew,
        notes: p.notes, isActive: p.isActive,
        monthlyEquivalent: monthlyEquivalent(p),
        status, daysUntilDue,
        dueSoon: daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7,
        lastPayment: p.payments[0] || null,
      };
    });

    const active = rows.filter((r) => r.isActive);
    const sum = (arr) => +arr.reduce((s, r) => s + r.monthlyEquivalent, 0).toFixed(2);
    const overview = {
      totalMonthly: sum(active),
      activeServices: active.length,
      dueSoon: {
        count: active.filter((r) => r.daysUntilDue !== null && r.daysUntilDue >= 0 && r.daysUntilDue <= 30).length,
        amount: sum(active.filter((r) => r.daysUntilDue !== null && r.daysUntilDue >= 0 && r.daysUntilDue <= 30)),
      },
      overdue: {
        count: active.filter((r) => r.status === 'OVERDUE').length,
        amount: sum(active.filter((r) => r.status === 'OVERDUE')),
      },
      // costs may be in different currencies — surface the breakdown too
      byCurrency: active.reduce((acc, r) => { acc[r.currency] = +( (acc[r.currency] || 0) + r.monthlyEquivalent ).toFixed(2); return acc; }, {}),
      generatedAt: now.toISOString(),
    };

    res.json({ overview, platforms: rows });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, category, url, monthlyCost, currency, billingCycle, nextDueDate, notes, autoRenew } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Platform name is required' });
    const cycle = VALID_CYCLES.includes(billingCycle) ? billingCycle : 'MONTHLY';
    const created = await prisma.platformCost.create({
      data: {
        name: String(name).trim(), category: category || null, url: url || null,
        monthlyCost: monthlyCost != null ? Number(monthlyCost) : 0,
        currency: (currency || 'USD').toUpperCase().slice(0, 8),
        billingCycle: cycle,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        notes: notes || null,
        autoRenew: autoRenew !== undefined ? !!autoRenew : true,
      },
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { name, category, url, monthlyCost, currency, billingCycle, nextDueDate, notes, autoRenew, isActive } = req.body;
    const data = {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(category !== undefined && { category: category || null }),
      ...(url !== undefined && { url: url || null }),
      ...(monthlyCost !== undefined && { monthlyCost: Number(monthlyCost) || 0 }),
      ...(currency !== undefined && { currency: (currency || 'USD').toUpperCase().slice(0, 8) }),
      ...(billingCycle !== undefined && VALID_CYCLES.includes(billingCycle) && { billingCycle }),
      ...(nextDueDate !== undefined && { nextDueDate: nextDueDate ? new Date(nextDueDate) : null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(autoRenew !== undefined && { autoRenew: !!autoRenew }),
      ...(isActive !== undefined && { isActive: !!isActive }),
      updatedAt: new Date(),
    };
    const result = await prisma.platformCost.updateMany({ where: { id: req.params.id }, data });
    if (result.count === 0) return res.status(404).json({ error: 'Platform not found' });
    res.json(await prisma.platformCost.findFirst({ where: { id: req.params.id } }));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const result = await prisma.platformCost.deleteMany({ where: { id: req.params.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Platform not found' });
    res.json({ message: 'Platform removed' });
  } catch (err) { next(err); }
};

// POST /super-admin/costs/:id/pay — record a payment and advance the due date
const markPaid = async (req, res, next) => {
  try {
    const p = await prisma.platformCost.findFirst({ where: { id: req.params.id } });
    if (!p) return res.status(404).json({ error: 'Platform not found' });

    const { amount, method, reference, notes, paidAt, periodLabel } = req.body;
    const when = paidAt ? new Date(paidAt) : new Date();
    const amt = amount != null ? Number(amount) : Number(p.monthlyCost || 0);
    const label = periodLabel || `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}`;

    await prisma.platformPayment.create({
      data: {
        platformCostId: p.id, amount: amt, currency: p.currency,
        paidAt: when, periodLabel: label,
        method: method || null, reference: reference || null, notes: notes || null,
        createdById: req.user.id,
      },
    });

    // Advance the schedule so the row goes green until the next cycle.
    const base = p.nextDueDate && new Date(p.nextDueDate) > when ? new Date(p.nextDueDate) : when;
    const nextDue = p.billingCycle === 'USAGE' || p.billingCycle === 'ONE_TIME'
      ? p.nextDueDate
      : advanceDueDate(base, p.billingCycle);

    await prisma.platformCost.updateMany({
      where: { id: p.id },
      data: { lastPaymentDate: when, nextDueDate: nextDue, updatedAt: new Date() },
    });
    res.json(await prisma.platformCost.findFirst({ where: { id: p.id }, include: { payments: { orderBy: { paidAt: 'desc' }, take: 1 } } }));
  } catch (err) { next(err); }
};

// GET /super-admin/costs/:id/payments — last 6 months (default) of history
const payments = async (req, res, next) => {
  try {
    const months = Math.min(36, Math.max(1, Number(req.query.months) || 6));
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const history = await prisma.platformPayment.findMany({
      where: { platformCostId: req.params.id, paidAt: { gte: since } },
      orderBy: { paidAt: 'desc' },
    });
    res.json(history);
  } catch (err) { next(err); }
};

// GET /super-admin/costs/export — CSV of the current cost table
const exportCsv = async (req, res, next) => {
  try {
    const now = new Date();
    const platforms = await prisma.platformCost.findMany({ orderBy: { name: 'asc' } });
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmtDate = (d) => (d ? new Date(d).toISOString().substring(0, 10) : '');
    const cols = ['Platform', 'Category', 'Monthly Cost', 'Currency', 'Billing Cycle', 'Next Due Date', 'Status', 'Last Payment Date'];
    const lines = [cols.join(',')];
    for (const p of platforms) {
      const { status } = deriveStatus(p, now);
      lines.push([
        esc(p.name), esc(p.category), esc(Number(p.monthlyCost || 0).toFixed(2)), esc(p.currency),
        esc(p.billingCycle), esc(fmtDate(p.nextDueDate)), esc(status), esc(fmtDate(p.lastPaymentDate)),
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="platform-costs-${now.toISOString().substring(0, 10)}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove, markPaid, payments, exportCsv };
