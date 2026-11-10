import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './database.js';
import { CRYPTO_SPECS } from './quantumCrypto.js';
import {
  parseCookies,
  verifyClearanceToken,
  createSecurityChallenge,
  verifyPuzzleSubmission,
  verifyCodeSubmission
} from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN ? process.env.DOMAIN.trim() : '';

// Trust first proxy (Nginx / Cloudflare / Docker bridge) for accurate protocol & client IP
app.set('trust proxy', 1);

// JSON body parser with strict size limit to mitigate large payload DoS attacks
app.use(express.json({ limit: '10kb' }));

// Anti-DDoS and Brute-Force Rate Limiting Store
const ipRateLimits = new Map();

function checkRateLimit(ip, action, maxAttempts, windowMs, lockMs = 0) {
  const key = `${ip}:${action}`;
  const now = Date.now();
  let record = ipRateLimits.get(key);

  if (record && record.lockedUntil && now < record.lockedUntil) {
    const waitSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, retryAfter: waitSec, message: `Security trigger: Rate limit exceeded. Locked for ${waitSec}s.` };
  }

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs, lockedUntil: 0 };
    ipRateLimits.set(key, record);
    return { allowed: true };
  }

  record.count++;
  if (record.count > maxAttempts) {
    if (lockMs > 0) {
      record.lockedUntil = now + lockMs;
      const waitSec = Math.ceil(lockMs / 1000);
      return { allowed: false, retryAfter: waitSec, message: `Security trigger: Rate limit exceeded. Locked for ${waitSec}s.` };
    }
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000), message: 'Too many requests. Please slow down.' };
  }

  return { allowed: true };
}

// Extract authenticated user from cookie or Bearer token
function getAuthUser(req) {
  const cookies = parseCookies(req);
  let token = cookies['astra_session'];
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token) return null;
  return db.getUserFromToken(token);
}

// Health check endpoint for Docker & uptime monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime(), ...db.getGlobalStats() });
});

// --- User Authentication API Endpoints ---

// Register new user account
app.post('/api/auth/register', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const limitCheck = checkRateLimit(clientIp, 'auth_reg', 6, 10 * 60 * 1000, 15 * 60 * 1000);
  if (!limitCheck.allowed) {
    return res.status(429).json({ success: false, reason: limitCheck.message });
  }

  const { username, password } = req.body || {};
  try {
    const user = db.createUser(username, password);
    const auth = db.authenticate(username, password);

    res.setHeader(
      'Set-Cookie',
      `astra_session=${auth.token}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`
    );

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      user: auth.user,
      token: auth.token
    });
  } catch (err) {
    return res.status(400).json({ success: false, reason: err.message || 'Registration failed.' });
  }
});

// Login to user account
app.post('/api/auth/login', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const limitCheck = checkRateLimit(clientIp, 'auth_login', 8, 5 * 60 * 1000, 15 * 60 * 1000);
  if (!limitCheck.allowed) {
    return res.status(429).json({ success: false, reason: limitCheck.message });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, reason: 'Username and password are required.' });
  }

  const auth = db.authenticate(username, password);
  if (!auth.success) {
    return res.status(400).json({ success: false, reason: auth.reason });
  }

  // Clear failed rate limit on success
  ipRateLimits.delete(`${clientIp}:auth_login`);

  res.setHeader(
    'Set-Cookie',
    `astra_session=${auth.token}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`
  );

  return res.status(200).json({
    success: true,
    message: 'Login successful!',
    user: auth.user,
    token: auth.token
  });
});

// Log out user
app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies['astra_session'];
  if (token) {
    db.destroySession(token);
  }
  res.setHeader('Set-Cookie', 'astra_session=; Path=/; Max-Age=0; SameSite=Lax');
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// Current User Info
app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  return res.status(200).json({
    success: true,
    authenticated: !!user,
    user: user || null
  });
});

// --- Global Leaderboard API Endpoints ---

// Get Leaderboard for a game
app.get('/api/leaderboard/:gameId', (req, res) => {
  const { gameId } = req.params;
  const validGames = ['alien-echo', 'neon-orbit', 'pirate-fishing', 'sonic-soccer', 'shape-wars'];
  if (!validGames.includes(gameId)) {
    return res.status(400).json({ success: false, reason: 'Unknown game ID.' });
  }

  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const leaderboard = db.getLeaderboard(gameId, limit);

  return res.status(200).json({
    success: true,
    gameId,
    leaderboard
  });
});

