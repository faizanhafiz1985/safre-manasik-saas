# Railway Deployment Guide

End-to-end: from the code you have right now to a live SaaS on a public URL.

**Time required:** 20–30 minutes for first deploy.

**You will need:**
- A GitHub account (free at <https://github.com>)
- A Railway account (free at <https://railway.app> — sign in with GitHub)
- Your PayPal credentials from [SETUP_PAYPAL.md](SETUP_PAYPAL.md) (optional — start with stub mode)

You will end up with:
- A public URL like `https://safre-frontend-production-1a2b.up.railway.app`
- A backend API at `https://safre-backend-production-1a2b.up.railway.app`
- A managed PostgreSQL database
- Automatic redeployment every time you push to GitHub

---

## Step 1 — Push your code to GitHub

Open a terminal in your project folder:

```bash
cd "C:\Users\fub7209\.claude\projects\Safre Manasik Application"

# Initialize git if not already done
git init
git branch -M main

# Add a sensible .gitignore (already done — verify)
type .gitignore  # Windows  /  cat .gitignore on mac/linux
```

If you don't have a `.gitignore`, create one:

```
node_modules
.env
.env.*
!.env.production.example
build
dist
*.log
.DS_Store
backend/uploads
backend/logs
.playwright-mcp
*.png
proxy/ssl
```

Then:

```bash
git add .
git commit -m "Initial commit: Safre Manasik SaaS v2.0"

# Create a new GitHub repo at https://github.com/new (call it "safre-manasik-saas")
# Make it PRIVATE — it contains your business logic.
# Then:

git remote add origin https://github.com/<your-username>/safre-manasik-saas.git
git push -u origin main
```

---

## Step 2 — Create a Railway project

1. Open <https://railway.app/new>
2. Click **Deploy from GitHub repo**
3. Authorize Railway to access your GitHub
4. Pick the `safre-manasik-saas` repo
5. Railway scans the repo and shows a list of services — you'll see it pick up Dockerfiles

It'll likely deploy the **wrong thing** initially (probably it tries to deploy the root as one service). Don't worry — we'll fix it.

---

## Step 3 — Configure two services

In Railway's project view, you should have **one service** auto-created. We need **two**: `backend` and `frontend`. Plus a managed Postgres.

### a. Delete the auto-created service

If Railway created one wrong service, click it → Settings → **Delete service**.

### b. Add the Postgres database

Click **+ New** → **Database** → **Add PostgreSQL**.

Railway provisions it instantly. Click the new service to see its **Variables** tab — there's a `DATABASE_URL` variable here. Copy its value (right-click → Copy).

### c. Add the backend service

Click **+ New** → **GitHub Repo** → pick `safre-manasik-saas`.

In **Settings**:
- **Root Directory**: `/backend`
- **Service Name**: `backend`
- **Builder**: Dockerfile (auto-detected from `backend/railway.json`)
- **Watch Paths**: `backend/**` (only redeploy when backend files change)

In **Variables** → click **+ New Variable** and add **each** of these:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Click "Add Reference" → pick the Postgres service → `DATABASE_URL` |
| `JWT_SECRET` | Generate with: `openssl rand -base64 48` (run this in any terminal) |
| `JWT_EXPIRES_IN` | `7d` |
| `FRONTEND_URL` | (leave blank for now — we'll set it after frontend deploys) |
| `PAYPAL_MODE` | `sandbox` (or `stub` if you don't have credentials yet) |
| `PAYPAL_CLIENT_ID` | from PayPal sandbox app (or leave blank for stub) |
| `PAYPAL_CLIENT_SECRET` | from PayPal sandbox app (or leave blank for stub) |

Click **Deploy** at the top. Wait 3–5 minutes for the first build.

Once it's deployed, go to **Settings → Networking → Generate Domain** to get a public URL like `https://backend-production-1a2b.up.railway.app`. **Copy this URL.**

### d. Add the frontend service

Click **+ New** → **GitHub Repo** → pick `safre-manasik-saas` (same repo, different service).

In **Settings**:
- **Root Directory**: `/frontend`
- **Service Name**: `frontend`
- **Builder**: Dockerfile
- **Watch Paths**: `frontend/**`

In **Variables**:

| Variable | Value |
|---|---|
| `REACT_APP_API_URL` | `https://backend-production-1a2b.up.railway.app/api` (from step c) |

Important: This is a **build-time** variable. Click the variable, hit the cogwheel, and tick **"Used in build"**.

Click **Deploy**. Wait 5–8 minutes for the first build.

Generate a public domain for the frontend too. You'll get something like `https://frontend-production-5e6f.up.railway.app`.

### e. Finish wiring CORS

Go back to the **backend** service → Variables → set:

```
FRONTEND_URL=https://frontend-production-5e6f.up.railway.app
```

The backend will redeploy automatically.

---

## Step 4 — Seed the database

Open the **backend** service → click the latest deployment → **Logs**. Wait for:

```
info: Safre Manasik SaaS API running on port ...
```

Once it's up, click the three-dot menu on the deployment → **"Connect via Railway CLI"** to get a shell, or use the simpler approach: **a one-time seed via Railway's web shell**.

```bash
# Option 1: Use Railway CLI (after `npm i -g @railway/cli` and `railway login`)
railway run --service backend node seeds/seed.js

# Option 2: SSH into the service (Railway > backend > Settings > "Run a command")
#   Command: node seeds/seed.js
```

You should see the success banner with credentials.

---

## Step 5 — Visit the app

Open `https://frontend-production-5e6f.up.railway.app` (your frontend URL) in a browser.

Log in with:
- Super Admin: `superadmin@safremanasik.com` / `Super@2026!`

**Immediately change the super admin password** (you can use the profile menu).

You're live!

---

## Step 6 — Connect your Dynadot domain

See [SETUP_DYNADOT_DNS.md](SETUP_DYNADOT_DNS.md).

---

## Step 7 — Set up automatic redeployment

Already done. Every time you `git push` to `main`, Railway rebuilds the changed service(s). No further config needed.

---

## Cost expectations

Railway charges by usage. Starter plan:

| Service | Usage | Estimated cost |
|---|---|---|
| Backend (Node API) | 512 MB RAM, occasional CPU | $3–5/mo |
| Frontend (nginx) | 128 MB RAM, low traffic | $1–2/mo |
| PostgreSQL | 256 MB RAM, 1 GB storage | $5/mo |
| **Total starter** | | **~$10–15/mo** |

At 10 active tenants and 1000 bookings/month, expect **$20–35/mo**.

You can set a billing cap in Railway → Account → Usage.

---

## Updating the app

```bash
# Make your changes
git add .
git commit -m "fix: whatever you fixed"
git push
```

Railway auto-rebuilds and redeploys. Watch the deployment in the Railway dashboard.

Database schema changes are handled automatically because the backend startup command runs `npx prisma db push` — but for production-grade migrations, switch to `prisma migrate deploy` once you have real users (see Prisma docs).

---

## Troubleshooting

### Backend won't start: `EADDRINUSE` or port issues
- Railway sets `PORT` env var dynamically. Server.js reads `process.env.PORT || 5000`. Make sure no hardcoded port is overriding this.

### Frontend shows but API calls fail
- `REACT_APP_API_URL` was wrong at build time. Update the variable, then go to **Deployments → Redeploy** (a fresh build is needed because React env vars are baked in at build).

### "CORS error" in browser console
- `FRONTEND_URL` on the backend doesn't match the actual frontend URL. Update it and the backend will redeploy.

### Database connection errors
- Confirm the `DATABASE_URL` reference is set correctly (should resolve to `postgres://postgres:...@<host>:5432/railway`).

### `prisma generate` fails in build
- Should not happen with the current Dockerfile, but if it does: in Railway → Settings → Build Command, override with `npx prisma generate && npm ci`.

### Cannot upload files / vouchers fail
- Railway's filesystem is **ephemeral** — files are lost on redeploy. The voucher PDF generation works because it streams the PDF response. But if you add features that write files to disk, you'll need to add a Railway Volume (Settings → Volumes) or switch to S3/R2.

---

## Done. Next steps

1. ✅ Deploy successful → app is live
2. → [SETUP_DYNADOT_DNS.md](SETUP_DYNADOT_DNS.md) — point your domain
3. → [SETUP_PAYPAL.md](SETUP_PAYPAL.md) — wire up real PayPal credentials
4. → Change super admin password
5. → Create your first real tenant via `/signup`
