# ─── Stage 1: Builder ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev

COPY . .

# Build-time API URL injection. On Railway, set this to the public backend URL
# (e.g. https://safre-backend-production.up.railway.app/api).
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# ─── Stage 2: Nginx ───────────────────────────────────────────────────────
FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Railway provides $PORT — nginx must listen on it.
# Use envsubst to expand ${PORT} into the final config at runtime.
ENV PORT=80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:${PORT}/ || exit 1

EXPOSE 80

# The official nginx:alpine image has an entrypoint that runs envsubst on
# /etc/nginx/templates/*.template into /etc/nginx/conf.d/ at container start,
# so the ${PORT} placeholder gets replaced with Railway's assigned port.
CMD ["nginx", "-g", "daemon off;"]
