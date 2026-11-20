import fs from 'fs';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, VALID_GAMES } from './database.js';
import { CRYPTO_SPECS } from './quantumCrypto.js';
import {
  parseCookies,
  sanitizeRedirectPath,
  verifyClearanceToken,
  createSecurityChallenge,
  verifyPuzzleSubmission,
  verifyCodeSubmission,
  clearChallengeInterval
} from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BIND_HOST = process.env.BIND_HOST ? process.env.BIND_HOST.trim() : '0.0.0.0';
const DOMAIN = process.env.DOMAIN ? process.env.DOMAIN.trim() : '';

function normalizeOnionHost(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = trimmed.includes('://') ? new URL(trimmed) : new URL(`http://${trimmed}`);
    if (
      parsed.username ||
      parsed.password ||
      (parsed.pathname && parsed.pathname !== '/') ||
      parsed.search ||
      parsed.hash
    ) {
      return '';
    }
    const host = parsed.host.toLowerCase();
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.onion(?::\d{1,5})?$/i.test(host)) {
      return '';
    }
    return host;
  } catch {
    return '';
  }
}

const ONION_DOMAIN = normalizeOnionHost(process.env.ONION_DOMAIN || '');

function getConfiguredOnionHost() {
  const envVal = process.env.ONION_DOMAIN;
  if (typeof envVal === 'string') {
    return normalizeOnionHost(envVal);
  }
  return ONION_DOMAIN;
}

export function isOnionRequest(req) {
  const host = String(req?.headers?.host || '').trim();
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.onion(?::\d{1,5})?$/i.test(host) && /\.onion(?::\d+)?$/i.test(host);
}

// Disable Express fingerprinting header
app.disable('x-powered-by');

// Trust first reverse proxy (Nginx / Caddy / Cloudflare / Docker bridge)
app.set('trust proxy', 1);

// Sub-application mounts: URL prefix -> workspace directory & human label
const SUB_APPS = Object.freeze([
  { prefix: '/neon-orbit', dir: 'neon-orbit', label: 'Neon Orbit' },
  { prefix: '/star-locator', dir: 'star_locator', label: 'Star Locator' },
  { prefix: '/chem-lab', dir: 'chem-lab', label: 'Chem Lab' },
  { prefix: '/chill-hub', dir: 'chill-hub', label: 'Chill Hub' },
  { prefix: '/shape-wars', dir: 'shape-wars', label: 'Shape Wars' },
  { prefix: '/sonic-soccer', dir: 'sonic-soccer', label: 'Sonic Soccer' },
  { prefix: '/nond_ex', dir: 'nond_ex', label: 'nond_ex' },
  { prefix: '/alien-echo', dir: 'alien-echo', label: 'Alien Echo' },
  { prefix: '/pirate-fishing', dir: 'pirate-fishing', label: 'Pirate Fishing' }
]);

const protectedAppPrefixes = SUB_APPS.map(a => a.prefix);

function isSecureRequest(req) {
  if (req.socket?.encrypted) return true;
  if (isOnionRequest(req)) return false;
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim().toLowerCase() === 'https') {
    return true;
  }
  return false;
}

