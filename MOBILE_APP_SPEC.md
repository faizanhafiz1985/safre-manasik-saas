# Safre Manasik — Mobile App Build Specification (Android & iOS)

> Single source of truth for building a **fully functional native mobile app** (Android + iOS)
> on top of the existing Safre Manasik backend. A mobile team or a code‑generation tool should
> be able to build the apps from this document alone. Nothing here requires backend changes
> except where explicitly called out in **§16 Backend gaps for mobile**.

- **Product:** Safre Manasik — multi‑tenant SaaS for Umrah/Hajj travel agencies (bookings, vouchers, invoices, hotels, transport/fleet, catering, payments, CRM).
- **Backend:** Node.js/Express + Prisma + PostgreSQL (hosted on Railway).
- **Existing web app:** React 18 + MUI (reference for screens/behaviour).
- **API base URL (production):** `https://api.safremanasik.com/api`
- **Web app (reference UI):** `https://app.safremanasik.com`
- **Auth:** JWT bearer. Web tokens last 7 days. **Mobile clients get a short‑lived access token (1h) + a rotating refresh token** (see §4) by logging in with `{ "client": "mobile" }`.
- **Push:** FCM (Android + iOS via APNs) — register device tokens at `POST /devices`; server pushes on booking‑status and payment events (see §13a).

---

## 1. Scope & app editions

The platform has distinct user roles. Recommended approach: **one app, role‑adaptive UI** (the
navigation/screens shown are driven by the authenticated user's effective permissions returned by
`GET /auth/me`). The same binary serves:

| Audience | Role(s) | Primary use on mobile |
|---|---|---|
| **Pilgrim / Customer** | `CUSTOMER` | Browse packages, view own bookings, download vouchers/invoices, pay online, profile |
| **Agency staff** | `ADMIN`, `AGENT` | Create/manage bookings, customers, vouchers, payments, hotels, transport, CRM, reports |
| **Driver** | `DRIVER` (custom role) | See assigned vehicle, log trips/odometer, submit cash, confirm maintenance |
| Platform owner | `SUPER_ADMIN` | (Optional) tenant administration — usually web‑only |

> Build the Customer experience and the Staff experience as two top‑level flows selected by role
> after login. Driver is a thin subset of Staff (Fleet only).

---

## 2. Architecture & conventions

### 2.1 Base URL & environments
- Production API: `https://api.safremanasik.com/api`
- The app should read the base URL from build config (`API_BASE_URL`) so staging can be swapped.
- All paths in this doc are relative to the API base (e.g. `POST /auth/login` → `https://api.safremanasik.com/api/auth/login`).

### 2.2 Auth header
- Every authenticated request: `Authorization: Bearer <jwt>`.
- Content type: `application/json` for request bodies.

### 2.3 Multi‑tenancy
- Tenant is **encoded in the JWT** (`tenantId`) — the server auto‑scopes all data to the caller's tenant. The app never sends tenantId.
- **Registration** (customer self‑signup) requires the agency's `tenantSlug` (e.g. `safre-manasik-1`).
- Tenant branding (logo, primary colour, name, plan) is returned inside the user object (`user.tenant`) on login and `/auth/me`.

### 2.4 Standard response shapes
- **Success (single):** the entity JSON, or `{ "message": "..." }`.
- **Success (list, paginated):** `{ "data": [ ... ], "total": <int>, "page": <int>, "pages": <int> }`.
- **Success (list, simple):** sometimes a bare array `[ ... ]` (e.g. `/transport/vehicles`, `/hotels`) or `{ data, total }` without page (e.g. `/users/customers`). Handle both: `Array.isArray(res) ? res : res.data`.
- **Error:** `{ "error": "Human readable message" }` with an appropriate HTTP status.

### 2.5 HTTP status codes
- `200` OK · `201` Created · `400` validation error (read `error`) · `401` invalid/expired token (→ force re‑login) · `403` no permission / plan feature locked / tenant suspended · `404` not found · `409` conflict (e.g. duplicate email) · `429` rate‑limited.

### 2.6 Rate limits
- Global: **500 requests / 15 min** per IP. Auth endpoints: **30 / 15 min**. Show a friendly "try again shortly" on `429`.

### 2.7 Currency, dates, numbers
- Default currency **SAR** (tenant‑configurable; comes back on entities as `currency`).
- Money fields are decimals (strings or numbers) — parse defensively.
- Dates are ISO‑8601 strings; date‑only inputs use `YYYY-MM-DD`.

---

## 3. Recommended tech stack

Either is acceptable; pick one:

- **React Native + Expo (recommended)** — fastest path to Android + iOS from one codebase; reuses the team's React/JS knowledge from the existing web app. Libraries:
  - Navigation: `@react-navigation/native` (stack + bottom tabs).
  - Networking: `axios` with an interceptor that injects the bearer token and handles `401`.
  - Secure token storage: `expo-secure-store` (Keychain/Keystore) — **never** plain AsyncStorage for the JWT.
  - Forms/validation: `react-hook-form` + the patterns in **§9**.
  - HTML voucher/invoice rendering: `react-native-webview`; PDF download/share: `expo-file-system` + `expo-sharing`.
  - Payments: PayPal/Moyasar via in‑app browser (`expo-web-browser`) or their SDKs (see **§13**).
  - Push: `expo-notifications` (requires backend change — **§16**).
  - i18n/RTL: `i18n-js` + `I18nManager` (Arabic is RTL).
- **Flutter** — equivalent mapping: `dio`, `flutter_secure_storage`, `go_router`, `webview_flutter`, `flutter_localizations`.

---

## 4. Authentication & session flow

| # | Endpoint | Auth | Body (key fields) | Returns |
|---|---|---|---|---|
| Login (web) | `POST /auth/login` | none | `email`, `password` | `{ token(7d), user }` |
| Login (mobile) | `POST /auth/login` | none | `email`, `password`, **`client:"mobile"`** | `{ token(1h), refreshToken(30d), user }` (user includes `role`, `tenantId`, `customRoleId`, `tenant{...}`) |
| **Refresh** | `POST /auth/refresh` | none | `refreshToken` | `{ token(1h), refreshToken }` — **rotating** (old token is revoked; reuse → 401) |
| **Logout** | `POST /auth/logout` | none | `refreshToken` | `{ message }` — revokes the refresh token (idempotent) |
| Current user | `GET /auth/me` | bearer | — | full user **+ `permissions: string[]`** (effective `feature:action` grants) |
| Register device (push) | `POST /devices` | bearer | `token` (FCM), `platform` (`ios`\|`android`\|`web`) | `{ message }` |
| Unregister device | `DELETE /devices/:token` | bearer | — | `{ message }` — call on logout/token change |
| Customer register | `POST /auth/register` | none | `name`, `email`, `password`, `phone`, `tenantSlug`, (`companyName`) | `{ token, user }` |
| Tenant signup | `POST /auth/signup-tenant` | none | `tenantName`, `adminName`, `adminEmail`, `password`, `contactEmail`, `contactPhone` | application submitted (manual approval) |
| Forgot username | `POST /auth/forgot-username` | none | `email` | generic 200 (no enumeration) |
| Forgot password | `POST /auth/forgot-password` | none | `email` | generic 200; emails a reset link/token |
| Reset password | `POST /auth/reset-password` | none | `token`, `password` | `{ message }` |
| Update profile | `PUT /auth/profile` | bearer | `name`, `phone`, `companyName`, `address` | updated user |
| Change password | `PUT /auth/change-password` | bearer | `currentPassword`, `newPassword` | `{ message }` |

**Session rules (mobile)**
1. Login with `{ client: "mobile" }`; store **both** `token` and `refreshToken` in secure storage (Keychain/Keystore).
2. Attach `Authorization: Bearer <token>` on every call; call `/auth/me` once to get role + permissions.
3. On `401`, call `POST /auth/refresh` with the stored `refreshToken`; on success replace **both** tokens and retry the original request. If refresh also fails (`401`), clear tokens and route to Login.
4. Implement this as a single axios/dio response interceptor with a refresh mutex (queue concurrent 401s, refresh once).
5. On logout: `POST /auth/logout` (refreshToken) **and** `DELETE /devices/:token`, then clear storage.
6. On `403 "Tenant suspended"`, show a blocking message and log out.

> Web clients keep the legacy 7‑day token and don't use refresh — both behaviours coexist.

---

## 5. Authorization (RBAC) — drive the UI from permissions

The server returns the user's **effective permissions** as an array of `"<feature>:<action>"`
strings from `GET /auth/me` (field `permissions`). **Gate every screen/button on these**, exactly
as the web app does (show a tab only if `permissions` contains `"<feature>:view"`).

- **Actions:** `view`, `create`, `edit`, `delete`, `export`.
- **Features (catalog):** `dashboard, packages, bookings, vouchers, voucher_forms, hotels, transport, catering, payments, customers, daily_schedule, transport_report, crm_overview, crm_leads, crm_pipeline, crm_tasks, crm_inbox, crm_reports, crm_settings, fleet_dashboard, fleet_trips, fleet_cash, fleet_maintenance, users, roles, tenant_settings, system_config`.
- `crm_*`, `daily_schedule`, `transport_report` are **plan‑gated** (may be absent on STARTER). `users/roles/tenant_settings/system_config/crm_reports/crm_settings` are **admin‑only**.
- Full catalog (with plan‑lock flags) is also available at `GET /rbac/catalog`.

