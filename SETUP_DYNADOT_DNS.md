# Pointing a Dynadot Domain at Railway

You have a domain at Dynadot. You want `app.yourdomain.com` (frontend) and `api.yourdomain.com` (backend) to point at Railway.

**Time required:** 10 minutes setup, plus 5–60 minutes for DNS propagation.

---

## Step 1 — Get Railway's CNAME targets

In Railway:

1. Open your **frontend** service
2. **Settings → Networking → Custom Domain**
3. Click **+ Add Custom Domain**
4. Enter `app.yourdomain.com` (replace `yourdomain.com` with your real domain)
5. Railway gives you a CNAME target like `xyz123.up.railway.app` — **copy this**

Do the same for **backend** service, with `api.yourdomain.com`. Copy that CNAME target too.

You now have:
- **app.yourdomain.com** → CNAME → `xyz123.up.railway.app`
- **api.yourdomain.com** → CNAME → `abc456.up.railway.app`

---

## Step 2 — Configure Dynadot DNS

1. Log into Dynadot at <https://www.dynadot.com>
2. **My Domains → Manage Domains** → click your domain
3. In the left sidebar: **DNS Settings**
4. Make sure the DNS type is **Dynadot DNS** (not "Forwarding" or "Parking")

You'll see a table for DNS records. Add two CNAME records:

| Subdomain | Record Type | IP Address or Target |
|---|---|---|
| `app` | CNAME | `xyz123.up.railway.app` (from Railway) |
| `api` | CNAME | `abc456.up.railway.app` (from Railway) |

**Important:** Do NOT include `https://` or trailing slashes. Just the hostname.

Click **Save DNS**.

---

## Step 3 — Wait for DNS propagation

DNS changes can take anywhere from **5 minutes to 1 hour** to propagate globally. You can check progress at:

<https://dnschecker.org/#CNAME/app.yourdomain.com>

Once you see the CNAME populated globally, move on.

---

## Step 4 — Tell Railway to issue SSL certs

Back in Railway:

1. Frontend service → Settings → Networking
2. Next to your custom domain, you should now see **"Verified"** with a green check
3. Railway automatically issues a free Let's Encrypt certificate — wait 1–2 minutes

If it shows "Pending DNS check" longer than 10 minutes, the CNAME hasn't propagated yet. Wait longer.

Do the same for backend.

---

## Step 5 — Update environment variables

Once both domains are verified and SSL is issued:

**Backend** service → Variables:
```
FRONTEND_URL=https://app.yourdomain.com
```

**Frontend** service → Variables:
```
REACT_APP_API_URL=https://api.yourdomain.com/api
```

Both services will redeploy. The frontend redeployment includes a fresh build because `REACT_APP_API_URL` is baked in at build time.

---

## Step 6 — Test

Open `https://app.yourdomain.com` in your browser.

You should see the Safre Manasik login screen, served from your domain over HTTPS.

---

## Bonus — Redirect apex (`yourdomain.com`) to `app.yourdomain.com`

If you want plain `yourdomain.com` (no `app.`) to redirect to the app:

### Option A: Dynadot URL forwarding (simplest)
1. Dynadot → your domain → **Forward** (in left sidebar)
2. Type: **301 Permanent Redirect**
3. Forward to: `https://app.yourdomain.com`
4. Save

### Option B: ALIAS / ANAME record
Dynadot supports `ANAME` (apex CNAME) on its DNS. Add an `ANAME` for `@` pointing to your Railway frontend hostname. This is cleaner but slightly more complex.

---

## Email considerations

DNS changes here do **not** affect email. If you use `you@yourdomain.com` for email, that's handled by separate MX records, which Dynadot manages independently.

If you don't have email yet and want `info@yourdomain.com`, set up Google Workspace or Zoho Mail and add their MX records to Dynadot.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "DNS check pending" forever in Railway | CNAME hasn't propagated | Wait longer; verify on dnschecker.org |
| Site loads but shows "Connection not secure" | SSL not yet issued | Wait 5 more minutes after CNAME verified |
| "ERR_TOO_MANY_REDIRECTS" | Both apex forwarding AND CNAME set | Remove one |
| Subdomain works but apex doesn't | Apex needs ANAME or forwarding | Use the Bonus section above |
| Old data showing — even after CNAME change | Browser DNS cache | Hard refresh: Ctrl+Shift+R, or `ipconfig /flushdns` |

---

## You're done

Your SaaS is now at `https://app.yourdomain.com`, fully HTTPS, hosted on Railway, with CI/CD from GitHub. Every push to `main` deploys automatically.