function buildCookieHeader(req, name, value, maxAgeSec) {
  const safeVal = value ? encodeURIComponent(value) : '';
  const attrs = [
    `${name}=${safeVal}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (isSecureRequest(req)) {
    attrs.push('Secure');
  }
  return attrs.join('; ');
}

function buildCspHeader(pathname) {
  // PixiJS v8 shader uniform system in Neon Orbit requires 'unsafe-eval'; keep all other routes stricter
  const needsUnsafeEval = pathname === '/neon-orbit' || pathname.startsWith('/neon-orbit/');
  const scriptSrc = needsUnsafeEval
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
    : "script-src 'self' 'unsafe-inline' blob:";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "connect-src 'self' https://stream.wikimedia.org https://pubchem.ncbi.nlm.nih.gov https://api.open-meteo.com https://ipapi.co https://raw.githubusercontent.com https://unpkg.com",
    "frame-src 'self' https://pubchem.ncbi.nlm.nih.gov",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

// --- Global Security Headers & Early Path Sanity Guard ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(self), microphone=(self), payment=(), usb=()');
  res.setHeader('Content-Security-Policy', buildCspHeader(req.path || '/'));

  if (isSecureRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Block protocol-relative or backslash-confused request URLs (`//evil.com`, `/\evil.com`)
  if (typeof req.originalUrl === 'string' && /^\/(?:\/|\\|%2f|%5c)/i.test(req.originalUrl)) {
    return res.status(400).json({ success: false, reason: 'Malformed request path.' });
  }

  // Advertise Tor v3 `.onion` mirror on clearnet HTTPS HTML responses (Tor Browser `.onion available` badge)
  const cleanOnionHost = getConfiguredOnionHost();
  if (cleanOnionHost && !isOnionRequest(req) && isSecureRequest(req)) {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      const safeOnionPath = sanitizeRedirectPath(req.originalUrl || '/');
      if (safeOnionPath) {
        const origWriteHead = res.writeHead;
        res.writeHead = function patchedWriteHead(statusCode, statusMessage, headers) {
          const code = Number(statusCode || res.statusCode || 200);
          const hdrObj = typeof statusMessage === 'object' && statusMessage !== null ? statusMessage : headers;
          const ct = String(
            res.getHeader('Content-Type') ||
            hdrObj?.['Content-Type'] ||
            hdrObj?.['content-type'] ||
            ''
          ).toLowerCase();
          if (
            !res.headersSent &&
            (code < 300 || code >= 400) &&
            ct.includes('text/html') &&
            !res.getHeader('Onion-Location')
          ) {
            res.setHeader('Onion-Location', `http://${cleanOnionHost}${safeOnionPath}`);
          }
          return origWriteHead.apply(this, arguments);
        };
      }
    }
  }

  next();
});

// JSON body parser with strict 10kb payload cap
app.use(express.json({ limit: '10kb' }));

// Handle malformed JSON or oversized bodies cleanly without stack trace leaks
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, reason: 'Request payload too large (max 10KB).' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ success: false, reason: 'Invalid JSON request body.' });
  }
  return next(err);
});

// --- Bounded Anti-DDoS & Brute-Force Rate Limiting Store ---
const MAX_RATE_LIMIT_ENTRIES = 5000;
const ipRateLimits = new Map();

function pruneRateLimits(now = Date.now()) {
  for (const [key, record] of ipRateLimits.entries()) {
    const windowExpired = now > record.resetTime;
    const lockExpired = !record.lockedUntil || now >= record.lockedUntil;
    if (windowExpired && lockExpired) {
      ipRateLimits.delete(key);
    }
  }
  while (ipRateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
    let victimKey;
    for (const [key, record] of ipRateLimits.entries()) {
      if (!record.lockedUntil || now >= record.lockedUntil) {
        victimKey = key;
        break;
      }
    }
    if (victimKey === undefined) {
      victimKey = ipRateLimits.keys().next().value;
    }
    if (victimKey === undefined) break;
    ipRateLimits.delete(victimKey);
  }
}

const rateLimitCleanupTimer = setInterval(() => {
  pruneRateLimits();
}, 60 * 1000);
if (typeof rateLimitCleanupTimer.unref === 'function') {
  rateLimitCleanupTimer.unref();
}

function getClientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

// Aggregate flood caps for unauthenticated `.onion` traffic (shared Tor container IP).
// Never set `lockMs > 0` on `onion_anon`, otherwise one troll could lock out every Tor visitor worldwide.
const ONION_ANON_LIMITS = Object.freeze({
  api_global: { maxAttempts: 1200, windowMs: 60 * 1000, lockMs: 0 },
  auth_reg: { maxAttempts: 20, windowMs: 10 * 60 * 1000, lockMs: 0 },
  auth_logout: { maxAttempts: 60, windowMs: 60 * 1000, lockMs: 0 },
  auth_pw_change: { maxAttempts: 30, windowMs: 60 * 1000, lockMs: 0 },
  auth_delete: { maxAttempts: 30, windowMs: 60 * 1000, lockMs: 0 },
  lb_start: { maxAttempts: 120, windowMs: 60 * 1000, lockMs: 0 },
  score_submit: { maxAttempts: 60, windowMs: 60 * 1000, lockMs: 0 },
  sec_challenge: { maxAttempts: 180, windowMs: 60 * 1000, lockMs: 0 },
  sec_verify_puzzle: { maxAttempts: 120, windowMs: 5 * 60 * 1000, lockMs: 0 },
  sec_verify_code: { maxAttempts: 120, windowMs: 5 * 60 * 1000, lockMs: 0 },
  sec_clear: { maxAttempts: 60, windowMs: 60 * 1000, lockMs: 0 }
});

