const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');
const QRCode = require('qrcode');

// ── Validation helpers ───────────────────────────────────────────────────────
const ALPHA = /^[A-Za-z؀-ۿ\s.'-]+$/;
const ALPHANUM = /^[A-Za-z0-9]+$/;
const DIGITS_12 = /^\d{12}$/;
const ROOM_TYPES = ['Single', 'Double', 'Triple', 'Quad'];

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
  // Tenant-configurable T&C — now split per document type. Each falls back to the
  // legacy single `voucher_terms` key (for tenants who set it before the split),
  // then to a sensible default. New keys need no migration (free key-value store).
  const clean = (k) => (map[k] && String(map[k]).trim()) || '';
  const legacy = clean('voucher_terms');
  const DEFAULT_VOUCHER = 'This voucher is subject to availability and the agency\'s booking policy.';
  const DEFAULT_INVOICE = 'This invoice is issued in accordance with the agency\'s booking and payment policy.';
  const termsHotel = clean('terms_hotel_voucher') || legacy || DEFAULT_VOUCHER;
  const termsTransport = clean('terms_transport_voucher') || legacy || DEFAULT_VOUCHER;
  const termsInvoice = clean('terms_invoice') || legacy || DEFAULT_INVOICE;
  // `terms` kept for any legacy caller; defaults to the hotel-voucher value.
  return { vatRate, currency, terms: termsHotel, termsHotel, termsTransport, termsInvoice };
}

// ── Atomic, gapless monthly invoice number: SAFPI/SAFAI + YYYY + MM + seq ──────
// INSERT ... ON CONFLICT guarantees no two concurrent issues share a number, and
// the counter only ever increments — it never resets mid-month.
async function nextInvoiceNumber(tenantId, docType) {
  const prefix = docType === 'PROFORMA' ? 'SAFPI' : 'SAFAI';
  const now = new Date();
  const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rows = await prisma.$queryRaw`
    INSERT INTO doc_sequences ("tenantId", "docType", period, "lastSeq", "updatedAt")
    VALUES (${tenantId}, ${docType}, ${period}, 1, NOW())
    ON CONFLICT ("tenantId", "docType", period)
    DO UPDATE SET "lastSeq" = doc_sequences."lastSeq" + 1, "updatedAt" = NOW()
    RETURNING "lastSeq"`;
  const seq = Number(rows[0].lastSeq);
  return `${prefix}${period}${String(seq).padStart(3, '0')}`;
}

// Immutable snapshot of the voucher at the moment the invoice is (re)built.
function invoiceSnapshot(v) {
  return {
    voucherNo: v.voucherNo, type: v.type, status: v.status, hcn: v.hcn || null,
    companyName: v.companyName || null,
    firstName: v.firstName, lastName: v.lastName,
    mobile: v.mobile, whatsapp: v.whatsapp || null, passport: v.passport,
    trips: Array.isArray(v.trips) ? v.trips : null,
    // legacy single-trip fallback fields
    hotelName: v.hotelName, checkInDate: v.checkInDate, checkOutDate: v.checkOutDate, perNightPrice: v.perNightPrice,
    vehicleType: v.vehicleType, pickupLocation: v.pickupLocation, dropoffLocation: v.dropoffLocation,
    travelDate: v.travelDate, passengerCount: v.passengerCount, transportPrice: v.transportPrice,
  };
}

