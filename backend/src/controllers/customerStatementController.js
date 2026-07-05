const prisma = require('../config/database');
const { printHelpers } = require('./formVoucherController');

const { esc, fmtDateLong, moneyFmt, loadTenantBrand, brandHeaderInner, baseCss, getTenantFinancials } = printHelpers;

// ── Customer Statement ────────────────────────────────────────────────────────
// A classic account statement for one customer over a date range, merging every
// financial event on their account into a single debit/credit ledger:
//   Debits  — booking invoices (amount charged) and direct-voucher invoices
//             (gross incl. VAT; Actual preferred over Proforma).
//   Credits — booking payments and direct-voucher payments.
// Balance convention: positive balance = amount the customer still owes.
// Cancelled bookings/vouchers are excluded; their payments (if any) still show.

const parseDay = (s, endOfDay) => {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  if (endOfDay) d.setUTCHours(23, 59, 59, 999); else d.setUTCHours(0, 0, 0, 0);
  return d;
};

// Gross (incl. VAT) charge for a direct voucher: prefer the ACTIVE Actual
// invoice, then the ACTIVE Proforma, then compute from the voucher snapshot.
function voucherGross(v, invoicesByVoucher) {
  const invs = invoicesByVoucher.get(v.id) || [];
  const pick = invs.find((i) => i.docType === 'ACTUAL' && i.status === 'ACTIVE')
    || invs.find((i) => i.docType === 'PROFORMA' && i.status === 'ACTIVE');
  if (pick) return { amount: Number(pick.grandTotal), ref: pick.number };
  const rate = v.vatRate != null ? Number(v.vatRate) : 0.15;
  return { amount: +(Number(v.totalValue || 0) * (1 + rate)).toFixed(2), ref: v.voucherNo };
}

