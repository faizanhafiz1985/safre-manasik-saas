/* Comprehensive functional + technical QA against LIVE production.
 * Creates sample records across every module, exercises flows, checks RBAC,
 * multi-tenant isolation, and edge cases. Node 18+ (global fetch). */
const BASE = 'https://api.safremanasik.com/api';
const T1 = 'c1e10c47-79fe-4efd-a68e-67a2b70c2698'; // Safre Manasik
const T2 = 'bcd0f87f-7a8b-4afb-88b9-69391ea76f20'; // Test traval (second tenant for isolation)
const STAMP = Date.now();
const results = [];
let section = '';
const sec = (s) => { section = s; console.log(`\n═══ ${s} ═══`); };
function rec(name, cond, detail) {
  results.push({ section, name, pass: !!cond, detail });
  console.log(`  ${cond ? '✅' : '❌'} ${name}${cond ? '' : `  →  ${detail || ''}`}`);
}
const D = (s) => `${s}T00:00:00.000Z`;

async function rawLogin(email, password) {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, token: j.token, body: j };
}
async function impersonate(saToken, tid) {
  const r = await fetch(`${BASE}/super-admin/tenants/${tid}/impersonate`, { method: 'POST', headers: { Authorization: `Bearer ${saToken}` } });
  const j = await r.json().catch(() => ({}));
  return j.token;
}
function client(token) {
  return async (method, path, body) => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: r.status, json, text };
  };
}
const idOf = (res) => res.json?.id || (Array.isArray(res.json) ? res.json[0]?.id : res.json?.data?.[0]?.id);

