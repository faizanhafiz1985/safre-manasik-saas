const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// ── ZATCA Phase-1 QR (TLV base64) ──────────────────────────────────────────
const encodeTlvField = (tag, value) => {
  const valueBytes = Buffer.from(String(value), 'utf8');
  return Buffer.concat([
    Buffer.from([tag]),
    Buffer.from([valueBytes.length]),
    valueBytes,
  ]);
};

const buildZatcaQrData = (booking, vatAmount) => {
  const sellerName   = 'Safre Manasik Travel Agency';
  const vatRegNumber = '300000000000003';            // replace with real VAT No.
  const timestamp    = new Date().toISOString();
  const totalWithVat = Number(booking.totalAmount || 0).toFixed(2);
  const vat          = Number(vatAmount || 0).toFixed(2);

  return Buffer.concat([
    encodeTlvField(1, sellerName),
    encodeTlvField(2, vatRegNumber),
    encodeTlvField(3, timestamp),
    encodeTlvField(4, totalWithVat),
    encodeTlvField(5, vat),
  ]).toString('base64');
};

const generateZatcaQrDataUrl = async (booking) => {
  const vatRate = 0.15;                              // 15% KSA VAT
  const base    = Number(booking.totalAmount || 0);
  const vat     = +(base * vatRate).toFixed(2);
  const tlvB64  = buildZatcaQrData(booking, vat);
  return QRCode.toDataURL(tlvB64, { errorCorrectionLevel: 'M', margin: 1, width: 120 });
};

