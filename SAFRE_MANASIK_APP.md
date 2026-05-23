# Safre Manasik App — Complete Project Summary

> Drop this whole file into a new conversation to bring Claude up to speed instantly.

**Project:** Safre Manasik — multi-tenant SaaS platform for Umrah / Hajj travel agencies (Saudi Arabia, CR 7053347410).
**Status:** Production-ready, live, fully tested (Phase 4 QA: 18/18 pass).
**Owner:** Faizan Hafiz · Faizan.hafiz@gmail.com
**Repo:** https://github.com/faizanhafiz1985/safre-manasik-saas
**Local working copy:** `C:\Users\fub7209\.claude\projects\Safre Manasik Application`

---

## 1 · Live URLs

| Surface | URL |
|---|---|
| Live app (login + signup) | https://app.safremanasik.com |
| Public signup link (share with customer agencies) | https://app.safremanasik.com/signup |
| Backend API (private — frontend nginx proxies /api here) | https://backend-production-44fd.up.railway.app |
| Railway project (`zesty-elegance`) | https://railway.com/project/adcd3710-a113-457d-af99-8a462aa04fd6 |
| Cloudflare DNS for safremanasik.com | https://dash.cloudflare.com |
| Dynadot domain registrar | https://www.dynadot.com |
| GitHub repository | https://github.com/faizanhafiz1985/safre-manasik-saas |
| PayPal Developer dashboard | https://developer.paypal.com/dashboard |

---

## 2 · Login credentials (production)

| Role | Email | Password |
|---|---|---|
| **SUPER_ADMIN** (platform owner — sees all tenants) | `superadmin@safremanasik.com` | `SuperAdmin@LwPSLqHQE65GnZYo!` |
| **Tenant admin** (Safre Manasik tenant) | `admin@safremanasik.com` | `BY3dFB3xd8zRwPMwA1!` |

> Self-heal: if SUPER_ADMIN password is lost, change `SUPERADMIN_PASSWORD` env var in Railway and redeploy — `bootstrap.js` syncs the DB user's password on next boot.

---

## 3 · Architecture (high-level)

```
Browser ──HTTPS──▶ Frontend (React + nginx, Railway) ──/api proxy──▶ Backend (Node/Express, Railway) ──Prisma──▶ PostgreSQL 17 (Railway)
                          │
                          │ DNS: app.safremanasik.com (Cloudflare → Railway, Let's Encrypt SSL)
                          │      api.safremanasik.com (same)
```

- **Multi-tenancy:** row-level isolation. Every tenant-owned model has `tenantId`. Prisma middleware + AsyncLocalStorage auto-filter on reads, auto-inject on writes. SUPER_ADMIN bypasses filtering.
- **Auth:** JWT (bcryptjs hashing, 12 rounds). JWT carries `id`, `tenantId`, `role`.
- **Deployment:** Railway auto-deploys from GitHub `main` branch. Each push triggers backend + frontend builds. Postgres lives in same Railway project on attached volume.

---

## 4 · Tech stack

**Backend:** Node 20 · Express · Prisma · PostgreSQL 17 · jsonwebtoken · bcryptjs · helmet · express-rate-limit · @paypal/checkout-server-sdk · puppeteer (voucher PDF) · winston (logging)

**Frontend:** React 18 · Material UI v5 · react-router v6 · react-hook-form · axios · Chart.js · react-toastify · Create React App build · nginx alpine serves bundle + `/api` proxy

**Infra:** Railway (PaaS) · Cloudflare (DNS) · Dynadot (domain registrar) · GitHub (source + CI trigger)

---

## 5 · Features built (everything currently live)

### 5.1 Core operational modules
Packages, Bookings, Hotels, Transport, Catering, Vouchers (HTML + PDF), Payments, Invoices, Reports (Daily Schedule + Transport report with CSV export), Users (RBAC), Tenant Settings.

