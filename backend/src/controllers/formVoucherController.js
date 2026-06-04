const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const QRCode = require('qrcode');

// ── Validation helpers ───────────────────────────────────────────────────────
const ALPHA = /^[A-Za-z؀-ۿ\s.'-]+$/;
const ALPHANUM = /^[A-Za-z0-9]+$/;
const DIGITS_12 = /^\d{12}$/;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Tenant financial config (VAT %, currency) from SystemConfig ───────────────
// Read with SUPER_ADMIN scope so the tenant middleware doesn't mangle the query.
async function getTenantFinancials(tenantId) {
  const rows = await new Promise((resolve) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try { resolve(await prisma.systemConfig.findMany({ where: { tenantId } })); }
      catch { resolve([]); }
    });
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const pct = parseFloat(map.vat_percentage);
  const vatRate = (!isNaN(pct) && pct >= 0) ? pct / 100 : 0.15; // default 15%
  const currency = (map.currency || 'SAR').toUpperCase();
  return { vatRate, currency };
}

// ── ZATCA Phase-1 QR (TLV/base64) with explicit total + VAT ───────────────────
function tlv(tag, value) {
  const b = Buffer.from(String(value), 'utf8');
  return Buffer.concat([Buffer.from([tag]), Buffer.from([b.length]), b]);
}
async function zatcaQrDataUrl({ sellerName, vatNumber, totalWithVat, vatAmount }) {
  const payload = Buffer.concat([
    tlv(1, sellerName || 'Safre Manasik'),
    tlv(2, vatNumber || '300000000000003'),
    tlv(3, new Date().toISOString()),
    tlv(4, Number(totalWithVat || 0).toFixed(2)),
    tlv(5, Number(vatAmount || 0).toFixed(2)),
  ]).toString('base64');
  return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 120 });
}

// ── Voucher number: SAF + YYYY + MM + 3-digit per-tenant monthly counter ──────
async function generateVoucherNo() {
  const now = new Date();
  const prefix = `SAF${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await prisma.formVoucher.count({ where: { voucherNo: { startsWith: prefix } } });
  let n = count + 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${prefix}${String(n).padStart(3, '0')}`;
    const clash = await prisma.formVoucher.findFirst({ where: { voucherNo: candidate } });
    if (!clash) return candidate;
    n++;
  }
}

// Nights between two dates (UTC midnight, DST-safe).
function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn); const b = new Date(checkOut);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

// ── Trips (both HOTEL and TRANSPORT vouchers may hold multiple trips) ──────────
// Reads body.trips[], or wraps the legacy single-trip fields into one element.
function rawTrips(body, type) {
  if (Array.isArray(body.trips) && body.trips.length) return body.trips;
  if (type === 'HOTEL' && (body.hotelName || body.checkInDate)) {
    return [{ hotelName: body.hotelName, hotelId: body.hotelId, checkInDate: body.checkInDate, checkOutDate: body.checkOutDate, perNightPrice: body.perNightPrice }];
  }
  if (type === 'TRANSPORT' && (body.vehicleType || body.pickupLocation)) {
    return [{ vehicleType: body.vehicleType, pickupLocation: body.pickupLocation, dropoffLocation: body.dropoffLocation, travelDate: body.travelDate, passengerCount: body.passengerCount, price: body.transportPrice }];
  }
  return [];
}

// Build the persisted trips array with per-trip line totals.
function buildTrips(body, type) {
  return rawTrips(body, type).map((t) => {
    if (type === 'HOTEL') {
      const nights = Math.max(0, nightsBetween(t.checkInDate, t.checkOutDate));
      const price = Number(t.perNightPrice || 0);
      return {
        hotelId: t.hotelId || null, hotelName: String(t.hotelName || '').trim(),
        checkInDate: t.checkInDate, checkOutDate: t.checkOutDate,
        perNightPrice: price, nights, lineTotal: nights * price,
      };
    }
    const price = Number(t.price ?? t.transportPrice ?? 0);
    return {
      vehicleType: String(t.vehicleType || '').trim(),
      pickupLocation: String(t.pickupLocation || '').trim(),
      dropoffLocation: String(t.dropoffLocation || '').trim(),
      travelDate: t.travelDate,
      passengerCount: t.passengerCount ? Number(t.passengerCount) : null,
      price, lineTotal: price,
    };
  });
}