function hashTokenPrefix(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
}

function getOnionRateLimitIdentity(req) {
  if (req._onionRateIdentity) return req._onionRateIdentity;

  const cookies = parseCookies(req);
  let sessionToken = cookies['astra_session'];
  if (!sessionToken && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
    sessionToken = req.headers.authorization.slice(7).trim();
  }
  if (sessionToken && db.getUserFromToken(sessionToken)) {
    req._onionRateIdentity = { key: `onion_sess:${hashTokenPrefix(sessionToken)}`, scoped: true };
    return req._onionRateIdentity;
  }

  const clearanceToken = cookies['z340_clearance'];
  if (clearanceToken && verifyClearanceToken(clearanceToken)) {
    req._onionRateIdentity = { key: `onion_clr:${hashTokenPrefix(clearanceToken)}`, scoped: true };
    return req._onionRateIdentity;
  }

  req._onionRateIdentity = { key: 'onion_anon', scoped: false };
  return req._onionRateIdentity;
}

function checkRateLimit(ip, action, maxAttempts, windowMs, lockMs = 0) {
  const now = Date.now();
  const key = `${ip}:${action}`;
  let record = ipRateLimits.get(key);

  if (record && record.lockedUntil && now < record.lockedUntil) {
    const waitSec = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
    return {
      allowed: false,
      retryAfter: waitSec,
      message: `Security trigger: Rate limit exceeded. Locked for ${waitSec}s.`
    };
  }

  if (!record || now > record.resetTime) {
    if (!record && ipRateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
      pruneRateLimits(now);
    }
    record = { count: 1, resetTime: now + windowMs, lockedUntil: 0 };
    ipRateLimits.set(key, record);
    return { allowed: true };
  }

  record.count++;
  if (record.count > maxAttempts) {
    if (lockMs > 0) {
      record.lockedUntil = now + lockMs;
      const waitSec = Math.max(1, Math.ceil(lockMs / 1000));
      return {
        allowed: false,
        retryAfter: waitSec,
        message: `Security trigger: Rate limit exceeded. Locked for ${waitSec}s.`
      };
    }
    const waitSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return {
      allowed: false,
      retryAfter: waitSec,
      message: 'Too many requests. Please slow down.'
    };
  }

  return { allowed: true };
}

function sendRateLimitExceeded(res, check) {
  res.setHeader('Retry-After', String(check.retryAfter));
  res.status(429).json({
    success: false,
    reason: check.message,
    retryAfter: check.retryAfter
  });
}

function enforceRateLimit(req, res, action, maxAttempts, windowMs, lockMs = 0) {
  if (!isOnionRequest(req)) {
    const check = checkRateLimit(getClientIp(req), action, maxAttempts, windowMs, lockMs);
    if (!check.allowed) {
      sendRateLimitExceeded(res, check);
      return false;
    }
    return true;
  }

  const identity = getOnionRateLimitIdentity(req);
  if (identity.scoped) {
    if (action === 'auth_reg') {
      const aggCheck = checkRateLimit(
        'onion_anon',
        'auth_reg',
        ONION_ANON_LIMITS.auth_reg.maxAttempts,
        ONION_ANON_LIMITS.auth_reg.windowMs,
        0
      );
      if (!aggCheck.allowed) {
        sendRateLimitExceeded(res, aggCheck);
        return false;
      }
    }
    const scopedLockMs = action === 'auth_pw_change' ? lockMs : 0;
    const check = checkRateLimit(identity.key, action, maxAttempts, windowMs, scopedLockMs);
    if (!check.allowed) {
      sendRateLimitExceeded(res, check);
      return false;
    }
    return true;
  }

  const anonCfg = ONION_ANON_LIMITS[action] || {
    maxAttempts: Math.max(maxAttempts * 4, 60),
    windowMs,
    lockMs: 0
  };
  const check = checkRateLimit('onion_anon', action, anonCfg.maxAttempts, anonCfg.windowMs, 0);
  if (!check.allowed) {
    sendRateLimitExceeded(res, check);
    return false;
  }
  return true;
}

