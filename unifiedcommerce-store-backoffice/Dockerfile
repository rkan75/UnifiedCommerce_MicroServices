# Backoffice (Vite SPA) - GCP Cloud Run
# Build-time: VITE_MEDUSA_BACKEND_URL (backend API origin, e.g. https://medusa-backend-xxx.run.app)

FROM node:20-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Backend URL is baked into the bundle at build time (Vite env)
ARG VITE_MEDUSA_BACKEND_URL=
ENV VITE_MEDUSA_BACKEND_URL=$VITE_MEDUSA_BACKEND_URL

RUN npm run build

# Production: serve static files (SPA with history fallback)
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

RUN npm install -g serve@14

COPY --from=builder /app/dist ./dist

# Cloud Run sets PORT at runtime
CMD ["sh", "-c", "exec serve -s dist -l ${PORT:-8080}"]
