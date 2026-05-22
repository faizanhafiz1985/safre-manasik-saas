# Safre Manasik — Vendor & Service Catalogue

Every external service the platform depends on, what it does, what it costs, where to manage it, and what happens if it goes away.

---

## Tier 1 — Mandatory (the platform cannot run without these)

### 1. GitHub
- **What:** Source code repository + CI trigger
- **URL:** <https://github.com/faizanhafiz1985/safre-manasik-saas>
- **Plan:** Free (public repo)
- **Cost:** **USD 0/mo**
- **Account owner:** faizanhafiz1985 (your account)
- **What you do here:** Look at code, see commit history, hit "Edit" pencil to make small fixes in the browser
- **If it goes down:** Existing deployments keep running. You only lose the ability to push new code until GitHub is back. Outages are very rare.

### 2. Railway (PaaS)
- **What:** Runs the frontend, backend, and database. Auto-deploys from GitHub.
- **URL:** <https://railway.com>
- **Plan options:**
  - **Hobby** – USD 5/mo base + usage; fine for 1–10 tenants
  - **Pro** – USD 20/mo base + usage; recommended once you have paying customers
- **Cost (current):** ~USD 5–25/mo
- **Account owner:** your personal Railway account
- **What you do here:** View logs, restart services, change env vars, rollback deploys, scale up
- **If it goes down:** Your platform is offline. Outages are rare (Railway publishes status at <https://railway.statuspage.io>). The whole stack can be redeployed to Fly.io / Render / Heroku in ~2 hours if needed.

### 3. Railway PostgreSQL (included in Railway plan)
- **What:** The database
- **Plan:** Bundled with Railway plan above
- **Cost:** Storage ~USD 0.25/GB-month + traffic
- **Backups:** Daily automatic snapshots on Pro plan
- **What you do here:** Set storage size, see backups, copy connection string for psql / Prisma Studio
- **If it goes down:** No tenant can log in or save anything. Restore from the most recent snapshot. If the data is truly lost, you can rebuild from PayPal's transaction history + tenant CR records — but it would be painful. Pro plan + daily backups protect against this.

### 4. Dynadot (Domain Registrar)
- **What:** Registered owner of `safremanasik.com`
- **URL:** <https://www.dynadot.com>
- **Plan:** Annual renewal
- **Cost:** ~USD 11/year (USD 0.92/mo amortised)
- **What you do here:** Renew domain (auto-renew available), change registrant contact, see WHOIS
- **If it goes down:** Domain stays registered; only the Dynadot admin UI is unavailable. DNS is on Cloudflare anyway.

### 5. Cloudflare (DNS)
- **What:** DNS for `safremanasik.com`. Resolves `app.*` and `api.*` to Railway. Holds the TXT verification records Railway requires for SSL.
- **URL:** <https://dash.cloudflare.com>
- **Plan:** Free
- **Cost:** **USD 0/mo**
- **Account owner:** Faizan.hafiz@gmail.com
- **What you do here:** Add / edit DNS records (rare — only when adding subdomains or new services). Cloudflare also hosts the nameservers `barbara.ns.cloudflare.com` + `casey.ns.cloudflare.com` that Dynadot points at.
- **If it goes down:** DNS resolves stop globally → custom domain breaks. The Railway URLs (`.up.railway.app`) keep working as a fallback.

---

## Tier 2 — Strongly recommended (your business will struggle without these)

### 6. PayPal (Payment gateway)
- **What:** Accept payments from customers. Each tenant brings their own PayPal account (per-tenant config in Tenant Settings).
- **URL:** <https://developer.paypal.com/dashboard>
- **Plan:** Free account, per-transaction fees
- **Cost:** **USD 0 fixed** + ~3.5% per transaction (varies by country)
- **What you do here:** You (the platform) don't need a PayPal account at all if every tenant uses their own. Optional: keep one as a platform-level fallback (see PAYPAL_CLIENT_ID/SECRET env vars).
- **If it goes down:** Payments fail. Customers see error pages. Restore by switching tenant gateway temporarily to stub mode while PayPal recovers.

### 7. SMTP / Email (Postmark or Resend)
- **What:** Sends transactional emails — welcome on signup approval, rejection notices, password resets, booking confirmations, etc.
- **URL:** <https://postmarkapp.com> or <https://resend.com>
- **Plan / cost:**
  - **Postmark**: USD 15/mo for 10,000 emails — best deliverability
  - **Resend**: free up to 3,000/mo + USD 20/mo for 50,000 — newest, fast onboarding
- **What you do here:** Sign up, verify your domain (DKIM/SPF records you add to Cloudflare), get an API token, paste it into Railway env vars (`SMTP_*`). See `TROUBLESHOOTING.md` → "Emails not being sent".
- **If it's not configured (current state):** Emails are logged to the backend console instead of sent. Applicants don't get their welcome email — you'd have to inform them manually. **Set this up before you start onboarding real customers.**

---

## Tier 3 — Nice to have

### 8. Sentry (Error tracking) — not yet wired
- **What:** Captures backend exceptions with stack traces so you find bugs before customers complain.
- **URL:** <https://sentry.io>
- **Cost:** Free up to 5,000 errors/month; USD 26/mo for 50,000
- **Wiring:** `npm install @sentry/node` in backend, add `Sentry.init({ dsn: process.env.SENTRY_DSN })` near the top of `server.js`.
- **If you skip this:** You only see errors when looking at Railway logs.

### 9. Logflare / Better Stack (Log aggregation) — not yet wired
- **What:** Search-friendly UI for logs vs. Railway's basic tail.
- **Cost:** Free tier or USD 10–20/mo
- **Useful when:** you have multiple services, multiple errors per day, or need to grep across long timespans.

### 10. Cloudinary / Cloudflare Images (Logo / image hosting)
- **What:** Hosts tenant logos and any future user-uploaded images.
- **URL:** <https://cloudflare.com/products/cloudflare-images/> or <https://cloudinary.com>
- **Cost:** Cloudflare Images USD 5/mo for 100k images; Cloudinary free up to 25 credits/mo
- **Current state:** Tenants paste a public HTTPS URL into the Logo URL field. They host it themselves (often on their own website). If you want them to upload directly, wire one of these.

### 11. Mapbox / Google Maps (Geocoding) — future
- **What:** Convert addresses to lat/lng, display hotel locations on maps.
- **Cost:** Both have generous free tiers (~25k-50k requests/mo).
- **Useful when:** showing hotels-near-Haram radius, transport routing.

---

## Tier 4 — Optional / future

| Vendor | What | Cost |
|---|---|---|
| ZATCA-compliant e-invoicing service | Saudi tax compliance for VAT-registered tenants | Varies — local Saudi providers, ~USD 30–100/mo |
| Twilio / WhatsApp Business API | Booking confirmations via SMS / WhatsApp | Pay-as-you-go |
| Stripe | Alternative to PayPal (cards only, lower fees in some markets) | Per-transaction |
| Algolia | Better search across packages/bookings | Free tier or USD 50/mo |
| Crisp / Intercom | Customer support chat widget | USD 25–40/mo |
| Datadog APM | Full application performance monitoring | USD 15–30/host/mo |

---

## Monthly cost summary

| Scenario | Monthly USD | What's included |
|---|---:|---|
| Bare minimum (running, no real traffic) | **~5** | GitHub free + Railway Hobby + Dynadot + Cloudflare free |
| Recommended live setup (handful of tenants) | **~25** | Above + Postmark email + 5 GB Postgres storage |
| Growth (50+ tenants, real payments) | **~70** | Railway Pro + Postmark + Sentry + extra Postgres storage |
| Enterprise-grade | **~200** | Railway scaled + Postmark + Datadog + Cloudflare Images + ZATCA service |

Plus: **PayPal fees** = ~3.5% of each customer payment, paid out of the payment itself, not a separate monthly bill.

---

## How to know what's running today

Run **Diagnostics** in the SUPER_ADMIN sidebar. Every required vendor / env var is checked. If something says WARN or FAIL, click into TROUBLESHOOTING.md and find the matching recipe.

---

## Vendor onboarding order (if starting fresh)

If you ever rebuild this from scratch, do it in this order:

1. Buy domain (Dynadot)
2. Set up Cloudflare (free, point Dynadot nameservers at it)
3. Create GitHub repo + push code
4. Create Railway project linked to GitHub → it auto-deploys
5. Add Postgres service in Railway
6. Set env vars (JWT_SECRET, SUPERADMIN_PASSWORD, FRONTEND_URL, BACKEND_URL)
7. Configure DNS records in Cloudflare (CNAME + TXT — see SETUP_CLOUDFLARE_DNS.md)
8. Wait for SSL → confirm `https://app.safremanasik.com` loads
9. Wire SMTP (Postmark) so emails actually send
10. Tell first tenant to sign up at `/signup` → you approve in SUPER_ADMIN
11. Tenant configures their own PayPal in Tenant Settings → starts accepting payments