// --- CSRF / Cross-Origin Protection for State-Changing `/api/*` Endpoints ---
const BODY_OPTIONAL_ROUTES = new Set([
  'POST:/api/auth/logout',
  'DELETE:/api/auth/account',
  'POST:/api/leaderboard/start',
  'POST:/api/security/clear'
]);

function getAllowedHosts(req) {
  const hosts = new Set();
  if (!isOnionRequest(req)) {
    const forwardedHost = req.headers['x-forwarded-host'];
    if (typeof forwardedHost === 'string' && forwardedHost.trim()) {
      hosts.add(forwardedHost.split(',')[0].trim().toLowerCase());
    }
  }
  const reqHost = req.headers.host;
  if (typeof reqHost === 'string' && reqHost.trim()) {
    hosts.add(reqHost.trim().toLowerCase());
  }
  if (DOMAIN && DOMAIN !== 'yourdomain.com') {
    try {
      const domUrl = DOMAIN.includes('://') ? new URL(DOMAIN) : new URL(`https://${DOMAIN}`);
      hosts.add(domUrl.host.toLowerCase());
    } catch {
      // Ignore invalid DOMAIN format
    }
  }
  const cleanOnionHost = getConfiguredOnionHost();
  if (cleanOnionHost) {
    hosts.add(cleanOnionHost);
  }
  return hosts;
}

app.use('/api', (req, res, next) => {
  // General per-IP API flood protection
  if (!enforceRateLimit(req, res, 'api_global', 240, 60 * 1000)) {
    return;
  }

  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  // Block modern browser cross-site fetch metadata immediately
  const secFetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (secFetchSite === 'cross-site') {
    return res.status(403).json({ success: false, reason: 'Cross-site API requests are forbidden.' });
  }

  // Verify Origin / Referer host matches server host when present
  const allowedHosts = getAllowedHosts(req);
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;

  if (originHeader !== undefined) {
    if (originHeader === 'null' || !originHeader) {
      return res.status(403).json({ success: false, reason: 'Cross-origin request blocked (invalid Origin).' });
    }
    try {
      const originHost = new URL(String(originHeader)).host.toLowerCase();
      if (allowedHosts.size > 0 && !allowedHosts.has(originHost)) {
        return res.status(403).json({ success: false, reason: 'Cross-origin request blocked (Origin mismatch).' });
      }
    } catch {
      return res.status(403).json({ success: false, reason: 'Cross-origin request blocked (malformed Origin).' });
    }
  } else if (refererHeader !== undefined) {
    try {
      const refererHost = new URL(String(refererHeader)).host.toLowerCase();
      if (allowedHosts.size > 0 && !allowedHosts.has(refererHost)) {
        return res.status(403).json({ success: false, reason: 'Cross-origin request blocked (Referer mismatch).' });
      }
    } catch {
      return res.status(403).json({ success: false, reason: 'Cross-origin request blocked (malformed Referer).' });
    }
  }

  // Require `Content-Type: application/json` to block HTML <form> / text/plain CSRF
  // Note: `req.is('application/json')` (`type-is`) returns `null` when Content-Length is 0 or absent,
  // so check the header directly when no body is transmitted.
  const routeKey = `${method}:/api${req.path.replace(/\/+$/, '') || ''}`;
  const rawContentType = req.headers['content-type'];
  const contentLength = Number(req.headers['content-length'] || 0);
  const hasTransferEncoding = Boolean(req.headers['transfer-encoding']);
  const hasBody = contentLength > 0 || hasTransferEncoding;
  const isJsonHeader =
    typeof rawContentType === 'string' &&
    /^application\/(?:[\w.+-]+\+)?json\b/i.test(rawContentType.trim());
  const isJsonContent = hasBody ? Boolean(req.is('application/json')) : isJsonHeader;

  if (BODY_OPTIONAL_ROUTES.has(routeKey)) {
    if (hasBody) {
      if (!isJsonContent) {
        return res.status(415).json({
          success: false,
          reason: 'Unsupported Content-Type. Expected application/json.'
        });
      }
    } else if (rawContentType !== undefined && rawContentType !== '' && !isJsonHeader) {
      return res.status(415).json({
        success: false,
        reason: 'Unsupported Content-Type. Expected application/json.'
      });
    }
  } else if (!isJsonContent) {
    return res.status(415).json({
      success: false,
      reason: 'Content-Type must be application/json.'
    });
  }

  return next();
});