// Request Anti-Cheat Game Challenge Token
app.post('/api/leaderboard/start', (req, res) => {
  const { gameId } = req.body || {};
  const validGames = ['alien-echo', 'neon-orbit', 'pirate-fishing', 'sonic-soccer', 'shape-wars'];
  if (!validGames.includes(gameId)) {
    return res.status(400).json({ success: false, reason: 'Unknown game ID.' });
  }

  const challenge = db.createGameChallenge(gameId);
  return res.status(200).json({
    success: true,
    challenge
  });
});

// Submit Score to Global Leaderboard
app.post('/api/leaderboard/submit', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const limitCheck = checkRateLimit(clientIp, 'score_submit', 15, 60 * 1000);
  if (!limitCheck.allowed) {
    return res.status(429).json({ success: false, reason: limitCheck.message });
  }

  const { gameId, score, username, challenge, details } = req.body || {};

  // Verify anti-cheat challenge if provided
  let isVerified = false;
  if (challenge) {
    const verify = db.verifyGameChallenge(gameId, challenge.startedAt, challenge.nonce, challenge.sig, score);
    if (!verify.valid) {
      return res.status(400).json({ success: false, reason: verify.reason });
    }
    isVerified = true;
  }

  const user = getAuthUser(req);
  let finalUsername = user ? user.username : (username || 'Guest');
  let userId = user ? user.id : null;

  try {
    const entry = db.recordScore({
      gameId,
      score,
      username: finalUsername,
      userId,
      details: details || {},
      isVerified
    });

    const updatedLeaderboard = db.getLeaderboard(gameId, 50);
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

// Global Stats Overview
app.get('/api/leaderboard/stats/overview', (req, res) => {
  return res.status(200).json({
    success: true,
    ...db.getGlobalStats()
  });
});

// --- Security Gateway API Endpoints ---

// Get a new puzzle & code challenge
app.get('/api/security/challenge', (req, res) => {
  const challenge = createSecurityChallenge();
  res.status(200).json({ success: true, ...challenge });
});

// Verify puzzle slider submission
app.post('/api/security/verify-puzzle', (req, res) => {
  const { challengeId, x, dragHistory, redirect } = req.body || {};
  const result = verifyPuzzleSubmission(challengeId, Number(x), dragHistory);

  if (result.success) {
    // Set 30-day clearance cookie across all sub-apps
    res.setHeader(
      'Set-Cookie',
      `z340_clearance=${result.token}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`
    );
    return res.status(200).json({ success: true, token: result.token, redirect: redirect || null });
  }

  return res.status(400).json({ success: false, reason: result.reason || 'Verification failed' });
});

// Verify alphanumeric code submission
app.post('/api/security/verify-code', (req, res) => {
  const { challengeId, code, redirect } = req.body || {};
  const result = verifyCodeSubmission(challengeId, code);

  if (result.success) {
    res.setHeader(
      'Set-Cookie',
      `z340_clearance=${result.token}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`
    );
    return res.status(200).json({ success: true, token: result.token, redirect: redirect || null });
  }

  return res.status(400).json({ success: false, reason: result.reason || 'Verification failed' });
});

// Check client clearance status
app.get('/api/security/status', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies['z340_clearance'];
  const isVerified = verifyClearanceToken(token);
  res.status(200).json({ verified: isVerified, quantumProtected: true });
});

// Post-Quantum Cryptographic Specifications
app.get('/api/security/specs', (req, res) => {
  res.status(200).json({
    success: true,
    specs: CRYPTO_SPECS
  });
});

// Lock / clear clearance (for manual testing or re-verification)
app.post('/api/security/clear', (req, res) => {
  res.setHeader('Set-Cookie', 'z340_clearance=; Path=/; Max-Age=0; SameSite=Lax');
  res.status(200).json({ success: true });
});

// --- Deep-Link & Manual App URL Security Interceptor ---
const protectedAppPrefixes = [
  '/neon-orbit',
  '/star-locator',
  '/chem-lab',
  '/chill-hub',
  '/shape-wars',
  '/sonic-soccer',
  '/nond_ex',
  '/alien-echo',
  '/pirate-fishing'
];

app.use((req, res, next) => {
  const pathname = req.path;
  const isProtected = protectedAppPrefixes.some(prefix => 
    pathname === prefix || pathname.startsWith(prefix + '/')
  );

  if (!isProtected) {
    return next();
  }

  // Check clearance token from cookies
  const cookies = parseCookies(req);
  const token = cookies['z340_clearance'];

  if (verifyClearanceToken(token)) {
    // Authenticated user: allow access
    return next();
  }

  // Unauthenticated user attempting to access a protected app:
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
  const isDirectNavigation = acceptsHtml || !pathname.includes('.');

  if (isDirectNavigation) {
    const appName = pathname.split('/')[1] || '';
    const redirectParam = encodeURIComponent(req.originalUrl);
    return res.redirect(302, `/?verify=required&app=${encodeURIComponent(appName)}&redirect=${redirectParam}`);
  }

  // Block direct unauthenticated static asset fetches
  return res.status(401).json({ error: 'Security clearance required' });
});

// Serve the Launchpad Dashboard at root
app.use(express.static(path.join(__dirname, 'dashboard')));

// Serve the apps on their respective paths
app.use('/neon-orbit', express.static(path.join(__dirname, 'neon-orbit', 'dist')));
app.use('/star-locator', express.static(path.join(__dirname, 'star_locator', 'dist')));
app.use('/chem-lab', express.static(path.join(__dirname, 'chem-lab', 'dist')));
app.use('/chill-hub', express.static(path.join(__dirname, 'chill-hub', 'dist')));
app.use('/shape-wars', express.static(path.join(__dirname, 'shape-wars', 'dist')));
app.use('/sonic-soccer', express.static(path.join(__dirname, 'sonic-soccer', 'dist')));
app.use('/nond_ex', express.static(path.join(__dirname, 'nond_ex', 'dist')));
app.use('/alien-echo', express.static(path.join(__dirname, 'alien-echo', 'dist')));
app.use('/pirate-fishing', express.static(path.join(__dirname, 'pirate-fishing', 'dist')));

// Fallback for SPA routing inside the sub-apps (if they use client-side routing)
app.get('/star-locator/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'star_locator', 'dist', 'index.html'));
});

