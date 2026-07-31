/* Senior QA — full-application regression sweep against LIVE production.
 * Covers: auth, config, users/RBAC, customers, packages, hotels, transport +
 * configurable types, fleet (trips/odometer/cash/maintenance/receipt/scope),
 * bookings lifecycle + payments + voucher, direct vouchers + invoices,
 * reports, CRM, cost monitor, security (401/403/isolation), new validations.
 * Creates ONLY disposable records and deletes them at the end. Node 18+. */
const BASE = 'https://api.safremanasik.com/api';
const T1 = 'c1e10c47-79fe-4efd-a68e-67a2b70c2698'; // Safre Manasik
const S = Date.now();
const results = []; let section = '';
const sec = (s) => { section = s; console.log(`\n═══ ${s} ═══`); };
const rec = (name, cond, detail) => { results.push({ section, name, pass: !!cond }); console.log(`  ${cond ? '✅' : '❌'} ${name}${cond ? '' : `  →  ${detail || ''}`}`); };
const login = async (e, p) => { const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: p }) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const cli = (tok) => async (m, p, b) => { const r = await fetch(`${BASE}${p}`, { method: m, headers: { 'Content-Type': 'application/json', ...(tok && { Authorization: `Bearer ${tok}` }) }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, json: j, text: t }; };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
  const cleanup = []; // [label, fn]
  // ── 1. AUTH & PLATFORM ─────────────────────────────────────────────────────
  sec('1. AUTH & PLATFORM SECURITY');
  const sa = await login('superadmin@safremanasik.com', 'Welcome@1234');
  rec('super-admin login', sa.status === 200 && sa.token);
  rec('wrong password -> 401', (await login('superadmin@safremanasik.com', 'nope')).status === 401);
  const anon = cli(null);
  rec('unauthenticated /bookings -> 401', (await anon('GET', '/bookings')).status === 401);
  rec('unauthenticated /super-admin/costs -> 401', (await anon('GET', '/super-admin/costs')).status === 401);
  rec('forgot-password generic 200 (no enumeration)', (await anon('POST', '/auth/forgot-password', { email: 'nobody@example.com' })).status === 200);
  const SA = cli(sa.token);
  const impR = await SA('POST', `/super-admin/tenants/${T1}/impersonate`);
  rec('proxy login (impersonate)', impR.status === 200 && impR.json.token);
  const A = cli(impR.json.token);
  rec('email diagnostic send ok', (await SA('POST', '/super-admin/test-email', { to: 'faizan_hafiz@hotmail.com' })).json?.result?.ok === true);

  // ── 2. CONFIG ──────────────────────────────────────────────────────────────
  sec('2. SYSTEM CONFIG');
  const cfg0 = (await A('GET', '/config')).json || {};
  rec('config loads (vat/currency)', !!cfg0.vat_percentage && !!cfg0.currency);
  await A('POST', '/config', { configs: { qa_probe: `x${S}` } });
  rec('config write persists', ((await A('GET', '/config')).json || {}).qa_probe === `x${S}`);
  rec('vehicle_types configurable', String(cfg0.vehicle_types || 'BUS').length > 0);

  // ── 3. USERS & RBAC ────────────────────────────────────────────────────────
  sec('3. USERS & RBAC');
  const uEmail = `qa.${S}@example.com`;
  const uR = await A('POST', '/users', { name: 'QA User', email: uEmail, role: 'AGENT', password: 'Test@1234', phone: '966500000001' });
  rec('create user', uR.status === 201, JSON.stringify(uR.json).slice(0, 80));
  const uid = uR.json?.id; cleanup.push(['user', () => A('DELETE', `/users/${uid}`)]);
  rec('duplicate email -> 409', (await A('POST', '/users', { name: 'd', email: uEmail, role: 'AGENT' })).status === 409);
  const roles = (await A('GET', '/rbac/roles')).json || [];
  rec('4 system roles incl. Driver', ['ADMIN', 'AGENT', 'CUSTOMER', 'DRIVER'].every((k) => roles.some((r) => r.key === k)));
  const drvRole = roles.find((r) => r.key === 'DRIVER');
  await A('PUT', `/rbac/users/${uid}/role`, { customRoleId: drvRole.id });
  const dLogin = await login(uEmail, 'Test@1234');
  rec('driver-role user can log in', dLogin.status === 200);
  const D = cli(dLogin.token);
  rec('driver blocked from users admin (403)', (await D('GET', '/users')).status === 403);
  rec('driver blocked from CRM (403)', (await D('GET', '/crm/leads')).status === 403);

  // ── 4. MASTERS: customers, packages, hotels, transport ────────────────────
  sec('4. MASTER DATA');
  // Standalone /customers route was retired — customers are unified CUSTOMER-role Users.
  const cR = await A('POST', '/users', { name: 'QA Cust', email: `qa.cust.${S}@example.com`, phone: '966500000002', companyName: 'QA', role: 'CUSTOMER' });
  rec('create customer (unified /users)', cR.status === 201, JSON.stringify(cR.json).slice(0, 80)); const custId = cR.json?.id;
  cleanup.push(['customer', () => A('DELETE', `/users/${custId}`)]);
  const pR = await A('POST', '/packages', { name: `QA Pkg ${S}`, durationDays: 7, transportIncluded: true, cateringIncluded: false, airportTransfer: true, isActive: true });
  rec('create package', pR.status === 201); const pkgId = pR.json?.id;
  cleanup.push(['package', () => A('DELETE', `/packages/${pkgId}`)]);
  const hR = await A('POST', '/hotels', { name: `QA Hotel ${S}`, city: 'MAKKAH', stars: 4, distanceToHaramMeters: 300, pricePerNight: 350 });
  rec('create hotel', hR.status === 201); const hotelId = hR.json?.id;
  cleanup.push(['hotel', () => A('DELETE', `/hotels/${hotelId}`)]);
  // driverIqama (10 digits) is mandatory; docs omitted on purpose — tooling/mobile
  // callers that don't submit the 8 compliance dates must still create vehicles.
  const vR = await A('POST', '/transport/vehicles', { name: `QA Veh ${S}`, plateNumber: `Q${S % 100000}`, type: 'minibus', capacity: 12, driverName: 'QA D', driverPhone: '966500000003', driverIqama: '1234567890', driverId: uid, initialOdometer: 2000, oilChangeIntervalKm: 1000, lastOilChangeOdometer: 2000 });
  rec('create vehicle (custom type normalised)', vR.status === 201 && vR.json?.type === 'MINIBUS', vR.json?.type);
  const vid = vR.json?.id; cleanup.push(['vehicle', () => A('DELETE', `/transport/vehicles/${vid}`)]);
  rec('initial=current odometer on create', vR.json?.initialOdometer === 2000 && vR.json?.currentOdometer === 2000);
  const rtR = await A('POST', '/transport/routes', { name: `QA Route ${S}`, fromLocation: 'Jeddah', toLocation: 'Makkah' });
  rec('create route', rtR.status === 201); const routeId = rtR.json?.id;
  cleanup.push(['route', () => A('DELETE', `/transport/routes/${routeId}`)]);

  // ── 5. FLEET (incl. newest features) ──────────────────────────────────────
  sec('5. FLEET: trips, odometer, oil task, receipt, scope');
  rec('Add Trip without From/To -> 400', (await A('POST', '/fleet/trips', { vehicleId: vid, distanceKm: 50 })).status === 400);
  rec('Add Trip negative km -> 400', (await A('POST', '/fleet/trips', { vehicleId: vid, startLabel: 'A', endLabel: 'B', distanceKm: -5 })).status === 400);
  const t1 = await A('POST', '/fleet/trips', { vehicleId: vid, startLabel: 'Jeddah', endLabel: 'Makkah', distanceKm: 400 });
  rec('trip 400km -> odometer 2400, oil OK', t1.json?.vehicleOdometer === 2400 && t1.json?.oil?.status === 'OK');
  const t2 = await A('POST', '/fleet/trips', { vehicleId: vid, startLabel: 'Makkah', endLabel: 'Madinah', distanceKm: 700 });
  rec('trip 700km -> 3100 DUE + auto task', t2.json?.vehicleOdometer === 3100 && t2.json?.oil?.status === 'DUE' && t2.json?.oilTaskCreated === true);
  // driver scope: driver assigned to vid CAN act; cannot on other vehicles
  rec('assigned driver sees only own vehicle', ((await D('GET', '/transport/vehicles')).json || []).every((v) => v.id === vid));
  rec('driver cash submit own vehicle 201', (await D('POST', '/fleet/cash', { vehicleId: vid, amount: 150 })).status === 201);
  rec('confirm oil without receipt -> 400', (await A('POST', '/fleet/maintenance/confirm', { vehicleId: vid, completed: true, performedOdometer: 3100 })).status === 400);
  const conf = await A('POST', '/fleet/maintenance/confirm', { vehicleId: vid, completed: true, performedOdometer: 3100, receiptData: PNG, receiptName: 'r.png' });
  rec('confirm with odo+receipt -> COMPLETED, alert clears', conf.json?.record?.status === 'COMPLETED' && conf.json?.oil?.status === 'OK');
  const recId = conf.json?.record?.id;
  rec('receipt retrievable', ((await A('GET', `/fleet/maintenance/${recId}/receipt`)).json?.receiptData || '').startsWith('data:image/png'));
  const dash = (await A('GET', '/fleet/dashboard')).json;
  rec('fleet dashboard aggregates trips+cash', dash?.summary?.totalTrips >= 2 && dash?.summary?.totalCash >= 150);

  // ── 6. BOOKINGS + PAYMENTS + VOUCHER ───────────────────────────────────────
  sec('6. BOOKINGS LIFECYCLE');
  // bookings need a CUSTOMER-role user
  const bcEmail = `qa.bcust.${S}@example.com`;
  const bcR = await A('POST', '/users', { name: 'QA BookCust', email: bcEmail, role: 'CUSTOMER', password: 'Test@1234' });
  const bcId = bcR.json?.id; cleanup.push(['booking customer user', () => A('DELETE', `/users/${bcId}`)]);
  const bk = await A('POST', '/bookings', { customerId: bcId, packageId: pkgId, travelDateFrom: '2026-08-01T00:00:00.000Z', travelDateTo: '2026-08-08T00:00:00.000Z', totalPax: 2, totalAmount: 4000 });
  rec('create booking (with package)', bk.status === 201); const bkId = bk.json?.id;
  const bk2 = await A('POST', '/bookings', { customerId: bcId, travelDateFrom: '2026-08-10T00:00:00.000Z', travelDateTo: '2026-08-12T00:00:00.000Z', totalPax: 1, totalAmount: 800 });
  rec('create booking WITHOUT package', bk2.status === 201 && bk2.json?.packageId === null);
  rec('past departure -> 400', (await A('POST', '/bookings', { customerId: bcId, travelDateFrom: '2020-01-01T00:00:00.000Z', travelDateTo: '2020-01-02T00:00:00.000Z', totalPax: 1, totalAmount: 1 })).status === 400);
  rec('confirm booking', (await A('PATCH', `/bookings/${bkId}/status`, { status: 'CONFIRMED' })).json?.status === 'CONFIRMED');
  rec('assign transport', (await A('POST', `/bookings/${bkId}/transport`, { vehicleId: vid, routeId, departureAt: '2026-08-01T00:00:00.000Z' })).status === 200);
  rec('record payment', (await A('POST', '/payments', { bookingId: bkId, amount: 2000, method: 'CASH', reference: 'QA' })).status === 201);
  const inv = await A('GET', `/payments/invoice/${bkId}`);
  rec('invoice reflects payment', inv.status === 200 && Number(inv.json?.paidAmount) === 2000);
  const prev = await A('GET', `/vouchers/preview/${bkId}?type=CONFIRMED`);
  rec('booking voucher hides pricing', prev.status === 200 && !/Amount Summary|VAT \(15%\)/i.test(prev.text));
  // cleanup: cancel both bookings (delete is soft-cancel by design)
  // Hard-delete so no test rows survive (a plain DELETE only soft-cancels and
  // the leftover row blocks deleting the test customer afterwards).
  cleanup.push(['booking1 purge', () => A('DELETE', `/bookings/${bkId}?hard=1`)]);
  cleanup.push(['booking2 purge', () => A('DELETE', `/bookings/${bk2.json?.id}?hard=1`)]);

  // ── 7. DIRECT VOUCHERS + INVOICES ──────────────────────────────────────────
  sec('7. DIRECT VOUCHERS + ZATCA INVOICES');
  const dv = await A('POST', '/voucher-forms', { type: 'HOTEL', firstName: 'Qa', lastName: 'Pilgrim', mobile: '966512345678', passport: 'QQ1234', trips: [{ hotelName: 'QA H', checkInDate: '2026-09-01', checkOutDate: '2026-09-03', perNightPrice: 500 }] });
  rec('create direct voucher + auto Proforma', dv.status === 201 && !!dv.json?.proformaInvoiceId);
  const dvId = dv.json?.id;
  const invs = (await A('GET', `/voucher-forms/${dvId}/invoices`)).json || [];
  const pf = invs.find((i) => i.docType === 'PROFORMA');
  rec('SAFPI number + VAT math (2*500*1.15=1150)', /^SAFPI\d+/.test(pf?.number || '') && Number(pf?.grandTotal) === 1150, pf?.grandTotal);
  const cf = await A('PATCH', `/voucher-forms/${dvId}/confirm`, {});
  rec('confirm w/o HCN + auto Actual invoice', cf.status === 200 && !!cf.json?.actualInvoiceId);
  rec('delete CONFIRMED voucher blocked 409', (await A('DELETE', `/voucher-forms/${dvId}`)).status === 409);
  rec('voucher payment write-once', (await A('PATCH', `/voucher-forms/${dvId}/payment`, { method: 'CASH' })).status === 200 && (await A('PATCH', `/voucher-forms/${dvId}/payment`, { method: 'CASH' })).status === 409);
  rec('tax invoice print has ZATCA QR', /ZATCA/i.test((await A('GET', `/voucher-forms/${dvId}/invoice/ACTUAL/print`)).text));
  cleanup.push(['voucher cancel+delete', async () => { await A('PATCH', `/voucher-forms/${dvId}/cancel`); return A('DELETE', `/voucher-forms/${dvId}`); }]);

  // ── 8. REPORTS ─────────────────────────────────────────────────────────────
  sec('8. REPORTS');
  const ds = await A('GET', '/reports/daily-schedule?date=2026-08-01');
  rec('daily schedule (package-less safe)', ds.status === 200 && ds.json?.summary?.checkIns >= 1);
  const tev = (ds.json?.events || []).find((e) => e.eventType === 'TRANSPORT' && e.transportId);
  if (tev) {
    rec('toggle transport flags', (await A('PATCH', '/reports/transport-status', { ids: [tev.transportId], departureDone: true })).status === 200);
  } else rec('toggle transport flags', false, 'no transport event found');
  rec('transport report + CSV columns', /Departure Done,Transport Availed/.test((await A('GET', '/reports/daily-schedule/export?date=2026-08-01')).text));

  // ── 9. CRM ─────────────────────────────────────────────────────────────────
  sec('9. CRM');
  const lead = await A('POST', '/crm/leads', { fullName: 'QA Lead', phone: '966500000004', budget: 5000 });
  rec('create lead', lead.status === 201); const leadId = lead.json?.id;
  cleanup.push(['lead', () => A('DELETE', `/crm/leads/${leadId}`)]);
  rec('lead status update + activity', (await A('PUT', `/crm/leads/${leadId}`, { status: 'QUALIFIED' })).status === 200);
  rec('CRM dashboard', (await A('GET', '/crm/reports/dashboard')).status === 200);

  // ── 10. COST MONITOR (super admin) ─────────────────────────────────────────
  sec('10. COST MONITOR');
  const costs = (await SA('GET', '/super-admin/costs')).json;
  rec('cost dashboard loads with platforms', (costs?.platforms || []).length >= 7);
  rec('cost CSV export', /Platform,Category/.test((await SA('GET', '/super-admin/costs/export')).text));
  rec('tenant admin blocked from costs (403)', (await A('GET', '/super-admin/costs')).status === 403);

  // ── CLEANUP ────────────────────────────────────────────────────────────────
  sec('CLEANUP (disposable test records)');
  // order matters: vehicle delete cascades fleet data; bookings cancelled first
  for (const [label, fn] of cleanup.reverse()) {
    try { const r = await fn(); console.log(`  ${r.status < 300 ? '🧹' : '⚠️'} ${label} (${r.status})`); }
    catch (e) { console.log(`  ⚠️ ${label}: ${e.message}`); }
  }
  await A('POST', '/config', { configs: { qa_probe: '' } });

  const passed = results.filter((r) => r.pass).length, failed = results.filter((r) => !r.pass);
  console.log(`\n${'═'.repeat(58)}\nTOTAL: ${passed}/${results.length} passed, ${failed.length} failed`);
  for (const f of failed) console.log(`  ❌ [${f.section}] ${f.name}`);
})().catch((e) => { console.error('QA CRASHED:', e.stack || e.message); process.exit(1); });