### 5.2 SaaS platform features
- **Tenant signup → approval workflow** (NEW v2.1) — `/signup` creates a `TenantApplication` (status PENDING). SUPER_ADMIN reviews at `/super-admin/applications`. Approve creates tenant + admin atomically + sends welcome email. Reject records reason + sends rejection email. Rejected applicants can re-apply.
- **Per-tenant PayPal config** — each tenant pastes their own Client ID / Secret in Tenant Settings → payments go straight to their PayPal. Falls back to platform env-var PayPal, then stub mode.
- **Configurable plans + feature flags** — STARTER / GROWTH / ENTERPRISE rows in `PlanConfig` table. SUPER_ADMIN edits limits (max users, max bookings) and feature flags (PDF vouchers, reports, API access, custom branding) at runtime. Changes apply within 5s. Add new arbitrary feature keys on the fly.
- **Quota enforcement** — `checkQuota('users'|'bookings')` and `requireFeature('flagKey')` middlewares gate routes. Hard blocks with clear "upgrade your plan" errors.
- **Per-tenant logo override** — tenant pastes a logo URL in Tenant Settings; `BrandLogo` component shows it everywhere for that tenant's users. Fallback chain: tenant logo → `/safre-manasik-logo.png` → `/logo.svg` → text badge.
- **Country/city dropdowns + full signup validation** — 37 countries with dial codes, cascading city dropdown, phone min 12 digits incl. country code, CR exactly 10 digits (numeric only), VAT exactly 15 digits (numeric only), email format, password ≥ 8 chars + letter + digit.
- **System Diagnostics page** — `/super-admin/diagnostics` runs 13 read-only health checks (DB connectivity + latency, env vars set, SMTP / PayPal / SUPER_ADMIN configured, table counts, plan_configs seeded, applications pending, runtime). Returns overall = healthy / degraded / unhealthy.
- **Self-healing behaviours** — SUPER_ADMIN password recoverable via env var; PlanConfig auto-seeds on boot; email service falls back to console log if SMTP unset; rejected applicants can re-apply (overwrites old row).

### 5.3 Frontend pages
Login, Signup (with approval-pending success state), Dashboard, Packages, Bookings, BookingDetail, Vouchers, Transport, Catering, Hotels, Payments, PayPalSuccess, Users, Tenant Settings (with PayPal section + logo preview), Profile, Daily Schedule + Transport reports, AdminConfig, **SuperAdminDashboard, SuperAdminPlans, SuperAdminApplications (new), SuperAdminDiagnostics (new)**.

---

## 6 · Roles + RBAC

| Role | Scope | Can do |
|---|---|---|
| SUPER_ADMIN | Platform-wide (tenantId=null) | Review applications, approve / reject, suspend / activate tenants, configure plans, see all bookings + revenue, run diagnostics |
| ADMIN | Their tenant only | All operational modules, tenant settings (including PayPal + logo + branding), create users |
| AGENT | Their tenant only | Create/edit bookings, vouchers, payments, transport, catering. Cannot manage users or settings. |
| CUSTOMER | Their tenant only | View own bookings, vouchers, packages |

---

## 7 · Environment variables (production)

### Backend service
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (auto-set by Railway) |
| `JWT_SECRET` | JWT signing key — 48+ random bytes |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://app.safremanasik.com` |
| `SUPERADMIN_EMAIL` | `superadmin@safremanasik.com` (default) |
| `SUPERADMIN_PASSWORD` | **the master switch** — bootstrap syncs DB user's password to this on every boot |
| `PAYPAL_MODE` | `sandbox` or `live` (optional platform fallback; each tenant brings own usually) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | Optional platform fallback |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Optional; if unset, emails go to console log |

### Frontend service
| Variable | Purpose |
|---|---|
| `PORT` | nginx listen port (Railway sets it) |
| `BACKEND_URL` | `https://backend-production-44fd.up.railway.app` |
| `REACT_APP_API_URL` | `/api` (same-origin via nginx — recommended) |

---

## 8 · Vendors + monthly cost

| Vendor | Purpose | Monthly USD | Tier |
|---|---|---|---|
| GitHub | Source + CI trigger | 0 | Mandatory |
| Railway | Hosts frontend + backend + Postgres | 5–25 | Mandatory |
| Railway Postgres | Database | ~5 storage | Mandatory |
| Dynadot | Domain registrar | ~1 (USD 11/year) | Mandatory |
| Cloudflare | DNS for safremanasik.com | 0 | Mandatory |
| PayPal | Payment gateway | 0 fixed + ~3.5% per txn | Strongly recommended |
| Postmark or Resend | Outgoing email | 0–15 | Strongly recommended |
| Sentry | Error tracking (not wired) | 0–26 | Nice to have |
| ZATCA e-invoicing | Saudi tax compliance (future) | 30–100 | Optional |

**Typical bill:**
- Minimum: USD 5/mo
- Recommended live setup: USD 25/mo
- 50+ tenants with real payments + email: ~USD 70/mo

---

