# syntax=docker/dockerfile:1

# ==============================================================================
# Stage 1: Install dependencies & compile all 9 Vite sub-applications
# ==============================================================================
FROM node:22-alpine AS build
WORKDIR /app

# Install production-only root backend dependencies in an isolated snapshot
COPY package*.json ./
RUN (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund) \
    && cp -R node_modules /tmp/prod_node_modules

# Copy source tree (.dockerignore excludes host node_modules, dist, .env, data, .git)
COPY . .

# Install & build every sub-application and verify each bundle produces dist/index.html
RUN set -eux; \
    for app in \
      neon-orbit \
      star_locator \
      chem-lab \
      chill-hub \
      shape-wars \
      sonic-soccer \
      nond_ex \
      alien-echo \
      pirate-fishing; \
    do \
      echo "==> Building sub-app: ${app}"; \
      (cd "${app}" && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) && npm run build); \
      test -f "${app}/dist/index.html"; \
    done

# ==============================================================================
# Stage 2: Minimal Hardened Production Runtime (non-root `node` user)
# ==============================================================================
FROM node:22-alpine AS production

# tini reaps zombie processes and forwards SIGTERM/SIGINT cleanly to Node
RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/hub_db.json

# Copy root production modules & backend source files (owned by root, readable by node)
COPY --from=build /tmp/prod_node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server.js ./
COPY --from=build /app/security.js ./
COPY --from=build /app/database.js ./
COPY --from=build /app/quantumCrypto.js ./

# Copy Launchpad Dashboard static assets
COPY --from=build /app/dashboard ./dashboard

# Copy compiled static bundles for all 9 sub-apps
# Note: star_locator directory is mounted at /star-locator in server.js; nond_ex at /nond_ex
COPY --from=build /app/neon-orbit/dist ./neon-orbit/dist
COPY --from=build /app/star_locator/dist ./star_locator/dist
COPY --from=build /app/chem-lab/dist ./chem-lab/dist
COPY --from=build /app/chill-hub/dist ./chill-hub/dist
COPY --from=build /app/shape-wars/dist ./shape-wars/dist
COPY --from=build /app/sonic-soccer/dist ./sonic-soccer/dist
COPY --from=build /app/nond_ex/dist ./nond_ex/dist
COPY --from=build /app/alien-echo/dist ./alien-echo/dist
COPY --from=build /app/pirate-fishing/dist ./pirate-fishing/dist

# Ensure application files are world-readable (immutable to non-root) and
# create /app/data owned exclusively by non-root `node` (UID/GID 1000) for atomic DB writes
RUN chmod -R a+rX /app \
    && mkdir -p /app/data \
    && chown -R node:node /app/data \
    && chmod 750 /app/data

EXPOSE 3000

# Drop root privileges before running healthchecks or the server
USER node

# Use IPv4 loopback explicitly (server.js binds to 0.0.0.0) without external shell/wget binaries
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