**Default role grants** (built‑in; admins can override per‑tenant with custom roles):
- **ADMIN** — everything.
- **AGENT** — view all operational modules; create/edit `bookings`, `customers`, `voucher_forms`; create `vouchers`, `payments`; export reports; create/edit CRM leads/tasks/pipeline/inbox; fleet trips/cash/maintenance.
- **CUSTOMER** — view `dashboard, packages, bookings, vouchers, hotels, transport, catering, payments` (own data only — server scopes bookings to `customerId`).
- **DRIVER** — view `dashboard, transport`; fleet trips (view/create/edit), cash (view/create), maintenance (view/edit); **own assigned vehicle only**.

> Note: `User.role` enum is `SUPER_ADMIN | ADMIN | AGENT | CUSTOMER`. **DRIVER is a built‑in custom role** (TenantRole) assigned via `customRoleId`, not a base role. Always trust `permissions[]` over role string for gating.

---

## 6. Full API reference (by module)

> Auth column: **B** = bearer required. Permission shown as `feature:action`. Admin/Agent role
> restrictions noted. GET list endpoints accept `?search=`, `?page=`, `?limit=` where applicable.

### 6.1 Dashboard
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/dashboard/stats` | B, ADMIN/AGENT | KPIs (counts, revenue) for the home dashboard |

### 6.2 Packages
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/packages` | B `packages:view` | list packages (with `priceTiers`, `packageHotels`) |
| GET | `/packages/:id` | B `packages:view` | package detail |
| POST | `/packages` | B ADMIN `packages:create` | create |
| PUT | `/packages/:id` | B ADMIN `packages:edit` | update |
| DELETE | `/packages/:id` | B ADMIN `packages:delete` | delete |

### 6.3 Bookings
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/bookings` | B `bookings:view` | list (filters: `status,search,agentId,customerId,dateFrom,dateTo,page,limit`). CUSTOMER auto‑scoped to own. |
| GET | `/bookings/:id` | B `bookings:view` | detail (customer, package, passengers, transports, caterings, hotelTrips, transportTrips, invoice, vouchers) |
| POST | `/bookings` | B ADMIN/AGENT `bookings:create` | create — see body in §17 |
| PUT | `/bookings/:id` | B ADMIN/AGENT `bookings:edit` | update (customer switch, dates, pax, amount, notes, `hotelTrips[]`, `transportTrips[]`) |
| PATCH | `/bookings/:id/status` | B ADMIN/AGENT `bookings:edit` | `{ status: TENTATIVE\|CONFIRMED\|CANCELLED }` |
| POST | `/bookings/:id/passengers` | B ADMIN/AGENT `bookings:edit` | add passengers |
| POST | `/bookings/:id/transport` | B ADMIN/AGENT `bookings:edit` | assign vehicle/route |
| POST | `/bookings/:id/catering` | B ADMIN/AGENT `bookings:edit` | assign meal plan |
| DELETE | `/bookings/:id` | B ADMIN `bookings:delete` | **soft cancel** (sets status CANCELLED, row kept). `?hard=1` → permanent purge incl. payments/invoice/vouchers/passengers (test-data cleanup) |

### 6.4 Vouchers (booking‑based)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/vouchers` | B `vouchers:view` | list (filter `?bookingId=`) |
| POST | `/vouchers/generate` | B ADMIN/AGENT `vouchers:create` + plan `pdfVouchers` | create a TENTATIVE/CONFIRMED voucher record |
| GET | `/vouchers/preview/:bookingId` | B (flexAuth; accepts `?token=`) | **HTML** voucher (render in WebView). `?type=CONFIRMED\|TENTATIVE` |
| GET | `/vouchers/download/:id` | B + plan `pdfVouchers` | **PDF** download (falls back to HTML) |
| DELETE | `/vouchers/:id` | B ADMIN `vouchers:delete` | delete a **TENTATIVE** voucher (409 on CONFIRMED — final documents). The booking is untouched. |