// Create (or, for an existing ACTIVE Proforma, refresh) the invoice for a voucher.
// Idempotent: one ACTIVE invoice per (voucher, docType). Best-effort — a failure
// here must never block voucher create/confirm, so callers wrap in try/catch.
async function upsertInvoice(voucher, docType, userId) {
  const tenantId = voucher.tenantId;
  const fin = await getTenantFinancials(tenantId);
  const rate = voucher.vatRate != null ? Number(voucher.vatRate) : fin.vatRate;
  const subtotal = Number(voucher.totalValue || 0);
  const vatAmount = +(subtotal * rate).toFixed(2);
  const grandTotal = +(subtotal + vatAmount).toFixed(2);
  const snapshot = invoiceSnapshot(voucher);

  const existing = await prisma.voucherInvoice.findFirst({ where: { voucherId: voucher.id, docType, status: 'ACTIVE' } });
  if (existing) {
    await prisma.voucherInvoice.updateMany({
      where: { id: existing.id },
      data: { subtotal, vatRate: rate, vatAmount, grandTotal, currency: fin.currency, snapshot, updatedAt: new Date() },
    });
    return existing.id;
  }
  const number = await nextInvoiceNumber(tenantId, docType);
  const inv = await prisma.voucherInvoice.create({
    data: { tenantId, voucherId: voucher.id, docType, number, subtotal, vatRate: rate, vatAmount, grandTotal, currency: fin.currency, snapshot, createdById: userId || null },
  });
  return inv.id;
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
      const rooms = Math.max(1, parseInt(t.rooms, 10) || 1);
      const roomType = ROOM_TYPES.includes(t.roomType) ? t.roomType : null;
      const passengerCount = (t.passengerCount === undefined || t.passengerCount === null || t.passengerCount === '')
        ? null : Math.max(0, parseInt(t.passengerCount, 10) || 0);
      return {
        hotelId: t.hotelId || null, hotelName: String(t.hotelName || '').trim(),
        checkInDate: t.checkInDate, checkOutDate: t.checkOutDate,
        roomType, passengerCount,
        perNightPrice: price, rooms, nights, lineTotal: rooms * nights * price,
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
      if (t.rooms !== undefined && t.rooms !== '' && (isNaN(Number(t.rooms)) || Number(t.rooms) < 1)) errors.push(`Trip ${n}: number of rooms must be at least 1`);
      if (t.roomType && !ROOM_TYPES.includes(t.roomType)) errors.push(`Trip ${n}: room type must be one of ${ROOM_TYPES.join(', ')}`);
      if (t.passengerCount !== undefined && t.passengerCount !== '' && (isNaN(Number(t.passengerCount)) || Number(t.passengerCount) < 1)) errors.push(`Trip ${n}: number of passengers must be at least 1`);
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
    // Auto-generate the Proforma invoice for the tentative voucher (best-effort).
    let proformaInvoiceId = null;
    try { proformaInvoiceId = await upsertInvoice(voucher, 'PROFORMA', req.user.id); }
    catch (e) { console.error('[voucher] proforma generation failed:', e.message); }
    res.status(201).json({ ...voucher, proformaInvoiceId });
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
    // Keep the Proforma invoice in sync with the edited (still-tentative) voucher.
    try { await upsertInvoice(updated, 'PROFORMA', req.user.id); }
    catch (e) { console.error('[voucher] proforma refresh failed:', e.message); }
    res.json(updated);
  } catch (err) { next(err); }
};

// ── Confirm — Tentative → Confirmed (one-way; not from Cancelled) ─────────────
const confirm = async (req, res, next) => {
  try {
    // HCN # is OPTIONAL. When supplied it must be alphanumeric; confirmation is
    // what finalizes the voucher and unlocks payment — not the HCN.
    const rawHcn = req.body.hcn != null ? String(req.body.hcn).trim() : '';
    if (rawHcn && !ALPHANUM.test(rawHcn)) {
      return res.status(400).json({ error: 'HCN # must be alphanumeric' });
    }
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    if (v.status === 'CONFIRMED') return res.status(409).json({ error: 'Voucher is already confirmed' });
    if (v.status === 'CANCELLED') return res.status(409).json({ error: 'A cancelled voucher cannot be confirmed' });
    await prisma.formVoucher.updateMany({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED', hcn: rawHcn || null, confirmedAt: new Date(), confirmedById: req.user.id, modifiedById: req.user.id, updatedAt: new Date() },
    });
    const confirmed = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    // Issue the Actual (tax) invoice on confirmation (best-effort).
    let actualInvoiceId = null;
    try { actualInvoiceId = await upsertInvoice(confirmed, 'ACTUAL', req.user.id); }
    catch (e) { console.error('[voucher] actual invoice generation failed:', e.message); }
    res.json({ ...confirmed, actualInvoiceId });
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
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    // A confirmed voucher is a finalized, invoiced record — it cannot be deleted.
    if (v.status === 'CONFIRMED') {
      return res.status(409).json({ error: 'Confirmed vouchers cannot be deleted. Cancel it instead.' });
    }
    // Invoices cascade-delete via FK ON DELETE CASCADE.
    await prisma.formVoucher.deleteMany({ where: { id: req.params.id } });
    res.json({ message: 'Voucher deleted' });
  } catch (err) { next(err); }
};

