import crypto from 'crypto';

// Master Server Secret for cryptographic derivation
const SERVER_SECRET = process.env.SECURITY_SECRET || 'z340_swiss_hub_sec_key_2026_9f8a3d';

// Cryptographic Specs & Audit Metadata
export const CRYPTO_SPECS = {
  algorithm: 'AES-256-GCM',
  mode: 'Galois/Counter Mode (Authenticated)',
  keyLengthBits: 256,
  ivLengthBits: 96,
  authTagLengthBits: 128,
  kdf: 'HKDF-SHA-512 (RFC 5869)',
  hashDigest: 'SHA-512 (512-bit margin)',
  quantumSecurity: 'NIST Level 5 Post-Quantum Symmetric Standard (Resistant to Grover & Shor Algorithms)',
  postGroverSecurityBits: 128
};

// Derive high-entropy 256-bit quantum key using HKDF-SHA-512
const QUANTUM_SALT = crypto.createHash('sha512').update('astra13_quantum_salt_defense_2026').digest();
const MASTER_QUANTUM_KEY = crypto.hkdfSync(
  'sha512',
  SERVER_SECRET,
  QUANTUM_SALT,
  'astra13_aes256_gcm_quantum_guard',
  32
);

/**
 * Encrypts an object or string using Quantum-Resistant AES-256-GCM.
 * Format: q1.<base64url(iv)>.<base64url(authTag)>.<base64url(ciphertext)>
 */
export function encryptQuantumPayload(data) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(12); // NIST recommended 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_QUANTUM_KEY, iv);
  
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
 * Decrypts and verifies a Quantum-Resistant AES-256-GCM payload.
 * Returns decrypted data or null if invalid/tampered.
 */
export function decryptQuantumPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'q1') return null;

  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const authTag = Buffer.from(parts[2], 'base64url');
    const encrypted = Buffer.from(parts[3], 'base64url');

    if (iv.length !== 12 || authTag.length !== 16) return null;

    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_QUANTUM_KEY, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const str = decrypted.toString('utf8');

    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  } catch (err) {
    // Authentication failed (tampering or corrupted token)
    return null;
  }
}

/**
 * Computes a 512-bit post-quantum HMAC-SHA-512 signature.
 */
export function signQuantumHMAC(payload) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha512', SERVER_SECRET).update(data).digest('hex');
}

/**
 * Constant-time verification of HMAC-SHA-512 signature.
 */
export function verifyQuantumHMAC(payload, signature) {
  if (!signature || typeof signature !== 'string') return false;
  try {
    const expected = signQuantumHMAC(payload);
    const bufA = Buffer.from(signature, 'hex');
    const bufB = Buffer.from(expected, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Generates an encrypted & authenticated Clearance / Session Token.
 */
export function generateQuantumToken(payload = {}, maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const tokenData = {
    ...payload,
    nonce,
    issuedAt: now,
    expiresAt: now + maxAgeMs
  };
  return encryptQuantumPayload(tokenData);
}

/**
 * Verifies and decodes an encrypted Clearance / Session Token.
 */
export function verifyQuantumToken(token) {
  const data = decryptQuantumPayload(token);
  if (!data || typeof data !== 'object') return { valid: false, reason: 'Invalid or tampered token' };
  
  if (data.expiresAt && Date.now() > data.expiresAt) {
    return { valid: false, reason: 'Token expired' };
  }

  return { valid: true, data };
}

export default {
  CRYPTO_SPECS,
  encryptQuantumPayload,
  decryptQuantumPayload,
  signQuantumHMAC,
  verifyQuantumHMAC,
  generateQuantumToken,
  verifyQuantumToken
};