### 6.5 Direct Vouchers (standalone hotel/transport vouchers + invoices)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/voucher-forms` | B `voucher_forms:view` | list direct vouchers |
| GET | `/voucher-forms/next-number` | B `voucher_forms:view` | next voucher number |
| GET | `/voucher-forms/:id` | B `voucher_forms:view` | detail |
| POST | `/voucher-forms` | B ADMIN/AGENT `voucher_forms:create` | create (`type: HOTEL\|TRANSPORT`, customer fields, `trips[]`) |
| PUT | `/voucher-forms/:id` | B ADMIN/AGENT `voucher_forms:edit` | update |
| PATCH | `/voucher-forms/:id/confirm` | B ADMIN/AGENT `voucher_forms:edit` | confirm (issues HCN, generates actual invoice) |
| PATCH | `/voucher-forms/:id/cancel` | B ADMIN/AGENT `voucher_forms:edit` | cancel |
| PATCH | `/voucher-forms/:id/payment` | B ADMIN/AGENT `payments:create` | record payment on the voucher |
| GET | `/voucher-forms/:id/print` | B `voucher_forms:view` | **HTML** voucher printout |
| GET | `/voucher-forms/:id/invoices` | B `voucher_forms:view` | list invoices for the voucher |
| GET | `/voucher-forms/:id/invoice/:docType/print` | B `voucher_forms:view` | **HTML** invoice (`docType`=`PROFORMA`\|`ACTUAL`) with ZATCA QR |
| — | *(behaviour)* | — | Every direct voucher is linked to the unified customer registry: pass `customerId` to link an existing customer, else the server matches by `mobile`, else auto-creates a CUSTOMER user (placeholder login email, no welcome email). Voucher customers therefore appear in `/users/customers`. |
| PATCH | `/voucher-forms/invoices/:invoiceId/cancel` | B ADMIN/AGENT `voucher_forms:edit` | cancel an invoice |
| DELETE | `/voucher-forms/invoices/:invoiceId` | B ADMIN `voucher_forms:delete` | delete invoice |
| DELETE | `/voucher-forms/:id` | B ADMIN `voucher_forms:delete` | delete voucher |

### 6.6 Customers (unified = CUSTOMER‑role users)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/users/customers` | B ADMIN/AGENT | customer list/picker. `?search=`, `?includeInactive=1` (incl. disabled). Returns `{ data:[{id,name,email,phone,companyName,isActive,createdAt}] }`. **Active‑only when no flag** (used by booking pickers). |
| GET | `/users/customers/:id/statement` | B ADMIN/AGENT | **Customer statement (JSON)** — date‑ranged debit/credit ledger merging bookings, booking payments, direct‑voucher invoices (gross incl. VAT) and voucher payments. `?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` (both optional). Returns `{ customer, period, currency, openingBalance, lines[{date,kind,ref,description,debit,credit,balance}], totals{debits,credits,closingBalance} }`. Positive balance = amount due. |
| GET | `/users/customers/:id/statement/print` | B ADMIN/AGENT | **HTML** branded statement printout (same params) — render in WebView/new tab |
| POST | `/users` | B ADMIN/AGENT | create customer (`{ name,email,phone,companyName, role:'CUSTOMER' }`) — sends welcome email |
| PUT | `/users/:id` | B ADMIN/AGENT | edit customer (`name,phone,companyName,address`; **email not editable**) |
| DELETE | `/users/:id` | B ADMIN `users:delete` | delete |

### 6.7 Users & Roles (admin)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/users` | B ADMIN `users:view` | all users (`?role=`,`?search=`,`?page=`,`?limit=`) |
| GET | `/users/:id` | B ADMIN `users:view` | detail |
| GET | `/users/agents` | B | staff picker |
| POST | `/users` | B ADMIN/AGENT (+quota) | create user (role ADMIN/AGENT/CUSTOMER) |
| PUT | `/users/:id` | B ADMIN/AGENT | update |
| DELETE | `/users/:id` | B ADMIN `users:delete` | delete |
| GET | `/rbac/catalog` | B | features + actions + plan‑lock state |
| GET | `/rbac/roles` | B ADMIN `roles:view` | tenant roles + grants + user counts |
| POST | `/rbac/roles` | B ADMIN `roles:create` | create custom role |
| PUT | `/rbac/roles/:id` | B ADMIN `roles:edit` | rename/describe |
| PUT | `/rbac/roles/:id/permissions` | B ADMIN `roles:edit` | set `permissions[]` |
| DELETE | `/rbac/roles/:id` | B ADMIN `roles:delete` | delete |
| PUT | `/rbac/users/:id/role` | B ADMIN `users:edit` | assign `{ customRoleId }` (null = built‑in) |

