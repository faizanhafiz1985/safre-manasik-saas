# Safre Manasik — Maintenance Runbook

Step-by-step recipes for the operator (you) to diagnose and resolve issues without needing a developer. Open this whenever something seems wrong.

---

## Step 1 — Always start at Diagnostics

1. Log in as SUPER_ADMIN at <https://app.safremanasik.com/login>.
2. Sidebar → **Diagnostics**.
3. Click **Run Again**.
4. Read the overall status:
   - **Healthy** (green) — nothing's wrong. Stop here.
   - **Degraded** (gold) — warnings only. The system is working but something is sub-optimal (e.g. SMTP not configured).
   - **Unhealthy** (red) — one or more checks failed. Read the "Checks" table to see exactly which.

Every failure or warning in the table has a `detail` column that tells you what's wrong in plain English. Use it to jump to the matching recipe below.

---

## Recipe — DB connection failed

**Symptom:** `database.connection` is FAIL.

**Cause:** Postgres is unreachable.

**Fix:**
1. Open Railway → project `zesty-elegance` → click the **Postgres** service.
2. Is the green "Online" dot showing? If not, click **Restart** in the kebab menu.
3. Click **Variables** → confirm `DATABASE_URL` exists. It's set automatically when Postgres is linked.
4. Open the backend service → Variables → confirm `DATABASE_URL` references Postgres (it should look like `${{ Postgres.DATABASE_URL }}`). If not, click `+ New Variable` → name `DATABASE_URL` → value `${{ Postgres.DATABASE_URL }}` → Save.
5. Backend → kebab on active deployment → **Redeploy**.

---

## Recipe — JWT_SECRET not set

**Symptom:** `env.JWT_SECRET` is FAIL or all logins return 500.

**Fix:**
1. Generate a strong secret locally: `openssl rand -base64 48` (or use any password generator, 48+ random chars).
2. Railway → backend service → Variables → add `JWT_SECRET=<paste value>`.
3. **Deploy Changes** at the top.
4. All existing JWTs become invalid — everyone must re-login. That's expected.

---

## Recipe — Lost SUPER_ADMIN password

**Symptom:** can't log in as `superadmin@safremanasik.com`.

**Fix (self-heal via env var):**
1. Railway → backend service → Variables.
2. Edit `SUPERADMIN_PASSWORD` to a new strong value (or add if missing).
3. **Deploy Changes**. Backend restarts.
4. On boot, `bootstrap.js` syncs the password from the env var to the DB user.
5. Log in with the new password.

Why this works: the boot-time bootstrap is idempotent and treats the env var as the source of truth. See `backend/src/bootstrap.js` (`ensureSuperAdmin` function).

---

## Recipe — Emails not being sent

**Symptom:** `email.smtp` is WARN, applicants don't get welcome / rejection emails.

