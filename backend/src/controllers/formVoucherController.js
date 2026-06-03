const prisma = require('../config/database');
const { generateZatcaQrDataUrl } = require('../services/voucherService');

// ── Validation helpers ───────────────────────────────────────────────────────
const ALPHA = /^[A-Za-z؀-ۿ\s.'-]+$/;
const ALPHANUM = /^[A-Za-z0-9]+$/;
const DIGITS_12 = /^\d{12}$/;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Voucher number generation ────────────────────────────────────────────────
// Format: SAF + YYYY + MM + 3-digit incremental counter, e.g. SAF202412001.
// The counter is per-tenant, per-month: we count this tenant's vouchers whose
// number starts with the SAF{YYYY}{MM} prefix and take the next value. A
// uniqueness loop guards against gaps/races, and the DB UNIQUE(tenantId,
// voucherNo) constraint is the final backstop. Queries are tenant-scoped by the
// Prisma middleware, so each tenant gets its own independent sequence.
async function generateVoucherNo() {
  const now = new Date();
  const prefix = `SAF${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await prisma.formVoucher.count({ where: { voucherNo: { startsWith: prefix } } });
  let n = count + 1;
  // Resolve any collision (e.g. a deleted-then-recreated gap) by probing forward.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${prefix}${String(n).padStart(3, '0')}`;
    const clash = await prisma.formVoucher.findFirst({ where: { voucherNo: candidate } });
    if (!clash) return candidate;
    n++;
  }
}

