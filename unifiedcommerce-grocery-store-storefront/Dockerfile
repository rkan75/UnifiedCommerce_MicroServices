# Next.js Storefront - GCP Cloud Run
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Build Next.js
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Required at build time (NEXT_PUBLIC_* are baked into the bundle)
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_f8e261468637babef6c09293ce362076755f516c3fd5fb40355e8b90c964eb42
ARG NEXT_PUBLIC_BASE_URL=https://localhost:8000
ARG MEDUSA_BACKEND_URL=https://localhost:9000
# Algolia search (optional) - use Search-Only API Key; backend uses Admin API Key
ARG NEXT_PUBLIC_ALGOLIA_APP_ID=8UPZHDU2DT
ARG NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=869234ab00b84d5ec9fcc79f1ff48658
ARG NEXT_PUBLIC_ALGOLIA_INDEX_NAME=products

ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_ALGOLIA_APP_ID=$NEXT_PUBLIC_ALGOLIA_APP_ID
ENV NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=$NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY
ENV NEXT_PUBLIC_ALGOLIA_INDEX_NAME=$NEXT_PUBLIC_ALGOLIA_INDEX_NAME

RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8000
EXPOSE 8000

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/patch-url-for-cloudrun.js ./patch-url-for-cloudrun.js

USER nextjs

# Cloud Run decodes URLs; re-encode @ for parallel-route chunks (Next.js #71626)
CMD ["node", "-r", "./patch-url-for-cloudrun.js", "server.js"]
