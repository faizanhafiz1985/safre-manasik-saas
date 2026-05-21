---
name: Safre Manasik Application
description: Complete Umrah Travel Management System — tech stack, architecture, credentials, and structure
type: project
---

Full production-ready multi-tenant SaaS Umrah Travel Management platform (v2.0). Built from a single-tenant base in May 2026.

**Why:** User needed complete, runnable SaaS system for a real Umrah travel agency business serving multiple operators.

**Multi-tenancy approach:** Row-level isolation via Prisma `$use` middleware + `AsyncLocalStorage` context. Every tenant-owned model has a `tenantId` column; middleware auto-injects on writes and auto-filters on reads. SUPER_ADMIN role bypasses filtering. Update/delete are converted to updateMany/deleteMany so the tenantId filter can be added — controllers refetch via findFirst when they need the record back.

**Tech Stack:**
- Backend: Node.js + Express + Prisma ORM + PostgreSQL
- Frontend: React 18 + Material UI v5 + React Hook Form + Chart.js
- Auth: JWT (bcryptjs hashing)
- PDF: Puppeteer (HTML fallback if Chromium unavailable)
- Docker: docker-compose with PostgreSQL + backend + frontend (nginx)

**Key Credentials (demo/dev):**
- SUPER_ADMIN (sees all tenants): superadmin@safremanasik.com / Super@2026!
- Tenant alrashidi admin: admin@alrashidi.sa / Admin@1234
- Tenant alrashidi agent: agent1@alrashidi.local / Agent@1234
- Tenant alrashidi customer: abdullah@alrashidi.local / Customer@1234
- Tenant hamdan-tours admin: admin@hamdan-tours.com / Admin@1234

**Structure:**
- `backend/prisma/schema.prisma` — 16 Prisma models
- `backend/src/server.js` — Express entry point
- `backend/seeds/seed.js` — Full realistic seed data
- `backend/src/services/voucherService.js` — Professional PDF voucher HTML template
- `frontend/src/App.js` — React routes with role-based PrivateRoute
- `docker-compose.yml` — Full stack Docker setup

**Modules:** Auth, Users (RBAC), Packages, Bookings, Transport, Catering, Hotels, Vouchers (PDF), Payments/Invoices, Dashboard, Admin Config

**How to apply:** Run `npm install` in both backend/ and frontend/, then `npx prisma db push && node seeds/seed.js` in backend/, then `npm run dev` / `npm start`.

**Payment gateway:** PayPal (via `@paypal/checkout-server-sdk`). Sandbox + live mode supported. Falls back to stub if `PAYPAL_CLIENT_ID/SECRET` are not set. PayPal doesn't support SAR, so backend auto-converts SAR→USD at 3.75 peg. Endpoints: `/api/payments/gateway/paypal/{config,create-order,capture-order,webhook}`. Frontend has a "Pay with PayPal" button on the booking detail page and `/payment/paypal/success` capture page.

**Deployment target:** Railway (PaaS that deploys from GitHub). Each service has `railway.json`. Backend Dockerfile runs `prisma db push` on startup. Frontend nginx.conf uses `${PORT}` from Railway. Custom domains configured via Dynadot DNS (CNAMEs).

**Go-live docs:** `GO_LIVE.md` is the entry point. References `SETUP_RAILWAY.md`, `SETUP_DYNADOT_DNS.md`, `SETUP_PAYPAL.md`. End-to-end smoke checklist included.