// Extract authenticated user from HttpOnly cookie or Bearer token
function getAuthUser(req) {
  const cookies = parseCookies(req);
  let token = cookies['astra_session'];
  if (!token && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token) return null;
  return db.getUserFromToken(token);
}

// Health check endpoint for Docker & uptime monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime(), ...db.getGlobalStats() });
});

// --- User Authentication & Privacy API Endpoints ---

app.post('/api/auth/register', (req, res) => {
  if (!enforceRateLimit(req, res, 'auth_reg', 6, 10 * 60 * 1000, 15 * 60 * 1000)) return;

  const { username, password } = req.body || {};
  try {
    db.createUser(username, password);
    const auth = db.authenticate(username, password);
    if (!auth.success) {
      return res.status(400).json({ success: false, reason: auth.reason || 'Registration failed.' });
    }

    res.setHeader('Set-Cookie', buildCookieHeader(req, 'astra_session', auth.token, 30 * 24 * 3600));

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      user: auth.user
    });
  } catch (err) {
    return res.status(400).json({ success: false, reason: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const onion = isOnionRequest(req);
  const clientIp = getClientIp(req);

  if (!onion) {
    if (!enforceRateLimit(req, res, 'auth_login', 8, 5 * 60 * 1000, 15 * 60 * 1000)) return;
  } else {
    // Bound overall .onion login rate without locking out the shared Tor container IP
    const floodCheck = checkRateLimit('onion_anon', 'auth_login_flood', 120, 60 * 1000, 0);
    if (!floodCheck.allowed) {
      sendRateLimitExceeded(res, floodCheck);
      return;
    }
  }

  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ success: false, reason: 'Username and password are required.' });
  }

  const normalizedUsername = username.trim().toLowerCase().slice(0, 64);
  if (onion) {
    // Protect individual accounts against password brute-forcing over Tor without locking out other users
    const userCheck = checkRateLimit(
      `onion_user:${normalizedUsername}`,
      'auth_login',
      8,
      5 * 60 * 1000,
      15 * 60 * 1000
    );
    if (!userCheck.allowed) {
      sendRateLimitExceeded(res, userCheck);
      return;
    }
  }

  const auth = db.authenticate(username, password);
  if (!auth.success) {
    return res.status(400).json({ success: false, reason: auth.reason });
  }

  if (onion) {
    ipRateLimits.delete(`onion_user:${normalizedUsername}:auth_login`);
  } else {
    ipRateLimits.delete(`${clientIp}:auth_login`);
  }
  res.setHeader('Set-Cookie', buildCookieHeader(req, 'astra_session', auth.token, 30 * 24 * 3600));

  return res.status(200).json({
    success: true,
    message: 'Login successful!',
    user: auth.user
  });
});

app.post('/api/auth/logout', (req, res) => {
  if (!enforceRateLimit(req, res, 'auth_logout', 20, 60 * 1000)) return;

  const cookies = parseCookies(req);
  let token = cookies['astra_session'];
  if (!token && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (token) {
    db.destroySession(token);
  }
  res.setHeader('Set-Cookie', buildCookieHeader(req, 'astra_session', '', 0));
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

app.post('/api/auth/change-password', (req, res) => {
  if (!enforceRateLimit(req, res, 'auth_pw_change', 6, 10 * 60 * 1000, 15 * 60 * 1000)) return;

  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, reason: 'Authentication required.' });
  }

  const currentPassword = req.body?.currentPassword ?? req.body?.oldPassword;
  const newPassword = req.body?.newPassword;

  const result = db.changePassword(user.id, currentPassword, newPassword);
  if (!result.success) {
    return res.status(400).json({ success: false, reason: result.reason });
  }

  res.setHeader('Set-Cookie', buildCookieHeader(req, 'astra_session', result.token, 30 * 24 * 3600));
  return res.status(200).json({
    success: true,
    message: 'Password updated successfully.',
    user: result.user
  });
});