function computeTotal(type, body) {
  return buildTrips(body, type).reduce((s, t) => s + t.lineTotal, 0);
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

  const trips = rawTrips(body, type);
  if (!trips.length) errors.push('At least one trip is required');
  trips.forEach((t, i) => {
    const n = i + 1;
    if (type === 'HOTEL') {
      if (!t.hotelName || !String(t.hotelName).trim()) errors.push(`Trip ${n}: hotel name is required`);
      if (!t.checkInDate) errors.push(`Trip ${n}: check-in date is required`);
      if (!t.checkOutDate) errors.push(`Trip ${n}: check-out date is required`);
      if (t.checkInDate && t.checkOutDate && nightsBetween(t.checkInDate, t.checkOutDate) <= 0) errors.push(`Trip ${n}: check-out must be after check-in`);
      if (t.perNightPrice === undefined || t.perNightPrice === '' || isNaN(Number(t.perNightPrice)) || Number(t.perNightPrice) < 0) errors.push(`Trip ${n}: per-night price is required (numeric)`);
    } else {
      const price = t.price ?? t.transportPrice;
      if (!t.vehicleType || !String(t.vehicleType).trim()) errors.push(`Trip ${n}: vehicle type is required`);
      if (!t.pickupLocation || !String(t.pickupLocation).trim()) errors.push(`Trip ${n}: pickup location is required`);
      if (!t.dropoffLocation || !String(t.dropoffLocation).trim()) errors.push(`Trip ${n}: drop-off location is required`);
      if (!t.travelDate) errors.push(`Trip ${n}: travel date is required`);
      if (price === undefined || price === '' || isNaN(Number(price)) || Number(price) < 0) errors.push(`Trip ${n}: price is required (numeric)`);
    }
  });
  return { type, errors };
}

// Build the persisted column payload (trips + legacy single columns from trip[0]).
function typeColumns(type, body) {
  const trips = buildTrips(body, type);
  const first = trips[0] || {};
  if (type === 'HOTEL') {
    return {
      trips,
      hotelId: first.hotelId || null, hotelName: first.hotelName || null,
      checkInDate: first.checkInDate ? new Date(first.checkInDate) : null,
      checkOutDate: first.checkOutDate ? new Date(first.checkOutDate) : null,
      perNightPrice: first.perNightPrice ?? null,
      // clear transport columns
      vehicleType: null, pickupLocation: null, dropoffLocation: null, travelDate: null, passengerCount: null, transportPrice: null,
    };
  }
  return {
    trips,
    vehicleType: first.vehicleType || null, pickupLocation: first.pickupLocation || null,
    dropoffLocation: first.dropoffLocation || null, travelDate: first.travelDate ? new Date(first.travelDate) : null,
    passengerCount: first.passengerCount ?? null, transportPrice: first.price ?? null,
    // clear hotel columns
    hotelId: null, hotelName: null, checkInDate: null, checkOutDate: null, perNightPrice: null,
  };
}

// ── Handlers ─────────────────────────────────────────────────────────────────
const nextNumber = async (req, res, next) => {
  try { res.json({ voucherNo: await generateVoucherNo() }); } catch (err) { next(err); }
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

    const voucherNo = await generateVoucherNo();
    const totalValue = computeTotal(type, req.body);
    const { vatRate } = await getTenantFinancials(tenantId); // snapshot at issue

    const data = {
      tenantId, voucherNo, type, status: 'TENTATIVE',
      companyName: req.body.companyName?.trim() || null,
      firstName: String(req.body.firstName).trim(),
      lastName: String(req.body.lastName).trim(),
      mobile: (req.body.mobile || '').replace(/\s/g, ''),
      whatsapp: req.body.whatsapp ? String(req.body.whatsapp).replace(/\s/g, '') : null,
      passport: String(req.body.passport).trim(),
      totalValue, vatRate, createdById: req.user.id,
      ...typeColumns(type, req.body),
    };
    const voucher = await prisma.formVoucher.create({ data });
    res.status(201).json(voucher);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Duplicate voucher number — please retry' });
    next(err);
  }
};

