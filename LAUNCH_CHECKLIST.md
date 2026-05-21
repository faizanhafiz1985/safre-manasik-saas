# Safre Manasik – Launch Checklist

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+ running locally (or Docker)
- Git

---

## STEP 1: Database Setup

### Option A – Docker (Recommended)
```bash
docker run -d \
  --name safre_postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=SafreManasik@2024 \
  -e POSTGRES_DB=safre_manasik \
  -p 5432:5432 \
  postgres:16-alpine
```

### Option B – Local PostgreSQL
```sql
CREATE DATABASE safre_manasik;
```

---

## STEP 2: Backend Setup

```bash
cd "backend"

# Install dependencies
npm install

# Copy environment file
copy .env.example .env
# Edit .env and set your DATABASE_URL, JWT_SECRET

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed database with sample data
node seeds/seed.js
```

Expected output:
```
✅ System configs created
✅ Admin user created: admin@safremanasik.com / Admin@1234
✅ 5 agents created
✅ 10 customers created
✅ 6 hotels created (3 Makkah + 3 Madinah)
✅ 5 vehicles created
✅ 3 catering vendors created
✅ 5 packages created
✅ 10 bookings created
✅ Payments and invoices updated
🎉 Seeding complete!
```

```bash
# Start backend server
npm run dev
# → API running at http://localhost:5000
```

---

## STEP 3: Frontend Setup

```bash
cd "frontend"

# Install dependencies
npm install

# Start development server
npm start
# → App running at http://localhost:3000
```

---

## STEP 4: Login and Test

Open `http://localhost:3000` and login with:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@safremanasik.com | Admin@1234 |
| **Agent** | ahmed@alrashidi.sa | Agent@1234 |
| **Customer** | abdullah@email.com | Customer@1234 |

---

## STEP 5: Docker Full Stack (Production-like)

```bash
# From project root
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- DB Studio: `cd backend && npx prisma studio`

---

## Pre-Launch Security Checklist

- [ ] **JWT_SECRET** set to strong random value (min 32 chars)
- [ ] **DATABASE_URL** uses strong password
- [ ] **.env** files are in `.gitignore` — never committed
- [ ] Rate limiting active (already configured: 500 req/15min API, 20 req/15min auth)
- [ ] CORS `FRONTEND_URL` set to your actual domain
- [ ] `NODE_ENV=production` in production environment
- [ ] HTTPS/TLS configured at proxy/load-balancer level
- [ ] Database backups configured

## Pre-Launch Functional Checklist

- [ ] Admin can login and see dashboard stats
- [ ] Admin can create/edit packages with hotel assignments and price tiers
- [ ] Agent can create bookings and add passengers
- [ ] Admin can change booking status (Tentative → Confirmed)
- [ ] Voucher preview renders correctly in browser
- [ ] Voucher PDF downloads (requires Puppeteer/Chromium)
- [ ] Payment recording updates invoice balance correctly
- [ ] System Config page saves and persists all settings
- [ ] Agent login only sees their own bookings
- [ ] Customer login only sees their own bookings
- [ ] All CRUD operations work for Hotels, Transport, Catering

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Run `npx prisma migrate deploy` (not `db push`)
- [ ] Build frontend: `npm run build`
- [ ] Serve frontend via nginx/CDN
- [ ] Configure reverse proxy (nginx/traefik) for API
- [ ] Set up SSL certificates (Let's Encrypt)
- [ ] Configure log rotation for winston logs
- [ ] Set up database connection pooling (PgBouncer or Prisma accelerate)
- [ ] Configure health monitoring at `/health` endpoint
- [ ] Set up automated DB backups (pg_dump cron)
- [ ] Puppeteer chromium available for PDF generation (see Dockerfile)

---

## Useful Commands

```bash
# Reset and re-seed database
cd backend
npx prisma migrate reset --force
node seeds/seed.js

# Open Prisma Studio (DB visual editor)
npx prisma studio

# View API health
curl http://localhost:5000/health

# View backend logs (Docker)
docker logs safre_backend -f
```

---

## Project Structure Summary

```
Safre Manasik Application/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Full DB schema (16 models)
│   ├── seeds/
│   │   └── seed.js                # Realistic seed data
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js        # Prisma client
│   │   │   └── logger.js          # Winston logger
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── bookingController.js
│   │   │   ├── cateringController.js
│   │   │   ├── configController.js
│   │   │   ├── dashboardController.js
│   │   │   ├── hotelController.js
│   │   │   ├── packageController.js
│   │   │   ├── paymentController.js
│   │   │   ├── transportController.js
│   │   │   ├── userController.js
│   │   │   └── voucherController.js
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT + RBAC
│   │   │   ├── errorHandler.js
│   │   │   └── validate.js
│   │   ├── routes/                # All API routes
│   │   ├── services/
│   │   │   └── voucherService.js  # Professional HTML/PDF voucher template
│   │   └── server.js              # Express app entry point
│   ├── .env
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/
│   │   │       ├── Layout.js      # App shell with sidebar + topbar
│   │   │       └── Sidebar.js     # Role-filtered navigation
│   │   ├── context/
│   │   │   └── AuthContext.js     # Auth state management
│   │   ├── pages/
│   │   │   ├── LoginPage.js
│   │   │   ├── RegisterPage.js
│   │   │   ├── DashboardPage.js   # Stats, charts, recent bookings
│   │   │   ├── PackagesPage.js    # CRUD + price tiers + hotel assignment
│   │   │   ├── BookingsPage.js    # List + filters + create
│   │   │   ├── BookingDetailPage.js # Full detail + status + payment + voucher
│   │   │   ├── TransportPage.js   # Vehicles + Routes
│   │   │   ├── CateringPage.js    # Vendors + Meal Plans
│   │   │   ├── HotelsPage.js
│   │   │   ├── VouchersPage.js    # Generate + Preview + Download
│   │   │   ├── PaymentsPage.js
│   │   │   ├── UsersPage.js       # Admin only
│   │   │   ├── AdminConfigPage.js # System configuration
│   │   │   └── ProfilePage.js
│   │   ├── services/
│   │   │   └── api.js             # Axios + interceptors
│   │   ├── utils/
│   │   │   └── helpers.js         # formatCurrency, formatDate, statusChip
│   │   ├── theme.js               # Material UI theme
│   │   └── App.js                 # Routes + PrivateRoute
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml
├── API_DOCUMENTATION.md
└── LAUNCH_CHECKLIST.md
```
