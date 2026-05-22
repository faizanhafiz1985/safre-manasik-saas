# Safre Manasik SaaS - PRODUCTION READINESS CHECKLIST

## Status: 95% COMPLETE ✅

Last updated: 2026-05-22

### ✅ COMPLETED
- [x] Code deployed to Railway (auto-deploy from GitHub)
- [x] PostgreSQL database running (Railway-managed Postgres 17)
- [x] Backend service configured + env vars set
- [x] Frontend service configured + env vars set
- [x] Multi-tenancy working (row-level isolation via Prisma middleware)
- [x] Auth, reports, bookings, payments all functional
- [x] CNAME records configured in Dynadot DNS
- [x] SSL certificates auto-issued by Railway

### ⚠️ INCOMPLETE (Must complete for live customers)

#### 1. PayPal Live Credentials (5 min)
**Status:** Currently in STUB mode

**Action needed:**
1. Go to https://developer.paypal.com/dashboard/applications/live
2. Get your `Client ID` and `Secret` from the App
3. Update Railway backend env vars:
   - `PAYPAL_MODE=live`
   - `PAYPAL_CLIENT_ID=<your_client_id>`
   - `PAYPAL_SECRET=<your_secret>`
4. Push to Railway (auto-redeploy)

#### 2. Super Admin Password Change (2 min)
**CRITICAL:** Change from default Super@2026!

**Action needed:**
1. Visit https://app.safremanasik.com
2. Login: `superadmin@safremanasik.com / Super@2026!`
3. Click Profile → Change Password
4. Set a strong password (12+ chars, uppercase, numbers, symbols)

#### 3. Production JWT Secret (1 min)
**Generate and set in Railway backend:**

```bash
# Generate secure JWT_SECRET (run this locally, copy result to Railway)
openssl rand -base64 48
```

Then update Railway backend env var:
- `JWT_SECRET=<the_48_bytes_you_generated>`

#### 4. Clean Demo Data (Optional, recommended)
**Remove seed accounts before real customers:**

1. Option A - Keep demo data (for testing):
   - Just mark accounts as inactive in the app

2. Option B - Full reset (removes everything):
   ```bash
   # On Railway backend shell:
   npx prisma db push --force-reset --accept-data-loss
   npm run db:seed
   ```

#### 5. Railway Billing Cap (1 min)
**Prevent runaway costs:**
1. Go to Railway dashboard → Account → Billing
2. Set spending cap to $50/month
3. Enable alerts at 80%

#### 6. Test End-to-End (10 min)
**Smoke test with real customer flow:**
- [ ] Visit https://app.safremanasik.com → login works
- [ ] Create a booking → works
- [ ] PayPal payment → processes correctly
- [ ] Booking status updates → success
- [ ] Invoice generated → correct amounts
- [ ] Export reports → CSV downloads correctly
- [ ] Tenant admin sees only their data → ✅

---

## Quick Setup Commands

### Generate production values:
```bash
# Generate 48-byte JWT_SECRET
openssl rand -base64 48

# Example output (use this format):
# aBc1234+/AbC1234+/AbC1234+/AbC1234+/AbC1234+/A==
```

### Update Railway Backend Env Vars:
Go to: https://railway.com/project/adcd3710-a113-457d-af99-8a462aa04fd6/service/e4ebf624-4da8-4140-9302-8fd815fd1cc6/variables

Add/update these variables:
```
NODE_ENV=production
JWT_SECRET=<your_generated_secret_here>
FRONTEND_URL=https://app.safremanasik.com
PAYPAL_MODE=sandbox  # or "live" after getting credentials
PAYPAL_CLIENT_ID=<get_from_paypal_dashboard>
PAYPAL_SECRET=<get_from_paypal_dashboard>
```

### Update Railway Frontend Env Vars:
Go to: https://railway.com/project/adcd3710-a113-457d-af99-8a462aa04fd6/service/{frontend-service-id}/variables

Already set:
```
REACT_APP_API_URL=https://api.safremanasik.com/api
```

---

## Go-Live Checklist (Final)

Before accepting real customers, verify:

- [ ] Super admin password changed from default
- [ ] JWT_SECRET is production-strength (48+ bytes)
- [ ] PayPal is in LIVE mode with real credentials (not sandbox)
- [ ] Demo tenant accounts deleted or marked inactive
- [ ] Railway billing cap configured
- [ ] HTTPS working on both app.safremanasik.com and api.safremanasik.com
- [ ] All domain CNAMEs pointing to Railway (verify via dnschecker.org)
- [ ] Email domain configured (optional, for transactional emails)
- [ ] One end-to-end test completed successfully
- [ ] Backup/restore process tested at least once

---

## Estimated Time to Full Production
- **With PayPal credentials ready:** ~15 minutes
- **Without PayPal credentials (need to sign up):** 30 minutes

**You are THIS close!** 🎯

---

## Support
- Stuck on PayPal? See: SETUP_PAYPAL.md
- Stuck on Railway? See: SETUP_RAILWAY.md
- Stuck on DNS? See: SETUP_DYNADOT_DNS.md