async function buildStatement(customerId, dateFrom, dateTo) {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true, name: true, email: true, phone: true, companyName: true, address: true, tenantId: true },
  });
  if (!customer) return null;

  const from = parseDay(dateFrom, false);
  const to = parseDay(dateTo, true);

  // ── Bookings + their payments ─────────────────────────────────────────────
  const bookings = await prisma.booking.findMany({
    where: { customerId: customer.id },
    select: {
      id: true, bookingRef: true, status: true, createdAt: true, totalAmount: true,
      currency: true, travelDateFrom: true, travelDateTo: true,
      package: { select: { name: true } },
      invoice: { select: { invoiceNo: true, totalAmount: true } },
    },
  });
  const bookingPayments = await prisma.payment.findMany({
    where: { booking: { customerId: customer.id }, status: 'PAID' },
    select: { id: true, bookingId: true, amount: true, method: true, reference: true, paidAt: true },
  });
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  // ── Direct vouchers (linked by customerId, or legacy match by mobile) ─────
  const voucherWhere = customer.phone
    ? { OR: [{ customerId: customer.id }, { mobile: customer.phone }] }
    : { customerId: customer.id };
  const vouchers = await prisma.formVoucher.findMany({
    where: voucherWhere,
    select: {
      id: true, voucherNo: true, type: true, status: true, createdAt: true,
      totalValue: true, vatRate: true, hotelName: true, trips: true,
      paymentStatus: true, paidAt: true, paymentMethod: true, paymentRef: true,
    },
  });
  const voucherInvoices = vouchers.length
    ? await prisma.voucherInvoice.findMany({
        where: { voucherId: { in: vouchers.map((v) => v.id) } },
        select: { voucherId: true, docType: true, status: true, number: true, grandTotal: true },
      })
    : [];
  const invoicesByVoucher = new Map();
  voucherInvoices.forEach((i) => {
    if (!invoicesByVoucher.has(i.voucherId)) invoicesByVoucher.set(i.voucherId, []);
    invoicesByVoucher.get(i.voucherId).push(i);
  });

  // ── Flatten into ledger entries ───────────────────────────────────────────
  const entries = [];

  bookings.filter((b) => b.status !== 'CANCELLED').forEach((b) => {
    const amount = b.invoice ? Number(b.invoice.totalAmount) : Number(b.totalAmount);
    entries.push({
      date: b.createdAt, kind: 'BOOKING', ref: b.invoice?.invoiceNo || b.bookingRef,
      description: `Booking ${b.bookingRef}${b.package?.name ? ` — ${b.package.name}` : ''} (${fmtDateLong(b.travelDateFrom)} → ${fmtDateLong(b.travelDateTo)})`,
      debit: amount, credit: 0,
    });
  });

  bookingPayments.forEach((p) => {
    const b = bookingById.get(p.bookingId);
    entries.push({
      date: p.paidAt, kind: 'PAYMENT', ref: p.reference || '—',
      description: `Payment received — ${p.method}${b ? ` (booking ${b.bookingRef})` : ''}`,
      debit: 0, credit: Number(p.amount),
    });
  });

  vouchers.filter((v) => v.status !== 'CANCELLED').forEach((v) => {
    const { amount, ref } = voucherGross(v, invoicesByVoucher);
    const firstTrip = Array.isArray(v.trips) && v.trips.length ? v.trips[0] : null;
    const svc = v.type === 'HOTEL'
      ? (firstTrip?.hotelName || v.hotelName || 'Hotel')
      : (firstTrip ? `${firstTrip.pickupLocation || ''} → ${firstTrip.dropoffLocation || ''}` : 'Transport');
    entries.push({
      date: v.createdAt, kind: 'VOUCHER', ref,
      description: `${v.type === 'HOTEL' ? 'Hotel' : 'Transport'} voucher ${v.voucherNo} — ${svc}${v.status === 'TENTATIVE' ? ' (tentative)' : ''}`,
      debit: amount, credit: 0,
    });
    if (v.paymentStatus === 'PAID' && v.paidAt) {
      entries.push({
        date: v.paidAt, kind: 'PAYMENT', ref: v.paymentRef || '—',
        description: `Payment received — ${v.paymentMethod || 'CASH'} (voucher ${v.voucherNo})`,
        debit: 0, credit: amount,
      });
    }
  });

  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  const before = entries.filter((e) => from && new Date(e.date) < from);
  const inRange = entries.filter((e) =>
    (!from || new Date(e.date) >= from) && (!to || new Date(e.date) <= to));

  const openingBalance = +before.reduce((s, e) => s + e.debit - e.credit, 0).toFixed(2);
  let running = openingBalance;
  const lines = inRange.map((e) => {
    running = +(running + e.debit - e.credit).toFixed(2);
    return { ...e, debit: +e.debit.toFixed(2), credit: +e.credit.toFixed(2), balance: running };
  });

  const totalDebits = +inRange.reduce((s, e) => s + e.debit, 0).toFixed(2);
  const totalCredits = +inRange.reduce((s, e) => s + e.credit, 0).toFixed(2);

  const { currency } = await getTenantFinancials(customer.tenantId);

  return {
    customer: {
      id: customer.id, name: customer.name, email: customer.email,
      phone: customer.phone, companyName: customer.companyName, address: customer.address,
    },
    period: { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null },
    currency,
    openingBalance,
    lines,
    totals: { debits: totalDebits, credits: totalCredits, closingBalance: +(openingBalance + totalDebits - totalCredits).toFixed(2) },
    tenantId: customer.tenantId,
  };
}

const getStatement = async (req, res, next) => {
  try {
    const stmt = await buildStatement(req.params.id, req.query.dateFrom, req.query.dateTo);
    if (!stmt) return res.status(404).json({ error: 'Customer not found' });
    const { tenantId, ...safe } = stmt;
    res.json(safe);
  } catch (err) { next(err); }
};

