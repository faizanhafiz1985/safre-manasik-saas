const { app, login, auth, request } = require('./setup');

describe('Report A — Daily Schedule', () => {
  let admin;
  beforeAll(async () => { admin = await login('admin@alrashidi.sa', 'Admin@1234'); });

  test('returns events for today', async () => {
    const today = new Date().toISOString().substring(0, 10);
    const res = await auth(request(app).get(`/api/reports/daily-schedule?date=${today}`), admin.token);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(today);
    expect(res.body.summary).toBeDefined();
    expect(res.body.events).toBeInstanceOf(Array);
  });

  test('rejects an invalid date', async () => {
    const res = await auth(request(app).get('/api/reports/daily-schedule?date=not-a-date'), admin.token);
    expect(res.status).toBe(400);
  });

  test('filters by event type', async () => {
    const today = new Date().toISOString().substring(0, 10);
    const res = await auth(request(app).get(`/api/reports/daily-schedule?date=${today}&eventType=TRANSPORT`), admin.token);
    expect(res.status).toBe(200);
    for (const ev of res.body.events) expect(ev.eventType).toBe('TRANSPORT');
  });

  test('CSV export produces text/csv', async () => {
    const today = new Date().toISOString().substring(0, 10);
    const res = await auth(request(app).get(`/api/reports/daily-schedule/export?date=${today}`), admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Event Type,Time,Booking Ref');
  });

  test('Customer role is denied', async () => {
    const cust = await login('abdullah@alrashidi.local', 'Customer@1234');
    const today = new Date().toISOString().substring(0, 10);
    const res = await auth(request(app).get(`/api/reports/daily-schedule?date=${today}`), cust.token);
    expect(res.status).toBe(403);
  });
});

describe('Report B — Transport by Date', () => {
  let admin;
  beforeAll(async () => { admin = await login('admin@alrashidi.sa', 'Admin@1234'); });

  test('returns runs over a date range', async () => {
    const start = new Date().toISOString().substring(0, 10);
    const end = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
    const res = await auth(request(app).get(`/api/reports/transport-by-date?startDate=${start}&endDate=${end}`), admin.token);
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.runs).toBeInstanceOf(Array);
    expect(res.body.summary.totalRuns).toBeGreaterThanOrEqual(0);
  });

  test('rejects ranges over 31 days', async () => {
    const start = '2026-01-01';
    const end = '2026-12-31';
    const res = await auth(request(app).get(`/api/reports/transport-by-date?startDate=${start}&endDate=${end}`), admin.token);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/31 days/);
  });

  test('groups by vehicle and date with occupancy calculated', async () => {
    const start = new Date().toISOString().substring(0, 10);
    const end = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
    const res = await auth(request(app).get(`/api/reports/transport-by-date?startDate=${start}&endDate=${end}`), admin.token);
    for (const run of res.body.runs) {
      expect(typeof run.occupancyPct).toBe('number');
      expect(run.occupancyPct).toBeGreaterThanOrEqual(0);
      expect(run.bookingRefs).toBeDefined();
    }
  });

  test('CSV export', async () => {
    const start = new Date().toISOString().substring(0, 10);
    const end = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
    const res = await auth(request(app).get(`/api/reports/transport-by-date/export?startDate=${start}&endDate=${end}`), admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });
});

describe('Reports respect tenant isolation', () => {
  test('two tenants see their own transport runs only', async () => {
    const t1 = await login('admin@alrashidi.sa', 'Admin@1234');
    const t2 = await login('admin@hamdan-tours.com', 'Admin@1234');
    const start = new Date().toISOString().substring(0, 10);
    const end = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
    const r1 = await auth(request(app).get(`/api/reports/transport-by-date?startDate=${start}&endDate=${end}`), t1.token);
    const r2 = await auth(request(app).get(`/api/reports/transport-by-date?startDate=${start}&endDate=${end}`), t2.token);
    // Vehicle plates must not overlap
    const plates1 = r1.body.runs.map((r) => r.vehiclePlate);
    const plates2 = r2.body.runs.map((r) => r.vehiclePlate);
    expect(plates1.filter((p) => plates2.includes(p))).toEqual([]);
  });
});
