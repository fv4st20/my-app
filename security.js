import crypto from 'crypto';
import { SERVER_SECRET, generateQuantumToken, verifyQuantumToken, CRYPTO_SPECS } from './quantumCrypto.js';

const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days clearance
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes to solve
const MAX_ACTIVE_CHALLENGES = 2000;
const MAX_COOKIE_HEADER_BYTES = 8192;
const MAX_COOKIE_COUNT = 64;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Bounded in-memory challenge storage: challengeId -> challenge details
const activeChallenges = new Map();

function pruneChallenges(now = Date.now()) {
  for (const [id, challenge] of activeChallenges.entries()) {
    if (now - challenge.createdAt > CHALLENGE_EXPIRY_MS) {
      activeChallenges.delete(id);
    }
  }
  while (activeChallenges.size >= MAX_ACTIVE_CHALLENGES) {
    const oldestKey = activeChallenges.keys().next().value;
    if (oldestKey === undefined) break;
    activeChallenges.delete(oldestKey);
  }
}

// Periodic cleanup of expired challenges (unref'd so tests/shutdown never hang)
const challengeCleanupTimer = setInterval(() => {
  pruneChallenges();
}, 60 * 1000);
if (typeof challengeCleanupTimer.unref === 'function') {
  challengeCleanupTimer.unref();
}

export function clearChallengeInterval() {
  clearInterval(challengeCleanupTimer);
}

/**
 * Validates and normalizes a local redirect path to prevent Open Redirect attacks.
 * Only permits same-origin relative paths starting with a single `/` and NOT `//` or `/\`.
 */