// ── Edit — TENTATIVE vouchers only ────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    if (v.status !== 'TENTATIVE') {
      return res.status(409).json({ error: `Only tentative vouchers can be edited (this one is ${v.status.toLowerCase()})` });
    }
    const { type, errors } = validateVoucher(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join('; '), fields: errors });

    const totalValue = computeTotal(type, req.body);
    const { vatRate } = await getTenantFinancials(v.tenantId);

    await prisma.formVoucher.updateMany({
      where: { id: req.params.id },
      data: {
        type,
        companyName: req.body.companyName?.trim() || null,
        firstName: String(req.body.firstName).trim(),
        lastName: String(req.body.lastName).trim(),
        mobile: (req.body.mobile || '').replace(/\s/g, ''),
        whatsapp: req.body.whatsapp ? String(req.body.whatsapp).replace(/\s/g, '') : null,
        passport: String(req.body.passport).trim(),
        totalValue, vatRate, modifiedById: req.user.id, updatedAt: new Date(),
        ...typeColumns(type, req.body),
      },
    });
    const updated = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) { next(err); }
};

// ── Confirm — Tentative → Confirmed (one-way; not from Cancelled) ─────────────
const confirm = async (req, res, next) => {
  try {
    const { hcn } = req.body;
    if (!hcn || !ALPHANUM.test(String(hcn).trim())) {
      return res.status(400).json({ error: 'HCN # is required and must be alphanumeric' });
    }
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    if (v.status === 'CONFIRMED') return res.status(409).json({ error: 'Voucher is already confirmed' });
    if (v.status === 'CANCELLED') return res.status(409).json({ error: 'A cancelled voucher cannot be confirmed' });
    await prisma.formVoucher.updateMany({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED', hcn: String(hcn).trim(), confirmedAt: new Date(), confirmedById: req.user.id, modifiedById: req.user.id, updatedAt: new Date() },
    });
    res.json(await prisma.formVoucher.findFirst({ where: { id: req.params.id } }));
  } catch (err) { next(err); }
};

