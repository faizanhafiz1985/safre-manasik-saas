# Setting up `app.safremanasik.com` via Cloudflare DNS

**Why this guide:** Dynadot's DNS panel refuses subdomains that contain a leading underscore (e.g. `_railway-verify.app`), which Railway requires for its TXT verification record. Cloudflare's free DNS accepts these records and is more reliable in general. This switches your domain's *nameservers* (not your domain registration — your domain stays at Dynadot) to Cloudflare.

**Time required:** 15 minutes setup, then 5 – 60 minutes for nameserver propagation.

**Cost:** USD 0. Cloudflare's free plan is sufficient.

---

## Step 1 — Sign up for Cloudflare

1. Go to <https://dash.cloudflare.com/sign-up>
2. Create an account with your email
3. Verify the email

## Step 2 — Add `safremanasik.com` to Cloudflare

1. Click **Add a Site** on the Cloudflare dashboard
2. Type `safremanasik.com` (no www, no https) → **Continue**
3. Pick the **Free** plan → **Continue**
4. Cloudflare scans your existing DNS records and imports them. Confirm.

## Step 3 — Get Cloudflare's nameservers

Cloudflare will show you two nameservers like:
- `ada.ns.cloudflare.com`
- `bob.ns.cloudflare.com`

**Copy both** — you'll paste them into Dynadot in the next step. The exact names differ per account.

## Step 4 — Point Dynadot to Cloudflare's nameservers

1. Log in to Dynadot at <https://www.dynadot.com>
2. **My Domains → Manage Domains** → click `safremanasik.com`
3. Left sidebar: **Name Servers**
4. Change DNS type from **Dynadot DNS** to **Name Servers**
5. Paste the two Cloudflare nameservers into the Name Server 1 and Name Server 2 fields
6. **Save**

Dynadot warns that this will take effect immediately. Confirm.

## Step 5 — Add Railway's DNS records in Cloudflare

Back in Cloudflare → your domain → **DNS → Records** → **Add record**. Add these three records:

| Type   | Name              | Target / Content                                                                                  | Proxy status (orange cloud) |
|--------|-------------------|---------------------------------------------------------------------------------------------------|-----------------------------|
| CNAME  | `app`             | `jvgh07ae.up.railway.app`                                                                          | **DNS only** (grey cloud)   |
| CNAME  | `api`             | `62j7zu2f.up.railway.app`                                                                          | **DNS only** (grey cloud)   |
| TXT    | `_railway-verify.app` | `railway-verify=006886178dff56457323bf53de8bc0dc8f0015b4b8866f2ee68811f508555c1d`              | n/a                         |

> ⚠️ **Important:** the **orange cloud (proxy) must be OFF** for the CNAME records. Cloudflare's proxy interferes with Railway's edge SSL termination. Click the cloud icon to toggle it grey ("DNS only").

> ⚠️ If Railway has issued you different verification tokens since these were captured, replace the TXT value with the one shown in Railway → frontend service → Settings → Networking → app.safremanasik.com → **Show DNS records**. Same for `api.safremanasik.com` on the backend service if it shows a separate TXT.

## Step 6 — Wait for propagation

DNS changes propagate in 5 – 60 minutes. Verify progress at:
- <https://dnschecker.org/#CNAME/app.safremanasik.com>
- <https://dnschecker.org/#TXT/_railway-verify.app.safremanasik.com>

Once you see the records populated globally, move on.

## Step 7 — Railway issues SSL certificates

Back in Railway:
1. **Frontend service** → Settings → Networking — `app.safremanasik.com` should now show **Verified** with a green check.
2. Railway automatically issues a Let's Encrypt cert (1 – 2 minutes).
3. Same for the **backend service** → `api.safremanasik.com`.

If a domain shows "Pending DNS check" for longer than 15 minutes, the records still haven't propagated — be patient.

## Step 8 — Update env vars to use the new domains

Backend service → Variables:
```
FRONTEND_URL=https://app.safremanasik.com
```

Frontend service → Variables — these can now optionally be reverted to the custom domain:
```
BACKEND_URL=https://api.safremanasik.com
REACT_APP_API_URL=/api      ← keep as /api; nginx still proxies same-origin
```

Click **Deploy Changes** on each. Both services redeploy.

## Step 9 — Test

Open `https://app.safremanasik.com/login` in your browser.

You should see the Safre Manasik login page, served over HTTPS from your custom domain. The padlock should be green and the certificate should be issued by Let's Encrypt.

---

## Optional — Redirect the apex `safremanasik.com` to `app.safremanasik.com`

In Cloudflare:
1. **Rules → Redirect Rules → Create rule**
2. **When incoming requests match:** hostname equals `safremanasik.com`
3. **Then:** static redirect → `https://app.safremanasik.com/$1`
4. Status: 301 Permanent
5. Deploy

---

## Troubleshooting

| Symptom                                              | Cause                                                | Fix                                                                  |
|------------------------------------------------------|-------------------------------------------------------|-----------------------------------------------------------------------|
| "DNS check pending" forever in Railway              | Records not yet propagated                            | Wait — confirm on dnschecker.org                                      |
| Loads but "Connection not secure"                   | SSL not yet issued                                    | Wait 5 more minutes after CNAME verified                              |
| Browser shows Railway 404 on `app.safremanasik.com` | Orange cloud (proxy) is ON for the CNAME              | Turn proxy OFF (grey cloud) in Cloudflare DNS                         |
| "ERR_TOO_MANY_REDIRECTS"                            | Apex redirect loops back to itself                    | Make sure the redirect target is `app.` not `@`                       |
| Subdomain works but apex doesn't                    | No apex record / no redirect                          | Use the "Optional — Redirect apex" step above                         |
| Old DNS responses persist                           | Browser / OS DNS cache                                | Ctrl+Shift+R, or `ipconfig /flushdns` on Windows                      |

---

## Why move DNS to Cloudflare?

- **Free.** Forever.
- **Allows the records Dynadot rejects.** Railway, Vercel, GCP, and many other PaaS providers require underscore-prefixed TXT records for verification. Dynadot's UI doesn't accept them.
- **Faster global propagation.** Cloudflare's anycast network is one of the largest in the world.
- **Free DDoS protection** at the DNS layer.
- **Easy DNS records UI** — adding / editing / deleting records is a 10-second click.
- **Your domain stays at Dynadot.** You don't transfer the domain; you just change its nameservers. Renewals still happen at Dynadot.

When you're ready, follow the steps above. Total clicking time: ~15 minutes plus DNS waiting time.
