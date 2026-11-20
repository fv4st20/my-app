import crypto from 'crypto';

// Known weak/placeholder secrets that must never be accepted silently
const WEAK_PLACEHOLDER_SECRETS = new Set([
  '',
  'z340_swiss_hub_sec_key_2026_9f8a3d',
  'changeme',
  'change-me',
  'secret',
  'password',
  'default',
  'your-secret-key',
  'your_secret_key_here',
  'replace_with_strong_random_secret'
]);

const rawConfiguredSecret = (
  process.env.SECURITY_SECRET ||
  process.env.SECRET_KEY ||
  process.env.CHALLENGE_SECRET ||
  ''
).trim();

let resolvedSecret;
let ephemeralSecret = false;

if (
  rawConfiguredSecret &&
  rawConfiguredSecret.length >= 16 &&
  !WEAK_PLACEHOLDER_SECRETS.has(rawConfiguredSecret.toLowerCase())
) {
  resolvedSecret = rawConfiguredSecret;
  if (rawConfiguredSecret.length < 32) {
    console.warn(
      '[SECURITY WARNING] Configured SECURITY_SECRET is shorter than 32 characters. ' +
      'Use at least 32 random bytes (64 hex chars) in production.'
    );
  }
} else {
  resolvedSecret = crypto.randomBytes(48).toString('hex');
  ephemeralSecret = true;
  console.warn(
    '[SECURITY WARNING] Missing or weak SECURITY_SECRET environment variable. ' +
    'Generated ephemeral 384-bit CSPRNG runtime secret; sessions and clearance cookies will reset on restart. ' +
    'Set a strong SECURITY_SECRET (e.g. `openssl rand -hex 48`) in your environment for production.'
  );
}

export const SERVER_SECRET = resolvedSecret;
export const IS_EPHEMERAL_SECRET = ephemeralSecret;

// Accurate, transparent cryptographic specifications reflecting real Node.js OpenSSL primitives
export const CRYPTO_SPECS = Object.freeze({
  algorithm: 'AES-256-GCM',
  mode: 'Galois/Counter Mode (Authenticated Symmetric Encryption)',
  keyLengthBits: 256,
  ivLengthBits: 96,
  authTagLengthBits: 128,
  kdf: 'HKDF-SHA-512 (RFC 5869)',
  passwordKdf: 'scrypt (salted memory-hard KDF, N=16384, r=8, p=1) + timingSafeEqual',
  hashDigest: 'HMAC-SHA-512 & SHA3-256 (Node.js OpenSSL 3)',
  csprng: 'crypto.randomBytes / crypto.randomInt / crypto.randomUUID',
  securityModel:
    'Standard classical & symmetric Node.js crypto primitives (AES-256-GCM, HKDF-SHA-512, HMAC-SHA-512, SHA3-256, scrypt). ' +
    '256-bit symmetric keys retain ~128-bit theoretical margin under Grover search, but no NIST FIPS 203/204 asymmetric PQC ' +
    'key encapsulation or formal government/FIPS compliance certification is claimed.',
  postGroverSymmetricMarginBits: 128,
  asymmetricPqcImplemented: false
});

// Derive 256-bit symmetric key using HKDF-SHA-512
const HKDF_SALT = crypto.createHash('sha3-512').update('astra13_hkdf_salt_v2').digest();
const MASTER_SYMMETRIC_KEY = Buffer.from(
  crypto.hkdfSync(
    'sha512',
    SERVER_SECRET,
    HKDF_SALT,
    'astra13_aes256_gcm_token_key_v2',
    32
  )
);

const MAX_TOKEN_LENGTH = 4096;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeParsedObject(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 32).map(item => sanitizeParsedObject(item, depth + 1));
  }
  const safe = Object.create(null);
  for (const [k, v] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    safe[k] = sanitizeParsedObject(v, depth + 1);
  }
  return safe;
}

/**
 * Encrypts an object or string using authenticated AES-256-GCM.
 * Format: q1.<base64url(iv)>.<base64url(authTag)>.<base64url(ciphertext)>
 */
export function encryptQuantumPayload(data) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_SYMMETRIC_KEY, iv);

  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 128-bit authentication tag

  return [
    'q1',
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url')
  ].join('.');
}

/**
 * Decrypts and authenticates an AES-256-GCM payload.
 * Returns null if malformed or authentication fails.
 */
export function decryptQuantumPayload(token) {
  if (!token || typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'q1') return null;
  if (!parts[1] || !parts[2] || !parts[3]) return null;

  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const authTag = Buffer.from(parts[2], 'base64url');
    const encrypted = Buffer.from(parts[3], 'base64url');

    if (iv.length !== 12 || authTag.length !== 16 || encrypted.length === 0) return null;

    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_SYMMETRIC_KEY, iv, {
      authTagLength: 16
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const str = decrypted.toString('utf8');

    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object') {
        return sanitizeParsedObject(parsed);
      }
      return parsed;
    } catch {
      return str;
    }
  } catch {
    return null;
  }
}

/**
 * Computes an HMAC-SHA-512 + SHA3-256 bound signature.
 */
export function signQuantumHMAC(payload) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const sha3Digest = crypto.createHash('sha3-256').update(data).digest('hex');
  return crypto
    .createHmac('sha512', SERVER_SECRET)
    .update(`${data}:${sha3Digest}`)
    .digest('hex');
}

/**
 * Constant-time verification of HMAC-SHA-512 signature.
 */
export function verifyQuantumHMAC(payload, signature) {
  if (!signature || typeof signature !== 'string' || signature.length !== 128 || !/^[0-9a-f]+$/i.test(signature)) {
    return false;
  }
  try {
    const expected = signQuantumHMAC(payload);
    const bufA = Buffer.from(signature, 'hex');
    const bufB = Buffer.from(expected, 'hex');
    if (bufA.length !== bufB.length || bufA.length !== 64) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Generates an encrypted & authenticated Session or Clearance Token.
 */
export function generateQuantumToken(payload = {}, maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const safePayload = Object.create(null);
  if (payload && typeof payload === 'object') {
    for (const [k, v] of Object.entries(payload)) {
      if (!DANGEROUS_KEYS.has(k)) {
        safePayload[k] = v;
      }
    }
  }
  safePayload.nonce = nonce;
  safePayload.issuedAt = now;
  safePayload.expiresAt = now + maxAgeMs;
  return encryptQuantumPayload(safePayload);
}

/**
 * Verifies and decodes an encrypted Session or Clearance Token.
 */
export function verifyQuantumToken(token) {
  const data = decryptQuantumPayload(token);
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'Invalid or tampered token' };
  }

  const now = Date.now();
  if (
    typeof data.expiresAt !== 'number' ||
    !Number.isFinite(data.expiresAt) ||
    now > data.expiresAt
  ) {
    return { valid: false, reason: 'Token expired' };
  }

  if (
    typeof data.issuedAt !== 'number' ||
    !Number.isFinite(data.issuedAt) ||
    data.issuedAt > now + 60_000
  ) {
    return { valid: false, reason: 'Invalid token timestamp' };
  }

  return { valid: true, data };
}

export default {
  SERVER_SECRET,
  IS_EPHEMERAL_SECRET,
  CRYPTO_SPECS,
  encryptQuantumPayload,
  decryptQuantumPayload,
  signQuantumHMAC,
  verifyQuantumHMAC,
  generateQuantumToken,
  verifyQuantumToken
};
