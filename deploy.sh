#!/usr/bin/env bash
# ==============================================================================
# Swiss Knife Hub — Hardened Build & Bare-Metal/PM2 Deployment Script
# ==============================================================================
# Usage:
#   ./deploy.sh                  # Install, audit, build all 9 sub-apps, and reload PM2
#   ./deploy.sh --build-only     # Install & build all 9 sub-apps without restarting PM2
#   ./deploy.sh --upgrade-deps   # Run `npm update` + `npm audit fix` before building
#   ./deploy.sh --skip-audit     # Skip `npm audit` advisory check
# ==============================================================================

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

BUILD_ONLY=false
UPGRADE_DEPS=false
RUN_AUDIT=true

for arg in "$@"; do
  case "${arg}" in
    --build-only)
      BUILD_ONLY=true
      ;;
    --upgrade-deps)
      UPGRADE_DEPS=true
      ;;
    --skip-audit)
      RUN_AUDIT=false
      ;;
    -h|--help)
      sed -n '2,10p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: ${arg} (use --help for usage)" >&2
      exit 1
      ;;
  esac
done

APPS=(
  "neon-orbit"
  "star_locator"
  "chem-lab"
  "chill-hub"
  "shape-wars"
  "sonic-soccer"
  "nond_ex"
  "alien-echo"
  "pirate-fishing"
)

install_deps() {
  local mode="${1:-all}"
  if [[ "${UPGRADE_DEPS}" == "true" ]]; then
    npm update --no-fund
    npm audit fix --no-fund || true
  elif [[ -f "package-lock.json" ]]; then
    if [[ "${mode}" == "prod" ]]; then
      npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
    else
      npm ci --no-audit --no-fund || npm install --no-audit --no-fund
    fi
  else
    if [[ "${mode}" == "prod" ]]; then
      npm install --omit=dev --no-audit --no-fund
    else
      npm install --no-audit --no-fund
    fi
  fi
}

echo "🚀 Building Swiss Knife Hub in ${SCRIPT_DIR}..."

# 1. Validate production `.env` and `SECURITY_SECRET` when deploying runtime
if [[ "${BUILD_ONLY}" == "false" ]]; then
  if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
    echo "⚠️  WARNING: .env file not found! Creating from .env.example is required for production:" >&2
    echo "    cp .env.example .env && chmod 600 .env" >&2
    echo "    # Generate a 256-bit secret with: openssl rand -hex 32" >&2
  else
    chmod 600 "${SCRIPT_DIR}/.env" || true
    if ! grep -Eq "^SECURITY_SECRET=['\"]?[A-Za-z0-9+/=_-]{32,}" "${SCRIPT_DIR}/.env" \
       || grep -Eq "^SECURITY_SECRET=['\"]?CHANGE_ME" "${SCRIPT_DIR}/.env"; then
      echo "⚠️  WARNING: SECURITY_SECRET in .env is missing, placeholder, or shorter than 32 chars!" >&2
      echo "    Generate a strong production secret immediately:" >&2
      echo "      openssl rand -hex 32" >&2
      echo "    or:" >&2
      echo "      node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"" >&2
    fi
  fi
fi

# Ensure runtime data directory exists with restricted owner-only permissions
mkdir -p "${SCRIPT_DIR}/data"
chmod 700 "${SCRIPT_DIR}/data" || true

# 2. Install & audit root backend dependencies
echo "📦 Installing root production dependencies..."
install_deps "prod"

if [[ "${RUN_AUDIT}" == "true" ]]; then
  echo "🔒 Auditing root production dependencies (high/critical CVEs)..."
  if ! npm audit --omit=dev --audit-level=high; then
    echo "⚠️  High/critical advisories detected in root dependencies. Run './deploy.sh --upgrade-deps' to patch." >&2
  fi
fi

# 3. Install & build all 9 Vite sub-apps in isolated subshells
for app in "${APPS[@]}"; do
  if [[ ! -d "${SCRIPT_DIR}/${app}" ]]; then
    echo "❌ Missing sub-app directory: ${SCRIPT_DIR}/${app}" >&2
    exit 1
  fi
  echo "📦 Building ${app}..."
  (
    cd "${SCRIPT_DIR}/${app}"
    install_deps "all"
    npm run build
  )
  if [[ ! -f "${SCRIPT_DIR}/${app}/dist/index.html" ]]; then
    echo "❌ Build verification failed: ${app}/dist/index.html was not generated!" >&2
    exit 1
  fi
done

echo "✅ All 9 sub-applications built and verified!"

if [[ "${BUILD_ONLY}" == "true" ]]; then
  echo "ℹ️  --build-only specified; skipping PM2 restart."
  exit 0
fi

# 4. Restart or start PM2 process safely
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ℹ️  PM2 is not installed. For Docker deployments run: docker compose up -d --build"
  echo "    For bare-metal PM2 deployments install PM2: npm install -g pm2"
  exit 0
fi

echo "🔄 Reloading PM2 process (swiss-knife-hub)..."
if pm2 describe swiss-knife-hub >/dev/null 2>&1; then
  pm2 restart swiss-knife-hub --update-env
else
  pm2 start "${SCRIPT_DIR}/ecosystem.config.cjs" --env production --update-env
fi

# 5. Verify local health endpoint
PORT_VAL="3000"
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  ENV_PORT="$(sed -n 's/^PORT=\([0-9][0-9]*\).*/\1/p' "${SCRIPT_DIR}/.env" | tail -n 1)"
  if [[ -n "${ENV_PORT}" ]]; then
    PORT_VAL="${ENV_PORT}"
  fi
fi

sleep 2
if node -e "fetch('http://127.0.0.1:${PORT_VAL}/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
  echo "✅ Health check passed at http://127.0.0.1:${PORT_VAL}/health"
else
  echo "⚠️  Server did not respond healthy on port ${PORT_VAL} yet — inspect logs with: pm2 logs swiss-knife-hub --lines 50" >&2
  exit 1
fi
