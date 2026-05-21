# Safre Manasik SaaS — Deployment Guide

A cloud-agnostic deployment guide. Tested patterns for AWS, DigitalOcean, and any Docker-capable VPS.

---

## Architecture

```
   Internet
      │
      ▼
   ┌─────────────────────────────┐
   │  Nginx Reverse Proxy        │  ports 80, 443
   │  (rate limit, SSL, headers) │
   └──────┬───────────────┬──────┘
          │               │
          ▼               ▼
   ┌──────────┐    ┌─────────────┐
   │ Frontend │    │   Backend   │  internal :5000
   │ (React)  │    │  (Node API) │
   └──────────┘    └──┬──────┬───┘
                      │      │
                      ▼      ▼
             ┌──────────┐  ┌────────┐
             │ Postgres │  │ Redis  │
             │   :5432  │  │ :6379  │
             └──────────┘  └────────┘
```

All services run as containers on a shared `safre_net` bridge network. Only the proxy exposes public ports.

---

## Prerequisites

- **Server**: 4 vCPU, 8 GB RAM, 80 GB SSD minimum (`db.t3.medium` / DigitalOcean 8 GB droplet)
- **Docker**: 24+ with Compose plugin
- **Domain**: A registered domain pointing to the server IP
- **SSL certificate**: Let's Encrypt via Certbot (free) or your CA
- **Region**: AWS me-south-1 (Bahrain) or me-central-1 (UAE) for proximity to Saudi customers

---

## First-Time Deployment

### 1. Clone and configure

```bash
git clone <your-repo-url> /opt/safre
cd /opt/safre
cp .env.production.example .env.production
nano .env.production    # Fill in all values
```

Critical values to set:
- `POSTGRES_PASSWORD` — generate with `openssl rand -base64 24`
- `REDIS_PASSWORD`    — generate with `openssl rand -base64 24`
- `JWT_SECRET`        — **generate with `openssl rand -base64 48`** (32+ char minimum)
- `FRONTEND_URL`      — `https://app.yourdomain.com`
- `REACT_APP_API_URL` — `https://api.yourdomain.com/api`

### 2. Obtain SSL certificate (Let's Encrypt)

```bash
# Stop anything on port 80 first
sudo systemctl stop nginx 2>/dev/null || true
sudo docker compose -f docker-compose.prod.yml down 2>/dev/null || true

sudo apt install certbot
sudo certbot certonly --standalone -d app.yourdomain.com -d api.yourdomain.com

# Copy certs into the proxy folder
sudo mkdir -p ./proxy/ssl
sudo cp /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem ./proxy/ssl/
sudo cp /etc/letsencrypt/live/app.yourdomain.com/privkey.pem ./proxy/ssl/
sudo chown -R 1000:1000 ./proxy/ssl
```

### 3. Update the nginx config with your domain

Edit `proxy/nginx.conf` and replace `server_name _;` with your actual domain on the HTTPS server block.

### 4. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Watch logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Initialise the database

```bash
docker exec safre_backend npx prisma db push --accept-data-loss
docker exec safre_backend node seeds/seed.js
```

### 6. Verify

```bash
curl https://api.yourdomain.com/health
# → { "status": "ok", ... }
```

Open `https://app.yourdomain.com` in a browser and log in with the seeded super-admin credentials.

---

## Production Readiness Checklist

| | Item |
|---|---|
| ☐ | Strong `JWT_SECRET` (48+ random bytes) |
| ☐ | Strong `POSTGRES_PASSWORD` and `REDIS_PASSWORD` |
| ☐ | SSL certificate valid and auto-renewing |
| ☐ | `seed.js` has been run, or production data migrated in |
| ☐ | Super admin password changed from default (`Super@2026!`) |
| ☐ | Demo tenant accounts deactivated or removed |
| ☐ | Daily database backups configured (`scripts/backup-db.sh` in cron) |
| ☐ | Off-site backup destination (S3 bucket) configured |
| ☐ | Sentry or CloudWatch error monitoring wired in |
| ☐ | Domain DNS pointing to server |
| ☐ | Server firewall: only ports 80, 443, 22 open |
| ☐ | SSH disabled with passwords; key-only auth |
| ☐ | `fail2ban` or similar for SSH brute-force |
| ☐ | Disk monitoring / auto-resize configured |
| ☐ | At least one trial restore from backup performed |

---

## Daily Operations

### View logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Run backup manually
```bash
sudo /opt/safre/scripts/backup-db.sh
```

### Restore from backup
```bash
sudo /opt/safre/scripts/restore-db.sh /var/backups/safre/safre_20260521_020000.sql.gz
```

### Update the application
```bash
cd /opt/safre
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
# Run any pending migrations
docker exec safre_backend npx prisma db push
```

### Scale up
- Vertical: stop, resize VM, restart
- Horizontal: see "Multi-instance deployment" below

---

## Multi-Instance Deployment (Future)

For tenant counts > 50, move to:

1. **Managed PostgreSQL** (AWS RDS, Aiven, Supabase)
2. **Managed Redis** (AWS ElastiCache, Redis Cloud)
3. **Multiple backend instances** behind an ALB
4. **PgBouncer** for connection pooling
5. **Read replica** for report queries
6. **CloudFront / Cloudflare** in front of the frontend bundle

The application is already stateless — scaling is purely an infrastructure exercise.

---

## Backup Schedule (Cron)

Add to root crontab:

```cron
# Daily PostgreSQL backup at 02:00 server time
0 2 * * * /opt/safre/scripts/backup-db.sh >> /var/log/safre-backup.log 2>&1

# Optional: weekly health summary
0 8 * * 1 docker stats --no-stream safre_backend safre_postgres safre_redis | mail -s "Safre Weekly Health" ops@yourdomain.com
```

---

## Compliance Notes (Saudi Arabia)

- **Data residency**: Hosting in `me-south-1` (Bahrain) or `me-central-1` (UAE) is recommended for Saudi customers.
- **ZATCA e-invoicing**: Required for all invoices. Integration is out of scope for this base deployment; coordinate with ZATCA-certified solution providers.
- **PDPL (Personal Data Protection Law)**: Pilgrim PII must remain in-region. Avoid offshoring backups outside the Gulf.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `502 Bad Gateway` from proxy | Backend not started or crashed | `docker logs safre_backend` and inspect |
| Frontend shows but API calls fail | `REACT_APP_API_URL` mismatch | Rebuild frontend with correct value |
| Login returns "Tenant suspended" | Tenant status is SUSPENDED | Super admin → activate tenant |
| `EADDRINUSE` on startup | Port 80/443 already in use | `sudo lsof -i :80` and stop the process |
| Slow report queries | Missing indexes | `EXPLAIN ANALYZE` and add as needed |
| PDF generation fails | Chromium missing in container | Rebuild backend image (Dockerfile installs it) |

---

## Contacts

For deployment issues with this exact codebase, the relevant files are:
- `docker-compose.prod.yml` — service definitions
- `proxy/nginx.conf` — TLS, routing, rate limiting
- `.env.production` — secrets (never committed)
- `backend/Dockerfile` — backend image build
- `frontend/Dockerfile` — frontend image build