app.delete('/api/auth/account', (req, res) => {
  if (!enforceRateLimit(req, res, 'auth_delete', 5, 10 * 60 * 1000)) return;

  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, reason: 'Authentication required.' });
  }

  const passwordOptional = req.body?.password;
  const result = db.deleteAccount(user.id, passwordOptional);
  if (!result.success) {
    return res.status(400).json({ success: false, reason: result.reason });
  }

  res.setHeader('Set-Cookie', buildCookieHeader(req, 'astra_session', '', 0));
  return res.status(200).json({
    success: true,
    message: 'Account and associated leaderboard data permanently deleted.',
    deletedScores: result.deletedScores
  });
});

app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  return res.status(200).json({
    success: true,
    authenticated: !!user,
    user: user || null
  });
});

// --- Global Leaderboard API Endpoints ---

app.get('/api/leaderboard/stats/overview', (req, res) => {
  return res.status(200).json({
    success: true,
    ...db.getGlobalStats()
  });
});

app.get('/api/leaderboard/:gameId', (req, res) => {
  const { gameId } = req.params;
  if (!VALID_GAMES.includes(gameId)) {
    return res.status(400).json({ success: false, reason: 'Unknown game ID.' });
  }

  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
  const leaderboard = db.getLeaderboard(gameId, limit);

  return res.status(200).json({
    success: true,
    gameId,
    leaderboard
  });
});

app.post('/api/leaderboard/start', (req, res) => {
  if (!enforceRateLimit(req, res, 'lb_start', 30, 60 * 1000)) return;

  const rawGameId = req.body?.gameId ?? req.query?.gameId;
  const gameId = typeof rawGameId === 'string' ? rawGameId.trim() : '';
  if (!VALID_GAMES.includes(gameId)) {
    return res.status(400).json({ success: false, reason: 'Unknown game ID.' });
  }

  const challenge = db.createGameChallenge(gameId);
  return res.status(200).json({
    success: true,
    challenge
  });
});

app.post('/api/leaderboard/submit', (req, res) => {
  if (!enforceRateLimit(req, res, 'score_submit', 15, 60 * 1000)) return;

  const { gameId, score, username, challenge, details } = req.body || {};
  if (typeof gameId !== 'string' || !VALID_GAMES.includes(gameId)) {
    return res.status(400).json({ success: false, reason: 'Unknown game ID.' });
  }
  if (typeof score !== 'number' || !Number.isFinite(score) || Number.isNaN(score) || score <= 0) {
    return res.status(400).json({ success: false, reason: 'Score must be a positive finite number.' });
  }

  let isVerified = false;
  if (challenge !== undefined && challenge !== null) {
    if (typeof challenge !== 'object' || Array.isArray(challenge)) {
      return res.status(400).json({ success: false, reason: 'Invalid challenge object.' });
    }
    if (challenge.gameId !== undefined && challenge.gameId !== gameId) {
      return res.status(400).json({ success: false, reason: 'Challenge gameId mismatch.' });
    }
    const verify = db.verifyGameChallenge(
      gameId,
      challenge.startedAt,
      challenge.nonce,
      challenge.sig,
      score
    );
    if (!verify.valid) {
      return res.status(400).json({ success: false, reason: verify.reason });
    }
    isVerified = true;
  }

  const user = getAuthUser(req);
  const finalUsername = user ? user.username : username;
  const userId = user ? user.id : null;

  try {
    const entry = db.recordScore({
      gameId,
      score,
      username: finalUsername,
      userId,
      details: details || {},
      isVerified
    });

    const updatedLeaderboard = db.getLeaderboard(gameId, 100);
    const playerRank = updatedLeaderboard.findIndex(s => s.id === entry.id) + 1;

    return res.status(200).json({
      success: true,
      message: 'Score submitted to Global Leaderboard!',
      entry,
      rank: playerRank > 0 ? playerRank : null,
      isRegistered: !!user
    });
  } catch (err) {
    return res.status(400).json({ success: false, reason: err.message || 'Failed to submit score.' });
  }
});

// --- Security Gateway API Endpoints ---

app.get('/api/security/challenge', (req, res) => {
  if (!enforceRateLimit(req, res, 'sec_challenge', 30, 60 * 1000)) return;
  const challenge = createSecurityChallenge();
  return res.status(200).json({ success: true, ...challenge });
});