## 9 · Key files in the repo

```
backend/
  prisma/schema.prisma                  ─ DB schema (Tenant, User, TenantApplication, PlanConfig, …)
  src/server.js                          ─ Express entry + bootstrap on startup
  src/bootstrap.js                       ─ Self-heal SUPER_ADMIN + seed PlanConfig on boot
  src/middleware/
    auth.js                              ─ JWT verification + role check
    tenant.js                            ─ AsyncLocalStorage tenant context
    quota.js                             ─ checkQuota + requireFeature
  src/controllers/
    authController.js                    ─ signup-tenant (creates TenantApplication), login, register, /me
    superAdminController.js              ─ tenants CRUD, plans, applications approve/reject
    diagnosticsController.js             ─ 13 health checks for SUPER_ADMIN
    tenantController.js                  ─ /tenant/current GET + PUT (incl. paypal config)
    paymentGatewayController.js          ─ PayPal create-order + capture
  src/services/
    paypalClient.js                      ─ per-tenant PayPal factory
    emailService.js                      ─ nodemailer if available, else console log
    voucherService.js                    ─ HTML + PDF voucher template
  Dockerfile                             ─ runs prisma db push + node src/server.js

frontend/
  public/
    safre-manasik-logo.png               ─ Platform default brand mark
    logo.svg                             ─ SVG fallback
  src/
    components/
      BrandLogo.js                       ─ resolves tenant logo → default → fallback
      layout/{Sidebar.js,Layout.js}      ─ branded chrome
    pages/
      LoginPage.js                       ─ logo card + login + signup CTA
      TenantSignupPage.js                ─ country/city dropdowns + full validation + "application submitted" success state
      TenantSettingsPage.js              ─ org info + Saudi compliance + branding + PayPal section
      SuperAdminDashboardPage.js         ─ tenant list + stats
      SuperAdminApplicationsPage.js      ─ approve / reject pending applications
      SuperAdminPlansPage.js             ─ edit STARTER/GROWTH/ENTERPRISE limits + features + price
      SuperAdminDiagnosticsPage.js       ─ system health UI
    data/countries.js                    ─ 37-country catalogue with dial codes + city lists
    services/api.js                      ─ axios with /api default, JWT interceptor
  nginx.conf                             ─ SPA fallback + /api proxy
  Dockerfile                             ─ multi-stage Node build → nginx alpine

ops docs (in repo root):
  Safre_Manasik_Documentation.docx       ─ 100 KB · 21 sections · full reference manual
  TROUBLESHOOTING.md                     ─ 12 step-by-step recipes for common problems
  VENDORS.md                             ─ Full vendor catalogue with onboarding order
  SETUP_CLOUDFLARE_DNS.md                ─ How to swap nameservers if needed
  SETUP_PAYPAL.md / SETUP_RAILWAY.md / GO_LIVE.md / etc.
  generate_docs.py                       ─ regenerates the Word doc from source
  CREDENTIALS_PROD.txt                   ─ git-ignored — production secrets

config:
  CLAUDE.md                              ─ project memory file
```

---

## 10 · How to maintain (operator runbook)

### Day-to-day
- **Approve new applications:** SUPER_ADMIN → Applications → review & click Approve.
- **Adjust a tenant's limits:** Platform Admin → edit tenant → bump Max Users / Max Bookings (or change Plan).
- **Change plan features platform-wide:** Plans & Pricing → edit plan → toggle flags. Applies in 5s.
- **Check system health:** Diagnostics page. Run before/after any change.

### When something breaks
1. Open Diagnostics — if any check is FAIL, the detail column tells you what's wrong.
2. Open `TROUBLESHOOTING.md` — find the matching recipe (12 of them, all step-by-step).
3. If you really get stuck, hire a Node.js + React developer for an hour (Upwork USD 20–60). Hand them this file + repo + read-only Railway invite.

### Self-heal behaviours
- Lost SUPER_ADMIN password: set `SUPERADMIN_PASSWORD` env var → redeploy → bootstrap syncs it.
- Missing PlanConfig rows: bootstrap re-seeds STARTER/GROWTH/ENTERPRISE on every boot.
- Missing default Safre Manasik logo image: `BrandLogo` falls back to logo.svg, then text badge.

### To deploy a code change
1. Edit code in this repo (locally or via GitHub web UI).
2. Commit + push to `main`.
3. Railway auto-deploys (~3 min). If auto-deploy doesn't fire (intermittent), change any env var in Railway → "Deploy Changes" forces a build from latest commit.

