# Safre Manasik API Documentation

Base URL: `http://localhost:5000/api`

All protected routes require: `Authorization: Bearer <token>`

---

## Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login, returns JWT |
| GET | `/auth/me` | Yes | Get current user |
| PUT | `/auth/change-password` | Yes | Change password |

**Login Request:**
```json
{ "email": "admin@safremanasik.com", "password": "Admin@1234" }
```
**Login Response:**
```json
{ "token": "eyJ...", "user": { "id": "...", "name": "System Admin", "role": "ADMIN" } }
```

---

## Users (Admin only)

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/users` | ADMIN | List users (paginated) |
| GET | `/users/agents` | All | List active agents |
| GET | `/users/:id` | ADMIN | Get user details |
| POST | `/users` | ADMIN | Create user |
| PUT | `/users/:id` | ADMIN | Update user |
| DELETE | `/users/:id` | ADMIN | Deactivate user |

**Query Params:** `role`, `search`, `page`, `limit`

---

## Packages

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/packages` | All | List packages |
| GET | `/packages/:id` | All | Package details |
| POST | `/packages` | ADMIN | Create package |
| PUT | `/packages/:id` | ADMIN | Update package |
| DELETE | `/packages/:id` | ADMIN | Deactivate package |

**Create Package Request:**
```json
{
  "name": "Economy Umrah 10 Days",
  "durationDays": 10,
  "transportIncluded": true,
  "cateringIncluded": true,
  "visaIncluded": true,
  "priceTiers": [
    { "tierName": "Double Room", "pricePerPax": 6500, "roomType": "DOUBLE", "minPax": 2 }
  ],
  "packageHotels": [
    { "hotelId": "uuid", "city": "MAKKAH", "nights": 5 },
    { "hotelId": "uuid", "city": "MADINAH", "nights": 4 }
  ]
}
```

---

## Bookings

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/bookings` | All | List bookings (filtered by role) |
| GET | `/bookings/:id` | All | Booking details |
| POST | `/bookings` | ADMIN, AGENT | Create booking |
| PUT | `/bookings/:id` | ADMIN, AGENT | Update booking |
| PATCH | `/bookings/:id/status` | ADMIN | Change status |
| POST | `/bookings/:id/passengers` | ADMIN, AGENT | Add passengers |
| POST | `/bookings/:id/transport` | ADMIN | Assign transport |
| POST | `/bookings/:id/catering` | ADMIN | Assign catering |
| DELETE | `/bookings/:id` | ADMIN | Cancel booking |

**Query Params:** `status` (TENTATIVE/CONFIRMED/CANCELLED), `search`, `agentId`, `customerId`, `dateFrom`, `dateTo`, `page`, `limit`

**Booking Status Values:** `TENTATIVE` | `CONFIRMED` | `CANCELLED`

---

## Transport

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/transport/vehicles` | All | List vehicles |
| GET | `/transport/vehicles/:id` | All | Vehicle details |
| POST | `/transport/vehicles` | ADMIN | Add vehicle |
| PUT | `/transport/vehicles/:id` | ADMIN | Update vehicle |
| DELETE | `/transport/vehicles/:id` | ADMIN | Delete vehicle |
| GET | `/transport/routes` | All | List routes |
| POST | `/transport/routes` | ADMIN | Create route |
| PUT | `/transport/routes/:id` | ADMIN | Update route |
| DELETE | `/transport/routes/:id` | ADMIN | Delete route |

**Vehicle Types:** `BUS` | `CAR` | `VIP`

---

## Catering

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/catering/vendors` | All | List vendors |
| GET | `/catering/vendors/:id` | All | Vendor details |
| POST | `/catering/vendors` | ADMIN | Create vendor |
| PUT | `/catering/vendors/:id` | ADMIN | Update vendor |
| DELETE | `/catering/vendors/:id` | ADMIN | Deactivate vendor |
| GET | `/catering/meal-plans` | All | List meal plans |
| POST | `/catering/meal-plans` | ADMIN | Create meal plan |
| PUT | `/catering/meal-plans/:id` | ADMIN | Update meal plan |

**Meal Types:** `BREAKFAST` | `LUNCH` | `DINNER`

---

## Hotels

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/hotels` | All | List hotels |
| GET | `/hotels/:id` | All | Hotel details |
| POST | `/hotels` | ADMIN | Create hotel |
| PUT | `/hotels/:id` | ADMIN | Update hotel |
| DELETE | `/hotels/:id` | ADMIN | Deactivate hotel |

**Query Params:** `city` (MAKKAH/MADINAH), `search`

---

## Vouchers

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/vouchers` | All | List vouchers |
| POST | `/vouchers/generate` | ADMIN, AGENT | Generate voucher |
| GET | `/vouchers/preview/:bookingId` | All | Preview HTML voucher |
| GET | `/vouchers/download/:id` | All | Download PDF/HTML |

**Generate Voucher Request:**
```json
{ "bookingId": "uuid", "type": "CONFIRMED" }
```
Voucher types: `TENTATIVE` | `CONFIRMED`

---

## Payments

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/payments` | ADMIN, AGENT | List payments |
| POST | `/payments` | ADMIN, AGENT | Record payment |
| GET | `/payments/invoice/:bookingId` | All | Get invoice |

**Payment Methods:** `CASH` | `BANK_TRANSFER` | `CREDIT_CARD` | `CHEQUE`

---

## Dashboard

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/dashboard/stats` | ADMIN, AGENT | Dashboard stats & chart data |

---

## System Config (Admin)

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/config` | ADMIN | Get all configs |
| POST | `/config` | ADMIN | Update configs |

**Update Config Request:**
```json
{
  "configs": {
    "company_name": "Safre Manasik Travel",
    "company_phone": "+966-11-000-0000",
    "vat_percentage": "15"
  }
}
```