app.get('/neon-orbit/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'neon-orbit', 'dist', 'index.html'));
});

app.get('/chem-lab/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'chem-lab', 'dist', 'index.html'));
});

app.get('/chill-hub/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'chill-hub', 'dist', 'index.html'));
});

app.get('/shape-wars/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'shape-wars', 'dist', 'index.html'));
});

app.get('/sonic-soccer/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'sonic-soccer', 'dist', 'index.html'));
});

app.get('/nond_ex/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'nond_ex', 'dist', 'index.html'));
});

app.get('/alien-echo/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'alien-echo', 'dist', 'index.html'));
});

app.get('/pirate-fishing/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'pirate-fishing', 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const publicBase = DOMAIN
    ? (DOMAIN.startsWith('http://') || DOMAIN.startsWith('https://') ? DOMAIN.replace(/\/$/, '') : `https://${DOMAIN}`)
    : `http://localhost:${PORT}`;

  console.log(`🚀 Swiss Knife Server running at http://0.0.0.0:${PORT}`);
  if (DOMAIN) {
    console.log(`🌐 Public Domain: ${publicBase}`);
  }
  console.log(`- Dashboard:      ${publicBase}/`);
  console.log(`- Neon Orbit:     ${publicBase}/neon-orbit/`);
  console.log(`- Star Locator:   ${publicBase}/star-locator/`);
  console.log(`- Chem Lab:       ${publicBase}/chem-lab/`);
  console.log(`- Chill Hub:      ${publicBase}/chill-hub/`);
  console.log(`- Shape Wars:     ${publicBase}/shape-wars/`);
  console.log(`- Sonic Soccer:   ${publicBase}/sonic-soccer/`);
  console.log(`- nond_ex:        ${publicBase}/nond_ex/`);
  console.log(`- Alien Echo:     ${publicBase}/alien-echo/`);
  console.log(`- Pirate Fishing: ${publicBase}/pirate-fishing/`);
});