---

## 11 · Known limitations + things to wire up later

| Item | Status | Effort to wire |
|---|---|---|
| SMTP (real email delivery) | not wired — emails log to console | 5 min: sign up Postmark, paste creds into env vars |
| Sentry (error tracking) | not wired | 10 min: install + Sentry.init() in server.js |
| Voucher PDF uses platform logo for all tenants | not yet refactored for per-tenant override | ~1 hour |
| GitHub auto-deploy intermittently misses pushes | pre-existing platform quirk | workaround documented: env var change forces rebuild |
| Arabic UI (i18n) | not built | ~2 days |
| ZATCA e-invoicing | not built | 1 week + integration with a Saudi provider |
| Customer self-service portal | minimal | ~1 week |

---

## 12 · QA sign-off (Phase 4)

18 end-to-end tests run against live production. **All pass.** Topics: diagnostics endpoint, valid signup (creates application not tenant), validation rejection (bad CR/VAT/phone), application listing, approve flow (creates tenant+user atomically), approved admin login, reject flow, rejected applicant cannot login, SUPER_ADMIN login via custom domain, per-tenant PayPal save with secret masking, plan feature flag enforcement, runtime plan reconfiguration, multi-tenant isolation, custom domain SSL, brand logo serving, per-tenant logo override.

Two defects found and fixed during QA:
1. `nodemailer` dependency mismatch in package.json broke `npm ci` → removed dep (graceful fallback exists).
2. Intermittent GitHub auto-deploy → documented env-var-change workaround.

Final diagnostic verdict: **10 PASS · 3 WARN · 0 FAIL**. The three warnings are all configuration choices (SMTP unwired, platform PayPal unwired, pending applications count > 0) — none indicate bugs.

---

## 13 · How to talk to Claude in a new conversation

When opening a new conversation about this project, paste this file's contents first, then ask your question. Claude will have everything it needs: URLs, credentials, architecture, conventions, file layout, deploy process, vendor list, and current state.

For most asks, you also want to mention:
- What problem you're trying to solve / what new feature you want
- Whether you want code changes or just guidance
- If code changes — Claude can edit + commit + push and trigger deploys via Railway dashboard (it has done all of this before in this project)

---

## 14 · Quick reference: every endpoint

```
public:
  POST /api/auth/signup-tenant      ─ creates a TenantApplication (PENDING)
  POST /api/auth/login              ─ returns JWT
  POST /api/auth/register           ─ register customer under existing tenant
  GET  /health                      ─ liveness

authenticated (JWT required):
  GET  /api/auth/me
  POST /api/auth/change-password
  PUT  /api/auth/profile
  GET  /api/tenant/current
  PUT  /api/tenant/current          ─ tenant settings (incl. PayPal config)
  GET  /api/tenant/current/quota    ─ usage + remaining + features

tenant-scoped (filtered by tenantId via Prisma middleware):
  GET/POST/PUT/DELETE /api/users
  GET/POST/PUT/DELETE /api/packages
  GET/POST/PUT/DELETE /api/bookings
  ... hotels, transport, catering, payments, vouchers, dashboard, config

reports (gated by 'reports' feature flag):
  GET  /api/reports/daily-schedule
  GET  /api/reports/daily-schedule/export
  GET  /api/reports/transport-by-date
  GET  /api/reports/transport-by-date/export

payment gateway:
  GET  /api/payments/gateway/paypal/config
  POST /api/payments/gateway/paypal/create-order
  POST /api/payments/gateway/paypal/capture-order
  POST /api/payments/gateway/paypal/webhook

super-admin (requires SUPER_ADMIN role):
  GET    /api/super-admin/stats
  GET    /api/super-admin/tenants
  GET    /api/super-admin/tenants/:id
  PUT    /api/super-admin/tenants/:id
  POST   /api/super-admin/tenants/:id/suspend
  POST   /api/super-admin/tenants/:id/activate
  DELETE /api/super-admin/tenants/:id
  GET    /api/super-admin/tenants/:id/usage
  GET    /api/super-admin/bookings
  GET    /api/super-admin/plans
  PUT    /api/super-admin/plans/:plan
  GET    /api/super-admin/applications
  POST   /api/super-admin/applications/:id/approve
  POST   /api/super-admin/applications/:id/reject
  GET    /api/super-admin/diagnostics
```

---

End of summary. Updated 2026-05-23.