### 6.8 Hotels
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/hotels` | B `hotels:view` | list (bare array). Fields incl. `city, stars, pricePerNight, distanceToHaramMeters, amenities[]` |
| GET | `/hotels/:id` | B `hotels:view` | detail |
| POST/PUT/DELETE | `/hotels[/:id]` | B ADMIN `hotels:create/edit/delete` | manage |

### 6.9 Transport (vehicles + routes)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/transport/vehicles` | B `transport:view` | list vehicles (bare array) |
| GET | `/transport/vehicles/:id` | B `transport:view` | detail |
| POST/PUT/DELETE | `/transport/vehicles[/:id]` | B ADMIN `transport:*` | manage (driver **Iqama # required, 10 digits**) |
| GET | `/transport/routes` | B `transport:view` | list routes |
| POST/PUT/DELETE | `/transport/routes[/:id]` | B ADMIN `transport:*` | manage |

### 6.10 Fleet (driver‑facing)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/fleet/dashboard` | B `fleet_dashboard:view` | fleet KPIs (hidden for drivers) |
| GET | `/fleet/trips` | B `fleet_trips:view` | trips (driver: own vehicle) |
| POST | `/fleet/trips/start` | B `fleet_trips:create` | start a live trip |
| POST | `/fleet/trips/:id/point` | B `fleet_trips:edit` | add GPS/odometer point |
| POST | `/fleet/trips/:id/stop` | B `fleet_trips:edit` | end trip (distance computed) |
| POST | `/fleet/trips` | B `fleet_trips:create` | log a completed trip (from/to, distance) |
| DELETE | `/fleet/trips/:id` | B ADMIN `fleet_trips:delete` | delete |
| GET | `/fleet/cash` | B `fleet_cash:view` | cash log |
| POST | `/fleet/cash` | B `fleet_cash:create` | submit cash entry |
| GET | `/fleet/maintenance` · `/fleet/maintenance/alerts` | B `fleet_maintenance:view` | maintenance list + oil/service alerts |
| GET | `/fleet/maintenance/:id/receipt` | B `fleet_maintenance:view` | receipt evidence |
| POST | `/fleet/maintenance/confirm` | B `fleet_maintenance:edit` | confirm maintenance done |

### 6.11 Catering
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/catering/vendors` · `/catering/vendors/:id` | B `catering:view` | vendors |
| POST/PUT/DELETE | `/catering/vendors[/:id]` | B ADMIN `catering:*` | manage vendors |
| GET | `/catering/meal-plans` | B `catering:view` | meal plans |
| POST/PUT/DELETE | `/catering/meal-plans[/:id]` | B ADMIN `catering:*` | manage plans |

### 6.12 Payments
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/payments` | B `payments:view` | list payments |
| POST | `/payments` | B ADMIN/AGENT `payments:create` | record manual payment (`bookingId, amount, method, reference`) |
| GET | `/payments/invoice/:bookingId` | B `payments:view` | invoice for a booking |
| GET | `/payments/:id/receipt/preview` | B `payments:view` | **HTML** receipt |
| GET | `/payments/:id/receipt/download` | B `payments:view` | receipt download |

### 6.13 Online payment gateways
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/payments/gateway/paypal/config` | B | PayPal client config for the tenant |
| POST | `/payments/gateway/paypal/create-order` | B | create PayPal order |
| POST | `/payments/gateway/paypal/capture-order` | B | capture after approval |
| POST | `/payments/gateway/intent` | B | Moyasar payment intent (Saudi cards/Mada/Apple Pay) |
| (webhooks) | `/payments/gateway/paypal/webhook`, `/payments/gateway/webhook` | server | gateway callbacks (not called by app) |

### 6.14 Reports
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/reports/daily-schedule` | B `daily_schedule:view` | daily ops schedule |
| GET | `/reports/daily-schedule/export` | B `daily_schedule:export` | CSV |
| GET | `/reports/transport-by-date` | B `transport_report:view` | transport report |
| GET | `/reports/transport-by-date/export` | B `transport_report:export` | CSV |
| PATCH | `/reports/transport-status` | B `transport_report:edit` | update a transport status |

### 6.15 CRM (plan‑gated)
Leads `/crm/leads[...]` (+ `/stats`, `/:id/notes`), Pipeline `/crm/pipelines`, `/crm/pipelines/:id/kanban`, `/crm/opportunities`, Tasks `/crm/tasks` (+ `/today`, `/:id/complete`), Inbox `/crm/conversations` (+ messages/resolve/assign/mark-read), Notifications `/crm/notifications` (+ mark‑read), Reports `/crm/reports/*`, Integrations & Automation (admin). All bearer + `crm_*` permissions. See route list in §6 source for exact verbs.

### 6.16 Config & Tenant
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/config` | B | tenant system config map (currency, VAT %, terms, vehicle types, etc.) |
| POST | `/config` | B ADMIN | upsert config (`{ configs: {key:value} }`) |
| GET | `/tenant/current` | B | tenant profile (compliance, branding, PayPal) |
| PUT | `/tenant/current` | B ADMIN | update tenant |
| GET | `/tenant/current/quota` | B | plan limits/usage |

### 6.17 Bulk import (admin/agent)
`GET /import` (entities), `GET /import/:entity/template` (CSV template), `POST /import/:entity` (rows). Entities: hotels, vehicles, packages, catering vendors, routes (customers import retired).

---

## 7. Key data models (fields the app renders/sends)

> Enums and field names are authoritative (from Prisma schema). Omitted: internal/audit fields.

**User** `{ id, name, email, role(SUPER_ADMIN|ADMIN|AGENT|CUSTOMER), phone, companyName, address, isActive, customRoleId, tenantId, createdAt, tenant{ id,name,slug,status,plan,logoUrl,primaryColor } }`

**Tenant** `{ id, name, slug, status(ACTIVE|TRIAL|SUSPENDED|CANCELLED), plan(STARTER|GROWTH|ENTERPRISE), logoUrl, primaryColor, contactEmail, contactPhone, crNumber, vatNumber, umrahLicenseNumber, address, country, city, currency, language, timezone, paypalEnabled, maxUsers, maxBookings }`

**Package** `{ id, name, description, durationDays, transportIncluded, cateringIncluded, visaIncluded, airportTransfer, isActive, priceTiers[], packageHotels[] }`
**PriceTier** `{ id, packageId, tierName, pricePerPax, roomType, minPax, maxPax }`
**PackageHotel** `{ id, packageId, hotelId, city(HotelCity), nights }`

**Hotel** `{ id, name, city(MAKKAH|MADINAH|JEDDAH|TAIF), stars, address, description, amenities[], distanceToHaramMeters, pricePerNight, isActive }`

**Booking** `{ id, bookingRef, customerId, agentId, packageId, status(TENTATIVE|CONFIRMED|CANCELLED), travelDateFrom, travelDateTo, totalPax, totalAmount, currency, notes, hotelTrips[], transportTrips[], customer, package, passengers[], invoice, vouchers[] }`
- **hotelTrips[]** `{ hotelId, hotelName, checkInDate, checkOutDate, rooms, perNightPrice, nights, lineTotal }`
- **transportTrips[]** `{ vehicleType, pickupLocation, dropoffLocation, travelDate, passengerCount, price, lineTotal }`

**Passenger** `{ id, bookingId, fullName, passportNo, passportExpiry, nationality, dateOfBirth, gender, phone, email, mahramName, mahramRelation, isPrimary }`

**Vehicle** `{ id, name, plateNumber, type, capacity, driverName, driverPhone, driverLicense, driverIqama(10 digits), isAvailable, initialOdometer, currentOdometer, oilChangeIntervalKm, lastOilChangeOdometer, driverId }`

**FormVoucher (Direct Voucher)** `{ id, voucherNo, type(HOTEL|TRANSPORT), status(TENTATIVE|CONFIRMED|CANCELLED), companyName, firstName, lastName, mobile, whatsapp, passport, hcn, paymentStatus, trips[], totalValue }`

**Payment** `{ id, bookingId, amount, currency, method(CASH|BANK_TRANSFER|CREDIT_CARD|CHEQUE|PAYPAL|MOYASAR|STRIPE), status(PENDING|PARTIAL|PAID), reference, gatewayRef, paidAt }`
**Invoice** `{ id, bookingId, invoiceNo, totalAmount, paidAmount, balance, vatAmount, currency, status, dueDate }`

---

## 8. Voucher & invoice rendering

- Voucher/invoice/receipt endpoints return **fully styled, print‑ready HTML** (branded with the tenant logo/colours; invoices include a **ZATCA Phase‑1 QR**).
- Mobile: render in a **WebView**, with a "Download / Share" action.
  - PDF: `GET /vouchers/download/:id` returns a PDF (or HTML fallback) — save with `expo-file-system`, share with `expo-sharing`.
  - The flexAuth voucher preview also accepts `?token=<jwt>` as a query param, useful for opening in an external viewer.

---

## 9. Validation rules (mirror server‑side; Saudi domain)

| Field | Rule |
|---|---|
| Email | `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| Saudi mobile (vouchers/passengers) | exactly **12 digits**, format `966XXXXXXXXX` |
| Generic phone | `^[+0-9\s\-]{7,20}$` |
| **Iqama # (driver)** | **exactly 10 digits, numeric only** (mandatory on vehicles) |
| CR Number | exactly **10 digits** |
| VAT Number | exactly **15 digits** |
| Passport | alphanumeric, no spaces |
| Name | letters only (Arabic letters allowed) |
| Currency code | 3 uppercase letters (e.g. `SAR`) |
| Money/decimal | `^[0-9]+(\.[0-9]+)?$`, ≥ 0 |
| Vehicle plate | alphanumeric incl. Arabic |

VAT default **15%** (tenant‑configurable via `/config` key `vat_percentage`). T&C for printouts come from config keys `terms_hotel_voucher`, `terms_transport_voucher`, `terms_invoice`.

---

## 10. Umrah/Hajj domain rules

- **Cities:** MAKKAH, MADINAH, JEDDAH, TAIF. Hotels carry `distanceToHaramMeters` (proximity to Haram is a key sort/filter for pilgrims).
- **Mahram:** female pilgrims may require a Mahram (passenger `mahramName`/`mahramRelation`).
- **Voucher lifecycle:** `TENTATIVE` → `CONFIRMED` (on confirm an **HCN** hotel confirmation number can be attached; an **actual tax invoice** is generated; before that a **proforma** exists).
- **Packages** bundle hotels (per city, nights) + transport + catering + visa flags.
- **Pricing:** per‑pax tiers by room type (Single/Double/Triple/Quad); itinerary line‑items can override with explicit hotel/transport trips.
- **Compliance:** Saudi CR (10‑digit), VAT (15‑digit), Umrah license; invoices are ZATCA‑compliant.

---

## 11. Branding & theme

```
Primary green:        #1B4B35   (dark: #0D2B1A, mid: #2E6B4F, light: #EAF2EE, pale: #F3F8F5)
Secondary gold:       #C9A227   (dark: #9B7A1A, light: #FFF8E6)
Cream background:     #F7F2E8
Success #16A34A · Warning #EA580C · Error #DC2626
Text primary #0D2B1A · text secondary #4B7060
Font: Inter / Segoe UI · Border radius 10 (buttons 8)
Buttons: gradient green, no UPPERCASE transform, weight 600
```
- **Per‑tenant override:** use `user.tenant.logoUrl` (fallback to platform logo) and `user.tenant.primaryColor` when present.
- App icon/splash should use the green/gold brand.

---

## 12. Screen map (by role) → endpoints

**Customer (Pilgrim) flow**
1. Login / Register (with agency `tenantSlug`) / Forgot password.
2. Home/Dashboard — `GET /dashboard/stats` (or a simple welcome).
3. Packages — `GET /packages`, detail `GET /packages/:id`.
4. My Bookings — `GET /bookings` (auto‑scoped), detail `GET /bookings/:id`.
5. Vouchers — `GET /vouchers?bookingId=`, view `GET /vouchers/preview/:bookingId` (WebView), download.
6. Payments — `GET /payments`, invoice `GET /payments/invoice/:bookingId`, pay online (§13).
7. Profile — `GET /auth/me`, `PUT /auth/profile`, `PUT /auth/change-password`.

**Staff (Admin/Agent) flow** (tabs gated by `permissions`)
- Dashboard, Bookings (list/create/edit/status), Customers (list/create/edit), Direct Vouchers (create/confirm/print/invoice), Vouchers (generate/preview), Payments (record/receipt), Hotels, Transport (vehicles/routes), Catering, Reports, CRM (leads/pipeline/tasks/inbox), Settings (tenant + config, admin), Users & Roles (admin).

**Driver flow**
- Home → assigned vehicle; Trips (start/point/stop or log), Cash (submit), Maintenance (alerts/confirm). Endpoints under `/fleet/*` and `/transport/vehicles`.

---

## 13. Online payments integration

- **PayPal:** `GET /payments/gateway/paypal/config` → render PayPal; `create-order` → open approval in in‑app browser → `capture-order` on return. Funds go to the tenant's own PayPal.
- **Moyasar (Saudi — Mada/Apple Pay/cards):** `POST /payments/gateway/intent` → complete via Moyasar hosted/SDK → server reconciles via webhook.
- **Apple Pay (iOS):** route through Moyasar's Apple Pay support; configure merchant ID in the iOS app.
- App should **not** hardcode keys — they come from the tenant config endpoints. After payment, refresh the booking/invoice to reflect `PAID/PARTIAL`.
- **Compliance:** do not collect raw card numbers in the app UI — always use the gateway's SDK/hosted fields.

---

## 13a. Push notifications (FCM)

Implemented backend (no app‑blocking work remaining):
- **Register** the FCM token after login & on refresh: `POST /devices { token, platform }`. **Unregister** on logout: `DELETE /devices/:token`.
- The server pushes automatically on: **booking status change** (`data.type=booking_status`) and **payment received** (`data.type=payment_received`). Each message carries a `data` object (`type`, `bookingId`, …) for deep‑link routing.
- Android + iOS are both delivered through FCM (iOS via APNs). In the app: integrate the Firebase SDK, obtain the FCM token, and handle foreground/background/tapped notifications (route using `data.type`).

**Backend config (one‑time, server side):** set env var `FCM_SERVICE_ACCOUNT` to the Firebase service‑account JSON (Project Settings → Service accounts → Generate new private key). For iOS also upload an APNs auth key in Firebase. Optional: `JWT_MOBILE_EXPIRES_IN` (default `1h`), `REFRESH_TOKEN_DAYS` (default `30`). **Until `FCM_SERVICE_ACCOUNT` is set, push is a safe no‑op** (device registration still works; nothing is sent).

> More event types (CRM assignment, maintenance alerts) can be wired server‑side easily; ask if you want them.

## 14. Internationalisation & accessibility

- Languages used by tenants: **English, Arabic (RTL), Urdu, Indonesian** (`tenant.language`). Implement i18n + automatic RTL for Arabic.
- Respect dynamic font sizes; ensure 44×44pt min touch targets; label all icons for screen readers.

---

## 15. Offline & caching

- Cache read‑mostly lists (packages, hotels) with stale‑while‑revalidate.
- Queue driver trip/cash submissions when offline and retry on reconnect (idempotency via client‑generated keys recommended — see §16).
- Never cache the JWT outside secure storage.

---

## 16. Backend gaps to add for a first‑class mobile app

✅ **Done** (implemented in backend):
- **Push notifications** — `POST /devices` / `DELETE /devices/:token` + FCM HTTP v1 sending; auto‑push on booking status & payment. Set `FCM_SERVICE_ACCOUNT` to activate. (§13a)
- **Refresh tokens** — `POST /auth/refresh` (rotating) + `POST /auth/logout`; mobile login issues a 1h access token + 30d refresh token. (§4)

Still open (not blocking v1):
1. **More push events** — CRM assignment, maintenance alerts (in‑app `GET /crm/notifications` exists for polling).
2. **File uploads** — passport/photo upload (e.g. presigned URL endpoint) if the app captures documents.
3. **Deep links / universal links** — for payment return URLs and shared voucher links.
4. **Idempotency keys** — for offline‑queued POSTs (payments, trips) to avoid duplicates.
5. **Server‑side pagination** on `/users/customers` if customer counts grow (currently returns all; app paginates client‑side).

---

## 17. Example requests

**Login**
```http
POST /api/auth/login
{ "email": "agent@agency.com", "password": "••••••" }
→ 200 { "token": "<jwt>", "user": { "id","name","role":"AGENT","tenantId","tenant":{...} } }
```

**Bootstrap session**
```http
GET /api/auth/me   Authorization: Bearer <jwt>
→ 200 { ...user, "permissions": ["bookings:view","bookings:create", ...] }
```

**Create booking (with itinerary)**
```http
POST /api/bookings   Authorization: Bearer <jwt>
{
  "customerId": "<userId>",
  "travelDateFrom": "2026-08-01", "travelDateTo": "2026-08-05",
  "totalPax": 3,
  "hotelTrips": [{ "hotelName":"Makkah Hotel","checkInDate":"2026-08-01","checkOutDate":"2026-08-04","rooms":"2","perNightPrice":"250" }],
  "transportTrips": [{ "vehicleType":"SUV (GMC)","pickupLocation":"JED","dropoffLocation":"Makkah","travelDate":"2026-08-01","passengerCount":"3","price":"600" }],
  "passengers": []
}
→ 201 { booking with auto-computed totalAmount }
```

**Generate + preview a voucher**
```http
POST /api/vouchers/generate { "bookingId":"<id>", "type":"CONFIRMED" }
GET  /api/vouchers/preview/<bookingId>?type=CONFIRMED   → text/html (render in WebView)
```

**Quick‑add a customer**
```http
POST /api/users { "name":"Ahmed Khan","email":"ahmed@x.com","phone":"966500000001","role":"CUSTOMER" }
→ 201 (customer appears in /users/customers and the booking picker)
```

---

## 18. Build/release checklist

- [ ] Set `API_BASE_URL` per environment (staging/prod).
- [ ] iOS: bundle id, Apple Pay merchant id (if Moyasar Apple Pay), push entitlement.
- [ ] Android: applicationId, FCM config (if push), signing keys.
- [ ] Store the JWT in Keychain/Keystore; clear on logout & on `401`.
- [ ] Role‑driven navigation from `permissions[]`.
- [ ] WebView for vouchers/invoices; share/download.
- [ ] Arabic RTL + i18n.
- [ ] Handle `403` plan‑locked features gracefully (hide or upsell).
- [ ] Brand: green/gold theme + per‑tenant logo/colour.

---

*Generated from the live Safre Manasik codebase. API base: `https://api.safremanasik.com/api`.*