app.post('/api/security/verify-puzzle', (req, res) => {
  if (!enforceRateLimit(req, res, 'sec_verify_puzzle', 15, 5 * 60 * 1000, 5 * 60 * 1000)) return;

  const { challengeId, x, dragHistory, redirect } = req.body || {};
  const numericX = typeof x === 'number' ? x : NaN;
  const result = verifyPuzzleSubmission(challengeId, numericX, dragHistory);

  if (result.success) {
    const safeRedirect = sanitizeRedirectPath(redirect);
    res.setHeader('Set-Cookie', buildCookieHeader(req, 'z340_clearance', result.token, 30 * 24 * 3600));
    return res.status(200).json({ success: true, redirect: safeRedirect });
  }

  return res.status(400).json({ success: false, reason: result.reason || 'Verification failed' });
});

app.post('/api/security/verify-code', (req, res) => {
  if (!enforceRateLimit(req, res, 'sec_verify_code', 15, 5 * 60 * 1000, 5 * 60 * 1000)) return;

  const { challengeId, code, redirect } = req.body || {};
  const result = verifyCodeSubmission(challengeId, code);

  if (result.success) {
    const safeRedirect = sanitizeRedirectPath(redirect);
    res.setHeader('Set-Cookie', buildCookieHeader(req, 'z340_clearance', result.token, 30 * 24 * 3600));
    return res.status(200).json({ success: true, redirect: safeRedirect });
  }

  return res.status(400).json({ success: false, reason: result.reason || 'Verification failed' });
});

app.get('/api/security/status', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies['z340_clearance'];
  const user = getAuthUser(req);
  const isVerified = !!user || verifyClearanceToken(token);
  return res.status(200).json({ verified: isVerified, quantumProtected: true });
});

app.get('/api/security/specs', (req, res) => {
  return res.status(200).json({
    success: true,
    specs: CRYPTO_SPECS
  });
});

app.post('/api/security/clear', (req, res) => {
  if (!enforceRateLimit(req, res, 'sec_clear', 20, 60 * 1000)) return;
  res.setHeader('Set-Cookie', buildCookieHeader(req, 'z340_clearance', '', 0));
  return res.status(200).json({ success: true });
});

// Unknown API fallback
app.use('/api', (req, res) => {
  return res.status(404).json({ success: false, reason: 'API endpoint not found.' });
});

// --- Guard Root `/?redirect=...` Deep-Link Parameter Against Open Redirects ---
app.get(['/', '/index.html'], (req, res, next) => {
  if (req.query && req.query.redirect !== undefined) {
    const rawRedirect = Array.isArray(req.query.redirect) ? '' : String(req.query.redirect);
    const safeRedirect = sanitizeRedirectPath(rawRedirect);
    if (!safeRedirect) {
      return res.redirect(302, '/');
    }
  }
  return next();
});

// --- Deep-Link & Manual App URL Security Interceptor ---
app.use((req, res, next) => {
  const pathname = req.path;
  const isProtected = protectedAppPrefixes.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/')
  );

  if (!isProtected) {
    return next();
  }

  const cookies = parseCookies(req);
  const token = cookies['z340_clearance'];
  const user = getAuthUser(req);

  if (user || verifyClearanceToken(token)) {
    return next();
  }

  const acceptsHtml = typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html');
  const isDirectNavigation = acceptsHtml || !pathname.includes('.');

  if (isDirectNavigation) {
    const rawSegment = pathname.split('/')[1] || '';
    const safeAppName = /^[a-zA-Z0-9_-]{1,32}$/.test(rawSegment) ? rawSegment : '';
    const safeTarget = sanitizeRedirectPath(req.originalUrl) || '/';
    return res.redirect(
      302,
      `/?verify=required&app=${encodeURIComponent(safeAppName)}&redirect=${encodeURIComponent(safeTarget)}`
    );
  }

  return res.status(401).json({ error: 'Security clearance required' });
});

// Serve Launchpad Dashboard at root (blocking dotfiles)
app.use(express.static(path.join(__dirname, 'dashboard'), { dotfiles: 'deny' }));