// ── Date calculation: number of nights between check-in and check-out ─────────
// Uses UTC midnight of each date so DST / timezone offsets never shift the count.
function nightsBetween(checkIn, checkOut) {
  const a = new Date(checkIn); const b = new Date(checkOut);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

function validateVoucher(body) {
  const errors = [];
  const type = body.type === 'TRANSPORT' ? 'TRANSPORT' : 'HOTEL';

  if (!body.firstName || !ALPHA.test(String(body.firstName).trim())) errors.push('First name is required (letters only)');
  if (!body.lastName || !ALPHA.test(String(body.lastName).trim())) errors.push('Last name is required (letters only)');
  if (body.companyName && !ALPHA.test(String(body.companyName).trim())) errors.push('Company name must contain letters only');
  if (!DIGITS_12.test((body.mobile || '').replace(/\s/g, ''))) errors.push('Mobile # must be exactly 12 digits');
  if (body.whatsapp && !DIGITS_12.test((body.whatsapp || '').replace(/\s/g, ''))) errors.push('WhatsApp # must be exactly 12 digits');
  if (!body.passport || !ALPHANUM.test(String(body.passport).trim())) errors.push('Passport # is required (alphanumeric)');

  if (type === 'HOTEL') {
    if (!body.hotelName || !String(body.hotelName).trim()) errors.push('Hotel name is required');
    if (!body.checkInDate) errors.push('Check-in date is required');
    if (!body.checkOutDate) errors.push('Check-out date is required');
    if (body.checkInDate && body.checkOutDate && nightsBetween(body.checkInDate, body.checkOutDate) <= 0) {
      errors.push('Check-out date must be after check-in date');
    }
    if (body.perNightPrice === undefined || body.perNightPrice === '' || isNaN(Number(body.perNightPrice)) || Number(body.perNightPrice) < 0) {
      errors.push('Per-night selling price is required (numeric)');
    }
  } else {
    if (!body.vehicleType || !String(body.vehicleType).trim()) errors.push('Vehicle type is required');
    if (!body.pickupLocation || !String(body.pickupLocation).trim()) errors.push('Pickup location is required');
    if (!body.dropoffLocation || !String(body.dropoffLocation).trim()) errors.push('Drop-off location is required');
    if (!body.travelDate) errors.push('Travel date is required');
    if (body.transportPrice === undefined || body.transportPrice === '' || isNaN(Number(body.transportPrice)) || Number(body.transportPrice) < 0) {
      errors.push('Transport price is required (numeric)');
    }
  }
  return { type, errors };
}

// Compute the stored total value from the typed fields.
function computeTotal(type, body) {
  if (type === 'HOTEL') {
    const nights = nightsBetween(body.checkInDate, body.checkOutDate);
    return Math.max(0, nights) * Number(body.perNightPrice || 0);
  }
  return Number(body.transportPrice || 0);
}

// ── Handlers ─────────────────────────────────────────────────────────────────
const nextNumber = async (req, res, next) => {
  try {
    res.json({ voucherNo: await generateVoucherNo() });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const { search, status, type, page = 1, limit = 15 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      ...(status && { status }),
      ...(type && { type }),
      ...(search && {
        OR: [
          { voucherNo: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { mobile: { contains: search } },
          { hotelName: { contains: search, mode: 'insensitive' } },
          { hcn: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      prisma.formVoucher.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.formVoucher.count({ where }),
    ]);
    res.json({ data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    res.json(v);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { type, errors } = validateVoucher(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join('; '), fields: errors });

    // Always generate the number server-side (ignore any client value) so the
    // SAF sequence can't be tampered with or duplicated.
    const voucherNo = await generateVoucherNo();
    const totalValue = computeTotal(type, req.body);

    const data = {
      tenantId,
      voucherNo,
      type,
      status: 'TENTATIVE',
      companyName: req.body.companyName?.trim() || null,
      firstName: String(req.body.firstName).trim(),
      lastName: String(req.body.lastName).trim(),
      mobile: (req.body.mobile || '').replace(/\s/g, ''),
      whatsapp: req.body.whatsapp ? String(req.body.whatsapp).replace(/\s/g, '') : null,
      passport: String(req.body.passport).trim(),
      totalValue,
      createdById: req.user.id,
      ...(type === 'HOTEL' ? {
        hotelId: req.body.hotelId || null,
        hotelName: String(req.body.hotelName).trim(),
        checkInDate: new Date(req.body.checkInDate),
        checkOutDate: new Date(req.body.checkOutDate),
        perNightPrice: Number(req.body.perNightPrice),
      } : {
        vehicleType: String(req.body.vehicleType).trim(),
        pickupLocation: String(req.body.pickupLocation).trim(),
        dropoffLocation: String(req.body.dropoffLocation).trim(),
        travelDate: new Date(req.body.travelDate),
        passengerCount: req.body.passengerCount ? Number(req.body.passengerCount) : null,
        transportPrice: Number(req.body.transportPrice),
      }),
    };

    const voucher = await prisma.formVoucher.create({ data });
    res.status(201).json(voucher);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Duplicate voucher number — please retry' });
    next(err);
  }
};

// ── State transition: Tentative → Confirmed (one-way) ─────────────────────────
const confirm = async (req, res, next) => {
  try {
    const { hcn } = req.body;
    if (!hcn || !ALPHANUM.test(String(hcn).trim())) {
      return res.status(400).json({ error: 'HCN # is required and must be alphanumeric' });
    }
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    // Confirmation is one-way: a confirmed voucher can never revert to tentative.
    if (v.status === 'CONFIRMED') {
      return res.status(409).json({ error: 'Voucher is already confirmed and cannot be changed' });
    }
    await prisma.formVoucher.updateMany({
      where: { id: req.params.id },
      data: {
        status: 'CONFIRMED',
        hcn: String(hcn).trim(),
        confirmedAt: new Date(),
        confirmedById: req.user.id,
        modifiedById: req.user.id,
        updatedAt: new Date(),
      },
    });
    const updated = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const result = await prisma.formVoucher.deleteMany({ where: { id: req.params.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Voucher not found' });
    res.json({ message: 'Voucher deleted' });
  } catch (err) { next(err); }
};

// ── Printable HTML voucher with ZATCA QR ──────────────────────────────────────
const printHtml = async (req, res, next) => {
  try {
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).send('<h1>Voucher not found</h1>');

    const tenant = req.user.tenantId
      ? await prisma.tenant.findFirst({ where: { id: req.user.tenantId }, select: { name: true, vatNumber: true, crNumber: true, primaryColor: true } }).catch(() => null)
      : null;
    const brand = tenant?.name || 'Safre Manasik';
    const accent = '#1B4B35';
    const isConfirmed = v.status === 'CONFIRMED';
    const statusColor = isConfirmed ? '#1B4B35' : '#B8860B';

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const fmtMoney = (n) => `SAR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    // ZATCA Phase-1 QR encodes seller, VAT no, timestamp, total (incl VAT) and
    // VAT amount as a TLV/base64 string. We reuse the shared helper, feeding it
    // this voucher's total value (it derives 15% VAT internally).
    const qrDataUrl = await generateZatcaQrDataUrl({ totalAmount: Number(v.totalValue || 0) }, tenant || {});

    const details = v.type === 'HOTEL' ? `
      <tr><td class="l">Hotel</td><td class="v">${esc(v.hotelName)}</td></tr>
      <tr><td class="l">Check-in</td><td class="v">${fmtDate(v.checkInDate)}</td></tr>
      <tr><td class="l">Check-out</td><td class="v">${fmtDate(v.checkOutDate)}</td></tr>
      <tr><td class="l">Nights</td><td class="v">${nightsBetween(v.checkInDate, v.checkOutDate)}</td></tr>
      <tr><td class="l">Per-night Price</td><td class="v">${fmtMoney(v.perNightPrice)}</td></tr>
    ` : `
      <tr><td class="l">Vehicle Type</td><td class="v">${esc(v.vehicleType)}</td></tr>
      <tr><td class="l">Route</td><td class="v">${esc(v.pickupLocation)} → ${esc(v.dropoffLocation)}</td></tr>
      <tr><td class="l">Travel Date</td><td class="v">${fmtDate(v.travelDate)}</td></tr>
      ${v.passengerCount ? `<tr><td class="l">Passengers</td><td class="v">${v.passengerCount}</td></tr>` : ''}
      <tr><td class="l">Price</td><td class="v">${fmtMoney(v.transportPrice)}</td></tr>
    `;

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(v.voucherNo)} — ${v.type} Voucher</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:13px}
  .page{max-width:800px;margin:18px auto;padding:0 18px}
  .no-print{text-align:right;margin-bottom:8px}
  .btn{background:${accent};color:#fff;border:none;padding:9px 22px;border-radius:6px;font-weight:700;cursor:pointer}
  .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:90px;font-weight:900;color:${statusColor};opacity:.05;z-index:0;letter-spacing:8px}
  .strip{background:#0D2B1A;color:#fff;padding:8px 16px;display:flex;justify-content:space-between;align-items:center;border-radius:5px 5px 0 0}
  .strip .t{font-weight:800;letter-spacing:2px;color:#C9A227}
  .hdr{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:1px solid #e2e8f0;border-top:none}
  .brand{font-size:22px;font-weight:800;color:${accent}}
  .badge{padding:5px 16px;border-radius:4px;font-weight:800;letter-spacing:2px;color:#fff;background:${statusColor}}
  h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#fff;background:${statusColor};padding:5px 10px;margin:16px 0 8px;border-radius:3px}
  table{width:100%;border-collapse:collapse}
  td{padding:6px 10px;border-bottom:1px solid #eef2f6;font-size:12px}
  td.l{color:#64748b;font-weight:600;width:38%}
  td.v{font-weight:600}
  .bottom{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;margin-top:16px}
  .amount{background:linear-gradient(135deg,#0D2B1A,#1B4B35);color:#fff;padding:14px 18px;border-radius:6px}
  .amount .lab{font-size:12px;color:rgba(255,255,255,.8)}
  .amount .val{font-size:24px;font-weight:800;color:#C9A227;margin-top:4px}
  .qr{text-align:center;border:1.5px solid #e2e8f0;border-radius:6px;padding:8px;background:#fafafa;min-width:140px}
  .qr .qt{font-size:8px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .terms{margin-top:16px;font-size:10px;color:#94a3b8;padding:8px 10px;background:#f8fafc;border-radius:4px;border-left:3px solid ${statusColor};line-height:1.5}
  @media print{.no-print{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head>
<body>
<div class="watermark">${v.status}</div>
<div class="page">
  <div class="no-print"><button class="btn" onclick="window.print()">🖨️ Print Voucher</button></div>
  <div class="strip">
    <span class="t">${v.type === 'HOTEL' ? 'HOTEL VOUCHER' : 'TRANSPORT VOUCHER'}</span>
    <span>Voucher No: <strong style="color:#C9A227">${esc(v.voucherNo)}</strong></span>
  </div>
  <div class="hdr">
    <div class="brand">${esc(brand)}</div>
    <div style="text-align:right">
      <div class="badge">${v.status}</div>
      <div style="font-size:10px;color:#64748b;margin-top:6px;line-height:1.6">
        Issued: ${fmtDate(v.createdAt)}<br>
        ${isConfirmed ? `Confirmed: ${fmtDate(v.confirmedAt)}<br>HCN #: <strong>${esc(v.hcn)}</strong>` : 'Status pending confirmation'}
      </div>
    </div>
  </div>

  <h3>Customer</h3>
  <table>
    ${v.companyName ? `<tr><td class="l">Company</td><td class="v">${esc(v.companyName)}</td></tr>` : ''}
    <tr><td class="l">Name</td><td class="v">${esc(v.firstName)} ${esc(v.lastName)}</td></tr>
    <tr><td class="l">Mobile</td><td class="v">${esc(v.mobile)}</td></tr>
    ${v.whatsapp ? `<tr><td class="l">WhatsApp</td><td class="v">${esc(v.whatsapp)}</td></tr>` : ''}
    <tr><td class="l">Passport #</td><td class="v">${esc(v.passport)}</td></tr>
  </table>

  <h3>${v.type === 'HOTEL' ? 'Hotel Details' : 'Transport Details'}</h3>
  <table>${details}</table>

  <div class="bottom">
    <div class="amount">
      <div class="lab">Total Value${v.type === 'HOTEL' ? ' (nights × per-night)' : ''}</div>
      <div class="val">${fmtMoney(v.totalValue)}</div>
      <div style="font-size:10px;color:rgba(255,255,255,.65);margin-top:4px">Inclusive of applicable 15% VAT for ZATCA</div>
    </div>
    <div class="qr">
      <div class="qt">ZATCA e-Invoice QR</div>
      <img src="${qrDataUrl}" alt="ZATCA QR" style="width:120px;height:120px"/>
      <div style="font-size:7px;color:#94a3b8;margin-top:4px">VAT No: ${esc(tenant?.vatNumber || '300000000000003')}</div>
    </div>
  </div>

  <div class="terms">
    <strong>Terms &amp; Conditions:</strong> This voucher is subject to availability and the agency's booking policy.
    ${isConfirmed
      ? 'All services on this <strong>CONFIRMED</strong> voucher are booked and finalized under HCN # ' + esc(v.hcn) + '.'
      : 'This is a <strong>TENTATIVE</strong> voucher — services are not finalized until confirmed.'}
    <br>Issued by ${esc(brand)}${tenant?.crNumber ? ' · CR No. ' + esc(tenant.crNumber) : ''} · Generated ${fmtDate(new Date())}.
  </div>
</div>
</body></html>`;

    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) { next(err); }
};

module.exports = { nextNumber, list, getOne, create, confirm, remove, printHtml };