// ── Branded, print-ready HTML statement (same visual language as vouchers) ────
const printStatement = async (req, res, next) => {
  try {
    const stmt = await buildStatement(req.params.id, req.query.dateFrom, req.query.dateTo);
    if (!stmt) return res.status(404).send('<h1>Customer not found</h1>');

    const accent = '#1B4B35';
    const { brand, logoUrl, addressLine, tenant } = await loadTenantBrand(stmt.tenantId);
    const fmtMoney = moneyFmt(stmt.currency);
    const c = stmt.customer;
    // Auto-created voucher customers carry a placeholder login email — hide it.
    const showEmail = c.email && !/@customers\.safremanasik\.com$/i.test(c.email);
    const periodLabel = `${stmt.period.from ? fmtDateLong(stmt.period.from) : 'Beginning'} — ${stmt.period.to ? fmtDateLong(stmt.period.to) : fmtDateLong(new Date())}`;
    const owes = stmt.totals.closingBalance > 0;

    const rows = stmt.lines.map((l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${fmtDateLong(l.date)}</td>
        <td>${esc(l.ref)}</td>
        <td>${esc(l.description)}</td>
        <td style="text-align:right">${l.debit ? fmtMoney(l.debit) : '—'}</td>
        <td style="text-align:right">${l.credit ? fmtMoney(l.credit) : '—'}</td>
        <td style="text-align:right;font-weight:700">${fmtMoney(l.balance)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Statement — ${esc(c.name)}</title>
<style>${baseCss(accent, accent)}
  td, th{font-size:11px}
  .sumgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
  .sumcard{border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;text-align:center}
  .sumcard .k{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700}
  .sumcard .a{font-size:15px;font-weight:800;color:${accent};margin-top:4px}
</style></head><body>
<div class="page">
  <div class="no-print"><button class="btn" onclick="window.print()">🖨 Print</button></div>
  <div class="strip"><span class="t">CUSTOMER STATEMENT</span><span>${esc(periodLabel)}</span></div>
  <div class="hdr">
    ${brandHeaderInner({ brand, logoUrl, addressLine, tenant, accent })}
    <div style="text-align:right">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Statement date</div>
      <div style="font-weight:700">${fmtDateLong(new Date())}</div>
    </div>
  </div>

  <h3>Customer</h3>
  <table>
    <tr><td class="l">Name</td><td class="v">${esc(c.name)}</td></tr>
    ${c.companyName ? `<tr><td class="l">Company</td><td class="v">${esc(c.companyName)}</td></tr>` : ''}
    ${c.phone ? `<tr><td class="l">Mobile</td><td class="v">${esc(c.phone)}</td></tr>` : ''}
    ${showEmail ? `<tr><td class="l">Email</td><td class="v">${esc(c.email)}</td></tr>` : ''}
    ${c.address ? `<tr><td class="l">Address</td><td class="v">${esc(c.address)}</td></tr>` : ''}
  </table>

  <h3>Account activity — ${esc(periodLabel)}</h3>
  <table>
    <thead><tr><th style="width:26px">#</th><th>Date</th><th>Ref</th><th>Description</th>
      <th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead>
    <tbody>
      <tr><td></td><td>${stmt.period.from ? fmtDateLong(stmt.period.from) : '—'}</td><td>—</td>
        <td style="font-weight:700">Opening balance</td><td></td><td></td>
        <td style="text-align:right;font-weight:700">${fmtMoney(stmt.openingBalance)}</td></tr>
      ${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:14px">No transactions in this period</td></tr>'}
    </tbody>
  </table>

  <div class="sumgrid">
    <div class="sumcard"><div class="k">Opening balance</div><div class="a">${fmtMoney(stmt.openingBalance)}</div></div>
    <div class="sumcard"><div class="k">Total charges</div><div class="a">${fmtMoney(stmt.totals.debits)}</div></div>
    <div class="sumcard"><div class="k">Total payments</div><div class="a">${fmtMoney(stmt.totals.credits)}</div></div>
    <div class="sumcard" style="background:${owes ? '#FFF8E6' : '#EAF2EE'}"><div class="k">${owes ? 'Balance due' : 'Closing balance'}</div><div class="a">${fmtMoney(stmt.totals.closingBalance)}</div></div>
  </div>

  <div class="terms">This statement reflects bookings, direct vouchers, invoices and payments recorded on your account
    for the period shown. Tentative vouchers are included at their proforma value. A positive closing balance is the
    amount due; please quote the reference numbers above when making payment.</div>
</div>
</body></html>`;
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) { next(err); }
};

module.exports = { getStatement, printStatement };
