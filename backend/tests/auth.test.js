const { app, login, auth, request } = require('./setup');

describe('Authentication', () => {
  test('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@alrashidi.sa', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('rejects login with unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'noone@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  test('tenant admin login returns token + tenantId', async () => {
    const { token, user } = await login('admin@alrashidi.sa', 'Admin@1234');
    expect(token).toBeTruthy();
    expect(user.role).toBe('ADMIN');
    expect(user.tenantId).toBeTruthy();
    expect(user.tenant.slug).toBe('alrashidi');
  });

  test('super admin login returns no tenantId', async () => {
    const { token, user } = await login('superadmin@safremanasik.com', 'Super@2026!');
    expect(token).toBeTruthy();
    expect(user.role).toBe('SUPER_ADMIN');
    expect(user.tenantId).toBeNull();
  });

  test('GET /auth/me returns the current user with tenant info', async () => {
    const { token } = await login('admin@alrashidi.sa', 'Admin@1234');
    const res = await auth(request(app).get('/api/auth/me'), token);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@alrashidi.sa');
    expect(res.body.tenant).toBeTruthy();
  });

  test('endpoints reject requests without token', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.status).toBe(401);
  });
});

describe('Tenant Signup', () => {
  test('creates a new tenant + admin user, returns token', async () => {
    const email = `test-${Date.now()}@newtenant.com`;
    const res = await request(app).post('/api/auth/signup-tenant').send({
      tenantName: `Test Tenant ${Date.now()}`,
      adminName: 'Test Admin',
      adminEmail: email,
      adminPassword: 'TestPass@2026',
      crNumber: '4030099999',
      city: 'Riyadh',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.tenant.slug).toBeTruthy();
    expect(res.body.tenant.status).toBe('TRIAL');
  });

  test('rejects signup with duplicate email', async () => {
    const res = await request(app).post('/api/auth/signup-tenant').send({
      tenantName: 'Dup Test',
      adminName: 'Test',
      adminEmail: 'admin@alrashidi.sa',
      adminPassword: 'TestPass@2026',
    });
    expect(res.status).toBe(409);
  });

  test('rejects signup with short password', async () => {
    const res = await request(app).post('/api/auth/signup-tenant').send({
      tenantName: 'Test',
      adminName: 'Test',
      adminEmail: `pw-${Date.now()}@test.com`,
      adminPassword: 'short',
    });
    expect(res.status).toBe(400);
  });
});