// ── Record a payment on a (confirmed) direct voucher — audited, write-once ─────
const recordPayment = async (req, res, next) => {
  try {
    const { method, reference } = req.body;
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    if (v.status !== 'CONFIRMED') return res.status(409).json({ error: 'Only confirmed vouchers can receive payment' });
    if (v.paymentStatus === 'PAID') return res.status(409).json({ error: 'This voucher is already marked paid' });
    if (!method || !String(method).trim()) return res.status(400).json({ error: 'Payment method is required' });

    await prisma.formVoucher.updateMany({
      where: { id: req.params.id },
      data: { paymentStatus: 'PAID', paidAt: new Date(), paymentMethod: String(method).trim(), paymentRef: reference ? String(reference).trim() : null, updatedAt: new Date() },
    });
    // Immutable audit trail of the payment-status change.
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: v.tenantId, userId: req.user.id,
          action: 'voucher.payment_recorded', entityType: 'form_voucher', entityId: v.id,
          payload: JSON.stringify({ voucherNo: v.voucherNo, amount: Number(v.totalValue || 0), method: String(method).trim(), reference: reference || null }),
          ipAddress: req.ip, userAgent: req.headers['user-agent'] || null,
        },
      });
    } catch { /* audit best-effort */ }
    res.json(await prisma.formVoucher.findFirst({ where: { id: req.params.id } }));
  } catch (err) { next(err); }
};

// ── Invoices for a voucher ────────────────────────────────────────────────────
const listInvoices = async (req, res, next) => {
  try {
    const invoices = await prisma.voucherInvoice.findMany({
      where: { voucherId: req.params.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, docType: true, number: true, status: true, grandTotal: true, currency: true, createdAt: true, cancelledAt: true },
    });
    res.json(invoices);
  } catch (err) { next(err); }
};

const cancelInvoice = async (req, res, next) => {
  try {
    const inv = await prisma.voucherInvoice.findFirst({ where: { id: req.params.invoiceId } });
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'CANCELLED') return res.status(409).json({ error: 'Invoice is already cancelled' });
    await prisma.voucherInvoice.updateMany({ where: { id: inv.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), updatedAt: new Date() } });
    res.json({ message: 'Invoice cancelled' });
  } catch (err) { next(err); }
};

const deleteInvoice = async (req, res, next) => {
  try {
    const result = await prisma.voucherInvoice.deleteMany({ where: { id: req.params.invoiceId } });
    if (result.count === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) { next(err); }
};

// ── Shared print helpers ──────────────────────────────────────────────────────
const fmtDateLong = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
const moneyFmt = (currency) => (n) => `${currency} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

async function loadTenantBrand(tenantId) {
  const tenant = tenantId
    ? await prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true, vatNumber: true, crNumber: true, address: true, city: true, country: true, logoUrl: true, contactPhone: true, contactEmail: true } }).catch(() => null)
    : null;
  const brand = tenant?.name || 'Safre Manasik';
  const rawLogo = tenant?.logoUrl || '';
  const logoUrl = rawLogo ? (/^https?:\/\//i.test(rawLogo) ? rawLogo : `https://app.safremanasik.com${rawLogo.startsWith('/') ? '' : '/'}${rawLogo}`) : '';
  const addressLine = [tenant?.address, tenant?.city, tenant?.country].filter(Boolean).join(', ');
  return { tenant, brand, logoUrl, addressLine };
}