export function sanitizeRedirectPath(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  // Reject control characters, CR/LF, and backslashes anywhere in the raw path
  if (/[\u0000-\u001F\u007F\\]/.test(trimmed)) return null;

  // Must start with `/` and NOT `//` or encoded slash/backslash tricks (`/%2f`, `/%5c`)
  if (!/^\/(?!\/|\\|%2f|%5c)/i.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (parsed.origin !== 'http://localhost') return null;
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//') || parsed.pathname.includes('\\')) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/**
 * Parses cookies safely from incoming request headers using a prototype-null map
 */
export function parseCookies(req) {
  const list = Object.create(null);
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader || typeof cookieHeader !== 'string') return list;
  if (cookieHeader.length > MAX_COOKIE_HEADER_BYTES) return list;

  const pairs = cookieHeader.split(';');
  const count = Math.min(pairs.length, MAX_COOKIE_COUNT);

  for (let i = 0; i < count; i++) {
    const cookie = pairs[i];
    const eqIdx = cookie.indexOf('=');
    if (eqIdx <= 0) continue;

    const name = cookie.slice(0, eqIdx).trim();
    if (!name || name.length > 128 || DANGEROUS_KEYS.has(name)) continue;

    const rawVal = cookie.slice(eqIdx + 1).trim();
    try {
      list[name] = decodeURIComponent(rawVal);
    } catch {
      // Malformed URI sequence in cookie value: skip safely without throwing URIError
      continue;
    }
  }
  return list;
}

/**
 * Generates an encrypted & authenticated AES-256-GCM clearance token
 */
export function generateClearanceToken() {
  return generateQuantumToken({ clearance: true, standard: 'AES-256-GCM' }, TOKEN_MAX_AGE_MS);
}

/**
 * Validates a clearance token (AES-256-GCM authenticated with HMAC fallback using current secret)
 */
export function verifyClearanceToken(token) {
  if (!token || typeof token !== 'string' || token.length > 4096) return false;

  if (token.startsWith('q1.')) {
    const verified = verifyQuantumToken(token);
    return Boolean(verified.valid && verified.data?.clearance === true);
  }

  // Legacy 3-part HMAC token fallback (only valid if signed with active strong SERVER_SECRET)
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [timestampStr, nonce, receivedHmac] = parts;
  if (!timestampStr || !nonce || !receivedHmac || receivedHmac.length !== 64 || !/^[0-9a-f]+$/i.test(receivedHmac)) {
    return false;
  }

  const timestamp = parseInt(timestampStr, 36);
  if (!Number.isFinite(timestamp)) return false;

  const age = Date.now() - timestamp;
  if (age < 0 || age > TOKEN_MAX_AGE_MS) return false;

  const payload = `${timestampStr}.${nonce}`;
  const expectedHmac = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');

  try {
    const bufReceived = Buffer.from(receivedHmac, 'hex');
    const bufExpected = Buffer.from(expectedHmac, 'hex');
    if (bufReceived.length === bufExpected.length && crypto.timingSafeEqual(bufReceived, bufExpected)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Generates a Cyber Puzzle Challenge + Code Challenge using CSPRNG
 */
export function createSecurityChallenge() {
  const now = Date.now();
  pruneChallenges(now);

  const challengeId = crypto.randomUUID();
  const width = 320;
  const height = 160;
  const pieceSize = 44;

  // Cryptographically random target coordinates
  const targetX = crypto.randomInt(70, width - pieceSize - 10);
  const targetY = crypto.randomInt(25, height - pieceSize - 5);

  // 4-character visual verification code (no ambiguous characters)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }

  activeChallenges.set(challengeId, {
    id: challengeId,
    targetX,
    targetY,
    code,
    createdAt: now
  });

  const piecePath = `M 0,0 
    H 14 C 14,9 30,9 30,0 H 44 
    V 14 C 35,14 35,30 44,30 V 44 
    H 30 C 30,35 14,35 14,44 H 0 
    V 30 C 9,30 9,14 0,14 Z`;

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
    <rect width="${width}" height="${height}" rx="14" fill="url(#bgGrad)" />
    <rect width="${width}" height="${height}" rx="14" fill="url(#cyberGrid)" />
    <path d="M 10 20 L 50 20 L 70 40 L 140 40" fill="none" stroke="rgba(99, 102, 241, 0.35)" stroke-width="1.5" />
    <circle cx="140" cy="40" r="2.5" fill="#6366f1" />
    <path d="M 200 140 L 250 140 L 270 120 L 310 120" fill="none" stroke="rgba(236, 72, 153, 0.35)" stroke-width="1.5" />
    <circle cx="200" cy="140" r="2.5" fill="#ec4899" />
    <circle cx="160" cy="80" r="55" fill="none" stroke="rgba(0, 240, 255, 0.08)" stroke-width="1" />
    <circle cx="160" cy="80" r="75" fill="none" stroke="rgba(99, 102, 241, 0.05)" stroke-width="1" stroke-dasharray="4,4" />
    <g transform="translate(${targetX}, ${targetY})">
      <path d="${piecePath}" fill="#030611" stroke="#00f0ff" stroke-width="2" stroke-dasharray="4,3" filter="url(#socketGlow)" opacity="0.9" />
      <circle cx="22" cy="22" r="6" fill="none" stroke="rgba(0, 240, 255, 0.4)" stroke-width="1" />
      <line x1="22" y1="12" x2="22" y2="32" stroke="rgba(0, 240, 255, 0.4)" stroke-width="1" />
      <line x1="12" y1="22" x2="32" y2="22" stroke="rgba(0, 240, 255, 0.4)" stroke-width="1" />
    </g>
    <text x="14" y="22" fill="rgba(255,255,255,0.4)" font-family="monospace" font-size="9" letter-spacing="1">ASTRA 13 DEFENSE PROTOCOL</text>
    <text x="${width - 14}" y="22" text-anchor="end" fill="#00f0ff" font-family="monospace" font-size="9" font-weight="bold">TARGET: ENGAGED</text>
    <text x="14" y="${height - 12}" fill="rgba(255,255,255,0.3)" font-family="monospace" font-size="8">SLOT COORD: [ACTIVE]</text>
  </svg>
  `.trim();

  const pieceSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pieceSize} ${pieceSize}" width="${pieceSize}" height="${pieceSize}">
    <defs>
      <linearGradient id="pieceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00f0ff" />
        <stop offset="40%" stop-color="#6366f1" />
        <stop offset="100%" stop-color="#ec4899" />
      </linearGradient>
    </defs>
    <path d="${piecePath}" fill="url(#pieceGrad)" stroke="#ffffff" stroke-width="1.8" />
    <circle cx="22" cy="22" r="7" fill="#ffffff" opacity="0.85" />
    <circle cx="22" cy="22" r="4" fill="#0b0f19" />
    <circle cx="22" cy="22" r="1.5" fill="#00f0ff" />
  </svg>
  `.trim();

  const codeWidth = 220;
  const codeHeight = 65;
  const colors = ['#00f0ff', '#ec4899', '#38bdf8', '#a855f7', '#34d399'];
  let charElements = '';
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const charX = 25 + i * 46;
    const charY = 44 + (crypto.randomInt(-3, 4));
    const rot = crypto.randomInt(-10, 11);
    const col = colors[i % colors.length];
    charElements += `<text x="${charX}" y="${charY}" transform="rotate(${rot}, ${charX}, ${charY})" fill="${col}" font-family="'Courier New', monospace" font-size="32" font-weight="900">${char}</text>`;
  }

  let noiseLines = '';
  for (let i = 0; i < 3; i++) {
    const y1 = crypto.randomInt(5, codeHeight - 5);
    const y2 = crypto.randomInt(5, codeHeight - 5);
    const qY = crypto.randomInt(0, codeHeight);
    const col = colors[crypto.randomInt(0, colors.length)];
    noiseLines += `<path d="M 0 ${y1} Q ${codeWidth / 2} ${qY} ${codeWidth} ${y2}" fill="none" stroke="${col}" stroke-width="1.2" opacity="0.45" />`;
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
    codeSvg,
    cryptoSpecs: CRYPTO_SPECS
  };
}

/**
 * Validates a puzzle slider submission (strictly one-time-use & NaN-safe)
 */
export function verifyPuzzleSubmission(challengeId, userX, dragHistory = []) {
  if (!challengeId || typeof challengeId !== 'string' || challengeId.length > 64) {
    return { success: false, reason: 'Invalid payload structure' };
  }

  // Always consume challenge immediately on lookup to prevent replay or brute-force attempts
  const challenge = activeChallenges.get(challengeId);
  activeChallenges.delete(challengeId);

  if (!challenge) {
    return { success: false, reason: 'Challenge expired or already used. Please try again.' };
  }

  if (Date.now() - challenge.createdAt > CHALLENGE_EXPIRY_MS) {
    return { success: false, reason: 'Challenge expired. Please try again.' };
  }

  if (typeof userX !== 'number' || !Number.isFinite(userX) || userX < 0 || userX > 320) {
    return { success: false, reason: 'Invalid alignment coordinate.' };
  }

  const delta = Math.abs(userX - challenge.targetX);
  if (!Number.isFinite(delta) || delta > 14) {
    return { success: false, reason: `Alignment offset (${Math.round(delta || 0)}px). Align with socket!` };
  }

  if (dragHistory !== undefined && dragHistory !== null) {
    if (!Array.isArray(dragHistory) || dragHistory.length > 600) {
      return { success: false, reason: 'Invalid kinetic telemetry.' };
    }
    if (dragHistory.length >= 2) {
      const firstT = Number(dragHistory[0]?.t);
      const lastT = Number(dragHistory[dragHistory.length - 1]?.t);
      if (!Number.isFinite(firstT) || !Number.isFinite(lastT)) {
        return { success: false, reason: 'Invalid kinetic timestamps.' };
      }
      const duration = lastT - firstT;
      if (duration < 80) {
        return { success: false, reason: 'Abnormal velocity detected.' };
      }
    }
  }

  const token = generateClearanceToken();
  return { success: true, token };
}

/**
 * Validates an alphanumeric code submission (strictly one-time-use & timing-safe)
 */
export function verifyCodeSubmission(challengeId, userCode) {
  if (!challengeId || typeof challengeId !== 'string' || challengeId.length > 64) {
    return { success: false, reason: 'Invalid challenge identifier.' };
  }
  if (!userCode || typeof userCode !== 'string' || userCode.length > 16) {
    activeChallenges.delete(challengeId);
    return { success: false, reason: 'Code required.' };
  }

  const challenge = activeChallenges.get(challengeId);
  activeChallenges.delete(challengeId);

  if (!challenge) {
    return { success: false, reason: 'Challenge expired or already used. Please try again.' };
  }

  if (Date.now() - challenge.createdAt > CHALLENGE_EXPIRY_MS) {
    return { success: false, reason: 'Challenge expired. Please try again.' };
  }

  const normalizedInput = userCode.trim().toUpperCase();
  const expectedCode = challenge.code.toUpperCase();

  if (normalizedInput.length !== expectedCode.length) {
    return { success: false, reason: 'Incorrect security code. Please try again.' };
  }

  const bufA = Buffer.from(normalizedInput, 'utf8');
  const bufB = Buffer.from(expectedCode, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { success: false, reason: 'Incorrect security code. Please try again.' };
  }

  const token = generateClearanceToken();
  return { success: true, token };
}