// ── Cancel — allowed for Tentative AND Confirmed ──────────────────────────────
const cancel = async (req, res, next) => {
  try {
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    if (v.status === 'CANCELLED') return res.status(409).json({ error: 'Voucher is already cancelled' });
    await prisma.formVoucher.updateMany({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', modifiedById: req.user.id, updatedAt: new Date() },
    });
    res.json(await prisma.formVoucher.findFirst({ where: { id: req.params.id } }));
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const result = await prisma.formVoucher.deleteMany({ where: { id: req.params.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Voucher not found' });
    res.json({ message: 'Voucher deleted' });
  } catch (err) { next(err); }
};

// ── Printable HTML voucher with VAT breakdown + ZATCA QR ──────────────────────
const printHtml = async (req, res, next) => {
  try {
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).send('<h1>Voucher not found</h1>');

    const tenant = req.user.tenantId
      ? await prisma.tenant.findFirst({ where: { id: req.user.tenantId }, select: { name: true, vatNumber: true, crNumber: true, address: true, city: true, country: true, logoUrl: true, contactPhone: true, contactEmail: true } }).catch(() => null)
      : null;
    const fin = await getTenantFinancials(v.tenantId);
    // Prefer the snapshot rate stored on the voucher; fall back to current config.
    const vatRate = v.vatRate != null ? Number(v.vatRate) : fin.vatRate;
    const currency = fin.currency;

    const brand = tenant?.name || 'Safre Manasik';
    const accent = '#1B4B35';
    const rawLogo = tenant?.logoUrl || '';
    const logoUrl = rawLogo ? (/^https?:\/\//i.test(rawLogo) ? rawLogo : `https://app.safremanasik.com${rawLogo.startsWith('/') ? '' : '/'}${rawLogo}`) : '';
    const addressLine = [tenant?.address, tenant?.city, tenant?.country].filter(Boolean).join(', ');

    const isConfirmed = v.status === 'CONFIRMED';
    const isCancelled = v.status === 'CANCELLED';
    const statusColor = isCancelled ? '#9CA3AF' : (isConfirmed ? '#1B4B35' : '#B8860B');

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const fmtMoney = (n) => `${currency} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    // VAT math: entered prices are the base (excl. VAT); VAT is added on top.
    const subtotal = Number(v.totalValue || 0);
    const vatAmount = +(subtotal * vatRate).toFixed(2);
    const grandTotal = +(subtotal + vatAmount).toFixed(2);
    const vatPctNum = vatRate * 100;
    const vatPctStr = Number.isInteger(vatPctNum) ? String(vatPctNum) : vatPctNum.toFixed(2);

    const qrDataUrl = await zatcaQrDataUrl({ sellerName: brand, vatNumber: tenant?.vatNumber, totalWithVat: grandTotal, vatAmount });

    // ── Service details table (hotel or transport, multi-trip) ───────────────
    let detailsTable;
    if (v.type === 'HOTEL') {
      const trips = Array.isArray(v.trips) && v.trips.length ? v.trips
        : (v.hotelName ? [{ hotelName: v.hotelName, checkInDate: v.checkInDate, checkOutDate: v.checkOutDate, perNightPrice: v.perNightPrice, nights: nightsBetween(v.checkInDate, v.checkOutDate), lineTotal: subtotal }] : []);
      detailsTable = `<table style="margin-top:8px">
        <thead><tr><th style="width:28px">#</th><th>Hotel</th><th>Check-in</th><th>Check-out</th>
          <th style="text-align:center">Nights</th><th style="text-align:right">Per-night</th><th style="text-align:right">Line Total</th></tr></thead>
        <tbody>${trips.map((t, i) => `<tr>
            <td>${i + 1}</td><td>${esc(t.hotelName)}</td><td>${fmtDate(t.checkInDate)}</td><td>${fmtDate(t.checkOutDate)}</td>
            <td style="text-align:center">${t.nights ?? nightsBetween(t.checkInDate, t.checkOutDate)}</td>
            <td style="text-align:right">${fmtMoney(t.perNightPrice)}</td>
            <td style="text-align:right">${fmtMoney(t.lineTotal ?? (Math.max(0, nightsBetween(t.checkInDate, t.checkOutDate)) * Number(t.perNightPrice || 0)))}</td></tr>`).join('')}
          <tr><td colspan="6" style="text-align:right;font-weight:700;border-top:2px solid ${accent}">Subtotal</td>
              <td style="text-align:right;font-weight:800;color:${accent};border-top:2px solid ${accent}">${fmtMoney(subtotal)}</td></tr>
        </tbody></table>`;
    } else {
      const trips = Array.isArray(v.trips) && v.trips.length ? v.trips
        : (v.vehicleType ? [{ vehicleType: v.vehicleType, pickupLocation: v.pickupLocation, dropoffLocation: v.dropoffLocation, travelDate: v.travelDate, passengerCount: v.passengerCount, price: v.transportPrice, lineTotal: subtotal }] : []);
      detailsTable = `<table style="margin-top:8px">
        <thead><tr><th style="width:28px">#</th><th>Vehicle</th><th>Route</th><th>Travel Date</th>
          <th style="text-align:center">Pax</th><th style="text-align:right">Price</th></tr></thead>
        <tbody>${trips.map((t, i) => `<tr>
            <td>${i + 1}</td><td>${esc(t.vehicleType)}</td><td>${esc(t.pickupLocation)} → ${esc(t.dropoffLocation)}</td>
            <td>${fmtDate(t.travelDate)}</td><td style="text-align:center">${t.passengerCount || '—'}</td>
            <td style="text-align:right">${fmtMoney(t.price ?? t.lineTotal)}</td></tr>`).join('')}
          <tr><td colspan="5" style="text-align:right;font-weight:700;border-top:2px solid ${accent}">Subtotal</td>
              <td style="text-align:right;font-weight:800;color:${accent};border-top:2px solid ${accent}">${fmtMoney(subtotal)}</td></tr>
        </tbody></table>`;
    }
    const tripCount = Array.isArray(v.trips) ? v.trips.length : 1;

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(v.voucherNo)} — ${v.type} Voucher</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:13px}
  .page{max-width:800px;margin:18px auto;padding:0 18px}
  .no-print{text-align:right;margin-bottom:8px}
  .btn{background:${accent};color:#fff;border:none;padding:9px 22px;border-radius:6px;font-weight:700;cursor:pointer}
  .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:90px;font-weight:900;color:${statusColor};opacity:.07;z-index:0;letter-spacing:8px}
  .strip{background:#0D2B1A;color:#fff;padding:8px 16px;display:flex;justify-content:space-between;align-items:center;border-radius:5px 5px 0 0}
  .strip .t{font-weight:800;letter-spacing:2px;color:#C9A227}
  .hdr{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:1px solid #e2e8f0;border-top:none}
  .brand{font-size:22px;font-weight:800;color:${accent}}
  .badge{padding:5px 16px;border-radius:4px;font-weight:800;letter-spacing:2px;color:#fff;background:${statusColor}}
  h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#fff;background:${statusColor};padding:5px 10px;margin:16px 0 8px;border-radius:3px}
  table{width:100%;border-collapse:collapse}
  th{background:${accent};color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}
  td{padding:6px 10px;border-bottom:1px solid #eef2f6;font-size:12px}
  td.l{color:#64748b;font-weight:600;width:38%}
  td.v{font-weight:600}
  .bottom{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;margin-top:16px}
  .amount{background:linear-gradient(135deg,#0D2B1A,#1B4B35);color:#fff;padding:14px 18px;border-radius:6px}
  .amount .lab{font-size:12px;color:rgba(255,255,255,.8);font-weight:700;margin-bottom:8px}
  .amount .row{display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.85);margin-bottom:4px}
  .amount .row.total{border-top:1px solid rgba(201,162,39,.45);margin-top:6px;padding-top:6px;font-weight:800;color:#C9A227;font-size:16px}
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
    <div style="display:flex;align-items:center;gap:12px">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(brand)}" style="height:56px;max-width:160px;object-fit:contain"/>` : ''}
      <div>
        <div class="brand">${esc(brand)}</div>
        ${addressLine ? `<div style="font-size:10px;color:#64748b;margin-top:2px">${esc(addressLine)}</div>` : ''}
        <div style="font-size:10px;color:#64748b">${tenant?.crNumber ? `CR No. ${esc(tenant.crNumber)}` : ''}${tenant?.crNumber && tenant?.vatNumber ? ' · ' : ''}${tenant?.vatNumber ? `VAT No. ${esc(tenant.vatNumber)}` : ''}</div>
        ${(tenant?.contactPhone || tenant?.contactEmail) ? `<div style="font-size:10px;color:#64748b">${esc(tenant.contactPhone || '')}${tenant?.contactPhone && tenant?.contactEmail ? ' · ' : ''}${esc(tenant.contactEmail || '')}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div class="badge">${v.status}</div>
      <div style="font-size:10px;color:#64748b;margin-top:6px;line-height:1.6">
        Issued: ${fmtDate(v.createdAt)}<br>
        ${isConfirmed ? `Confirmed: ${fmtDate(v.confirmedAt)}<br>HCN #: <strong>${esc(v.hcn)}</strong>` : (isCancelled ? 'This voucher has been cancelled' : 'Status pending confirmation')}
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

  <h3>${v.type === 'HOTEL' ? 'Hotel Details' : 'Transport Details'}${tripCount > 1 ? ` — ${tripCount} Trips` : ''}</h3>
  ${detailsTable}

  <div class="bottom">
    <div class="amount">
      <div class="lab">Amount Summary</div>
      <div class="row"><span>Amount (excl. VAT)</span><span>${fmtMoney(subtotal)}</span></div>
      <div class="row"><span>VAT (${vatPctStr}%)</span><span>${fmtMoney(vatAmount)}</span></div>
      <div class="row total"><span>Total (incl. VAT)</span><span>${fmtMoney(grandTotal)}</span></div>
    </div>
    <div class="qr">
      <div class="qt">ZATCA e-Invoice QR</div>
      <img src="${qrDataUrl}" alt="ZATCA QR" style="width:120px;height:120px"/>
      <div style="font-size:7px;color:#94a3b8;margin-top:4px">VAT No: ${esc(tenant?.vatNumber || '300000000000003')}</div>
    </div>
  </div>

  <div class="terms">
    <strong>Terms &amp; Conditions:</strong> This voucher is subject to availability and the agency's booking policy.
    ${isCancelled
      ? 'This voucher has been <strong>CANCELLED</strong> and is no longer valid.'
      : (isConfirmed
        ? 'All services on this <strong>CONFIRMED</strong> voucher are booked and finalized under HCN # ' + esc(v.hcn) + '.'
        : 'This is a <strong>TENTATIVE</strong> voucher — services are not finalized until confirmed.')}
    <br>Issued by ${esc(brand)}${tenant?.crNumber ? ' · CR No. ' + esc(tenant.crNumber) : ''} · Generated ${fmtDate(new Date())}.
  </div>
</div>
</body></html>`;

    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) { next(err); }
};

module.exports = { nextNumber, list, getOne, create, update, confirm, cancel, remove, printHtml };
