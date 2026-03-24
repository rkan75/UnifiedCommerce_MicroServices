# Medusa Backend + Admin - GCP Cloud Run
# Per official docs: https://docs.medusajs.com/learn/build
# Run from .medusa/server which contains the standalone production build
FROM node:20-alpine AS base

WORKDIR /app

# Install all deps (including dev) for build (postinstall runs patch-package + scripts/apply-admin-branding.js)
FROM base AS deps
COPY package.json package-lock.json* ./
COPY scripts ./scripts
COPY patches ./patches
RUN npm ci --legacy-peer-deps

# Build Medusa (creates .medusa/server with compiled JS, medusa-config.js, admin)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx medusa build

# Production image - run from .medusa/server per official deployment guide
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=9000
EXPOSE 9000

RUN addgroup -g 1001 -S nodejs
RUN adduser -S medusa -u 1001

# Use the standalone build from .medusa/server
COPY --from=builder /app/.medusa/server ./
# Startup wrapper listens on PORT immediately (so Cloud Run probe passes), then preflight + Medusa or 503
COPY --from=builder /app/scripts/cloud-run-db-preflight.js ./scripts/
COPY --from=builder /app/scripts/cloud-run-start.js ./scripts/

# Install production deps in .medusa/server (has its own package.json). Skip scripts so postinstall (patch-package, apply-admin-branding) does not run—already applied in deps stage.
RUN npm ci --omit=dev --ignore-scripts --legacy-peer-deps && rm -rf /root/.npm

# Medusa expects to run from project root; .medusa/server IS the built "root"
WORKDIR /app

USER medusa

# Listen on PORT immediately; run preflight then start Medusa on internal port and proxy (or serve 503 if DB down).
CMD ["node", "scripts/cloud-run-start.js"]
