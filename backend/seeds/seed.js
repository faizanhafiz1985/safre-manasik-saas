require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Seeding Safre Manasik SaaS database...\n');

  // ─── Clean slate ──────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, invoices, payments, vouchers, booking_caterings,
      booking_transports, passengers, bookings, package_hotels, price_tiers,
      packages, meal_plans, catering_vendors, routes, vehicles, hotels,
      system_configs, users, tenants
    RESTART IDENTITY CASCADE
  `);
  console.log('🧹 Existing data cleared\n');

  // ─── SUPER_ADMIN (no tenant — sees everything) ────────────────────────────
  const superAdminPass = await bcrypt.hash('Super@2026!', 12);
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Platform Super Admin',
      email: 'superadmin@safremanasik.com',
      password: superAdminPass,
      role: 'SUPER_ADMIN',
      tenantId: null,
      phone: '+966-11-000-0000',
    },
  });
  console.log('👑 SUPER_ADMIN created: superadmin@safremanasik.com / Super@2026!\n');

  // ─── Tenant 1: Al-Rashidi Travel (Saudi Arabia) ───────────────────────────
  const tenant1 = await prisma.tenant.create({
    data: {
      slug: 'alrashidi',
      name: 'Al-Rashidi Travel Agency',
      contactEmail: 'info@alrashidi.sa',
      contactPhone: '+966-50-111-2222',
      crNumber: '4030001234',
      vatNumber: '300001234500003',
      umrahLicenseNumber: 'UMR-2024-001',
      umrahLicenseExpiry: new Date('2027-12-31'),
      address: 'King Fahd Road, Jeddah',
      city: 'Jeddah',
      country: 'Saudi Arabia',
      currency: 'SAR',
      language: 'ar',
      primaryColor: '#0D7377',
      plan: 'GROWTH',
      status: 'ACTIVE',
      maxUsers: 50,
      maxBookings: 1000,
    },
  });

  // ─── Tenant 2: Hamdan Tours (smaller, on TRIAL) ───────────────────────────
  const tenant2 = await prisma.tenant.create({
    data: {
      slug: 'hamdan-tours',
      name: 'Hamdan Tours & Travel',
      contactEmail: 'info@hamdan-tours.com',
      contactPhone: '+966-55-333-4444',
      crNumber: '1010005678',
      vatNumber: '300005678900003',
      umrahLicenseNumber: 'UMR-2024-002',
      address: 'Olaya Street, Riyadh',
      city: 'Riyadh',
      country: 'Saudi Arabia',
      currency: 'SAR',
      primaryColor: '#1B5E7A',
      plan: 'STARTER',
      status: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`🏢 Tenants created:\n   - ${tenant1.name} (${tenant1.slug}) — ${tenant1.plan}\n   - ${tenant2.name} (${tenant2.slug}) — ${tenant2.plan} (TRIAL)\n`);

  // ─── Helper: seed a full operational dataset for a tenant ─────────────────
  async function seedTenantOperations(tenant, adminEmail, adminPassword) {
    console.log(`\n📦 Seeding operations for ${tenant.name}...`);

    // System configs (per-tenant)
    await prisma.systemConfig.createMany({
      data: [
        { tenantId: tenant.id, key: 'company_name', value: tenant.name, description: 'Company name on documents' },
        { tenantId: tenant.id, key: 'company_phone', value: tenant.contactPhone, description: 'Public phone' },
        { tenantId: tenant.id, key: 'company_email', value: tenant.contactEmail, description: 'Public email' },
        { tenantId: tenant.id, key: 'company_address', value: tenant.address || '', description: 'Office address' },
        { tenantId: tenant.id, key: 'currency', value: tenant.currency, description: 'Default currency' },
        { tenantId: tenant.id, key: 'vat_percentage', value: '15', description: 'VAT percentage (Saudi 15%)' },
        { tenantId: tenant.id, key: 'booking_tentative_days', value: '3', description: 'Tentative booking expiry days' },
      ],
    });

    // Admin user
    const adminPass = await bcrypt.hash(adminPassword, 12);
    const admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: tenant.slug === 'alrashidi' ? 'Ahmed Al-Rashidi' : 'Khalid Al-Hamdan',
        email: adminEmail, password: adminPass, role: 'ADMIN',
        phone: tenant.contactPhone, companyName: tenant.name,
      },
    });

    // Agents
    const agentPass = await bcrypt.hash('Agent@1234', 12);
    const agents = await Promise.all([
      prisma.user.create({ data: { tenantId: tenant.id, name: `${tenant.slug}-agent-1`, email: `agent1@${tenant.slug}.local`, password: agentPass, role: 'AGENT', phone: '+966-50-111-1001', companyName: tenant.name } }),
      prisma.user.create({ data: { tenantId: tenant.id, name: `${tenant.slug}-agent-2`, email: `agent2@${tenant.slug}.local`, password: agentPass, role: 'AGENT', phone: '+966-50-111-1002', companyName: tenant.name } }),
    ]);

    // Customers
    const custPass = await bcrypt.hash('Customer@1234', 12);
    const customers = await Promise.all([
      prisma.user.create({ data: { tenantId: tenant.id, name: 'Abdullah Customer', email: `abdullah@${tenant.slug}.local`, password: custPass, role: 'CUSTOMER', phone: '+966-50-100-1001' } }),
      prisma.user.create({ data: { tenantId: tenant.id, name: 'Maryam Customer', email: `maryam@${tenant.slug}.local`, password: custPass, role: 'CUSTOMER', phone: '+966-55-100-1002' } }),
      prisma.user.create({ data: { tenantId: tenant.id, name: 'Ibrahim Customer', email: `ibrahim@${tenant.slug}.local`, password: custPass, role: 'CUSTOMER', phone: '+966-54-100-1003' } }),
    ]);

    // Hotels
    const makkahHotels = await Promise.all([
      prisma.hotel.create({ data: { tenantId: tenant.id, name: 'Swissotel Al Maqam Makkah', city: 'MAKKAH', stars: 5, address: 'Abraj Al-Bait Towers, Makkah 24231', description: 'Luxury hotel steps from Masjid Al-Haram', amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Prayer Room'], distanceToHaramMeters: 100 } }),
      prisma.hotel.create({ data: { tenantId: tenant.id, name: 'Hilton Suites Makkah', city: 'MAKKAH', stars: 5, address: 'Ibrahim Al-Khalil Street, Makkah', description: 'Premium suites with Haram views', amenities: ['WiFi', 'Gym', 'Restaurant', 'Room Service'], distanceToHaramMeters: 250 } }),
      prisma.hotel.create({ data: { tenantId: tenant.id, name: 'Al Safwah Royal Orchid', city: 'MAKKAH', stars: 4, address: 'Ajyad Street, Makkah', description: 'Comfortable hotel near Masjid Al-Haram', amenities: ['WiFi', 'Restaurant', 'Prayer Room', 'Laundry'], distanceToHaramMeters: 600 } }),
    ]);
    const madinahHotels = await Promise.all([
      prisma.hotel.create({ data: { tenantId: tenant.id, name: 'Anwar Al Madinah Mövenpick', city: 'MADINAH', stars: 5, address: 'King Fahd Road, Madinah', description: 'Luxury hotel adjacent to Masjid An-Nabawi', amenities: ['WiFi', 'Pool', 'Spa', 'Multiple Restaurants'], distanceToHaramMeters: 150 } }),
      prisma.hotel.create({ data: { tenantId: tenant.id, name: 'Dallah Taibah Hotel', city: 'MADINAH', stars: 4, address: 'Masjid Al Nabawi District, Madinah', description: 'Excellent location near Prophet\'s Mosque', amenities: ['WiFi', 'Restaurant', 'Prayer Room', 'Shuttle'], distanceToHaramMeters: 400 } }),
      prisma.hotel.create({ data: { tenantId: tenant.id, name: 'Al Eiman Taibah Hotel', city: 'MADINAH', stars: 3, address: 'Central Area, Madinah', description: 'Budget-friendly option near Prophet\'s Mosque', amenities: ['WiFi', 'Restaurant', 'Prayer Room'], distanceToHaramMeters: 800 } }),
    ]);

    // Vehicles
    const platePrefix = tenant.slug === 'alrashidi' ? 'AR' : 'HT';
    const vehicles = await Promise.all([
      prisma.vehicle.create({ data: { tenantId: tenant.id, name: 'Mercedes Sprinter', plateNumber: `${platePrefix}-BUS-001`, type: 'BUS', capacity: 20, driverName: 'Ali Al-Zahrawi', driverPhone: '+966-55-201-1001', driverLicense: 'DL-SAU-001' } }),
      prisma.vehicle.create({ data: { tenantId: tenant.id, name: 'Toyota Coaster', plateNumber: `${platePrefix}-BUS-002`, type: 'BUS', capacity: 30, driverName: 'Hassan Al-Ghamdi', driverPhone: '+966-55-201-1002', driverLicense: 'DL-SAU-002' } }),
      prisma.vehicle.create({ data: { tenantId: tenant.id, name: 'Land Cruiser VIP', plateNumber: `${platePrefix}-VIP-001`, type: 'VIP', capacity: 6, driverName: 'Fahad Al-Otaibi', driverPhone: '+966-55-201-1003', driverLicense: 'DL-SAU-003' } }),
      prisma.vehicle.create({ data: { tenantId: tenant.id, name: 'Toyota Camry', plateNumber: `${platePrefix}-CAR-001`, type: 'CAR', capacity: 4, driverName: 'Nasser Al-Qahtani', driverPhone: '+966-55-201-1004' } }),
      prisma.vehicle.create({ data: { tenantId: tenant.id, name: 'GMC Yukon VIP', plateNumber: `${platePrefix}-VIP-002`, type: 'VIP', capacity: 8, driverName: 'Saad Al-Dosari', driverPhone: '+966-55-201-1005' } }),
    ]);

    // Routes
    const routes = await Promise.all([
      prisma.route.create({ data: { tenantId: tenant.id, name: 'JED → Makkah', fromLocation: 'King Abdulaziz Intl (JED)', toLocation: 'Makkah City Center', description: 'Airport to Makkah hotel', vehicleId: vehicles[0].id } }),
      prisma.route.create({ data: { tenantId: tenant.id, name: 'Makkah → Madinah', fromLocation: 'Makkah Hotel', toLocation: 'Madinah Hotel', description: 'Intercity transfer', vehicleId: vehicles[1].id } }),
      prisma.route.create({ data: { tenantId: tenant.id, name: 'Madinah → MED Airport', fromLocation: 'Madinah Hotel', toLocation: 'Prince Mohammed Bin Abdulaziz (MED)', description: 'Return transfer', vehicleId: vehicles[0].id } }),
      prisma.route.create({ data: { tenantId: tenant.id, name: 'Haram Shuttle', fromLocation: 'Hotel', toLocation: 'Masjid Al-Haram', description: 'Daily shuttle to mosque', vehicleId: vehicles[3].id } }),
      prisma.route.create({ data: { tenantId: tenant.id, name: 'Ziyarat Tour Makkah', fromLocation: 'Makkah Hotel', toLocation: 'Holy Sites', description: 'Sightseeing tour', vehicleId: vehicles[2].id } }),
    ]);

    // Catering
    const vendors = await Promise.all([
      prisma.cateringVendor.create({ data: { tenantId: tenant.id, name: 'Al-Noor Catering', contactName: 'Rashid Al-Noor', phone: '+966-12-301-1001', email: 'info@alnoor.local', address: 'Makkah Industrial Area', speciality: 'Arabic & International' } }),
      prisma.cateringVendor.create({ data: { tenantId: tenant.id, name: 'Barakah Foods', contactName: 'Kareem Barakah', phone: '+966-14-301-1002', email: 'info@barakah.local', address: 'Madinah Food Park', speciality: 'Halal Buffet' } }),
    ]);
    const mealPlans = await Promise.all([
      prisma.mealPlan.create({ data: { vendorId: vendors[0].id, name: 'Standard Breakfast', mealType: 'BREAKFAST', description: 'Buffet breakfast', pricePerPax: 35 } }),
      prisma.mealPlan.create({ data: { vendorId: vendors[0].id, name: 'Arabic Lunch Box', mealType: 'LUNCH', description: 'Rice, chicken/lamb, salad', pricePerPax: 55 } }),
      prisma.mealPlan.create({ data: { vendorId: vendors[1].id, name: 'Premium Dinner Buffet', mealType: 'DINNER', description: 'Full buffet', pricePerPax: 75 } }),
    ]);

    // Packages
    const packages = [];
    packages.push(await prisma.package.create({
      data: {
        tenantId: tenant.id,
        name: '7-Night Umrah — Standard',
        description: '3 nights Madinah + 4 nights Makkah, 4-star hotels, full board.',
        durationDays: 7, transportIncluded: true, cateringIncluded: true, visaIncluded: true, airportTransfer: true,
        priceTiers: { create: [
          { tierName: 'Quad (4 sharing)', pricePerPax: 4500, roomType: 'QUAD', minPax: 4 },
          { tierName: 'Triple (3 sharing)', pricePerPax: 5500, roomType: 'TRIPLE', minPax: 3 },
          { tierName: 'Double (2 sharing)', pricePerPax: 7000, roomType: 'DOUBLE', minPax: 2 },
          { tierName: 'Single', pricePerPax: 10000, roomType: 'SINGLE', minPax: 1 },
        ]},
        packageHotels: { create: [
          { hotelId: madinahHotels[1].id, city: 'MADINAH', nights: 3 },
          { hotelId: makkahHotels[2].id, city: 'MAKKAH', nights: 4 },
        ]},
        agents: { connect: agents.map((a) => ({ id: a.id })) },
      },
    }));
    packages.push(await prisma.package.create({
      data: {
        tenantId: tenant.id,
        name: '10-Night Umrah — Premium',
        description: '4 nights Madinah + 6 nights Makkah, 5-star hotels close to Haram.',
        durationDays: 10, transportIncluded: true, cateringIncluded: true, visaIncluded: true, airportTransfer: true,
        priceTiers: { create: [
          { tierName: 'Quad', pricePerPax: 9500, roomType: 'QUAD', minPax: 4 },
          { tierName: 'Double', pricePerPax: 14000, roomType: 'DOUBLE', minPax: 2 },
          { tierName: 'Single', pricePerPax: 22000, roomType: 'SINGLE', minPax: 1 },
        ]},
        packageHotels: { create: [
          { hotelId: madinahHotels[0].id, city: 'MADINAH', nights: 4 },
          { hotelId: makkahHotels[0].id, city: 'MAKKAH', nights: 6 },
        ]},
        agents: { connect: [{ id: agents[0].id }] },
      },
    }));

    // Bookings — spread across recent days so Report A and Report B have data
    const today = new Date();
    const day = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); d.setHours(10, 0, 0, 0); return d; };
    const bookingSpec = [
      { customerIdx: 0, agentIdx: 0, pkgIdx: 0, status: 'CONFIRMED', from: day(0),  to: day(7),  pax: 4, amount: 18000 },
      { customerIdx: 1, agentIdx: 0, pkgIdx: 0, status: 'CONFIRMED', from: day(0),  to: day(7),  pax: 2, amount: 14000 },
      { customerIdx: 2, agentIdx: 1, pkgIdx: 1, status: 'CONFIRMED', from: day(1),  to: day(11), pax: 3, amount: 28500 },
      { customerIdx: 0, agentIdx: 1, pkgIdx: 0, status: 'TENTATIVE', from: day(2),  to: day(9),  pax: 2, amount: 14000 },
      { customerIdx: 1, agentIdx: 0, pkgIdx: 1, status: 'CONFIRMED', from: day(3),  to: day(13), pax: 1, amount: 22000 },
    ];
    const bookings = [];
    for (const bs of bookingSpec) {
      const tier = await prisma.priceTier.findFirst({ where: { packageId: packages[bs.pkgIdx].id } });
      const ref = `${tenant.slug.toUpperCase().substring(0, 4)}-${Date.now().toString().slice(-6)}${bookings.length}`;
      const b = await prisma.booking.create({
        data: {
          tenantId: tenant.id,
          bookingRef: ref,
          customerId: customers[bs.customerIdx].id,
          agentId: agents[bs.agentIdx].id,
          packageId: packages[bs.pkgIdx].id,
          priceTierId: tier.id,
          status: bs.status,
          travelDateFrom: bs.from,
          travelDateTo: bs.to,
          totalPax: bs.pax,
          totalAmount: bs.amount,
          currency: 'SAR',
        },
      });
      bookings.push(b);

      const invoiceNo = `INV-${tenant.slug.toUpperCase().substring(0,4)}-${Date.now().toString().slice(-6)}${bookings.length}`;
      const vatAmt = Math.round(bs.amount * 0.15 * 100) / 100;
      await prisma.invoice.create({
        data: {
          tenantId: tenant.id, bookingId: b.id, invoiceNo,
          totalAmount: bs.amount, paidAmount: 0, balance: bs.amount,
          vatAmount: vatAmt, currency: 'SAR', status: 'PENDING',
        },
      });
    }

    // Passengers for the first 2 bookings
    await prisma.passenger.createMany({
      data: [
        { bookingId: bookings[0].id, fullName: 'Abdullah Al-Customer', passportNo: 'SA1000001', nationality: 'Saudi Arabian', dateOfBirth: new Date('1975-05-15'), gender: 'MALE', phone: customers[0].phone, isPrimary: true, passportExpiry: new Date('2030-06-01') },
        { bookingId: bookings[0].id, fullName: 'Fatima Al-Customer', passportNo: 'SA1000002', nationality: 'Saudi Arabian', dateOfBirth: new Date('1978-08-22'), gender: 'FEMALE', isPrimary: false, mahramName: 'Abdullah Al-Customer', mahramRelation: 'HUSBAND', passportExpiry: new Date('2030-06-01') },
        { bookingId: bookings[0].id, fullName: 'Omar Al-Customer', passportNo: 'SA1000003', nationality: 'Saudi Arabian', dateOfBirth: new Date('2000-03-10'), gender: 'MALE', isPrimary: false, passportExpiry: new Date('2030-06-01') },
        { bookingId: bookings[0].id, fullName: 'Nora Al-Customer', passportNo: 'SA1000004', nationality: 'Saudi Arabian', dateOfBirth: new Date('2002-11-30'), gender: 'FEMALE', isPrimary: false, mahramName: 'Abdullah Al-Customer', mahramRelation: 'FATHER', passportExpiry: new Date('2030-06-01') },
        { bookingId: bookings[1].id, fullName: 'Maryam Customer', passportNo: 'SA2000001', nationality: 'Saudi Arabian', dateOfBirth: new Date('1985-02-14'), gender: 'FEMALE', isPrimary: true, mahramName: 'Khalil Customer', mahramRelation: 'HUSBAND', passportExpiry: new Date('2029-12-01') },
        { bookingId: bookings[1].id, fullName: 'Khalil Customer', passportNo: 'SA2000002', nationality: 'Saudi Arabian', dateOfBirth: new Date('1983-07-20'), gender: 'MALE', isPrimary: false, passportExpiry: new Date('2029-12-01') },
      ],
    });

    // Transport assignments — at varied times today/tomorrow/etc. so reports have data
    const ts = (dayOffset, hour, minute = 0) => { const d = new Date(today); d.setDate(d.getDate() + dayOffset); d.setHours(hour, minute, 0, 0); return d; };
    await prisma.bookingTransport.createMany({
      data: [
        { bookingId: bookings[0].id, vehicleId: vehicles[0].id, routeId: routes[0].id, departureAt: ts(0, 8, 0),  arrivalAt: ts(0, 9, 30) },
        { bookingId: bookings[1].id, vehicleId: vehicles[0].id, routeId: routes[0].id, departureAt: ts(0, 8, 0),  arrivalAt: ts(0, 9, 30) },
        { bookingId: bookings[2].id, vehicleId: vehicles[1].id, routeId: routes[1].id, departureAt: ts(1, 14, 0), arrivalAt: ts(1, 19, 0) },
        { bookingId: bookings[3].id, vehicleId: vehicles[2].id, routeId: routes[0].id, departureAt: ts(2, 10, 0), arrivalAt: ts(2, 11, 30) },
        { bookingId: bookings[4].id, vehicleId: vehicles[4].id, routeId: routes[4].id, departureAt: ts(3, 16, 0), arrivalAt: ts(3, 18, 0) },
      ],
    });

    // Vouchers + a payment for the first booking
    await prisma.voucher.create({ data: { tenantId: tenant.id, bookingId: bookings[0].id, type: 'CONFIRMED', voucherNo: `CON-${tenant.slug}-001` } });
    await prisma.payment.create({ data: { tenantId: tenant.id, bookingId: bookings[0].id, amount: 18000, method: 'BANK_TRANSFER', status: 'PAID', reference: 'TRF-2026-001' } });
    await prisma.invoice.updateMany({ where: { bookingId: bookings[0].id }, data: { paidAmount: 18000, balance: 0, status: 'PAID' } });

    console.log(`   ✓ ${tenant.slug}: 1 admin, 2 agents, 3 customers, 6 hotels, 5 vehicles, 5 routes, 2 packages, ${bookings.length} bookings`);
  }

  // Seed both tenants
  await seedTenantOperations(tenant1, 'admin@alrashidi.sa', 'Admin@1234');
  await seedTenantOperations(tenant2, 'admin@hamdan-tours.com', 'Admin@1234');

  console.log('\n🎉 Seeding complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Login Credentials');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('👑 SUPER ADMIN (sees all tenants):');
  console.log('   superadmin@safremanasik.com / Super@2026!');
  console.log('');
  console.log('🏢 Tenant: Al-Rashidi Travel (alrashidi)');
  console.log('   admin@alrashidi.sa       / Admin@1234');
  console.log('   agent1@alrashidi.local   / Agent@1234');
  console.log('   abdullah@alrashidi.local / Customer@1234');
  console.log('');
  console.log('🏢 Tenant: Hamdan Tours (hamdan-tours) [TRIAL]');
  console.log('   admin@hamdan-tours.com   / Admin@1234');
  console.log('   agent1@hamdan-tours.local / Agent@1234');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
