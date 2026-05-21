# Go-Live Checklist

Open these guides in order. Each one takes 5–30 minutes.

| Order | Step | Guide | Time |
|---|---|---|---|
| 1 | Push code to GitHub | [SETUP_RAILWAY.md](SETUP_RAILWAY.md) §1 | 5 min |
| 2 | Deploy on Railway | [SETUP_RAILWAY.md](SETUP_RAILWAY.md) §2-5 | 20 min |
| 3 | Point Dynadot domain at Railway | [SETUP_DYNADOT_DNS.md](SETUP_DYNADOT_DNS.md) | 10 min + 1 hr DNS wait |
| 4 | Wire up PayPal (sandbox first) | [SETUP_PAYPAL.md](SETUP_PAYPAL.md) | 5 min |
| 5 | Test end-to-end | (this file, below) | 15 min |
| 6 | Switch PayPal to live mode | [SETUP_PAYPAL.md](SETUP_PAYPAL.md) §5 | 5 min |

---

## End-to-end smoke test

Once Step 4 is complete, run through these checks. If any fail, see the matching troubleshooting section in the relevant guide.

### Auth
- [ ] Visit `https://app.yourdomain.com` — login screen loads, no CORS errors in browser console
- [ ] Log in as `superadmin@safremanasik.com / Super@2026!` — redirects to `/super-admin`
- [ ] **Immediately change the super admin password** (Profile menu → Change Password)
- [ ] Log out, log in as a tenant admin (`admin@alrashidi.sa / Admin@1234`) — redirects to `/dashboard`

### Multi-tenancy
- [ ] As tenant admin, you see only Al-Rashidi data (5 bookings, 6 hotels)
- [ ] As super admin, you see all tenants in `/super-admin`
- [ ] Open browser dev tools, copy your tenant admin's JWT token, try to GET `/api/super-admin/tenants` — should return 403

### Reports
- [ ] Go to **Daily Schedule** — table populates for today
- [ ] Click **Export CSV** — downloads correctly
- [ ] Go to **Transport Report** — runs and occupancy show
- [ ] Try `+31 days` range — works

### Tenant settings
- [ ] Go to **Tenant Settings** — your tenant info appears
- [ ] Change the primary colour, hit Save — reloads with new value

### PayPal (sandbox)
- [ ] Open any booking, click **Pay with PayPal** — redirects to PayPal sandbox
- [ ] Sign in with a sandbox buyer account (from PayPal Developer → Sandbox Accounts)
- [ ] Approve the payment — redirects back to `/payment/paypal/success`
- [ ] See "Payment Successful" screen, then auto-redirect to booking
- [ ] Booking now shows the new payment in the Payment History section
- [ ] Invoice status updated (PARTIAL or PAID)

### Tenant signup (new customer flow)
- [ ] In an incognito window, go to `https://app.yourdomain.com/signup`
- [ ] Fill in a new organisation name and admin details
- [ ] Submit — automatically logged in to a fresh tenant with empty dashboard
- [ ] Super admin can see this new tenant in `/super-admin`

---

## Production hardening checklist

Before you market the app to real customers:

- [ ] Super admin password changed from `Super@2026!`
- [ ] All seed/demo tenant accounts either deleted or marked inactive (`isActive: false`)
- [ ] Run `npx prisma db push --force-reset --accept-data-loss` then `npm run db:seed` ONLY if you want to start clean — this wipes the demo data
- [ ] PayPal switched from `sandbox` to `live`
- [ ] HTTPS working on both `app.yourdomain.com` and `api.yourdomain.com`
- [ ] `JWT_SECRET` is at least 48 random bytes (use `openssl rand -base64 48`)
- [ ] Set Railway billing cap to avoid runaway costs
- [ ] Postgres backups: Railway does automatic daily backups on paid plans. Verify on the database service → Backups tab.
- [ ] Test restore from a backup at least once before going live
- [ ] Sentry or Logflare wired in for error tracking (optional but recommended)
- [ ] Custom email domain set up (for outgoing transactional emails — see Step 6 below)

---

## Optional: outgoing email

The app currently doesn't send emails. To add:

1. Sign up for **Postmark** ($15/mo) or **Resend** (free tier)
2. Add env var `EMAIL_API_KEY` and a helper in `backend/src/services/email.js`
3. Trigger emails on: booking confirmation, payment received, voucher generated

I can build this for you on request — it's about 1 hour of work.

---

## Where things live

| What | Where |
|---|---|
| Source code | Your GitHub repo |
| Live app | `https://app.yourdomain.com` |
| API | `https://api.yourdomain.com` |
| Database | Railway → Postgres service |
| Logs | Railway → each service → Logs tab |
| Metrics | Railway → each service → Metrics tab |
| Billing | Railway → Account → Usage |
| Domain | Dynadot → My Domains |
| PayPal dashboard | https://developer.paypal.com/dashboard/applications/live |

---

## You're live

If you completed every checkbox above, you have a production multi-tenant SaaS taking real PayPal payments.

The whole stack — every service, every secret, every test — is yours and only yours. No vendor lock-in beyond Railway+PayPal, both of which have clean exit paths.

Next features to consider:
- Outgoing email (booking confirmations, voucher delivery)
- More report types
- Customer self-service portal
- Mobile-friendly improvements
- Arabic UI (i18n)
- ZATCA e-invoicing for Saudi tax compliance

Ping me when you're ready for any of these.
