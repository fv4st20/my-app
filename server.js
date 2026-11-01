import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
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

// JSON body parser for security API requests
app.use(express.json());

// Health check endpoint for Docker & uptime monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// --- Security Gateway API Endpoints ---

// Get a new puzzle & code challenge
app.get('/api/security/challenge', (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || '';
  const challenge = createSecurityChallenge(clientIp);
  res.status(200).json({ success: true, ...challenge });
});

// Verify puzzle slider submission
app.post('/api/security/verify-puzzle', (req, res) => {
  const { challengeId, x, dragHistory, redirect } = req.body || {};
  const clientIp = req.ip || req.socket?.remoteAddress || '';
  const result = verifyPuzzleSubmission(challengeId, Number(x), dragHistory, clientIp);

  if (result.success) {
    // Set 30-day clearance cookie across all sub-apps
    res.setHeader(
      'Set-Cookie',
      `z340_clearance=${result.token}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`
    );
    return res.status(200).json({ success: true, redirect: redirect || null });
  }

  return res.status(400).json({ success: false, reason: result.reason || 'Verification failed' });
});

// Verify alphanumeric code submission
app.post('/api/security/verify-code', (req, res) => {
  const { challengeId, code, redirect } = req.body || {};
  const clientIp = req.ip || req.socket?.remoteAddress || '';
  const result = verifyCodeSubmission(challengeId, code, clientIp);

  if (result.success) {
    res.setHeader(
      'Set-Cookie',
      `z340_clearance=${result.token}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`
    );
    return res.status(200).json({ success: true, redirect: redirect || null });
  }

  return res.status(400).json({ success: false, reason: result.reason || 'Verification failed' });
});

// Check client clearance status
app.get('/api/security/status', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies['z340_clearance'];
  const clientIp = req.ip || req.socket?.remoteAddress || '';
  const isVerified = verifyClearanceToken(token, clientIp);
  res.status(200).json({ verified: isVerified });
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
  const clientIp = req.ip || req.socket?.remoteAddress || '';

  if (verifyClearanceToken(token, clientIp)) {
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
