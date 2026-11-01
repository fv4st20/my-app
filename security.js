import crypto from 'crypto';

// Server secret for HMAC token signing (persists per server run or can use env var)
const SERVER_SECRET = process.env.SECURITY_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days clearance
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes to solve

// In-memory challenge storage: challengeId -> challenge details
const activeChallenges = new Map();

// Periodic cleanup of expired challenges
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of activeChallenges.entries()) {
    if (now - challenge.createdAt > CHALLENGE_EXPIRY_MS) {
      activeChallenges.delete(id);
    }
  }
}, 60 * 1000);

/**
 * Parses cookies from incoming request headers
 */
export function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (!name) return;
    const value = parts.slice(1).join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

/**
 * Generates an HMAC-signed clearance token
 */
export function generateClearanceToken(clientIp = '') {
  const timestamp = Date.now().toString(36);
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${timestamp}.${nonce}.${clientIp}`;
  const hmac = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return `${timestamp}.${nonce}.${hmac}`;
}

/**
 * Validates an HMAC-signed clearance token
 */
export function verifyClearanceToken(token, clientIp = '') {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [timestampStr, nonce, receivedHmac] = parts;
  const timestamp = parseInt(timestampStr, 36);

  if (isNaN(timestamp)) return false;
  const age = Date.now() - timestamp;
  if (age < 0 || age > TOKEN_MAX_AGE_MS) return false;

  // Verify HMAC (support both IP-bound and subnet/general verification)
  const payloadWithIp = `${timestampStr}.${nonce}.${clientIp}`;
  const expectedHmacWithIp = crypto.createHmac('sha256', SERVER_SECRET).update(payloadWithIp).digest('hex');

  const payloadGeneral = `${timestampStr}.${nonce}.`;
  const expectedHmacGeneral = crypto.createHmac('sha256', SERVER_SECRET).update(payloadGeneral).digest('hex');

  try {
    const bufReceived = Buffer.from(receivedHmac, 'hex');
    const bufWithIp = Buffer.from(expectedHmacWithIp, 'hex');
    const bufGeneral = Buffer.from(expectedHmacGeneral, 'hex');

    if (bufReceived.length === bufWithIp.length && crypto.timingSafeEqual(bufReceived, bufWithIp)) {
      return true;
    }
    if (bufReceived.length === bufGeneral.length && crypto.timingSafeEqual(bufReceived, bufGeneral)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Generates a high-tech Cyber Puzzle Challenge + Code Challenge
 */
export function createSecurityChallenge(clientIp = '') {
  const challengeId = crypto.randomUUID();
  const width = 320;
  const height = 160;
  const pieceSize = 44;

  // Target X between 65 and 260; Target Y between 25 and 90
  const targetX = Math.floor(65 + Math.random() * (width - pieceSize - 75));
  const targetY = Math.floor(25 + Math.random() * (height - pieceSize - 35));

  // 4-character visual verification code (no ambiguous characters)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Save to active challenges
  activeChallenges.set(challengeId, {
    id: challengeId,
    targetX,
    targetY,
    code,
    clientIp,
    createdAt: Date.now()
  });

  // SVG Puzzle Piece Path relative to (0,0)
  // Classic high-tech notched socket/key
  const piecePath = `M 0,0 
    H 14 C 14,9 30,9 30,0 H 44 
    V 14 C 35,14 35,30 44,30 V 44 
    H 30 C 30,35 14,35 14,44 H 0 
    V 30 C 9,30 9,14 0,14 Z`;

  // Background SVG with neon cyber grid, target socket, and sci-fi aesthetic
  const bgSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#050814" />
        <stop offset="50%" stop-color="#0e172a" />
        <stop offset="100%" stop-color="#090d1a" />
      </linearGradient>
      <pattern id="cyberGrid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(99, 102, 241, 0.12)" stroke-width="1" />
        <circle cx="20" cy="20" r="1" fill="rgba(0, 240, 255, 0.25)" />
      </pattern>
      <filter id="socketGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#00f0ff" flood-opacity="0.6"/>
      </filter>
    </defs>

    <!-- Base Canvas Background -->
    <rect width="${width}" height="${height}" rx="14" fill="url(#bgGrad)" />
    <rect width="${width}" height="${height}" rx="14" fill="url(#cyberGrid)" />

    <!-- Cyber Circuit Accents -->
    <path d="M 10 20 L 50 20 L 70 40 L 140 40" fill="none" stroke="rgba(99, 102, 241, 0.35)" stroke-width="1.5" />
    <circle cx="140" cy="40" r="2.5" fill="#6366f1" />
    <path d="M 200 140 L 250 140 L 270 120 L 310 120" fill="none" stroke="rgba(236, 72, 153, 0.35)" stroke-width="1.5" />
    <circle cx="200" cy="140" r="2.5" fill="#ec4899" />
    
    <!-- Decorative Center Radar Circles -->
    <circle cx="160" cy="80" r="55" fill="none" stroke="rgba(0, 240, 255, 0.08)" stroke-width="1" />
    <circle cx="160" cy="80" r="75" fill="none" stroke="rgba(99, 102, 241, 0.05)" stroke-width="1" stroke-dasharray="4,4" />
    
    <!-- Holographic Target Notch Socket (Where the piece must land) -->
    <g transform="translate(${targetX}, ${targetY})">
      <!-- Dark sunken slot -->
      <path d="${piecePath}" fill="#030611" stroke="#00f0ff" stroke-width="2" stroke-dasharray="4,3" filter="url(#socketGlow)" opacity="0.9" />
      <!-- Target crosshair in slot -->
      <circle cx="22" cy="22" r="6" fill="none" stroke="rgba(0, 240, 255, 0.4)" stroke-width="1" />
      <line x1="22" y1="12" x2="22" y2="32" stroke="rgba(0, 240, 255, 0.4)" stroke-width="1" />
      <line x1="12" y1="22" x2="32" y2="22" stroke="rgba(0, 240, 255, 0.4)" stroke-width="1" />
    </g>

    <!-- Top & Bottom Tech Indicators -->
    <text x="14" y="22" fill="rgba(255,255,255,0.4)" font-family="monospace" font-size="9" letter-spacing="1">Z340 DEFENSE PROTOCOL</text>
    <text x="${width - 14}" y="22" text-anchor="end" fill="#00f0ff" font-family="monospace" font-size="9" font-weight="bold">TARGET: ENGAGED</text>
    <text x="14" y="${height - 12}" fill="rgba(255,255,255,0.3)" font-family="monospace" font-size="8">SLOT COORD: [REDACTED]</text>
  </svg>
  `.trim();

  // Floating Puzzle Piece SVG (Energy Core)
  const pieceSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pieceSize + 16} ${pieceSize + 16}" width="${pieceSize + 16}" height="${pieceSize + 16}">
    <defs>
      <linearGradient id="pieceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00f0ff" />
        <stop offset="40%" stop-color="#6366f1" />
        <stop offset="100%" stop-color="#ec4899" />
      </linearGradient>
      <filter id="pieceGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#00f0ff" flood-opacity="0.8" />
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.6)" />
      </filter>
    </defs>
    <g transform="translate(8, 8)">
      <!-- Main glowing puzzle core -->
      <path d="${piecePath}" fill="url(#pieceGrad)" stroke="#ffffff" stroke-width="1.8" filter="url(#pieceGlow)" />
      <!-- Inner circuit emblem -->
      <circle cx="22" cy="22" r="7" fill="#ffffff" opacity="0.85" />
      <circle cx="22" cy="22" r="4" fill="#0b0f19" />
      <circle cx="22" cy="22" r="1.5" fill="#00f0ff" />
    </g>
  </svg>
  `.trim();

  // Alphanumeric Code Verification SVG
  const codeWidth = 220;
  const codeHeight = 65;
  const colors = ['#00f0ff', '#ec4899', '#38bdf8', '#a855f7', '#34d399'];
  let charElements = '';
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const charX = 35 + i * 44 + (Math.random() * 8 - 4);
    const charY = 44 + (Math.random() * 8 - 4);
    const rot = Math.floor(Math.random() * 24 - 12);
    const col = colors[i % colors.length];
    charElements += `<text x="${charX}" y="${charY}" transform="rotate(${rot}, ${charX}, ${charY})" fill="${col}" font-family="'Courier New', monospace" font-size="32" font-weight="900" filter="drop-shadow(0 0 6px ${col})">${char}</text>`;
  }

  // Random noise lines across code
  let noiseLines = '';
  for (let i = 0; i < 3; i++) {
    const y1 = Math.random() * codeHeight;
    const y2 = Math.random() * codeHeight;
    const col = colors[Math.floor(Math.random() * colors.length)];
    noiseLines += `<path d="M 0 ${y1} Q ${codeWidth / 2} ${Math.random() * codeHeight} ${codeWidth} ${y2}" fill="none" stroke="${col}" stroke-width="1.2" opacity="0.45" />`;
  }

  const codeSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${codeWidth} ${codeHeight}" width="${codeWidth}" height="${codeHeight}">
    <rect width="${codeWidth}" height="${codeHeight}" rx="12" fill="#080d1a" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
    ${noiseLines}
    ${charElements}
  </svg>
  `.trim();

  return {
    challengeId,
    bgSvg,
    pieceSvg,
    targetY,
    codeSvg
  };
}