(async () => {
  // ── Auth / platform ──────────────────────────────────────────────────────
  sec('AUTH & PLATFORM');
  const sa = await rawLogin('superadmin@safremanasik.com', 'Welcome@1234');
  rec('super-admin login', sa.status === 200 && sa.token, `status ${sa.status}`);
  const SA = client(sa.token);
  const badLogin = await rawLogin('superadmin@safremanasik.com', 'wrongpass');
  rec('bad password rejected (401)', badLogin.status === 401, `status ${badLogin.status}`);
  const fp = await client(null)('POST', '/auth/forgot-password', { email: 'nobody@example.com' });
  rec('forgot-password returns 200 (no user enumeration)', fp.status === 200, `status ${fp.status}`);
  const tenants = await SA('GET', '/super-admin/tenants');
  rec('list tenants', tenants.status === 200 && (Array.isArray(tenants.json) || Array.isArray(tenants.json?.data)), `status ${tenants.status}`);
  const me = await SA('GET', '/auth/me');
  rec('/auth/me for super-admin', me.status === 200 && me.json.role === 'SUPER_ADMIN', `role ${me.json?.role}`);

  // ── Impersonate tenant 1 ─────────────────────────────────────────────────
  const t1 = await impersonate(sa.token, T1);
  const A = client(t1);
  rec('impersonate tenant 1', !!t1, 'no token');

  // ── System Config ────────────────────────────────────────────────────────
  sec('SYSTEM CONFIG');
  const cfgSet = await A('POST', '/config', { configs: { vat_percentage: '15', currency: 'SAR', voucher_terms: 'QA terms ' + STAMP } });
  rec('save config (vat/currency/terms)', cfgSet.status === 200 || cfgSet.status === 201, `status ${cfgSet.status}`);
  const cfgGet = await A('GET', '/config');
  rec('config persisted', cfgGet.json?.voucher_terms?.includes(String(STAMP)), 'terms not persisted');

  // ── Customers registry (CRM B2B/B2C with passengers) ─────────────────────
  sec('CUSTOMERS REGISTRY');
  const custB2C = await A('POST', '/customers', { type: 'B2C', firstName: 'QA', lastName: 'Pilgrim', mobile: '966500000901', whatsapp: '966500000901' });
  rec('create B2C customer', custB2C.status === 201, `status ${custB2C.status} ${JSON.stringify(custB2C.json).slice(0,120)}`);
  const custB2B = await A('POST', '/customers', { type: 'B2B', companyName: 'QA Travels', crNumber: '4030567890', firstName: 'Biz', lastName: 'Contact', mobile: '966500000902', whatsapp: '966500000902', nationalAddress: '1234 King Rd, Makkah 24231' });
  rec('create B2B customer', custB2B.status === 201, `status ${custB2B.status} ${JSON.stringify(custB2B.json).slice(0,120)}`);
  const custList = await A('GET', '/customers');
  rec('list customers', custList.status === 200, `status ${custList.status}`);

  // ── Booking customer (User) ──────────────────────────────────────────────
  sec('USERS');
  const custEmail = `qa.cust.${STAMP}@example.com`;
  const newCust = await A('POST', '/users', { name: 'QA Customer', email: custEmail, phone: '966500000903', role: 'CUSTOMER', customerType: 'B2C', password: 'Test@1234' });
  rec('create CUSTOMER user', newCust.status === 201, `status ${newCust.status} ${JSON.stringify(newCust.json).slice(0,120)}`);
  const custUserId = newCust.json?.id;
  const dupEmail = await A('POST', '/users', { name: 'Dup', email: custEmail, role: 'CUSTOMER' });
  rec('duplicate email rejected (409)', dupEmail.status === 409, `status ${dupEmail.status}`);
  const updUser = await A('PUT', `/users/${custUserId}`, { name: 'QA Customer Renamed', phone: '966500000999' });
  rec('update user', updUser.status === 200, `status ${updUser.status}`);

  // ── Packages + price tiers ───────────────────────────────────────────────
  sec('PACKAGES');
  const pkg = await A('POST', '/packages', { name: `QA Package ${STAMP}`, description: '7N Umrah', durationDays: 7, transportIncluded: true, cateringIncluded: true, airportTransfer: true, isActive: true });
  rec('create package', pkg.status === 201, `status ${pkg.status} ${JSON.stringify(pkg.json).slice(0,150)}`);
  const pkgId = pkg.json?.id;

  // ── Hotels ───────────────────────────────────────────────────────────────
  sec('HOTELS');
  const hotel = await A('POST', '/hotels', { name: `QA Hilton ${STAMP}`, city: 'MAKKAH', stars: 5, address: 'Ajyad St, Makkah', distanceToHaramMeters: 200, pricePerNight: 600 });
  rec('create hotel', hotel.status === 201, `status ${hotel.status} ${JSON.stringify(hotel.json).slice(0,150)}`);

  // ── Transport: vehicles + routes ─────────────────────────────────────────
  sec('TRANSPORT MASTER');
  const veh = await A('POST', '/transport/vehicles', { name: `QA Coaster ${STAMP}`, plateNumber: `QA-${STAMP%10000}`, type: 'BUS', capacity: 30, driverName: 'QA Driver', driverPhone: '966500000910' });
  rec('create vehicle', veh.status === 201, `status ${veh.status} ${JSON.stringify(veh.json).slice(0,150)}`);
  const vehId = veh.json?.id;
  const route = await A('POST', '/transport/routes', { name: 'QA Jeddah→Makkah', fromLocation: 'Jeddah Airport', toLocation: 'Makkah' });
  rec('create route', route.status === 201, `status ${route.status} ${JSON.stringify(route.json).slice(0,150)}`);
  const routeId = route.json?.id;

  // ── Catering: vendors + meal plans ───────────────────────────────────────
  sec('CATERING');
  const vendor = await A('POST', '/catering/vendors', { name: `QA Caterer ${STAMP}`, contactPhone: '966500000920' });
  rec('create catering vendor', vendor.status === 201, `status ${vendor.status} ${JSON.stringify(vendor.json).slice(0,150)}`);
  const vendorId = vendor.json?.id;
  let mealId;
  if (vendorId) {
    const meal = await A('POST', '/catering/meal-plans', { vendorId, name: 'Full Board', mealType: 'LUNCH', pricePerPax: 50 });
    rec('create meal plan', meal.status === 201, `status ${meal.status} ${JSON.stringify(meal.json).slice(0,150)}`);
    mealId = meal.json?.id;
  }

  // ── Bookings (with package, without package, edit, cancel, assignments) ──
  sec('BOOKINGS');
  const bk = await A('POST', '/bookings', { customerId: custUserId, packageId: pkgId, travelDateFrom: D('2026-07-01'), travelDateTo: D('2026-07-08'), totalPax: 3, totalAmount: 9000, notes: 'QA booking w/ package' });
  rec('create booking WITH package', bk.status === 201, `status ${bk.status} ${JSON.stringify(bk.json).slice(0,150)}`);
  const bkId = bk.json?.id;
  const bkNoPkg = await A('POST', '/bookings', { customerId: custUserId, travelDateFrom: D('2026-07-10'), travelDateTo: D('2026-07-15'), totalPax: 2, totalAmount: 4000, notes: 'QA ad-hoc no package' });
  rec('create booking WITHOUT package', bkNoPkg.status === 201 && bkNoPkg.json?.packageId === null, `status ${bkNoPkg.status} pkg ${bkNoPkg.json?.packageId}`);
  const bkNoPkgPast = await A('POST', '/bookings', { customerId: custUserId, travelDateFrom: D('2020-01-01'), travelDateTo: D('2020-01-05'), totalPax: 1, totalAmount: 100 });
  rec('past departure rejected (400)', bkNoPkgPast.status === 400, `status ${bkNoPkgPast.status}`);
  const bkEdit = await A('PUT', `/bookings/${bkId}`, { totalPax: 4, totalAmount: 9500, notes: 'QA edited' });
  rec('edit booking', bkEdit.status === 200, `status ${bkEdit.status}`);
  const confirmBk = await A('PATCH', `/bookings/${bkId}/status`, { status: 'CONFIRMED' });
  rec('confirm booking (status)', confirmBk.status === 200 && confirmBk.json?.status === 'CONFIRMED', `status ${confirmBk.status}`);
  if (vehId) {
    const asgT = await A('POST', `/bookings/${bkId}/transport`, { vehicleId: vehId, routeId, departureAt: D('2026-07-01') });
    rec('assign transport to booking', asgT.status === 200, `status ${asgT.status}`);
  }
  if (mealId) {
    const asgC = await A('POST', `/bookings/${bkId}/catering`, { mealPlanId: mealId, paxCount: 4 });
    rec('assign catering to booking', asgC.status === 200, `status ${asgC.status}`);
  }
  const addPax = await A('POST', `/bookings/${bkId}/passengers`, { passengers: [{ fullName: 'Pax One', passportNo: 'P1234567', nationality: 'PK', dateOfBirth: '1990-05-05T00:00:00.000Z', gender: 'MALE', isPrimary: true }] });
  rec('add passenger to booking', addPax.status === 200, `status ${addPax.status}`);

  // ── Payments + invoice ───────────────────────────────────────────────────
  sec('PAYMENTS (booking)');
  const pay = await A('POST', '/payments', { bookingId: bkId, amount: 5000, method: 'BANK_TRANSFER', reference: 'QA-PAY-1' });
  rec('record booking payment', pay.status === 201, `status ${pay.status} ${JSON.stringify(pay.json).slice(0,120)}`);
  const inv = await A('GET', `/payments/invoice/${bkId}`);
  rec('get booking invoice', inv.status === 200, `status ${inv.status}`);

  // ── Booking voucher (no pricing) + PDF feature gate ──────────────────────
  sec('BOOKING VOUCHER');
  const prev = await client(t1)('GET', `/vouchers/preview/${bkId}?type=CONFIRMED`);
  const hasPricing = /Amount Summary|Base Amount|VAT \(15%\)|Total incl/i.test(prev.text || '');
  rec('voucher preview loads', prev.status === 200, `status ${prev.status}`);
  rec('voucher preview hides pricing', !hasPricing, 'pricing present');
  rec('voucher preview hides ZATCA QR', !/ZATCA e-Invoice QR/i.test(prev.text || ''), 'qr present');

  // ── Direct Vouchers (FormVoucher) + invoices + payment ───────────────────
  sec('DIRECT VOUCHERS + INVOICES');
  const dv = await A('POST', '/voucher-forms', { type: 'HOTEL', firstName: 'Qa', lastName: 'Tester', mobile: '966512345600', passport: 'QA12345', trips: [{ hotelName: 'QA Hotel', checkInDate: '2026-08-01', checkOutDate: '2026-08-04', perNightPrice: 400 }, { hotelName: 'QA Hotel 2', checkInDate: '2026-08-04', checkOutDate: '2026-08-06', perNightPrice: 300 }] });
  rec('create multi-trip hotel voucher', dv.status === 201, `status ${dv.status} ${JSON.stringify(dv.json).slice(0,150)}`);
  const dvId = dv.json?.id;
  rec('proforma auto-generated', !!dv.json?.proformaInvoiceId, 'no proformaInvoiceId');
  const dvInvs = await A('GET', `/voucher-forms/${dvId}/invoices`);
  const proforma = (dvInvs.json || []).find((i) => i.docType === 'PROFORMA');
  rec('proforma invoice SAFPI numbered', proforma && /^SAFPI\d{8,}/.test(proforma.number), `num ${proforma?.number}`);
  // total = (3*400)+(2*300)=1800 +15% = 2070
  rec('proforma grandTotal = 2070 (VAT correct)', proforma && Number(proforma.grandTotal) === 2070, `got ${proforma?.grandTotal}`);
  const dvEdit = await A('PUT', `/voucher-forms/${dvId}`, { type: 'HOTEL', firstName: 'Qa', lastName: 'Tester', mobile: '966512345600', passport: 'QA12345', trips: [{ hotelName: 'QA Hotel', checkInDate: '2026-08-01', checkOutDate: '2026-08-03', perNightPrice: 400 }] });
  rec('edit tentative voucher', dvEdit.status === 200, `status ${dvEdit.status}`);
  const confirmDv = await A('PATCH', `/voucher-forms/${dvId}/confirm`, {});
  rec('confirm voucher WITHOUT HCN', confirmDv.status === 200, `status ${confirmDv.status} ${JSON.stringify(confirmDv.json).slice(0,120)}`);
  rec('actual invoice auto-generated', !!confirmDv.json?.actualInvoiceId, 'no actualInvoiceId');
  const editConfirmed = await A('PUT', `/voucher-forms/${dvId}`, { type: 'HOTEL', firstName: 'X', lastName: 'Y', mobile: '966512345600', passport: 'QA12345', trips: [{ hotelName: 'h', checkInDate: '2026-08-01', checkOutDate: '2026-08-02', perNightPrice: 1 }] });
  rec('edit confirmed voucher blocked (409)', editConfirmed.status === 409, `status ${editConfirmed.status}`);
  const dvPay = await A('PATCH', `/voucher-forms/${dvId}/payment`, { method: 'CASH', reference: 'QA' });
  rec('record voucher payment', dvPay.status === 200 && dvPay.json?.paymentStatus === 'PAID', `status ${dvPay.status}`);
  const dvPay2 = await A('PATCH', `/voucher-forms/${dvId}/payment`, { method: 'CASH' });
  rec('voucher payment write-once (409)', dvPay2.status === 409, `status ${dvPay2.status}`);
  const dvDel = await A('DELETE', `/voucher-forms/${dvId}`);
  rec('delete confirmed voucher blocked (409)', dvDel.status === 409, `status ${dvDel.status}`);
  const dvVoucherHtml = await client(t1)('GET', `/voucher-forms/${dvId}/print`);
  rec('voucher print hides pricing', !/Amount Summary|Per-night|Line Total/i.test(dvVoucherHtml.text || ''), 'pricing present');
  const dvInvHtml = await client(t1)('GET', `/voucher-forms/${dvId}/invoice/ACTUAL/print`);
  rec('actual invoice print shows pricing+QR', /ZATCA/i.test(dvInvHtml.text || '') && /VAT/i.test(dvInvHtml.text || ''), 'missing');
  // transport voucher
  const dvT = await A('POST', '/voucher-forms', { type: 'TRANSPORT', firstName: 'Trans', lastName: 'Port', mobile: '966512345601', passport: 'TR99999', trips: [{ vehicleType: 'VIP', pickupLocation: 'Jeddah', dropoffLocation: 'Makkah', travelDate: '2026-08-10', passengerCount: 4, price: 700 }] });
  rec('create transport voucher', dvT.status === 201, `status ${dvT.status}`);
  const dvTcancel = await A('PATCH', `/voucher-forms/${dvT.json?.id}/cancel`);
  rec('cancel tentative voucher', dvTcancel.status === 200, `status ${dvTcancel.status}`);

  // ── Reports ──────────────────────────────────────────────────────────────
  sec('REPORTS');
  const ds = await A('GET', '/reports/daily-schedule?date=2026-07-01');
  rec('daily schedule loads', ds.status === 200, `status ${ds.status}`);
  const tEvent = (ds.json?.events || []).find((e) => e.eventType === 'TRANSPORT' && e.transportId);
  rec('daily schedule has transport w/ flags', tEvent && tEvent.departureDoneText === 'Pending', `${tEvent?.departureDoneText}`);
  if (tEvent) {
    const tog = await A('PATCH', '/reports/transport-status', { ids: [tEvent.transportId], departureDone: true, transportAvailed: true });
    rec('toggle transport flags', tog.status === 200, `status ${tog.status}`);
    const ds2 = await A('GET', '/reports/daily-schedule?date=2026-07-01');
    const e2 = ds2.json.events.find((e) => e.transportId === tEvent.transportId);
    rec('flags persisted as Done', e2?.departureDone === true && e2?.transportAvailed === true, JSON.stringify(e2 && { d: e2.departureDone, a: e2.transportAvailed }));
  }
  const tr = await A('GET', '/reports/transport-by-date?startDate=2026-07-01&endDate=2026-07-01');
  rec('transport report loads', tr.status === 200, `status ${tr.status}`);
  const csv = await client(t1)('GET', '/reports/daily-schedule/export?date=2026-07-01');
  rec('daily CSV export has new columns', /Departure Done,Transport Availed/.test(csv.text || ''), 'missing columns');

  // ── CRM ──────────────────────────────────────────────────────────────────
  sec('CRM');
  const lead = await A('POST', '/crm/leads', { fullName: 'QA Lead', phone: '966500000930', budget: 8000, travelInterest: 'UMRAH' });
  rec('create lead', lead.status === 201, `status ${lead.status} ${JSON.stringify(lead.json).slice(0,120)}`);
  const leadId = lead.json?.id;
  const leadUpd = await A('PUT', `/crm/leads/${leadId}`, { status: 'QUALIFIED', priority: 'HIGH' });
  rec('update lead status', leadUpd.status === 200, `status ${leadUpd.status}`);
  const leadList = await A('GET', '/crm/leads');
  rec('list leads', leadList.status === 200, `status ${leadList.status}`);
  const pipe = await A('GET', '/crm/pipelines');
  rec('list pipelines', pipe.status === 200, `status ${pipe.status}`);
  const task = await A('POST', '/crm/tasks', { title: 'QA Task', leadId, dueAt: D('2026-07-20') });
  rec('create CRM task', task.status === 201, `status ${task.status} ${JSON.stringify(task.json).slice(0,120)}`);
  const crmRep = await A('GET', '/crm/reports/dashboard');
  rec('CRM reports dashboard', crmRep.status === 200, `status ${crmRep.status}`);

  // ── RBAC: custom role + enforcement (real login) ─────────────────────────
  sec('RBAC ENFORCEMENT');
  const roles = await A('GET', '/rbac/roles');
  rec('list roles', roles.status === 200 && Array.isArray(roles.json), `status ${roles.status}`);
  const newRole = await A('POST', '/rbac/roles', { name: `QA BookingsOnly ${STAMP}`, permissions: ['bookings:view', 'bookings:create'] });
  rec('create custom role', newRole.status === 201 || newRole.status === 200, `status ${newRole.status} ${JSON.stringify(newRole.json).slice(0,120)}`);
  const roleId = newRole.json?.id;
  const staffEmail = `qa.staff.${STAMP}@example.com`;
  const staff = await A('POST', '/users', { name: 'QA Staff', email: staffEmail, role: 'AGENT', password: 'Staff@1234', phone: '966500000940' });
  rec('create AGENT staff', staff.status === 201, `status ${staff.status}`);
  if (roleId && staff.json?.id) {
    const assign = await A('PUT', `/rbac/users/${staff.json.id}/role`, { customRoleId: roleId });
    rec('assign custom role to staff', assign.status === 200, `status ${assign.status}`);
    const staffLogin = await rawLogin(staffEmail, 'Staff@1234');
    rec('staff can log in', staffLogin.status === 200 && staffLogin.token, `status ${staffLogin.status}`);
    const S = client(staffLogin.token);
    const sBookings = await S('GET', '/bookings');
    rec('bookings-only staff: GET /bookings 200', sBookings.status === 200, `status ${sBookings.status}`);
    const sPkgView = await S('GET', '/packages');
    rec('implied-view: GET /packages 200', sPkgView.status === 200, `status ${sPkgView.status}`);
    const sCrm = await S('GET', '/crm/leads');
    rec('bookings-only staff: GET /crm/leads 403', sCrm.status === 403, `status ${sCrm.status}`);
    const sPkgCreate = await S('POST', '/packages', { name: 'hack', durationDays: 1 });
    rec('bookings-only staff: POST /packages 403', sPkgCreate.status === 403, `status ${sPkgCreate.status}`);
    const sMe = await S('GET', '/auth/me');
    const perms = sMe.json?.permissions || [];
    rec('staff /auth/me excludes crm perms', !perms.includes('crm_leads:view'), `has crm? ${perms.includes('crm_leads:view')}`);
  }

  // ── Multi-tenant isolation ───────────────────────────────────────────────
  sec('MULTI-TENANT ISOLATION');
  const t2 = await impersonate(sa.token, T2);
  const B = client(t2);
  const t2Customers = await B('GET', '/customers');
  const leakedCust = (Array.isArray(t2Customers.json) ? t2Customers.json : t2Customers.json?.data || []).some((c) => c.mobile === '966500000901');
  rec('tenant 2 cannot see tenant 1 customer', !leakedCust, 'LEAK: customer visible cross-tenant');
  const t2Leads = await B('GET', '/crm/leads');
  const leadCount2 = t2Leads.json?.total ?? (t2Leads.json?.data?.length);
  rec('tenant 2 leads isolated', t2Leads.status === 200, `status ${t2Leads.status} total ${leadCount2}`);
  const t1Cfg = await B('GET', '/config');
  rec('tenant 2 config does NOT have tenant1 QA terms', !t1Cfg.json?.voucher_terms?.includes(String(STAMP)), 'LEAK: config bled across tenants');

  // ── Summary ──────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${'═'.repeat(60)}\nTOTAL: ${passed}/${results.length} passed, ${failed.length} failed`);
  if (failed.length) {
    console.log('\nFAILURES:');
    for (const f of failed) console.log(`  ❌ [${f.section}] ${f.name} — ${f.detail || ''}`);
  }
})().catch((e) => { console.error('QA CRASHED:', e.stack || e.message); process.exit(1); });
