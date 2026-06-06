// Seed sample CONFIRMED bookings (hotel + transport) so the Daily Schedule and
// Transport reports show data. Runs against the LIVE API using a super-admin
// proxy (impersonation) token for tenant "Safre Manasik". Node 18+ (global fetch).
const BASE = 'https://api.safremanasik.com/api';
const TID = 'c1e10c47-79fe-4efd-a68e-67a2b70c2698'; // Safre Manasik
const TODAY = '2026-06-06';
const D = (s) => `${s}T00:00:00.000Z`;

async function login() {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@safremanasik.com', password: 'Welcome@1234' }) });
  return (await r.json()).token;
}
async function impersonate(sa) {
  const r = await fetch(`${BASE}/super-admin/tenants/${TID}/impersonate`, { method: 'POST', headers: { Authorization: `Bearer ${sa}` } });
  return (await r.json()).token;
}
let TOKEN;
async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  return json;
}

(async () => {
  const sa = await login();
  TOKEN = await impersonate(sa);
  console.log('Impersonating Safre Manasik…');

  // 1. Package (current live API still requires a package on bookings)
  const pkg = await api('POST', '/packages', {
    name: 'Ad-hoc Umrah Services', description: 'Sample package for schedule demo',
    durationDays: 7, transportIncluded: true, cateringIncluded: true, airportTransfer: true, isActive: true,
  });
  console.log('Package:', pkg.id);

  // 2. Customers (User role CUSTOMER). example.com is a reserved safe domain.
  const stamp = Date.now();
  const custDefs = [
    { name: 'Ahmed Al-Salem', email: `ahmed.alsalem.${stamp}@example.com`, phone: '966551112201' },
    { name: 'Mohammed Khan', email: `mohammed.khan.${stamp}@example.com`, phone: '966551112202' },
    { name: 'Yusuf Ibrahim', email: `yusuf.ibrahim.${stamp}@example.com`, phone: '966551112203' },
    { name: 'Bilal Hassan', email: `bilal.hassan.${stamp}@example.com`, phone: '966551112204' },
  ];
  const customers = [];
  for (const c of custDefs) {
    const u = await api('POST', '/users', { ...c, role: 'CUSTOMER', customerType: 'B2C' });
    customers.push(u.id); console.log('Customer:', c.name, u.id);
  }

  // 3. Vehicles (VehicleType: BUS | CAR | VIP)
  const vehDefs = [
    { name: 'GMC Yukon XL', plateNumber: 'RUH-2201', type: 'VIP', capacity: 7, driverName: 'Khalid Omar', driverPhone: '966500000011' },
    { name: 'Toyota Hiace', plateNumber: 'JED-4410', type: 'CAR', capacity: 12, driverName: 'Sami Yusuf', driverPhone: '966500000012' },
    { name: 'Mercedes Coach', plateNumber: 'MAD-7788', type: 'BUS', capacity: 50, driverName: 'Tariq Aziz', driverPhone: '966500000013' },
  ];
  const vehicles = [];
  for (const v of vehDefs) { const x = await api('POST', '/transport/vehicles', v); vehicles.push(x.id); console.log('Vehicle:', v.name, x.id); }

  // 4. Routes
  const routeDefs = [
    { name: 'Jeddah Airport → Makkah', fromLocation: 'Jeddah Airport (JED)', toLocation: 'Makkah' },
    { name: 'Madinah → Makkah', fromLocation: 'Madinah', toLocation: 'Makkah' },
    { name: 'Makkah → Madinah', fromLocation: 'Makkah', toLocation: 'Madinah' },
    { name: 'Jeddah Airport → Madinah', fromLocation: 'Jeddah Airport (JED)', toLocation: 'Madinah' },
  ];
  const routes = [];
  for (const rt of routeDefs) { const x = await api('POST', '/transport/routes', rt); routes.push(x.id); console.log('Route:', rt.name, x.id); }

  // 5. Bookings (all CONFIRMED). Travel dates centered on TODAY so the daily
  //    schedule shows check-ins/outs, plus transport runs on TODAY.
  const bookingDefs = [
    { c: 0, from: '2026-06-06', to: '2026-06-12', pax: 4, amount: 9600, veh: 0, route: 0, dep: '2026-06-06' }, // check-in today + transport today
    { c: 1, from: '2026-06-06', to: '2026-06-10', pax: 2, amount: 5200, veh: 1, route: 1, dep: '2026-06-06' }, // check-in today + transport today
    { c: 2, from: '2026-06-06', to: '2026-06-06', pax: 3, amount: 4200, veh: 2, route: 2, dep: '2026-06-06' }, // check-in + check-out today + transport today
    { c: 3, from: '2026-06-07', to: '2026-06-14', pax: 6, amount: 13800, veh: 2, route: 3, dep: '2026-06-07' }, // check-in tomorrow + transport tomorrow
  ];
  for (const b of bookingDefs) {
    const booking = await api('POST', '/bookings', {
      customerId: customers[b.c], packageId: pkg.id,
      travelDateFrom: D(b.from), travelDateTo: D(b.to), totalPax: b.pax, totalAmount: b.amount,
      notes: 'Sample booking for schedule/report demo',
    });
    await api('PATCH', `/bookings/${booking.id}/status`, { status: 'CONFIRMED' });
    await api('POST', `/bookings/${booking.id}/transport`, { vehicleId: vehicles[b.veh], routeId: routes[b.route], departureAt: D(b.dep) });
    console.log(`Booking ${booking.bookingRef}: ${custDefs[b.c].name}, ${b.from}→${b.to}, transport ${routeDefs[b.route].name} on ${b.dep}`);
  }
  console.log('\nDONE — 4 confirmed bookings + transports seeded. Daily Schedule for 2026-06-06 should show 3 check-ins, 1 check-out, 3 transport runs.');
})().catch((e) => { console.error('SEED FAILED:', e.message); process.exit(1); });