// ── Logo: try real PNG from public folder, else fall back to SVG ────────────
let LOGO_HTML;
try {
  const logoPngPath = path.join(__dirname, '../../../frontend/public/logo.png');
  const b64 = fs.readFileSync(logoPngPath).toString('base64');
  LOGO_HTML = `<img src="data:image/png;base64,${b64}" alt="Safr e Manasik" style="height:90px;display:block;" />`;
} catch {
  LOGO_HTML = null; // SVG fallback assigned below
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" width="260" height="100">
  <defs>
    <linearGradient id="gG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#D4A017"/>
      <stop offset="100%" style="stop-color:#C9A227"/>
    </linearGradient>
    <linearGradient id="aG" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#C9A227"/>
      <stop offset="100%" style="stop-color:#9B7A1A"/>
    </linearGradient>
  </defs>
  <!-- Arch frame -->
  <path d="M15,185 L15,95 Q15,20 85,20 Q155,20 155,95 L155,185 Z" fill="none" stroke="url(#aG)" stroke-width="6"/>
  <path d="M25,185 L25,98 Q25,32 85,32 Q145,32 145,98 L145,185 Z" fill="none" stroke="url(#aG)" stroke-width="2.5" opacity="0.5"/>
  <!-- Finial + crescent -->
  <polygon points="85,8 90,22 80,22" fill="url(#gG)"/>
  <circle cx="85" cy="7" r="4" fill="url(#gG)"/>
  <path d="M92,12 Q100,5 100,16 Q93,13 92,12Z" fill="url(#gG)" opacity="0.9"/>
  <!-- Kaaba -->
  <rect x="60" y="100" width="50" height="52" rx="2" fill="#1B4B35"/>
  <rect x="78" y="118" width="14" height="20" rx="1" fill="#C9A227" opacity="0.8"/>
  <rect x="60" y="108" width="50" height="8" fill="#C9A227" opacity="0.4"/>
  <rect x="60" y="100" width="50" height="4" rx="1" fill="#0D2B1A"/>
  <!-- Minarets -->
  <rect x="22" y="70" width="10" height="85" rx="2" fill="#1B4B35"/>
  <polygon points="22,70 32,70 27,52" fill="#1B4B35"/>
  <circle cx="27" cy="51" r="4" fill="#C9A227"/>
  <rect x="138" y="70" width="10" height="85" rx="2" fill="#1B4B35"/>
  <polygon points="138,70 148,70 143,52" fill="#1B4B35"/>
  <circle cx="143" cy="51" r="4" fill="#C9A227"/>
  <!-- Road -->
  <path d="M45,185 Q55,165 65,155 Q75,145 80,130" fill="none" stroke="#C9A227" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
  <path d="M125,185 Q115,165 105,155 Q95,145 90,130" fill="none" stroke="#C9A227" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
  <!-- Palm -->
  <line x1="40" y1="152" x2="40" y2="132" stroke="#1B4B35" stroke-width="2.5"/>
  <path d="M40,133 Q33,125 28,127 Q34,132 35,135Z" fill="#1B4B35"/>
  <path d="M40,133 Q47,122 52,125 Q45,130 43,133Z" fill="#1B4B35"/>
  <!-- Mountains -->
  <polygon points="30,158 50,135 70,158" fill="#1B4B35" opacity="0.3"/>
  <polygon points="90,158 115,138 140,158" fill="#1B4B35" opacity="0.3"/>
  <!-- Text -->
  <text x="180" y="82" font-family="Georgia,serif" font-size="54" font-weight="700" fill="#1B4B35" letter-spacing="-1">Safr</text>
  <text x="180" y="122" font-family="Georgia,serif" font-size="30" font-style="italic" fill="#C9A227" letter-spacing="2">e</text>
  <text x="206" y="122" font-family="Georgia,serif" font-size="46" font-weight="700" fill="#1B4B35" letter-spacing="-0.5">Manasik</text>
  <line x1="180" y1="133" x2="510" y2="133" stroke="#C9A227" stroke-width="1.5" opacity="0.6"/>
  <polygon points="345,129 349,133 345,137 341,133" fill="#C9A227"/>
  <text x="345" y="150" font-family="Arial,sans-serif" font-size="10.5" font-weight="700" fill="#1B4B35" text-anchor="middle" letter-spacing="1.5">UMRAH  •  HAJJ  •  TRAVEL  •  ZIARAAT  •  TOURS</text>
  <text x="345" y="167" font-family="Georgia,serif" font-size="10" font-style="italic" fill="#C9A227" text-anchor="middle" letter-spacing="0.5">Your Journey, Our Responsibility</text>
  <text x="345" y="182" font-family="Arial,sans-serif" font-size="8.5" fill="#5A7A65" text-anchor="middle">( Registered in KSA )   |   CR No. 7053347410</text>
</svg>`;

if (!LOGO_HTML) LOGO_HTML = LOGO_SVG;

// ── Main voucher HTML generator ─────────────────────────────────────────────
const getVoucherHtml = async (booking, type, voucherNo) => {
  const isConfirmed  = type === 'CONFIRMED';
  const statusColor  = isConfirmed ? '#1B4B35' : '#B8860B';
  const statusBg     = isConfirmed ? '#1B4B35' : '#C9A227';
  const statusText   = isConfirmed ? 'CONFIRMED' : 'TENTATIVE';
  const docTitle     = isConfirmed ? 'CONFIRMED VOUCHER' : 'TENTATIVE VOUCHER';
  const voucherRef   = voucherNo || booking.bookingRef;

  const vatRate  = 0.15;
  const base     = Number(booking.totalAmount || 0);
  const vatAmt   = +(base * vatRate).toFixed(2);
  const total    = +(base + vatAmt).toFixed(2);

  const qrDataUrl = await generateZatcaQrDataUrl(booking);

  const formatDate     = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
  const formatCurrency = (n) => `SAR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const passengers   = booking.passengers || [];
  const makkahHotel  = booking.package?.packageHotels?.find((ph) => ph.city === 'MAKKAH')?.hotel;
  const madinahHotel = booking.package?.packageHotels?.find((ph) => ph.city === 'MADINAH')?.hotel;
  const transport    = booking.transports?.[0];
  const catering     = booking.caterings?.[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${docTitle} - ${voucherRef}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; background:#fff; font-size:12.5px; }
  .page { width:210mm; min-height:297mm; margin:0 auto; padding:12mm 16mm; position:relative; }

  /* Watermark */
  .watermark {
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-45deg);
    font-size:90px; font-weight:900; color:${statusColor};
    opacity:0.05; pointer-events:none; white-space:nowrap; z-index:0; letter-spacing:8px;
  }
  .content { position:relative; z-index:1; }

  /* Header strip */
  .header-strip {
    background:#0D2B1A; color:#fff; padding:7px 14px;
    display:flex; justify-content:space-between; align-items:center;
    border-radius:4px 4px 0 0;
  }
  .header-strip .doc-type { font-size:13px; font-weight:800; letter-spacing:3px; color:#C9A227; }
  .header-strip .voucher-no { font-size:10px; color:rgba(255,255,255,0.85); }

  /* Logo row */
  .header-main {
    display:flex; justify-content:space-between; align-items:center;
    padding:10px 14px; border:1px solid #e2e8f0; border-top:none; margin-bottom:16px;
  }
  .status-badge {
    padding:5px 16px; border-radius:4px; font-size:12px; font-weight:800;
    background:${statusBg}; color:#fff; letter-spacing:2px;
  }
  .issued-info { font-size:10px; color:#64748b; text-align:right; margin-top:5px; line-height:1.6; }

  /* Sections */
  h3 {
    font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px;
    color:#fff; background:${statusColor}; padding:4px 10px; margin-bottom:7px; border-radius:3px;
  }
  .section { margin-bottom:14px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
  .info-row { display:flex; margin-bottom:4px; }
  .info-label { font-weight:600; color:#475569; min-width:120px; font-size:11px; }
  .info-value { color:#1e293b; font-size:11px; }

  /* Table */
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:${statusColor}; color:#fff; padding:6px 8px; text-align:left; font-weight:700; font-size:10px; text-transform:uppercase; }
  td { padding:5px 8px; border-bottom:1px solid #e2e8f0; }
  tr:nth-child(even) td { background:#f8fafc; }

  /* Amount + ZATCA block */
  .bottom-section { display:grid; grid-template-columns:1fr auto; gap:16px; align-items:start; margin-bottom:16px; }
  .amount-box {
    background:linear-gradient(135deg,#0D2B1A 0%,#1B4B35 100%);
    color:#fff; padding:12px 16px; border-radius:6px;
  }
  .amount-box .label { font-size:12px; font-weight:600; }
  .amount-box .sub   { font-size:10px; color:rgba(255,255,255,0.7); margin-top:2px; }
  .amount-box .value { font-size:20px; font-weight:800; color:#C9A227; margin-top:4px; }
  .amount-rows { margin-top:8px; border-top:1px solid rgba(255,255,255,0.2); padding-top:8px; }
  .amount-row { display:flex; justify-content:space-between; font-size:10px; color:rgba(255,255,255,0.8); margin-bottom:2px; }
  .amount-row.total { font-weight:800; font-size:11px; color:#C9A227; border-top:1px solid rgba(201,162,39,0.4); padding-top:4px; margin-top:4px; }

  .zatca-box {
    text-align:center; border:1.5px solid #e2e8f0; border-radius:6px;
    padding:8px 10px; background:#fafafa; min-width:140px;
  }
  .zatca-box .zatca-title { font-size:8px; font-weight:700; color:#1B4B35; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
  .zatca-box .zatca-sub   { font-size:7px; color:#94a3b8; margin-top:4px; }

  /* Footer */
  .footer { margin-top:14px; padding-top:10px; border-top:2px solid #C9A227; display:flex; justify-content:space-between; align-items:flex-end; }
  .footer-note { font-size:9.5px; color:#64748b; line-height:1.7; }
  .sig-line { width:150px; border-top:1px solid #94a3b8; padding-top:4px; font-size:10px; color:#64748b; text-align:center; }
  .terms { font-size:9px; color:#94a3b8; margin-top:10px; padding:7px 10px; background:#f8fafc; border-radius:4px; border-left:3px solid ${statusColor}; line-height:1.5; }

  @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="watermark">${statusText}</div>
  <div class="content">

    <!-- Header strip -->
    <div class="header-strip">
      <span class="doc-type">${docTitle}</span>
      <span class="voucher-no">Voucher No: <strong style="color:#C9A227;">${voucherRef}</strong></span>
    </div>

    <!-- Logo + status -->
    <div class="header-main">
      <div>${LOGO_HTML}</div>
      <div style="text-align:right;">
        <div class="status-badge">${statusText}</div>
        <div class="issued-info">
          Booking Ref: <strong>${booking.bookingRef}</strong><br>
          Issued: ${formatDate(new Date())}<br>
          Travel: ${formatDate(booking.travelDateFrom)} — ${formatDate(booking.travelDateTo)}
        </div>
      </div>
    </div>

    <!-- Customer + Travel -->
    <div class="grid-2">
      <div class="section">
        <h3>Customer Information</h3>
        <div class="info-row"><span class="info-label">Full Name:</span><span class="info-value">${booking.customer?.name || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${booking.customer?.email || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${booking.customer?.phone || 'N/A'}</span></div>
        ${booking.agent ? `<div class="info-row"><span class="info-label">Agent:</span><span class="info-value">${booking.agent.companyName || booking.agent.name}</span></div>` : ''}
      </div>
      <div class="section">
        <h3>Travel Details</h3>
        <div class="info-row"><span class="info-label">Package:</span><span class="info-value">${booking.package?.name || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Duration:</span><span class="info-value">${booking.package?.durationDays || '-'} Days</span></div>
        <div class="info-row"><span class="info-label">Departure:</span><span class="info-value">${formatDate(booking.travelDateFrom)}</span></div>
        <div class="info-row"><span class="info-label">Return:</span><span class="info-value">${formatDate(booking.travelDateTo)}</span></div>
        <div class="info-row"><span class="info-label">Total Pax:</span><span class="info-value">${booking.totalPax}</span></div>
      </div>
    </div>

    <!-- Hotels -->
    <div class="grid-2">
      <div class="section">
        <h3>Hotel in Makkah</h3>
        ${makkahHotel ? `
          <div class="info-row"><span class="info-label">Hotel:</span><span class="info-value">${makkahHotel.name}</span></div>
          <div class="info-row"><span class="info-label">Rating:</span><span class="info-value">${'★'.repeat(makkahHotel.stars)}</span></div>
          <div class="info-row"><span class="info-label">Address:</span><span class="info-value">${makkahHotel.address || 'Makkah, Saudi Arabia'}</span></div>
        ` : '<div style="color:#94a3b8;font-size:11px;padding:4px 0;">No hotel assigned</div>'}
      </div>
      <div class="section">
        <h3>Hotel in Madinah</h3>
        ${madinahHotel ? `
          <div class="info-row"><span class="info-label">Hotel:</span><span class="info-value">${madinahHotel.name}</span></div>
          <div class="info-row"><span class="info-label">Rating:</span><span class="info-value">${'★'.repeat(madinahHotel.stars)}</span></div>
          <div class="info-row"><span class="info-label">Address:</span><span class="info-value">${madinahHotel.address || 'Madinah, Saudi Arabia'}</span></div>
        ` : '<div style="color:#94a3b8;font-size:11px;padding:4px 0;">No hotel assigned</div>'}
      </div>
    </div>

    <!-- Transport + Catering -->
    <div class="grid-2">
      <div class="section">
        <h3>Transportation</h3>
        ${transport ? `
          <div class="info-row"><span class="info-label">Vehicle:</span><span class="info-value">${transport.vehicle?.name}</span></div>
          <div class="info-row"><span class="info-label">Type:</span><span class="info-value">${transport.vehicle?.type}</span></div>
          <div class="info-row"><span class="info-label">Route:</span><span class="info-value">${transport.route ? `${transport.route.fromLocation} → ${transport.route.toLocation}` : 'As per itinerary'}</span></div>
          <div class="info-row"><span class="info-label">Driver:</span><span class="info-value">${transport.vehicle?.driverName}</span></div>
        ` : `<div class="info-row"><span class="info-label">Included:</span><span class="info-value">${booking.package?.transportIncluded ? 'Yes – as per itinerary' : 'Not included'}</span></div>`}
      </div>
      <div class="section">
        <h3>Catering</h3>
        ${catering ? `
          <div class="info-row"><span class="info-label">Vendor:</span><span class="info-value">${catering.mealPlan?.vendor?.name}</span></div>
          <div class="info-row"><span class="info-label">Meal Plan:</span><span class="info-value">${catering.mealPlan?.name}</span></div>
          <div class="info-row"><span class="info-label">Type:</span><span class="info-value">${catering.mealPlan?.mealType}</span></div>
        ` : `<div class="info-row"><span class="info-label">Included:</span><span class="info-value">${booking.package?.cateringIncluded ? 'Yes – as per package' : 'Not included'}</span></div>`}
      </div>
    </div>

    <!-- Passengers -->
    ${passengers.length > 0 ? `
    <div class="section">
      <h3>Passenger Details</h3>
      <table>
        <thead>
          <tr><th>#</th><th>Full Name</th><th>Passport No</th><th>Nationality</th><th>Date of Birth</th><th>Gender</th></tr>
        </thead>
        <tbody>
          ${passengers.map((p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${p.fullName}${p.isPrimary ? ' <span style="background:#C9A227;color:#fff;font-size:8px;padding:1px 4px;border-radius:2px;vertical-align:middle;">LEAD</span>' : ''}</td>
              <td>${p.passportNo}</td>
              <td>${p.nationality}</td>
              <td>${formatDate(p.dateOfBirth)}</td>
              <td>${p.gender}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Amount + ZATCA QR -->
    <div class="bottom-section">
      <div class="amount-box">
        <div class="label">Package Amount Summary</div>
        <div class="sub">${booking.package?.name || ''} — ${booking.totalPax} pax</div>
        <div class="amount-rows">
          <div class="amount-row"><span>Base Amount:</span><span>${formatCurrency(base)}</span></div>
          <div class="amount-row"><span>VAT (15%):</span><span>${formatCurrency(vatAmt)}</span></div>
          <div class="amount-row total"><span>Total incl. VAT:</span><span>${formatCurrency(total)}</span></div>
        </div>
      </div>
      <div class="zatca-box">
        <div class="zatca-title">ZATCA e-Invoice QR</div>
        <img src="${qrDataUrl}" alt="ZATCA QR Code" style="width:110px;height:110px;" />
        <div class="zatca-sub">Scan to verify invoice<br>VAT No: 300000000000003</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>
        <div class="footer-note"><strong>Safre Manasik Travel Agency</strong> — CR No. 7053347410</div>
        <div class="footer-note">Tel: +966-11-000-0000 | Email: info@safremanasik.com</div>
        <div class="footer-note">VAT Registration No: 300000000000003 | Registered in KSA</div>
        <div class="footer-note">Generated: ${formatDate(new Date())}</div>
      </div>
      <div class="sig-line">Authorized Signature</div>
    </div>

    <div class="terms">
      <strong>Terms &amp; Conditions:</strong> This voucher is subject to availability. Services are as per the package.
      Cancellation charges apply per policy.
      ${isConfirmed
        ? 'All services on this <strong>CONFIRMED VOUCHER</strong> are booked and finalized.'
        : 'This is a <strong>TENTATIVE VOUCHER</strong> — confirmation and full payment are still pending.'}
    </div>

  </div>
</div>
</body>
</html>`;
};

// ── Receipt Voucher ─────────────────────────────────────────────────────────
const getReceiptHtml = async (payment, booking, receiptNo) => {
  const formatDate     = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
  const formatCurrency = (n) => `SAR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const invoice   = booking?.invoice;
  const paidAt    = payment.paidAt ? new Date(payment.paidAt) : new Date();
  const methodLabel = { CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', CREDIT_CARD: 'Credit Card', CHEQUE: 'Cheque' };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Payment Receipt - ${receiptNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; background:#fff; font-size:12.5px; }
  .page { width:210mm; min-height:297mm; margin:0 auto; padding:12mm 16mm; position:relative; }
  .watermark {
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-45deg);
    font-size:90px; font-weight:900; color:#1B4B35;
    opacity:0.04; pointer-events:none; white-space:nowrap; z-index:0; letter-spacing:8px;
  }
  .content { position:relative; z-index:1; }
  .header-strip {
    background:#0D2B1A; color:#fff; padding:7px 14px;
    display:flex; justify-content:space-between; align-items:center;
    border-radius:4px 4px 0 0;
  }
  .header-strip .doc-type { font-size:13px; font-weight:800; letter-spacing:3px; color:#C9A227; }
  .header-strip .rec-no   { font-size:10px; color:rgba(255,255,255,0.85); }
  .header-main {
    display:flex; justify-content:space-between; align-items:center;
    padding:10px 14px; border:1px solid #e2e8f0; border-top:none; margin-bottom:16px;
  }
  .status-badge {
    padding:5px 16px; border-radius:4px; font-size:12px; font-weight:800;
    background:#1B4B35; color:#fff; letter-spacing:2px;
  }
  .issued-info { font-size:10px; color:#64748b; text-align:right; margin-top:5px; line-height:1.6; }
  h3 {
    font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px;
    color:#fff; background:#1B4B35; padding:4px 10px; margin-bottom:7px; border-radius:3px;
  }
  .section { margin-bottom:14px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
  .info-row { display:flex; margin-bottom:4px; }
  .info-label { font-weight:600; color:#475569; min-width:130px; font-size:11px; }
  .info-value { color:#1e293b; font-size:11px; }
  .amount-box {
    background:linear-gradient(135deg,#0D2B1A 0%,#1B4B35 100%);
    color:#fff; padding:14px 18px; border-radius:6px; margin-bottom:14px;
  }
  .amount-box .label  { font-size:11px; font-weight:600; color:rgba(255,255,255,0.8); }
  .amount-box .value  { font-size:26px; font-weight:800; color:#C9A227; margin:4px 0; }
  .amount-box .method { font-size:11px; color:rgba(255,255,255,0.7); }
  .summary-table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:14px; }
  .summary-table td { padding:6px 10px; border-bottom:1px solid #e2e8f0; }
  .summary-table tr:nth-child(even) td { background:#f8fafc; }
  .summary-table .total-row td { font-weight:700; border-top:2px solid #C9A227; color:#1B4B35; }
  .paid-row td { color:#0e9f6e; font-weight:700; }
  .balance-row td { font-weight:700; color:#dc2626; }
  .balance-clear td { font-weight:700; color:#0e9f6e; }
  .stamp {
    display:inline-block; border:3px solid #1B4B35; border-radius:50%;
    width:90px; height:90px; text-align:center; line-height:1.2;
    padding-top:18px; font-size:9px; font-weight:800; color:#1B4B35;
    letter-spacing:0.5px; opacity:0.6; transform:rotate(-15deg);
  }
  .footer { margin-top:14px; padding-top:10px; border-top:2px solid #C9A227; display:flex; justify-content:space-between; align-items:flex-end; }
  .footer-note { font-size:9.5px; color:#64748b; line-height:1.7; }
  .sig-line { width:150px; border-top:1px solid #94a3b8; padding-top:4px; font-size:10px; color:#64748b; text-align:center; }
  .terms { font-size:9px; color:#94a3b8; margin-top:10px; padding:7px 10px; background:#f8fafc; border-radius:4px; border-left:3px solid #1B4B35; line-height:1.5; }
  @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="watermark">PAID</div>
  <div class="content">

    <div class="header-strip">
      <span class="doc-type">PAYMENT RECEIPT</span>
      <span class="rec-no">Receipt No: <strong style="color:#C9A227;">${receiptNo}</strong></span>
    </div>

    <div class="header-main">
      <div>${LOGO_HTML}</div>
      <div style="text-align:right;">
        <div class="status-badge">PAID</div>
        <div class="issued-info">
          Booking Ref: <strong>${booking.bookingRef}</strong><br>
          Payment Date: ${formatDate(paidAt)}<br>
          Invoice No: <strong>${invoice?.invoiceNo || 'N/A'}</strong>
        </div>
      </div>
    </div>

    <!-- Payment Amount Box -->
    <div class="amount-box">
      <div class="label">AMOUNT RECEIVED</div>
      <div class="value">${formatCurrency(payment.amount)}</div>
      <div class="method">Method: ${methodLabel[payment.method] || payment.method}${payment.reference ? ' | Ref: ' + payment.reference : ''}</div>
    </div>

    <div class="grid-2">
      <div class="section">
        <h3>Customer Information</h3>
        <div class="info-row"><span class="info-label">Full Name:</span><span class="info-value">${booking.customer?.name || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${booking.customer?.email || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${booking.customer?.phone || 'N/A'}</span></div>
        ${booking.agent ? `<div class="info-row"><span class="info-label">Agent:</span><span class="info-value">${booking.agent.companyName || booking.agent.name}</span></div>` : ''}
      </div>
      <div class="section">
        <h3>Booking Details</h3>
        <div class="info-row"><span class="info-label">Package:</span><span class="info-value">${booking.package?.name || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Duration:</span><span class="info-value">${booking.package?.durationDays || '-'} Days</span></div>
        <div class="info-row"><span class="info-label">Departure:</span><span class="info-value">${formatDate(booking.travelDateFrom)}</span></div>
        <div class="info-row"><span class="info-label">Return:</span><span class="info-value">${formatDate(booking.travelDateTo)}</span></div>
        <div class="info-row"><span class="info-label">Total Pax:</span><span class="info-value">${booking.totalPax}</span></div>
      </div>
    </div>

    <!-- Invoice Summary -->
    <div class="section">
      <h3>Invoice Summary</h3>
      <table class="summary-table">
        <tr><td style="color:#475569;font-weight:600;">Total Package Amount</td><td style="text-align:right;">${formatCurrency(invoice?.totalAmount ?? booking.totalAmount)}</td></tr>
        <tr class="paid-row"><td>Previous Payments</td><td style="text-align:right;">${formatCurrency(Number(invoice?.paidAmount ?? 0) - Number(payment.amount))}</td></tr>
        <tr class="paid-row"><td>This Payment</td><td style="text-align:right;">${formatCurrency(payment.amount)}</td></tr>
        <tr class="total-row"><td>Total Paid</td><td style="text-align:right;">${formatCurrency(invoice?.paidAmount ?? payment.amount)}</td></tr>
        <tr class="${Number(invoice?.balance ?? 0) <= 0 ? 'balance-clear' : 'balance-row'}"><td>Remaining Balance</td><td style="text-align:right;">${formatCurrency(invoice?.balance ?? 0)}</td></tr>
      </table>
    </div>

    ${payment.notes ? `<div class="section"><h3>Notes</h3><p style="font-size:11px;color:#475569;padding:6px 0;">${payment.notes}</p></div>` : ''}

    <div class="footer">
      <div>
        <div class="footer-note"><strong>Safre Manasik Travel Agency</strong> — CR No. 7053347410</div>
        <div class="footer-note">Tel: +966-11-000-0000 | Email: info@safremanasik.com</div>
        <div class="footer-note">VAT Registration No: 300000000000003 | Registered in KSA</div>
        <div class="footer-note">Generated: ${formatDate(new Date())}</div>
      </div>
      <div style="display:flex;gap:20px;align-items:center;">
        <div class="stamp">SAFRE<br>MANASIK<br>PAID<br>${paidAt.getFullYear()}</div>
        <div class="sig-line">Authorized Signature</div>
      </div>
    </div>

    <div class="terms">
      <strong>Payment Confirmation:</strong> This receipt confirms that the above payment has been received.
      Please retain this receipt for your records. For queries contact info@safremanasik.com.
    </div>

  </div>
</div>
</body>
</html>`;
};

module.exports = { getVoucherHtml, getReceiptHtml };
