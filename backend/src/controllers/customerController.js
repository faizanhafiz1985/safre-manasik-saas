const prisma = require('../config/database');

// ── Validation helpers ───────────────────────────────────────────────────────
const ALPHA = /^[A-Za-z؀-ۿ\s.'-]+$/;          // letters (incl. Arabic), spaces, . ' -
const DIGITS_12 = /^\d{12}$/;
const DIGITS_10 = /^\d{10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALPHANUM = /^[A-Za-z0-9؀-ۿ\s.\-_&]+$/;
const GENDERS = ['Male', 'Female'];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Validate a person sub-object (used for both the main customer and passengers).
// `requirePhones` toggles the 12-digit mobile/whatsapp requirement (mandatory on
// the main customer, optional-but-format-checked on child passengers).
function validatePerson(p, label, requirePhones, errors) {
  if (!p.firstName || !ALPHA.test(String(p.firstName).trim())) errors.push(`${label}: First name is required (letters only)`);
  if (!p.lastName || !ALPHA.test(String(p.lastName).trim())) errors.push(`${label}: Last name is required (letters only)`);

  const mobile = (p.mobile || '').replace(/\s/g, '');
  const wa = (p.whatsapp || '').replace(/\s/g, '');
  if (requirePhones) {
    if (!DIGITS_12.test(mobile)) errors.push(`${label}: Mobile # must be exactly 12 digits`);
    if (!DIGITS_12.test(wa)) errors.push(`${label}: WhatsApp # must be exactly 12 digits`);
  } else {
    if (mobile && !DIGITS_12.test(mobile)) errors.push(`${label}: Mobile # must be exactly 12 digits`);
    if (wa && !DIGITS_12.test(wa)) errors.push(`${label}: WhatsApp # must be exactly 12 digits`);
  }

  if (p.email && !EMAIL.test(String(p.email).trim())) errors.push(`${label}: Invalid email format`);
  if (p.gender && !GENDERS.includes(p.gender)) errors.push(`${label}: Gender must be Male or Female`);
}

function validateCustomer(body) {
  const errors = [];
  const type = body.type === 'B2B' ? 'B2B' : 'B2C';

  validatePerson(body, 'Customer', true, errors);

  if (type === 'B2B') {
    if (!body.companyName || !ALPHANUM.test(String(body.companyName).trim())) errors.push('Company Name is required (letters and numbers)');
    if (!DIGITS_10.test((body.crNumber || '').replace(/\s/g, ''))) errors.push('CR # must be exactly 10 digits');
    if (!body.nationalAddress || !String(body.nationalAddress).trim()) errors.push('National Address is required');

    const passengers = Array.isArray(body.passengers) ? body.passengers : [];
    passengers.forEach((p, i) => validatePerson(p, `Passenger ${i + 1}`, false, errors));
  }

  return { type, errors };
}

// Strip a person object down to the persisted fields.
function personData(p, tenantId) {
  return {
    tenantId,
    firstName: String(p.firstName).trim(),
    lastName: String(p.lastName).trim(),
    mobile: p.mobile ? String(p.mobile).replace(/\s/g, '') : null,
    whatsapp: p.whatsapp ? String(p.whatsapp).replace(/\s/g, '') : null,
    passport: p.passport ? String(p.passport).trim() : null,
    email: p.email ? String(p.email).trim() : null,
    gender: GENDERS.includes(p.gender) ? p.gender : null,
  };
}

const customerInclude = { passengers: { orderBy: { createdAt: 'asc' } } };

// ── Handlers ─────────────────────────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { search, type, page = 1, limit = 15 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      ...(type && { type }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { mobile: { contains: search } },
          { companyName: { contains: search, mode: 'insensitive' } },
          { crNumber: { contains: search } },
        ],
      }),
    };
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where, skip, take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { passengers: true } } },
      }),
      prisma.customer.count({ where }),
    ]);
    res.json({ data: customers, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({ where: { id: req.params.id }, include: customerInclude });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { type, errors } = validateCustomer(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join('; '), fields: errors });

    const base = personData(req.body, tenantId);
    const data = {
      tenantId,
      type,
      ...base,
      // mobile/whatsapp are mandatory on the main customer
      mobile: (req.body.mobile || '').replace(/\s/g, ''),
      whatsapp: (req.body.whatsapp || '').replace(/\s/g, ''),
      companyName: type === 'B2B' ? String(req.body.companyName).trim() : null,
      crNumber: type === 'B2B' ? (req.body.crNumber || '').replace(/\s/g, '') : null,
      nationalAddress: type === 'B2B' ? String(req.body.nationalAddress).trim() : null,
    };

    // Nested passenger creates need tenantId set explicitly — the tenant
    // middleware only injects tenantId on the top-level create, not nested rows.
    if (type === 'B2B' && Array.isArray(req.body.passengers) && req.body.passengers.length) {
      data.passengers = { create: req.body.passengers.map((p) => personData(p, tenantId)) };
    }

    const customer = await prisma.customer.create({ data, include: customerInclude });
    res.status(201).json(customer);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const { type, errors } = validateCustomer(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join('; '), fields: errors });

    const base = personData(req.body, tenantId);
    // updateMany (the middleware downgrades update -> updateMany) cannot do nested
    // relation writes, so we update scalars here and replace passengers separately.
    await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        type,
        firstName: base.firstName,
        lastName: base.lastName,
        mobile: (req.body.mobile || '').replace(/\s/g, ''),
        whatsapp: (req.body.whatsapp || '').replace(/\s/g, ''),
        passport: base.passport,
        email: base.email,
        gender: base.gender,
        companyName: type === 'B2B' ? String(req.body.companyName).trim() : null,
        crNumber: type === 'B2B' ? (req.body.crNumber || '').replace(/\s/g, '') : null,
        nationalAddress: type === 'B2B' ? String(req.body.nationalAddress).trim() : null,
        updatedAt: new Date(),
      },
    });

    // Replace passengers: remove all then recreate (B2C ends up with none).
    await prisma.customerPassenger.deleteMany({ where: { customerId: req.params.id } });
    if (type === 'B2B' && Array.isArray(req.body.passengers) && req.body.passengers.length) {
      await prisma.customerPassenger.createMany({
        data: req.body.passengers.map((p) => ({ ...personData(p, tenantId), customerId: req.params.id })),
      });
    }

    const customer = await prisma.customer.findFirst({ where: { id: req.params.id }, include: customerInclude });
    res.json(customer);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const result = await prisma.customer.deleteMany({ where: { id: req.params.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) { next(err); }
};

// ── Voucher (printable HTML) ──────────────────────────────────────────────────
const voucherHtml = async (req, res, next) => {
  try {
    const c = await prisma.customer.findFirst({ where: { id: req.params.id }, include: customerInclude });
    if (!c) return res.status(404).send('<h1>Customer not found</h1>');

    const tenant = req.user.tenantId
      ? await prisma.tenant.findFirst({ where: { id: req.user.tenantId }, select: { name: true, primaryColor: true } }).catch(() => null)
      : null;
    const brand = tenant?.name || 'Safre Manasik';
    const accent = tenant?.primaryColor || '#1B4B35';
    const voucherNo = `CUST-${c.id.slice(0, 8).toUpperCase()}`;
    const fullName = `${esc(c.firstName)} ${esc(c.lastName)}`;
    const isB2B = c.type === 'B2B';

    const passengerRows = (c.passengers || []).map((p, i) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${i + 1}</td>
        <td style="padding:8px;border:1px solid #ddd">${esc(p.firstName)}</td>
        <td style="padding:8px;border:1px solid #ddd">${esc(p.lastName)}</td>
        <td style="padding:8px;border:1px solid #ddd">${esc(p.passport || '—')}</td>
        <td style="padding:8px;border:1px solid #ddd">${esc(p.mobile || '—')}</td>
      </tr>`).join('');

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(voucherNo)} — Voucher</title>
<style>
  @media print { .no-print { display:none } body { margin:0 } }
  body { font-family: Arial, Helvetica, sans-serif; color:#222; max-width:800px; margin:20px auto; padding:0 16px }
  .hdr { background:${accent}; color:#fff; padding:20px 24px; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center }
  .hdr h1 { margin:0; font-size:22px; color:#C9A227 }
  .body { border:1px solid #e5e5e5; border-top:none; border-radius:0 0 8px 8px; padding:24px }
  .company { font-size:24px; font-weight:800; color:${accent}; margin:0 0 4px }
  .row { display:flex; flex-wrap:wrap; gap:12px 32px; margin:12px 0 }
  .field { min-width:180px } .label { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:.5px }
  .value { font-size:15px; font-weight:600 }
  table { width:100%; border-collapse:collapse; margin-top:12px }
  th { background:${accent}; color:#fff; padding:8px; border:1px solid #ddd; font-size:13px; text-align:left }
  .badge { display:inline-block; background:#C9A227; color:#fff; padding:4px 12px; border-radius:12px; font-size:12px; font-weight:700 }
  .btn { background:${accent}; color:#fff; border:none; padding:10px 24px; border-radius:6px; font-weight:700; cursor:pointer; font-size:14px }
</style></head>
<body>
  <div class="no-print" style="text-align:right;margin-bottom:8px">
    <button class="btn" onclick="window.print()">🖨️ Print Voucher</button>
  </div>
  <div class="hdr">
    <h1>${esc(brand)}</h1>
    <div style="text-align:right">
      <div style="font-size:12px;opacity:.85">VOUCHER NO.</div>
      <div style="font-size:16px;font-weight:700">${esc(voucherNo)}</div>
    </div>
  </div>
  <div class="body">
    <span class="badge">${isB2B ? 'CORPORATE (B2B)' : 'INDIVIDUAL (B2C)'}</span>
    ${isB2B ? `<p class="company" style="margin-top:12px">${esc(c.companyName)}</p>
      <div class="row">
        <div class="field"><div class="label">CR Number</div><div class="value">${esc(c.crNumber || '—')}</div></div>
        <div class="field"><div class="label">National Address</div><div class="value">${esc(c.nationalAddress || '—')}</div></div>
      </div>
      <div class="row">
        <div class="field"><div class="label">Primary Contact</div><div class="value">${fullName}</div></div>
        <div class="field"><div class="label">Mobile</div><div class="value">${esc(c.mobile)}</div></div>
        <div class="field"><div class="label">WhatsApp</div><div class="value">${esc(c.whatsapp)}</div></div>
        ${c.email ? `<div class="field"><div class="label">Email</div><div class="value">${esc(c.email)}</div></div>` : ''}
      </div>
      <h3 style="margin:20px 0 4px;color:${accent}">Associated Passengers (${(c.passengers || []).length})</h3>
      ${(c.passengers || []).length ? `<table>
        <thead><tr><th style="width:40px">#</th><th>First Name</th><th>Last Name</th><th>Passport #</th><th>Mobile #</th></tr></thead>
        <tbody>${passengerRows}</tbody>
      </table>` : '<p style="color:#888">No passengers added.</p>'}
      `
      : `<div class="row" style="margin-top:16px">
        <div class="field"><div class="label">Customer Name</div><div class="value">${fullName}</div></div>
        <div class="field"><div class="label">Gender</div><div class="value">${esc(c.gender || '—')}</div></div>
      </div>
      <div class="row">
        <div class="field"><div class="label">Mobile</div><div class="value">${esc(c.mobile)}</div></div>
        <div class="field"><div class="label">WhatsApp</div><div class="value">${esc(c.whatsapp)}</div></div>
      </div>
      <div class="row">
        <div class="field"><div class="label">Passport #</div><div class="value">${esc(c.passport || '—')}</div></div>
        ${c.email ? `<div class="field"><div class="label">Email</div><div class="value">${esc(c.email)}</div></div>` : ''}
      </div>`}
    <p style="margin-top:24px;color:#888;font-size:12px;border-top:1px solid #eee;padding-top:12px">
      Issued by ${esc(brand)} · ${new Date().toLocaleDateString()} · This voucher is valid for the named customer${isB2B ? ' and listed passengers' : ''}.
    </p>
  </div>
</body></html>`;

    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, voucherHtml };