function brandHeaderInner({ brand, logoUrl, addressLine, tenant, accent }) {
  return `<div style="display:flex;align-items:center;gap:12px">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(brand)}" style="height:56px;max-width:160px;object-fit:contain"/>` : ''}
      <div>
        <div class="brand" style="font-size:22px;font-weight:800;color:${accent}">${esc(brand)}</div>
        ${addressLine ? `<div style="font-size:10px;color:#64748b;margin-top:2px">${esc(addressLine)}</div>` : ''}
        <div style="font-size:10px;color:#64748b">${tenant?.crNumber ? `CR No. ${esc(tenant.crNumber)}` : ''}${tenant?.crNumber && tenant?.vatNumber ? ' · ' : ''}${tenant?.vatNumber ? `VAT No. ${esc(tenant.vatNumber)}` : ''}</div>
        ${(tenant?.contactPhone || tenant?.contactEmail) ? `<div style="font-size:10px;color:#64748b">${esc(tenant.contactPhone || '')}${tenant?.contactPhone && tenant?.contactEmail ? ' · ' : ''}${esc(tenant.contactEmail || '')}</div>` : ''}
      </div>
    </div>`;
}

// Customer + service-details tables. showPrices=false omits all monetary columns
// (used on the voucher, which must NOT reveal pricing).
function partyAndServiceTables(v, { accent, currency, showPrices }) {
  const fmtMoney = moneyFmt(currency);
  const subtotal = Number(v.totalValue || 0);
  let detailsTable;
  if (v.type === 'HOTEL') {
    const trips = Array.isArray(v.trips) && v.trips.length ? v.trips
      : (v.hotelName ? [{ hotelName: v.hotelName, checkInDate: v.checkInDate, checkOutDate: v.checkOutDate, perNightPrice: v.perNightPrice, nights: nightsBetween(v.checkInDate, v.checkOutDate), lineTotal: subtotal }] : []);
    detailsTable = `<table style="margin-top:8px">
      <thead><tr><th style="width:28px">#</th><th>Hotel</th><th>Check-in</th><th>Check-out</th><th style="text-align:center">Rooms</th><th style="text-align:center">Room Type</th><th style="text-align:center">Pax</th><th style="text-align:center">Nights</th>
        ${showPrices ? '<th style="text-align:right">Per-night</th><th style="text-align:right">Line Total</th>' : ''}</tr></thead>
      <tbody>${trips.map((t, i) => `<tr>
          <td>${i + 1}</td><td>${esc(t.hotelName)}</td><td>${fmtDateLong(t.checkInDate)}</td><td>${fmtDateLong(t.checkOutDate)}</td>
          <td style="text-align:center">${t.rooms ?? 1}</td>
          <td style="text-align:center">${esc(t.roomType || '—')}</td>
          <td style="text-align:center">${t.passengerCount ?? '—'}</td>
          <td style="text-align:center">${t.nights ?? nightsBetween(t.checkInDate, t.checkOutDate)}</td>
          ${showPrices ? `<td style="text-align:right">${fmtMoney(t.perNightPrice)}</td><td style="text-align:right">${fmtMoney(t.lineTotal ?? ((t.rooms ?? 1) * Math.max(0, nightsBetween(t.checkInDate, t.checkOutDate)) * Number(t.perNightPrice || 0)))}</td>` : ''}</tr>`).join('')}
        ${showPrices ? `<tr><td colspan="9" style="text-align:right;font-weight:700;border-top:2px solid ${accent}">Subtotal</td>
            <td style="text-align:right;font-weight:800;color:${accent};border-top:2px solid ${accent}">${fmtMoney(subtotal)}</td></tr>` : ''}
      </tbody></table>`;
  } else {
    const trips = Array.isArray(v.trips) && v.trips.length ? v.trips
      : (v.vehicleType ? [{ vehicleType: v.vehicleType, pickupLocation: v.pickupLocation, dropoffLocation: v.dropoffLocation, travelDate: v.travelDate, passengerCount: v.passengerCount, price: v.transportPrice, lineTotal: subtotal }] : []);
    detailsTable = `<table style="margin-top:8px">
      <thead><tr><th style="width:28px">#</th><th>Vehicle</th><th>Route</th><th>Travel Date</th><th style="text-align:center">Pax</th>
        ${showPrices ? '<th style="text-align:right">Price</th>' : ''}</tr></thead>
      <tbody>${trips.map((t, i) => `<tr>
          <td>${i + 1}</td><td>${esc(t.vehicleType)}</td><td>${esc(t.pickupLocation)} → ${esc(t.dropoffLocation)}</td>
          <td>${fmtDateLong(t.travelDate)}</td><td style="text-align:center">${t.passengerCount || '—'}</td>
          ${showPrices ? `<td style="text-align:right">${fmtMoney(t.price ?? t.lineTotal)}</td>` : ''}</tr>`).join('')}
        ${showPrices ? `<tr><td colspan="5" style="text-align:right;font-weight:700;border-top:2px solid ${accent}">Subtotal</td>
            <td style="text-align:right;font-weight:800;color:${accent};border-top:2px solid ${accent}">${fmtMoney(subtotal)}</td></tr>` : ''}
      </tbody></table>`;
  }
  const customerTable = `<table>
    ${v.companyName ? `<tr><td class="l">Company</td><td class="v">${esc(v.companyName)}</td></tr>` : ''}
    <tr><td class="l">Name</td><td class="v">${esc(v.firstName)} ${esc(v.lastName)}</td></tr>
    <tr><td class="l">Mobile</td><td class="v">${esc(v.mobile)}</td></tr>
    ${v.whatsapp ? `<tr><td class="l">WhatsApp</td><td class="v">${esc(v.whatsapp)}</td></tr>` : ''}
    <tr><td class="l">Passport #</td><td class="v">${esc(v.passport)}</td></tr>
  </table>`;
  return { customerTable, detailsTable };
}

function baseCss(accent, statusColor) {
  return `*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:13px}
  .page{max-width:800px;margin:18px auto;padding:0 18px}
  .no-print{text-align:right;margin-bottom:8px}
  .btn{background:${accent};color:#fff;border:none;padding:9px 22px;border-radius:6px;font-weight:700;cursor:pointer}
  .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:90px;font-weight:900;color:${statusColor};opacity:.07;z-index:0;letter-spacing:8px}
  .strip{background:#0D2B1A;color:#fff;padding:8px 16px;display:flex;justify-content:space-between;align-items:center;border-radius:5px 5px 0 0}
  .strip .t{font-weight:800;letter-spacing:2px;color:#C9A227}
  .hdr{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:1px solid #e2e8f0;border-top:none}
  .badge{padding:5px 16px;border-radius:4px;font-weight:800;letter-spacing:2px;color:#fff;background:${statusColor}}
  h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#fff;background:${statusColor};padding:5px 10px;margin:16px 0 8px;border-radius:3px}
  table{width:100%;border-collapse:collapse}
  th{background:${accent};color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}
  td{padding:6px 10px;border-bottom:1px solid #eef2f6;font-size:12px}
  td.l{color:#64748b;font-weight:600;width:38%}
  td.v{font-weight:600}
  .pill{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:800;font-size:11px;letter-spacing:1px}
  .bottom{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;margin-top:16px}
  .amount{background:linear-gradient(135deg,#0D2B1A,#1B4B35);color:#fff;padding:14px 18px;border-radius:6px}
  .amount .lab{font-size:12px;color:rgba(255,255,255,.8);font-weight:700;margin-bottom:8px}
  .amount .row{display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.85);margin-bottom:4px}
  .amount .row.total{border-top:1px solid rgba(201,162,39,.45);margin-top:6px;padding-top:6px;font-weight:800;color:#C9A227;font-size:16px}
  .qr{text-align:center;border:1.5px solid #e2e8f0;border-radius:6px;padding:8px;background:#fafafa;min-width:140px}
  .qr .qt{font-size:8px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .terms{margin-top:16px;font-size:10px;color:#94a3b8;padding:8px 10px;background:#f8fafc;border-radius:4px;border-left:3px solid ${statusColor};line-height:1.5}
  @media print{.no-print{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}`;
}

// ── Printable HTML voucher — service confirmation, NO pricing, shows payment ──
const printHtml = async (req, res, next) => {
  try {
    const v = await prisma.formVoucher.findFirst({ where: { id: req.params.id } });
    if (!v) return res.status(404).send('<h1>Voucher not found</h1>');

    const { tenant, brand, logoUrl, addressLine } = await loadTenantBrand(req.user.tenantId);
    const fin = await getTenantFinancials(v.tenantId);
    const currency = fin.currency;
    const accent = '#1B4B35';
    const isConfirmed = v.status === 'CONFIRMED';
    const isCancelled = v.status === 'CANCELLED';
    const statusColor = isCancelled ? '#9CA3AF' : (isConfirmed ? '#1B4B35' : '#B8860B');
    const isPaid = v.paymentStatus === 'PAID';
    const payColor = isPaid ? '#1B4B35' : '#B91C1C';

    const { customerTable, detailsTable } = partyAndServiceTables(v, { accent, currency, showPrices: false });
    const tripCount = Array.isArray(v.trips) ? v.trips.length : 1;

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(v.voucherNo)} — ${v.type} Voucher</title>
<style>${baseCss(accent, statusColor)}</style></head>
<body>
<div class="watermark">${v.status}</div>
<div class="page">
  <div class="no-print"><button class="btn" onclick="window.print()">🖨️ Print Voucher</button></div>
  <div class="strip">
    <span class="t">${v.type === 'HOTEL' ? 'HOTEL VOUCHER' : 'TRANSPORT VOUCHER'}</span>
    <span>Voucher No: <strong style="color:#C9A227">${esc(v.voucherNo)}</strong></span>
  </div>
  <div class="hdr">
    ${brandHeaderInner({ brand, logoUrl, addressLine, tenant, accent })}
    <div style="text-align:right">
      <div class="badge">${v.status}</div>
      <div style="margin-top:6px"><span class="pill" style="background:${payColor};color:#fff">${isPaid ? 'PAID' : 'UNPAID'}</span></div>
      <div style="font-size:10px;color:#64748b;margin-top:6px;line-height:1.6">
        Issued: ${fmtDateLong(v.createdAt)}<br>
        ${isConfirmed ? `Confirmed: ${fmtDateLong(v.confirmedAt)}${v.hcn ? `<br>HCN #: <strong>${esc(v.hcn)}</strong>` : ''}` : (isCancelled ? 'This voucher has been cancelled' : 'Status pending confirmation')}
      </div>
    </div>
  </div>

  <h3>Customer</h3>
  ${customerTable}

  <h3>${v.type === 'HOTEL' ? 'Hotel Details' : 'Transport Details'}${tripCount > 1 ? ` — ${tripCount} Trips` : ''}</h3>
  ${detailsTable}

  <h3>Payment</h3>
  <table>
    <tr><td class="l">Payment Status</td><td class="v" style="color:${payColor};font-weight:800">${isPaid ? 'PAID' : 'UNPAID'}</td></tr>
    ${isPaid ? `<tr><td class="l">Paid On</td><td class="v">${fmtDateLong(v.paidAt)}</td></tr>
    ${v.paymentMethod ? `<tr><td class="l">Method</td><td class="v">${esc(v.paymentMethod)}</td></tr>` : ''}
    ${v.paymentRef ? `<tr><td class="l">Reference</td><td class="v">${esc(v.paymentRef)}</td></tr>` : ''}` : ''}
  </table>

  <div class="terms">
    <strong>Terms &amp; Conditions:</strong> ${esc(v.type === 'HOTEL' ? fin.termsHotel : fin.termsTransport)}
    <br>${isCancelled
      ? 'This voucher has been <strong>CANCELLED</strong> and is no longer valid.'
      : (isConfirmed
        ? 'All services on this <strong>CONFIRMED</strong> voucher are booked and finalized' + (v.hcn ? ' under HCN # ' + esc(v.hcn) : '') + '.'
        : 'This is a <strong>TENTATIVE</strong> voucher — services are not finalized until confirmed.')}
    <br>Pricing is provided separately on the corresponding invoice. Issued by ${esc(brand)}${tenant?.crNumber ? ' · CR No. ' + esc(tenant.crNumber) : ''} · Generated ${fmtDateLong(new Date())}.
  </div>
</div>
</body></html>`;
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) { next(err); }
};

// ── Printable invoice (Proforma or Actual) — priced, ZATCA QR, branded ────────
const invoicePrintHtml = async (req, res, next) => {
  try {
    const docType = String(req.params.docType || '').toUpperCase() === 'ACTUAL' ? 'ACTUAL' : 'PROFORMA';
    const inv = await prisma.voucherInvoice.findFirst({ where: { voucherId: req.params.id, docType, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
    if (!inv) return res.status(404).send(`<h1>${docType === 'ACTUAL' ? 'Actual' : 'Proforma'} invoice not found</h1><p>It is generated automatically when the voucher is ${docType === 'ACTUAL' ? 'confirmed' : 'created'}.</p>`);
    const v = await prisma.formVoucher.findFirst({ where: { id: inv.voucherId } });
    if (!v) return res.status(404).send('<h1>Voucher not found</h1>');

    const { tenant, brand, logoUrl, addressLine } = await loadTenantBrand(req.user.tenantId);
    const fin = await getTenantFinancials(v.tenantId);
    const currency = inv.currency || fin.currency;
    const fmtMoney = moneyFmt(currency);
    const accent = '#1B4B35';
    const isProforma = docType === 'PROFORMA';
    const docTitle = isProforma ? 'PROFORMA INVOICE' : 'TAX INVOICE';
    const statusColor = isProforma ? '#B8860B' : '#1B4B35';

    const subtotal = Number(inv.subtotal || 0);
    const vatAmount = Number(inv.vatAmount || 0);
    const grandTotal = Number(inv.grandTotal || 0);
    const rate = inv.vatRate != null ? Number(inv.vatRate) : fin.vatRate;
    const vatPctNum = rate * 100;
    const vatPctStr = Number.isInteger(vatPctNum) ? String(vatPctNum) : vatPctNum.toFixed(2);
    const isPaid = v.paymentStatus === 'PAID';

    const qrDataUrl = await zatcaQrDataUrl({ sellerName: brand, vatNumber: tenant?.vatNumber, totalWithVat: grandTotal, vatAmount });
    const { customerTable, detailsTable } = partyAndServiceTables(v, { accent, currency, showPrices: true });
    const tripCount = Array.isArray(v.trips) ? v.trips.length : 1;

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(inv.number)} — ${docTitle}</title>
<style>${baseCss(accent, statusColor)}</style></head>
<body>
<div class="watermark">${isProforma ? 'PROFORMA' : 'INVOICE'}</div>
<div class="page">
  <div class="no-print"><button class="btn" onclick="window.print()">🖨️ Print Invoice</button></div>
  <div class="strip">
    <span class="t">${docTitle}</span>
    <span>Invoice No: <strong style="color:#C9A227">${esc(inv.number)}</strong></span>
  </div>
  <div class="hdr">
    ${brandHeaderInner({ brand, logoUrl, addressLine, tenant, accent })}
    <div style="text-align:right">
      <div class="badge">${isProforma ? 'PROFORMA' : 'TAX INVOICE'}</div>
      <div style="margin-top:6px"><span class="pill" style="background:${isPaid ? '#1B4B35' : '#B91C1C'};color:#fff">${isPaid ? 'PAID' : 'UNPAID'}</span></div>
      <div style="font-size:10px;color:#64748b;margin-top:6px;line-height:1.6">
        Invoice Date: ${fmtDateLong(inv.createdAt)}<br>
        Ref Voucher: <strong>${esc(v.voucherNo)}</strong>${v.hcn ? `<br>HCN #: <strong>${esc(v.hcn)}</strong>` : ''}
      </div>
    </div>
  </div>

  <h3>Bill To</h3>
  ${customerTable}

  <h3>${v.type === 'HOTEL' ? 'Hotel Services' : 'Transport Services'}${tripCount > 1 ? ` — ${tripCount} Trips` : ''}</h3>
  ${detailsTable}

  <div class="bottom">
    <div class="amount">
      <div class="lab">Invoice Summary</div>
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
    <strong>Terms &amp; Conditions:</strong> ${esc(fin.termsInvoice)}
    <br>${isProforma
      ? 'This is a <strong>PROFORMA INVOICE</strong> for a tentative booking and is not a valid tax invoice for payment claims.'
      : 'This is the <strong>TAX INVOICE</strong> for a confirmed booking.'}
    Issued by ${esc(brand)}${tenant?.crNumber ? ' · CR No. ' + esc(tenant.crNumber) : ''} · Generated ${fmtDateLong(new Date())}.
  </div>
</div>
</body></html>`;
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) { next(err); }
};

module.exports = {
  nextNumber, list, getOne, create, update, confirm, cancel, remove, printHtml,
  recordPayment, listInvoices, invoicePrintHtml, cancelInvoice, deleteInvoice,
};