/**
 * Validates a puzzle slider submission
 */
export function verifyPuzzleSubmission(challengeId, userX, dragHistory = [], clientIp = '') {
  if (!challengeId || typeof userX !== 'number') {
    return { success: false, reason: 'Invalid payload structure' };
  }

  const challenge = activeChallenges.get(challengeId);
  if (!challenge) {
    return { success: false, reason: 'Challenge expired or invalid. Please refresh.' };
  }

  // Clean up challenge to prevent replay attacks
  activeChallenges.delete(challengeId);

  // Validate tolerance (+/- 7px)
  const delta = Math.abs(userX - challenge.targetX);
  if (delta > 7) {
    return { success: false, reason: `Alignment error (${Math.round(delta)}px offset). Try again!` };
  }

  // Basic kinetic heuristic check for human behavior (non-zero movement count)
  if (Array.isArray(dragHistory) && dragHistory.length > 0) {
    const duration = dragHistory[dragHistory.length - 1].t - dragHistory[0].t;
    // Human drags take at least 150ms and less than 30s
    if (duration > 0 && duration < 120) {
      return { success: false, reason: 'Bot kinetic profile detected (abnormal velocity).' };
    }
  }

  // Generate clearance token
  const token = generateClearanceToken(clientIp);
  return { success: true, token };
}

/**
 * Validates an alphanumeric code submission
 */
export function verifyCodeSubmission(challengeId, userCode, clientIp = '') {
  if (!challengeId || !userCode || typeof userCode !== 'string') {
    return { success: false, reason: 'Code required.' };
  }

  const challenge = activeChallenges.get(challengeId);
  if (!challenge) {
    return { success: false, reason: 'Challenge expired or invalid. Please refresh.' };
  }

  activeChallenges.delete(challengeId);

  if (userCode.trim().toUpperCase() !== challenge.code.toUpperCase()) {
    return { success: false, reason: 'Incorrect security code. Please try again.' };
  }

  const token = generateClearanceToken(clientIp);
  return { success: true, token };
}
