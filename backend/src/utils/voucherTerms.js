const prisma = require('../config/database');
const { runWithTenant } = require('../config/tenantContext');

const DEFAULT_VOUCHER = 'This voucher is subject to availability and the agency\'s booking policy.';
const DEFAULT_INVOICE = 'This invoice is issued in accordance with the agency\'s booking and payment policy.';

// Tenant-configurable Terms & Conditions, split per document type. Each falls
// back to the legacy single `voucher_terms` key (for tenants who set it before
// the split), then to a sensible default. Read with SUPER_ADMIN scope so the
// tenant middleware doesn't mangle the query.
async function getVoucherTerms(tenantId) {
  const rows = await new Promise((resolve) => {
    runWithTenant({ isSuperAdmin: true }, async () => {
      try { resolve(await prisma.systemConfig.findMany({ where: { tenantId } })); }
      catch { resolve([]); }
    });
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const clean = (k) => (map[k] && String(map[k]).trim()) || '';
  const legacy = clean('voucher_terms');
  return {
    termsHotel: clean('terms_hotel_voucher') || legacy || DEFAULT_VOUCHER,
    termsTransport: clean('terms_transport_voucher') || legacy || DEFAULT_VOUCHER,
    termsInvoice: clean('terms_invoice') || legacy || DEFAULT_INVOICE,
  };
}

module.exports = { getVoucherTerms, DEFAULT_VOUCHER, DEFAULT_INVOICE };
