const { app, login, auth, request } = require('./setup');

// Smoke tests across the main CRUD endpoints
describe('Bookings CRUD', () => {
  let admin;
  let createdBookingId;
  beforeAll(async () => { admin = await login('admin@alrashidi.sa', 'Admin@1234'); });

  test('list bookings', async () => {
    const res = await auth(request(app).get('/api/bookings'), admin.token);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('create a booking', async () => {
    // Need a customer and a package id
    const customers = await auth(request(app).get('/api/users/customers'), admin.token);
    const packages = await auth(request(app).get('/api/packages'), admin.token);
    const customerId = customers.body.data[0].id;
    const packageId = packages.body.data[0].id;

    const res = await auth(request(app).post('/api/bookings'), admin.token).send({
      customerId, packageId,
      travelDateFrom: '2026-09-01', travelDateTo: '2026-09-08',
      totalPax: 2, totalAmount: 10000,
      passengers: [{ fullName: 'Test Passenger 1', passportNo: 'PT100', nationality: 'Saudi', dateOfBirth: '1990-01-01', gender: 'MALE', isPrimary: true }],
    });
    expect(res.status).toBe(201);
    expect(res.body.bookingRef).toBeTruthy();
    expect(res.body.tenantId).toBe(admin.user.tenantId);
    createdBookingId = res.body.id;
  });

  test('update booking status', async () => {
    const res = await auth(request(app).patch(`/api/bookings/${createdBookingId}/status`), admin.token).send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  test('cancel booking', async () => {
    const res = await auth(request(app).delete(`/api/bookings/${createdBookingId}`), admin.token);
    expect(res.status).toBe(200);
  });
});

describe('Hotels CRUD', () => {
  let admin;
  beforeAll(async () => { admin = await login('admin@alrashidi.sa', 'Admin@1234'); });

  test('create, update, delete a hotel', async () => {
    const create = await auth(request(app).post('/api/hotels'), admin.token).send({
      name: 'Test Hotel ' + Date.now(), city: 'MAKKAH', stars: 4, address: 'Test', amenities: ['WiFi'],
    });
    expect(create.status).toBe(201);
    const id = create.body.id;
    expect(create.body.tenantId).toBe(admin.user.tenantId);

    const update = await auth(request(app).put(`/api/hotels/${id}`), admin.token).send({
      name: 'Updated Hotel', city: 'MAKKAH', stars: 5,
    });
    expect(update.status).toBe(200);
    expect(update.body.name).toBe('Updated Hotel');

    const del = await auth(request(app).delete(`/api/hotels/${id}`), admin.token);
    expect(del.status).toBe(200);
  });
});

describe('Vehicles CRUD with tenant-scoped plate uniqueness', () => {
  let admin;
  beforeAll(async () => { admin = await login('admin@alrashidi.sa', 'Admin@1234'); });

  test('two tenants can have vehicles with the same plate number', async () => {
    // Create in tenant 1
    const v1 = await auth(request(app).post('/api/transport/vehicles'), admin.token).send({
      name: 'Shared Plate Test', plateNumber: 'SHARED-001', type: 'CAR', capacity: 4,
      driverName: 'Driver A', driverPhone: '+966-50-000-0000',
    });
    expect(v1.status).toBe(201);

    // Tenant 2 should also be able to create with same plate
    const t2 = await login('admin@hamdan-tours.com', 'Admin@1234');
    const v2 = await auth(request(app).post('/api/transport/vehicles'), t2.token).send({
      name: 'Shared Plate Test', plateNumber: 'SHARED-001', type: 'CAR', capacity: 4,
      driverName: 'Driver B', driverPhone: '+966-50-000-0001',
    });
    expect(v2.status).toBe(201);

    // Cleanup
    await auth(request(app).delete(`/api/transport/vehicles/${v1.body.id}`), admin.token);
    await auth(request(app).delete(`/api/transport/vehicles/${v2.body.id}`), t2.token);
  });
});

describe('Tenant Settings', () => {
  let admin;
  beforeAll(async () => { admin = await login('admin@alrashidi.sa', 'Admin@1234'); });

  test('GET current tenant returns own tenant', async () => {
    const res = await auth(request(app).get('/api/tenant/current'), admin.token);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('alrashidi');
    expect(res.body._count).toBeDefined();
  });

  test('PUT current tenant updates settings', async () => {
    const res = await auth(request(app).put('/api/tenant/current'), admin.token).send({
      contactPhone: '+966-50-999-9999',
      primaryColor: '#FF5733',
    });
    expect(res.status).toBe(200);
    expect(res.body.contactPhone).toBe('+966-50-999-9999');
    expect(res.body.primaryColor).toBe('#FF5733');
  });

  test('non-admin (agent) cannot update tenant settings', async () => {
    const agent = await login('agent1@alrashidi.local', 'Agent@1234');
    const res = await auth(request(app).put('/api/tenant/current'), agent.token).send({ contactPhone: 'x' });
    expect(res.status).toBe(403);
  });
});
