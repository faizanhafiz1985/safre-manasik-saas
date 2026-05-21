# ─── Stage 1: Builder ─────────────────────────────────────────────────────
FROM node:18-bullseye-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --only=production && npm cache clean --force
RUN npx prisma generate

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────
FROM node:18-bullseye-slim AS runtime

# Chromium + fonts for Puppeteer (voucher PDF generation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    chromium \
    fonts-liberation fonts-noto fonts-noto-cjk fonts-noto-color-emoji fonts-dejavu \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libasound2 libcairo2 libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Non-root user (Railway runs containers as non-root by default)
RUN groupadd -r app && useradd -r -g app -m -d /home/app app

WORKDIR /app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/prisma ./prisma
COPY --chown=app:app . .

RUN mkdir -p /app/logs /app/uploads && chown -R app:app /app/logs /app/uploads

USER app

# Railway sets $PORT. Default to 5000 for local docker-compose.
ENV PORT=5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||5000)+'/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Run prisma db push to apply schema, then start the server.
# This makes first-deploy painless on Railway. After first deploy, prisma db push is a no-op.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/server.js"]