**Fix — wire up SMTP:**
1. Pick a provider:
   - **Postmark** (recommended, $15/mo, very reliable): sign up at <https://postmarkapp.com>. Get the Server API Token.
   - **Resend** (free tier 100/day): sign up at <https://resend.com>. Get an API key.
   - **Gmail** (free, dev-only, deliverability mediocre): create an [App Password](https://myaccount.google.com/apppasswords).
2. Railway → backend → Variables → add (use the values for your chosen provider):
   ```
   SMTP_HOST=smtp.postmarkapp.com    # or smtp.resend.com, smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=<token-or-username>
   SMTP_PASS=<token-or-password>
   SMTP_FROM="Safre Manasik <noreply@safremanasik.com>"
   ```
3. **Deploy Changes**.
4. Re-run Diagnostics — the `email.smtp` line should now say "pass".
5. Submit a test tenant application to confirm an email arrives at the applicant's address.

If your `SMTP_FROM` uses your own domain (e.g. `noreply@safremanasik.com`), you must verify the domain with the provider — they'll give you DKIM/SPF records to add to Cloudflare DNS.

---

## Recipe — PayPal payments going to stub mode

**Symptom:** "Pay with PayPal" leads to a fake stub page; `paypal.platform` warn.

**Two ways to fix, depending on the model you want:**

**A. Each tenant brings their own PayPal account** (recommended SaaS model — money goes straight to the tenant's account, you don't touch it):
1. Tenant admin: Sidebar → Tenant Settings → Payment Gateway section.
2. Toggle **PayPal enabled** on.
3. Mode = `live`.
4. Paste their Client ID + Secret from <https://developer.paypal.com/dashboard/applications/live>.
5. Save. Funds for that tenant's customers now flow directly to that tenant's PayPal.

**B. Platform-level fallback** (one global account, all money goes to you, then you reconcile and pay tenants):
1. Get your own PayPal app credentials.
2. Railway → backend → Variables: set `PAYPAL_MODE=live`, `PAYPAL_CLIENT_ID=...`, `PAYPAL_CLIENT_SECRET=...`.
3. Deploy Changes.

---

## Recipe — Custom domain shows "Connection not secure"

**Symptom:** `https://app.safremanasik.com` won't load or shows a cert warning.

**Fix:**
1. Confirm DNS: in any terminal `nslookup app.safremanasik.com`. It should resolve to `*.up.railway.app`.
2. If not, log into Cloudflare → safremanasik.com → DNS → Records. The CNAME for `app` should point to `jvgh07ae.up.railway.app` with proxy status **DNS only** (grey cloud, not orange).
3. If the proxy (orange cloud) is on, click it to turn it off. Cloudflare proxy interferes with Railway's edge SSL.
4. Wait 5 min for DNS to repropagate.
5. Railway → frontend → Settings → Networking → confirm `app.safremanasik.com` shows **Verified** with a green check. If "DNS pending", wait longer; if a TXT record is requested, add it in Cloudflare following SETUP_CLOUDFLARE_DNS.md.

---

## Recipe — A tenant says "I can't create more users / bookings"

**Symptom:** API returns 403 with "users limit reached" or "bookings limit reached".

**Fix:**
1. Log in as SUPER_ADMIN → Platform Admin (`/super-admin`).
2. Find the tenant → click the pencil **Edit**.
3. Either:
   - Bump `Max Users` or `Max Bookings` for that specific tenant (override).
   - Or change `Plan` to GROWTH or ENTERPRISE (uses the plan's defaults — see Plans & Pricing).
4. Save. Change takes effect within ~5 seconds (cache TTL).

---

## Recipe — A tenant says "PDF voucher download fails"

**Symptom:** clicking download returns `Feature "pdfVouchers" is not available on your STARTER plan`.

This is working as designed — the tenant is on a plan that doesn't include PDF vouchers.

**Fix (one of):**
- **Upgrade the tenant**: SUPER_ADMIN → Platform Admin → Edit tenant → change Plan to GROWTH/ENTERPRISE.
- **Or: enable PDFs for STARTER globally**: SUPER_ADMIN → Plans & Pricing → edit STARTER → toggle `PDF Vouchers` on → Save.

---

## Recipe — New tenant application stuck on "Pending"

**Symptom:** an applicant submitted signup days ago and complains nothing has happened.

**Fix:**
1. SUPER_ADMIN → Applications.
2. Filter: Pending. The application should appear.
3. Click **Approve** (creates tenant + admin, sends welcome email) or **Reject** (with a reason that goes to the applicant).
4. If the user can't find their welcome email after approval, check the `email.smtp` row in Diagnostics — if SMTP isn't configured, the email was only logged to the backend, not actually sent. See the "Emails not being sent" recipe.

---

## Recipe — Frontend deployed but I still see the old version

**Symptom:** push to GitHub, Railway shows "Deployment successful", but the browser shows old behaviour.

**Fix:**
1. Hard refresh: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac). The new JS bundle has a different filename than the cached one.
2. Check the `<script>` tag in page source. The filename is `main.<hash>.js`. After a real rebuild this hash changes.
3. If after hard refresh the hash is the same, the build didn't actually pick up the new code. Force a fresh build:
   - Railway → frontend → Variables → add `DEPLOY_NONCE=anything-different` (or change to a new value if it exists).
   - Click **Deploy Changes**.
   - Railway rebuilds from latest commit on `main`.

---

## Recipe — Roll back a bad deploy

**Symptom:** the new version broke something. Need to revert fast.

**Fix:**
1. Railway → affected service → Deployments tab.
2. Scroll the History list to find the previous successful deploy (status REMOVED, but it's still in the list).
3. Kebab menu on that row → **Redeploy**.
4. Within ~30 seconds it becomes active.
5. The bug is on `main` — open the offending commit on GitHub, fix it, push, and Railway will redeploy automatically (or use the env var trick above).

---

## Recipe — Database is full / running out of disk

**Symptom:** Postgres metrics in Railway show storage near 100%, or queries are getting slow.

**Fix:**
1. Railway → Postgres service → Volumes tab → increase the volume size (small fee for the extra GBs).
2. **Or** clean up unused data:
   - `audit_logs` and old `bookings` are usually the biggest tables.
   - Run cleanup SQL via `npx prisma studio` (if you've installed Prisma locally with the right `DATABASE_URL`) or via `psql` with the Postgres connection string.

---

## Recipe — Suspect security issue

**Symptom:** suspicious logins, unauthorised access, or a leaked credential.

**Immediate steps:**
1. **Rotate JWT_SECRET** (see recipe above). Forces everyone to re-login.
2. **Rotate SUPERADMIN_PASSWORD** (see recipe above).
3. SUPER_ADMIN → Platform Admin → **Suspend** any tenant that looks compromised.
4. Check Railway → backend → Logs tab for the timeframe of concern. Filter for the suspected email address.
5. If a PayPal Client ID/Secret was leaked: rotate them at developer.paypal.com and update the affected tenant in Tenant Settings.

---

## Where to find what

| What | Location |
|------|----------|
| Live app | <https://app.safremanasik.com> |
| Backend logs | Railway → backend → Logs |
| DB | Railway → Postgres → Connect (gives you a public connection string) |
| DNS | Cloudflare → safremanasik.com → DNS |
| Source code | <https://github.com/faizanhafiz1985/safre-manasik-saas> |
| Diagnostics in-app | SUPER_ADMIN sidebar → Diagnostics |

---

## Last resort — hire a developer for 1 hour

Any competent Node.js + React developer can dive in. Hand them:
- This repo URL
- Read-only Railway access (Settings → Members → Invite)
- This file + the Word doc

Most maintenance asks take 30–60 min. Typical rates: USD 20–60/hour on Upwork / Toptal.