function sendSubAppIndex(res, dirName, label) {
  const indexPath = path.join(__dirname, dirName, 'dist', 'index.html');
  res.sendFile(indexPath, err => {
    if (err && !res.headersSent) {
      res.status(503).type('html').send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${label} Unavailable</title></head>` +
        `<body style="background:#0b0f19;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">` +
        `<div style="text-align:center;max-width:460px;padding:24px;">` +
        `<h1 style="font-size:1.4rem;margin-bottom:8px;">${label} is temporarily unavailable</h1>` +
        `<p style="color:#94a3b8;font-size:0.95rem;">The application bundle has not been built yet. <a href="/" style="color:#6366f1;">Return to Hub</a></p>` +
        `</div></body></html>`
      );
    }
  });
}

// Mount static bundles & resilient SPA fallbacks for all 9 sub-apps
for (const subApp of SUB_APPS) {
  app.use(subApp.prefix, express.static(path.join(__dirname, subApp.dir, 'dist'), { dotfiles: 'deny' }));
  app.get([subApp.prefix, `${subApp.prefix}/`, `${subApp.prefix}/*`], (req, res) => {
    sendSubAppIndex(res, subApp.dir, subApp.label);
  });
}

// Global error fallback (never expose stack traces or filesystem paths)
app.use((err, req, res, _next) => {
  console.error('❌ Unhandled server error:', err?.message || err);
  if (res.headersSent) return;
  if (req.path && req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, reason: 'Internal server error.' });
  }
  return res.status(500).type('text').send('Internal Server Error');
});

// --- Server Lifecycle, Entrypoint Guard & Graceful Shutdown ---
let activeServer = null;
let isShuttingDown = false;

export function startServer(port = PORT, host = BIND_HOST) {
  if (activeServer) return activeServer;
  activeServer = app.listen(port, host, () => {
    const addr = activeServer.address();
    const boundPort = typeof addr === 'object' && addr ? addr.port : port;
    const publicBase = DOMAIN && DOMAIN !== 'yourdomain.com'
      ? (DOMAIN.startsWith('http://') || DOMAIN.startsWith('https://') ? DOMAIN.replace(/\/$/, '') : `https://${DOMAIN}`)
      : `http://localhost:${boundPort}`;

    console.log(`🚀 Swiss Knife Server running at http://${host}:${boundPort}`);
    if (DOMAIN && DOMAIN !== 'yourdomain.com') {
      console.log(`🌐 Public Domain: ${publicBase}`);
    }
    const cleanOnion = getConfiguredOnionHost();
    if (cleanOnion) {
      console.log(`🧅 Tor Onion Service: http://${cleanOnion}`);
    }
    console.log(`- Dashboard:      ${publicBase}/`);
    for (const subApp of SUB_APPS) {
      console.log(`- ${subApp.label.padEnd(15)} ${publicBase}${subApp.prefix}/`);
    }
  });
  return activeServer;
}

export function shutdown(signal = 'SIGTERM') {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}. Flushing database and shutting down gracefully...`);

  clearInterval(rateLimitCleanupTimer);
  clearChallengeInterval();

  const finishExit = (code = 0) => {
    try {
      db.close();
    } catch (err) {
      console.error('Error closing database:', err?.message || err);
    }
    process.exit(code);
  };

  if (!activeServer) {
    finishExit(0);
    return;
  }

  const forceTimer = setTimeout(() => {
    console.warn('⚠️ Forcing shutdown after timeout.');
    finishExit(0);
  }, 5000);
  if (typeof forceTimer.unref === 'function') {
    forceTimer.unref();
  }

  activeServer.close(() => {
    clearTimeout(forceTimer);
    activeServer = null;
    finishExit(0);
  });
}

function isExecutedDirectly() {
  if (!process.argv[1]) return false;
  try {
    const argPath = fs.realpathSync(process.argv[1]);
    const selfPath = fs.realpathSync(__filename);
    if (process.platform === 'win32') {
      return argPath.toLowerCase() === selfPath.toLowerCase();
    }
    return argPath === selfPath;
  } catch {
    const argResolved = path.resolve(process.argv[1]);
    if (process.platform === 'win32') {
      return argResolved.toLowerCase() === __filename.toLowerCase();
    }
    return argResolved === __filename;
  }
}

if (isExecutedDirectly()) {
  startServer();
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export { app, sanitizeRedirectPath };
export default app;
