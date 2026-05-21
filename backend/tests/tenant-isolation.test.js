// CRITICAL: These tests verify that one tenant cannot see or mutate another
// tenant's data. A regression here is a security breach.

const { app, login, auth, request } = require('./setup');

describe('Tenant Isolation — the security boundary', () => {
  let t1, t2, sa;

  beforeAll(async () => {
    t1 = await login('admin@alrashidi.sa', 'Admin@1234');
    t2 = await login('admin@hamdan-tours.com', 'Admin@1234');
    sa = await login('superadmin@safremanasik.com', 'Super@2026!');
  });

  test('tenants see only their own bookings', async () => {
    const r1 = await auth(request(app).get('/api/bookings'), t1.token);
    const r2 = await auth(request(app).get('/api/bookings'), t2.token);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    // Tenant 1 bookings should all be tenant 1
    expect(r1.body.data.length).toBeGreaterThan(0);
    for (const b of r1.body.data) expect(b.tenantId).toBe(t1.user.tenantId);
    for (const b of r2.body.data) expect(b.tenantId).toBe(t2.user.tenantId);

    // No overlap
    const ids1 = r1.body.data.map((b) => b.id);
    const ids2 = r2.body.data.map((b) => b.id);
    expect(ids1.filter((id) => ids2.includes(id))).toEqual([]);
  });

  test('tenants see only their own hotels', async () => {
    const r1 = await auth(request(app).get('/api/hotels'), t1.token);
    const r2 = await auth(request(app).get('/api/hotels'), t2.token);
    const ids1 = r1.body.map((h) => h.id);
    const ids2 = r2.body.map((h) => h.id);
    expect(ids1.filter((id) => ids2.includes(id))).toEqual([]);
  });

  test('tenants see only their own vehicles', async () => {
    const r1 = await auth(request(app).get('/api/transport/vehicles'), t1.token);
    const r2 = await auth(request(app).get('/api/transport/vehicles'), t2.token);
    const plates1 = r1.body.map((v) => v.plateNumber);
    const plates2 = r2.body.map((v) => v.plateNumber);
    expect(plates1.some((p) => p.startsWith('AR-'))).toBe(true);
    expect(plates2.some((p) => p.startsWith('HT-'))).toBe(true);
    expect(plates1.filter((p) => plates2.includes(p))).toEqual([]);
  });

  test('tenant 1 cannot GET a tenant 2 booking by ID', async () => {
    const r2 = await auth(request(app).get('/api/bookings'), t2.token);
    const t2BookingId = r2.body.data[0].id;
    const stolen = await auth(request(app).get(`/api/bookings/${t2BookingId}`), t1.token);
    expect(stolen.status).toBe(404);
  });

  test('tenant 1 cannot UPDATE a tenant 2 booking', async () => {
    const r2 = await auth(request(app).get('/api/bookings'), t2.token);
    const t2BookingId = r2.body.data[0].id;
    const res = await auth(request(app).patch(`/api/bookings/${t2BookingId}/status`), t1.token).send({ status: 'CANCELLED' });
    expect(res.status).toBe(404);
  });

  test('tenant 1 cannot DELETE a tenant 2 vehicle', async () => {
    const r2 = await auth(request(app).get('/api/transport/vehicles'), t2.token);
    const t2VehicleId = r2.body[0].id;
    const res = await auth(request(app).delete(`/api/transport/vehicles/${t2VehicleId}`), t1.token);
    expect(res.status).toBe(404);
  });

  test('tenant 1 cannot UPDATE a tenant 2 hotel', async () => {
    const r2 = await auth(request(app).get('/api/hotels'), t2.token);
    const t2HotelId = r2.body[0].id;
    const res = await auth(request(app).put(`/api/hotels/${t2HotelId}`), t1.token).send({ name: 'Hijacked', city: 'MAKKAH' });
    expect(res.status).toBe(404);
  });

  test('tenant dashboard stats show only own data', async () => {
    const r1 = await auth(request(app).get('/api/dashboard/stats'), t1.token);
    const r2 = await auth(request(app).get('/api/dashboard/stats'), t2.token);
    // >= because other tests in the suite may have created bookings in tenant 1
    expect(r1.body.stats.totalBookings).toBeGreaterThanOrEqual(5);
    expect(r2.body.stats.totalBookings).toBe(5);
    // Super admin sees 10
  });

  test('super admin sees all tenants and all data', async () => {
    const tenants = await auth(request(app).get('/api/super-admin/tenants'), sa.token);
    expect(tenants.status).toBe(200);
    expect(tenants.body.data.length).toBeGreaterThanOrEqual(2);

    const allBookings = await auth(request(app).get('/api/super-admin/bookings'), sa.token);
    expect(allBookings.status).toBe(200);
    expect(allBookings.body.total).toBeGreaterThanOrEqual(10);
  });

  test('non-super-admin cannot access super-admin endpoints', async () => {
    const res = await auth(request(app).get('/api/super-admin/tenants'), t1.token);
    expect(res.status).toBe(403);
  });

  test('non-admin cannot suspend a tenant', async () => {
    const res = await auth(request(app).post('/api/super-admin/tenants/anything/suspend'), t1.token);
    expect(res.status).toBe(403);
  });
});

describe('Tenant Suspension', () => {
  let sa;
  beforeAll(async () => { sa = await login('superadmin@safremanasik.com', 'Super@2026!'); });

  test('super admin can suspend and reactivate a tenant', async () => {
    const list = await auth(request(app).get('/api/super-admin/tenants'), sa.token);
    const trial = list.body.data.find((t) => t.slug === 'hamdan-tours');
    expect(trial).toBeTruthy();

    const sus = await auth(request(app).post(`/api/super-admin/tenants/${trial.id}/suspend`), sa.token);
    expect(sus.status).toBe(200);
    expect(sus.body.status).toBe('SUSPENDED');

    // Suspended tenant's users cannot log in
    const blocked = await request(app).post('/api/auth/login').send({ email: 'admin@hamdan-tours.com', password: 'Admin@1234' });
    expect(blocked.status).toBe(403);

    // Reactivate
    const reactivated = await auth(request(app).post(`/api/super-admin/tenants/${trial.id}/activate`), sa.token);
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.status).toBe('ACTIVE');

    // Users can log in again
    const ok = await request(app).post('/api/auth/login').send({ email: 'admin@hamdan-tours.com', password: 'Admin@1234' });
    expect(ok.status).toBe(200);
  });
});
