import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  SERVER_SECRET,
  generateQuantumToken,
  verifyQuantumToken,
  signQuantumHMAC,
  verifyQuantumHMAC
} from './quantumCrypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const VALID_GAMES = Object.freeze([
  'alien-echo',
  'neon-orbit',
  'pirate-fishing',
  'sonic-soccer',
  'shape-wars'
]);

const MAX_GAME_SCORES = Object.freeze({
  'sonic-soccer': 60,
  'alien-echo': 100,
  'shape-wars': 100_000,
  'neon-orbit': 5_000_000,
  'pirate-fishing': 100_000_000
});

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const GAME_CHALLENGE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours max session window
const MAX_ACTIVE_GAME_CHALLENGES = 5000;
const MAX_USED_NONCES = 10000;
const MAX_SESSIONS_PER_USER = 5;
const MAX_TOTAL_SESSIONS = 5000;
const MAX_SCORES_PER_GAME = 500;
const MAX_TOTAL_USERS = 10000;

const SCRYPT_PARAMS = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024
});
const DUMMY_PASSWORD_SALT = crypto.randomBytes(16).toString('hex');

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Control & invisible/zero-width Unicode characters
const CONTROL_OR_INVISIBLE_RE = /[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]/;

// URLs, domains, and promotional spam indicators
const URL_OR_DOMAIN_RE = /(?:https?:|ftp:|mailto:|javascript:|data:|www\.|\/\/|\.(?:com|net|org|io|co|uk|de|ru|xyz|gg|me|app|dev|info|biz|link|top|site|online|gov|edu)\b|(?:^|[_-\s])(?:http|https|www)(?:[_-\s]|$))/i;
const BARE_URL_SUBSTRING_RE = /(?:https?:\/\/|www\.|http)/i;

// Reserved impersonation names
const RESERVED_EXACT_OR_TOKEN = new Set([
  'admin',
  'admins',
  'administrator',
  'sysadmin',
  'moderator',
  'moderators',
  'mod',
  'automod',
  'system',
  'owner',
  'support',
  'staff',
  'official',
  'root',
  'security',
  'webmaster',
  'postmaster'
]);

const RESERVED_SUBSTRINGS = [
  'admin',
  'moderator',
  'sysadmin',
  'system',
  'owner',
  'support'
];

// Curated profanity, hate speech, and slur patterns (applied after leetspeak normalization)
const PROFANITY_SUBSTRING_PATTERNS = [
  /f+u+c+k+/,
  /s+h+i+t+/,
  /b+i+t+c+h+/,
  /a+s+s+h+o+l+e+/,
  /b+a+s+t+a+r+d+/,
  /c+u+n+t+/,
  /d+i+c+k+h*e*a*d*/,
  /p+u+s+s+y+/,
  /w+h+o+r+e+/,
  /s+l+u+t+/,
  /n+i+g+g+(?:a+|e+r+)/,
  /f+a+g+g*o*t*/,
  /r+e+t+a+r+d+/,
  /k+i+k+e+/,
  /c+h+i+n+k+/,
  /t+r+a+n+n+y+/,
  /n+a+z+i+/,
  /h+i+t+l+e+r+/,
  /p+e+d+o+p*h*i*l*e*/
];

const PROFANITY_TOKEN_SET = new Set([
  'ass',
  'cock',
  'dick',
  'fag',
  'kys',
  'rape',
  'spic',
  'porn',
  'sex'
]);

function normalizeLeet(str) {
  return str
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
}

/**
 * Validates and filters usernames for both account registration and guest leaderboard display.
 * Rejects control/invisible chars, URLs/domains, reserved impersonation names, and profanity/slurs.
 */
export function validateUsername(rawInput, { isRegistration = false } = {}) {
  if (!isRegistration && (rawInput === undefined || rawInput === null || rawInput === '')) {
    return 'Guest';
  }
  if (typeof rawInput !== 'string') {
    throw new Error('Username must be a valid text string.');
  }

  if (CONTROL_OR_INVISIBLE_RE.test(rawInput)) {
    throw new Error('Username contains invalid control or invisible characters.');
  }

  const trimmed = rawInput.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    if (!isRegistration) return 'Guest';
    throw new Error('Username is required.');
  }

  if (isRegistration) {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      throw new Error('Username must be 3-20 characters and contain only letters, numbers, or underscores.');
    }
  } else {
    if (trimmed.length < 2 || trimmed.length > 24) {
      throw new Error('Display name must be between 2 and 24 characters.');
    }
    if (!/^[a-zA-Z0-9_ -]{2,24}$/.test(trimmed)) {
      throw new Error('Display name may contain only letters, numbers, spaces, hyphens, or underscores.');
    }
  }

  // Reject URLs and domains
  if (URL_OR_DOMAIN_RE.test(trimmed) || BARE_URL_SUBSTRING_RE.test(trimmed)) {
    throw new Error('Usernames cannot contain URLs, links, or domain names.');
  }

  const lower = trimmed.toLowerCase();
  const normalizedLeet = normalizeLeet(trimmed);
  const compactAlpha = normalizedLeet.replace(/[^a-z]/g, '');
  const tokens = normalizedLeet.split(/[\s_-]+/).filter(Boolean);

  // Reserved impersonation check
  if (RESERVED_EXACT_OR_TOKEN.has(lower) || RESERVED_EXACT_OR_TOKEN.has(compactAlpha)) {
    throw new Error('This username is reserved and cannot be used.');
  }
  for (const tok of tokens) {
    const tokAlpha = tok.replace(/[^a-z]/g, '');
    if (RESERVED_EXACT_OR_TOKEN.has(tok) || RESERVED_EXACT_OR_TOKEN.has(tokAlpha)) {
      throw new Error('This username contains a reserved role title and cannot be used.');
    }
  }
  for (const reservedSub of RESERVED_SUBSTRINGS) {
    if (lower.includes(reservedSub) || compactAlpha.includes(reservedSub)) {
      throw new Error('This username contains a reserved administrative term and cannot be used.');
    }
  }

  // Profanity & slur filter
  for (const tok of tokens) {
    const tokAlpha = tok.replace(/[^a-z]/g, '');
    if (PROFANITY_TOKEN_SET.has(tok) || PROFANITY_TOKEN_SET.has(tokAlpha)) {
      throw new Error('Username violates community conduct rules.');
    }
  }
  for (const pattern of PROFANITY_SUBSTRING_PATTERNS) {
    if (pattern.test(compactAlpha) || pattern.test(lower)) {
      throw new Error('Username violates community conduct rules.');
    }
  }

  return trimmed;
}

/**
 * Bounds and sanitizes score `details` metadata with prototype-pollution guards.
 */
export function sanitizeDetails(details, depth = 0) {
  const safe = Object.create(null);
  if (!details || typeof details !== 'object' || Array.isArray(details) || depth > 2) {
    return safe;
  }

  const keys = Object.keys(details);
  const maxKeys = 12;
  let count = 0;

  for (const key of keys) {
    if (count >= maxKeys) break;
    if (
      DANGEROUS_KEYS.has(key) ||
      key.length === 0 ||
      key.length > 40 ||
      !/^[a-zA-Z0-9_-]+$/.test(key)
    ) {
      continue;
    }
    // Never persist raw IP fields even if submitted inside details
    if (/^(ip|clientip|remoteaddress|ipaddress)$/i.test(key)) {
      continue;
    }

    const val = details[key];
    if (typeof val === 'number') {
      if (Number.isFinite(val)) {
        safe[key] = val;
        count++;
      }
    } else if (typeof val === 'boolean') {
      safe[key] = val;
      count++;
    } else if (typeof val === 'string') {
      safe[key] = val.replace(CONTROL_OR_INVISIBLE_RE, '').slice(0, 120);
      count++;
    } else if (val && typeof val === 'object' && !Array.isArray(val) && depth < 2) {
      safe[key] = sanitizeDetails(val, depth + 1);
      count++;
    }
  }

  return safe;
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function resolveDbFilePath(explicitPath) {
  const target = explicitPath || process.env.DB_PATH;
  if (target && String(target).trim()) {
    return path.resolve(String(target).trim());
  }
  return path.join(__dirname, 'data', 'hub_db.json');
}

export class Database {
  constructor(explicitDbPath = null) {
    this.dbFile = resolveDbFilePath(explicitDbPath);
    this.dataDir = path.dirname(this.dbFile);

    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      console.error('⚠️ Failed to ensure database directory exists:', err.message);
    }

    this.data = {
      version: 1,
      users: [],
      scores: [],
      sessions: []
    };

    // Bounded anti-cheat challenge & replay maps
    this.activeGameChallenges = new Map(); // nonce -> { gameId, startedAt, expiresAt }
    this.usedNonces = new Map(); // nonce -> expiresAt

    this.saveTimeout = null;
    this.load();

    // Clean expired sessions & challenges periodically (unref'd so tests/shutdown don't hang)
    this.cleanupInterval = setInterval(() => this.cleanup(), 15 * 60 * 1000);
    if (typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  load() {
    try {
      if (fs.existsSync(this.dbFile)) {
        const raw = fs.readFileSync(this.dbFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const rawUsers = Array.isArray(parsed.users) ? parsed.users : [];
          const rawScores = Array.isArray(parsed.scores) ? parsed.scores : [];
          const rawSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];

          let needsMigrationSave = false;

          this.data = {
            version: 1,
            users: rawUsers
              .filter(u => u && typeof u === 'object' && typeof u.id === 'string' && typeof u.username === 'string')
              .map(u => {
                if ('ip' in u || 'clientIp' in u) needsMigrationSave = true;
                return {
                  id: u.id,
                  username: u.username,
                  passwordHash: typeof u.passwordHash === 'string' ? u.passwordHash : '',
                  salt: typeof u.salt === 'string' ? u.salt : '',
                  avatarColor: typeof u.avatarColor === 'string' ? u.avatarColor : '#6366f1',
                  createdAt: Number(u.createdAt) || Date.now(),
                  lastLogin: Number(u.lastLogin) || Date.now(),
                  totalGamesPlayed: Number(u.totalGamesPlayed) || 0
                };
              }),
            scores: rawScores
              .filter(s => s && typeof s === 'object' && VALID_GAMES.includes(s.gameId) && Number.isFinite(Number(s.score)) && Number(s.score) > 0)
              .map(s => {
                if ('ip' in s || 'clientIp' in s) needsMigrationSave = true;
                return {
                  id: typeof s.id === 'string' ? s.id : 'scr_' + crypto.randomBytes(8).toString('hex'),
                  gameId: s.gameId,
                  userId: typeof s.userId === 'string' ? s.userId : null,
                  username: typeof s.username === 'string' ? s.username.slice(0, 24) : 'Guest',
                  isGuest: !s.userId,
                  score: Math.floor(Number(s.score)),
                  details: sanitizeDetails(s.details),
                  createdAt: Number(s.createdAt) || Date.now(),
                  updatedAt: Number(s.updatedAt) || Number(s.createdAt) || Date.now(),
                  isVerified: Boolean(s.isVerified)
                };
              }),
            sessions: rawSessions
              .filter(s => s && typeof s === 'object' && typeof s.userId === 'string' && Number(s.expiresAt) > Date.now())
              .map(s => {
                if ('ip' in s || 'clientIp' in s || 'token' in s) needsMigrationSave = true;
                const tokenHash =
                  typeof s.tokenHash === 'string' && s.tokenHash.length === 64
                    ? s.tokenHash
                    : typeof s.token === 'string'
                      ? hashSessionToken(s.token)
                      : null;
                return tokenHash
                  ? {
                      tokenHash,
                      userId: s.userId,
                      createdAt: Number(s.createdAt) || Date.now(),
                      expiresAt: Number(s.expiresAt)
                    }
                  : null;
              })
              .filter(Boolean)
          };

          if (needsMigrationSave) {
            this.saveSync();
          }

          console.log(`📦 Loaded Database (${this.dbFile}): ${this.data.users.length} users, ${this.data.scores.length} scores`);
        }
      } else {
        this.saveSync();
      }
    } catch (err) {
      console.error('⚠️ Error loading database, initializing fresh state:', err.message);
    }
  }

  saveSync() {
    const tempFile = `${this.dbFile}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const json = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tempFile, json, { encoding: 'utf-8', mode: 0o600 });
      try {
        fs.renameSync(tempFile, this.dbFile);
      } catch (renameErr) {
        // Fallback for Windows antivirus/indexer transient lock on target file
        if (renameErr && (renameErr.code === 'EPERM' || renameErr.code === 'EACCES')) {
          fs.copyFileSync(tempFile, this.dbFile);
          fs.unlinkSync(tempFile);
        } else {
          throw renameErr;
        }
      }
    } catch (err) {
      console.error('❌ Failed to save database to disk:', err.message);
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  save() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveSync();
    }, 80);
    if (typeof this.saveTimeout.unref === 'function') {
      this.saveTimeout.unref();
    }
  }

  flush() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
      this.saveSync();
    }
  }

  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.flush();
  }

  pruneChallengesAndNonces(now = Date.now()) {
    for (const [nonce, ch] of this.activeGameChallenges.entries()) {
      if (now > ch.expiresAt) {
        this.activeGameChallenges.delete(nonce);
      }
    }
    while (this.activeGameChallenges.size > MAX_ACTIVE_GAME_CHALLENGES) {
      const oldest = this.activeGameChallenges.keys().next().value;
      if (oldest === undefined) break;
      this.activeGameChallenges.delete(oldest);
    }

    for (const [nonce, exp] of this.usedNonces.entries()) {
      if (now > exp) {
        this.usedNonces.delete(nonce);
      }
    }
    while (this.usedNonces.size > MAX_USED_NONCES) {
      const oldest = this.usedNonces.keys().next().value;
      if (oldest === undefined) break;
      this.usedNonces.delete(oldest);
    }
  }

  cleanup() {
    const now = Date.now();
    const beforeSessions = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter(s => s.expiresAt > now);
    this.pruneChallengesAndNonces(now);
    if (this.data.sessions.length !== beforeSessions) {
      this.save();
    }
  }

  // --- Password Hashing & Verification (scrypt + timingSafeEqual) ---
  hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64, SCRYPT_PARAMS).toString('hex');
  }

  verifyPassword(password, salt, hash) {
    if (typeof password !== 'string' || password.length === 0 || password.length > 200) {
      return { valid: false, needsRehash: false };
    }
    if (typeof hash !== 'string' || !hash || !/^[0-9a-f]+$/i.test(hash)) {
      return { valid: false, needsRehash: false };
    }

    try {
      // Standard 64-byte (128 hex char) salted scrypt hash
      if (typeof salt === 'string' && salt.length >= 16 && hash.length === 128) {
        const computed = this.hashPassword(password, salt);
        const bufA = Buffer.from(computed, 'hex');
        const bufB = Buffer.from(hash, 'hex');
        if (bufA.length !== bufB.length) return { valid: false, needsRehash: false };
        return { valid: crypto.timingSafeEqual(bufA, bufB), needsRehash: false };
      }

      // Safe legacy SHA-256 record migration path (64 hex chars)
      if (hash.length === 64) {
        const legacyInput = salt ? `${password}${salt}` : password;
        const expected = crypto.createHash('sha256').update(legacyInput).digest('hex');
        const bufA = Buffer.from(expected, 'hex');
        const bufB = Buffer.from(hash, 'hex');
        if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
          return { valid: true, needsRehash: true };
        }
      }
      return { valid: false, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // --- User Operations ---
  findUserByUsername(username) {
    if (!username || typeof username !== 'string' || username.length > 64) return null;
    const clean = username.trim().toLowerCase();
    if (!clean) return null;
    return this.data.users.find(u => u.username.toLowerCase() === clean) || null;
  }

  findUserById(id) {
    if (!id || typeof id !== 'string') return null;
    return this.data.users.find(u => u.id === id) || null;
  }

  createSessionForUser(user) {
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    const token = generateQuantumToken(
      { userId: user.id, sid: crypto.randomBytes(18).toString('base64url') },
      SESSION_TTL_MS
    );
    const tokenHash = hashSessionToken(token);

    // Prune expired sessions and cap per-user sessions
    this.data.sessions = this.data.sessions.filter(s => s.expiresAt > now);
    const userSessions = this.data.sessions.filter(s => s.userId === user.id);
    if (userSessions.length >= MAX_SESSIONS_PER_USER) {
      userSessions.sort((a, b) => a.createdAt - b.createdAt);
      const toRemove = new Set(
        userSessions.slice(0, userSessions.length - MAX_SESSIONS_PER_USER + 1).map(s => s.tokenHash)
      );
      this.data.sessions = this.data.sessions.filter(s => !toRemove.has(s.tokenHash));
    }

    // Cap global sessions store
    if (this.data.sessions.length >= MAX_TOTAL_SESSIONS) {
      this.data.sessions.sort((a, b) => a.createdAt - b.createdAt);
      this.data.sessions = this.data.sessions.slice(this.data.sessions.length - MAX_TOTAL_SESSIONS + 1);
    }

    this.data.sessions.push({
      tokenHash,
      userId: user.id,
      createdAt: now,
      expiresAt
    });

    return token;
  }

  createUser(username, password) {
    if (this.data.users.length >= MAX_TOTAL_USERS) {
      throw new Error('Registration capacity reached. Please try again later.');
    }

    const cleanUsername = validateUsername(username, { isRegistration: true });

    if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
      throw new Error('Password must be between 6 and 100 characters long.');
    }
    if (CONTROL_OR_INVISIBLE_RE.test(password)) {
      throw new Error('Password contains invalid control characters.');
    }
    if (this.findUserByUsername(cleanUsername)) {
      throw new Error('Username is already registered. Please choose another or log in.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const id = 'usr_' + crypto.randomBytes(8).toString('hex');

    const avatarColors = ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    const avatarColor = avatarColors[crypto.randomInt(0, avatarColors.length)];
    const now = Date.now();

    const user = {
      id,
      username: cleanUsername,
      passwordHash,
      salt,
      avatarColor,
      createdAt: now,
      lastLogin: now,
      totalGamesPlayed: 0
    };

    this.data.users.push(user);

    // Link previous guest scores with matching username without falsely elevating `isVerified`
    for (const s of this.data.scores) {
      if (!s.userId && s.username.toLowerCase() === cleanUsername.toLowerCase()) {
        s.userId = user.id;
        s.isGuest = false;
        s.isVerified = Boolean(s.isVerified);
      }
    }

    this.save();

    return {
      id: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt
    };
  }

  authenticate(username, password) {
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return { success: false, reason: 'Invalid username or password.' };
    }
    if (password.length > 200) {
      return { success: false, reason: 'Invalid username or password.' };
    }

    const user = this.findUserByUsername(username);
    if (!user) {
      // Equalize timing against username enumeration
      this.hashPassword(password.slice(0, 100), DUMMY_PASSWORD_SALT);
      return { success: false, reason: 'Invalid username or password.' };
    }

    const check = this.verifyPassword(password, user.salt, user.passwordHash);
    if (!check.valid) {
      return { success: false, reason: 'Invalid username or password.' };
    }

    // Transparently upgrade legacy hashes to salted scrypt
    if (check.needsRehash) {
      user.salt = crypto.randomBytes(16).toString('hex');
      user.passwordHash = this.hashPassword(password, user.salt);
    }

    user.lastLogin = Date.now();
    const token = this.createSessionForUser(user);
    this.save();

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt
      }
    };
  }

  changePassword(userId, currentPassword, newPassword) {
    const user = this.findUserById(userId);
    if (!user) {
      return { success: false, reason: 'Account not found.' };
    }
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 200) {
      return { success: false, reason: 'Current password is required.' };
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 100) {
      return { success: false, reason: 'New password must be between 6 and 100 characters long.' };
    }
    if (CONTROL_OR_INVISIBLE_RE.test(newPassword)) {
      return { success: false, reason: 'New password contains invalid control characters.' };
    }

    const check = this.verifyPassword(currentPassword, user.salt, user.passwordHash);
    if (!check.valid) {
      return { success: false, reason: 'Current password is incorrect.' };
    }

    if (currentPassword === newPassword) {
      return { success: false, reason: 'New password must differ from your current password.' };
    }

    user.salt = crypto.randomBytes(16).toString('hex');
    user.passwordHash = this.hashPassword(newPassword, user.salt);

    // Rotate sessions: revoke all previous sessions for this user and issue a fresh token
    this.destroyAllUserSessions(user.id, false);
    const token = this.createSessionForUser(user);
    this.save();

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt
      }
    };
  }

  deleteAccount(userId, passwordOptional) {
    const user = this.findUserById(userId);
    if (!user) {
      return { success: false, reason: 'Account not found.' };
    }

    if (passwordOptional !== undefined && passwordOptional !== null && passwordOptional !== '') {
      if (typeof passwordOptional !== 'string' || !this.verifyPassword(passwordOptional, user.salt, user.passwordHash).valid) {
        return { success: false, reason: 'Incorrect password.' };
      }
    }

    this.data.users = this.data.users.filter(u => u.id !== userId);
    this.data.sessions = this.data.sessions.filter(s => s.userId !== userId);

    const prevScoreCount = this.data.scores.length;
    this.data.scores = this.data.scores.filter(s => s.userId !== userId);
    const deletedScores = prevScoreCount - this.data.scores.length;

    this.save();
    return { success: true, deletedScores };
  }

  getUserFromToken(token) {
    if (!token || typeof token !== 'string' || token.length > 4096) return null;

    let expectedUserId = null;
    if (token.startsWith('q1.')) {
      const qv = verifyQuantumToken(token);
      if (!qv.valid || typeof qv.data?.userId !== 'string') return null;
      expectedUserId = qv.data.userId;
    }

    const incomingHash = hashSessionToken(token);
    const incomingBuf = Buffer.from(incomingHash, 'hex');

    const sessionIndex = this.data.sessions.findIndex(s => {
      if (!s.tokenHash || s.tokenHash.length !== 64) return false;
      try {
        const storedBuf = Buffer.from(s.tokenHash, 'hex');
        return storedBuf.length === incomingBuf.length && crypto.timingSafeEqual(storedBuf, incomingBuf);
      } catch {
        return false;
      }
    });

    if (sessionIndex === -1) return null;
    const session = this.data.sessions[sessionIndex];

    if (session.expiresAt < Date.now()) {
      this.data.sessions.splice(sessionIndex, 1);
      this.save();
      return null;
    }

    if (expectedUserId && session.userId !== expectedUserId) {
      return null;
    }

    const user = this.findUserById(session.userId);
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt
    };
  }

  destroySession(token) {
    if (!token || typeof token !== 'string' || token.length > 4096) return;
    const targetHash = hashSessionToken(token);
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter(s => s.tokenHash !== targetHash);
    if (this.data.sessions.length !== before) {
      this.save();
    }
  }

  destroyAllUserSessions(userId, persist = true) {
    if (!userId) return;
    this.data.sessions = this.data.sessions.filter(s => s.userId !== userId);
    if (persist) {
      this.save();
    }
  }

  // --- Anti-Cheat Game Challenge Generation & Verification ---
  createGameChallenge(gameId) {
    if (!VALID_GAMES.includes(gameId)) {
      throw new Error('Unknown game ID.');
    }

    const now = Date.now();
    this.pruneChallengesAndNonces(now);

    const nonce = crypto.randomBytes(16).toString('hex');
    const startedAt = now;
    const payload = `${gameId}:${startedAt}:${nonce}`;
    const sig = signQuantumHMAC(payload);

    this.activeGameChallenges.set(nonce, {
      gameId,
      startedAt,
      expiresAt: now + GAME_CHALLENGE_TTL_MS
    });

    return {
      gameId,
      startedAt,
      nonce,
      sig
    };
  }

  verifyGameChallenge(gameId, startedAt, nonce, sig, score) {
    if (!VALID_GAMES.includes(gameId)) {
      return { valid: false, reason: 'Invalid game ID.' };
    }
    if (
      typeof nonce !== 'string' ||
      !/^[0-9a-f]{32}$/i.test(nonce) ||
      typeof sig !== 'string' ||
      !Number.isFinite(Number(startedAt))
    ) {
      return { valid: false, reason: 'Missing or malformed verification challenge signature.' };
    }

    const now = Date.now();
    this.pruneChallengesAndNonces(now);

    // Check Replay Attack first
    if (this.usedNonces.has(nonce)) {
      this.activeGameChallenges.delete(nonce);
      return { valid: false, reason: 'Duplicate game session challenge (Replay Attack detected).' };
    }

    // Consume active challenge (strictly one-time-use even on failed checks)
    const issued = this.activeGameChallenges.get(nonce);
    this.activeGameChallenges.delete(nonce);

    const numStartedAt = Number(startedAt);
    const payload = `${gameId}:${numStartedAt}:${nonce}`;
    const isSigValid = verifyQuantumHMAC(payload, sig);

    if (!isSigValid) {
      return { valid: false, reason: 'Tampered game session signature.' };
    }

    // Must match an active, non-expired challenge issued for this exact gameId & timestamp
    if (!issued) {
      return { valid: false, reason: 'Game session challenge expired, unknown, or already used.' };
    }
    if (issued.gameId !== gameId || issued.startedAt !== numStartedAt) {
      return { valid: false, reason: 'Challenge gameId or timestamp mismatch.' };
    }
    if (now > issued.expiresAt) {
      return { valid: false, reason: 'Game session challenge expired.' };
    }

    // Record consumed nonce to block any future replay within TTL window
    this.usedNonces.set(nonce, issued.expiresAt);

    if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) {
      return { valid: false, reason: 'Score must be a positive finite number.' };
    }

    const elapsedMs = now - numStartedAt;
    if (elapsedMs < 0 || elapsedMs > GAME_CHALLENGE_TTL_MS) {
      return { valid: false, reason: 'Invalid session clock or expired duration.' };
    }

    const maxAllowed = MAX_GAME_SCORES[gameId];
    if (score > maxAllowed) {
      return { valid: false, reason: `Score exceeds maximum physical limit for ${gameId}.` };
    }

    // Per-game physics & reality thresholds
    if (gameId === 'alien-echo') {
      const minRequiredMs = Math.max(1000, (score - 1) * 800);
      if (score > 2 && elapsedMs < minRequiredMs) {
        return { valid: false, reason: `Abnormal completion speed detected (${Math.round(elapsedMs)}ms for score ${score}).` };
      }
    } else if (gameId === 'neon-orbit') {
      const scorePerSec = score / Math.max(1, elapsedMs / 1000);
      if (scorePerSec > 25000) {
        return { valid: false, reason: 'Score acceleration exceeds game physics limits.' };
      }
    }

    return { valid: true };
  }

  // --- Leaderboard Operations ---
  recordScore({ gameId, score, username, userId = null, details = {}, isVerified = false }) {
    if (!VALID_GAMES.includes(gameId)) {
      throw new Error(`Invalid game ID: ${gameId}`);
    }

    if (typeof score !== 'number' || !Number.isFinite(score) || Number.isNaN(score) || score <= 0) {
      throw new Error('Score must be a positive finite number.');
    }

    const numScore = Math.floor(score);
    if (!Number.isSafeInteger(numScore) || numScore <= 0) {
      throw new Error('Score must be a positive integer.');
    }

    const maxAllowed = MAX_GAME_SCORES[gameId];
    if (numScore > maxAllowed) {
      throw new Error(`Score exceeds realistic limit (${maxAllowed.toLocaleString()}) for ${gameId}.`);
    }

    const cleanName = validateUsername(username, { isRegistration: false });
    const cleanDetails = sanitizeDetails(details);

    const existingIndex = userId
      ? this.data.scores.findIndex(s => s.gameId === gameId && s.userId === userId)
      : this.data.scores.findIndex(
          s => s.gameId === gameId && !s.userId && s.username.toLowerCase() === cleanName.toLowerCase()
        );

    let entry;
    if (existingIndex !== -1) {
      const existing = this.data.scores[existingIndex];
      // Prevent overwriting a verified score with an unverified submission
      if (numScore > existing.score && (!existing.isVerified || isVerified)) {
        existing.score = numScore;
        existing.details = cleanDetails;
        existing.updatedAt = Date.now();
        existing.isVerified = Boolean(isVerified);
        existing.username = cleanName;
      }
      entry = existing;
    } else {
      const now = Date.now();
      entry = {
        id: 'scr_' + crypto.randomBytes(8).toString('hex'),
        gameId,
        userId: userId || null,
        username: cleanName,
        isGuest: !userId,
        score: numScore,
        details: cleanDetails,
        createdAt: now,
        updatedAt: now,
        isVerified: Boolean(isVerified)
      };
      this.data.scores.push(entry);

      // Bound stored scores per game to prevent unbounded disk/memory growth
      const gameScores = this.data.scores.filter(s => s.gameId === gameId);
      if (gameScores.length > MAX_SCORES_PER_GAME) {
        gameScores.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
        const keepIds = new Set(gameScores.slice(0, MAX_SCORES_PER_GAME).map(s => s.id));
        this.data.scores = this.data.scores.filter(s => s.gameId !== gameId || keepIds.has(s.id));
      }
    }

    if (userId) {
      const u = this.findUserById(userId);
      if (u) {
        u.totalGamesPlayed = (u.totalGamesPlayed || 0) + 1;
      }
    }

    this.save();
    return entry;
  }

  getLeaderboard(gameId, limit = 50) {
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const scores = this.data.scores
      .filter(s => s.gameId === gameId)
      .sort((a, b) => b.score - a.score || (a.createdAt || 0) - (b.createdAt || 0))
      .slice(0, safeLimit);

    return scores.map((s, index) => {
      const ts = s.updatedAt || s.createdAt;
      return {
        rank: index + 1,
        id: s.id,
        username: s.username,
        userId: s.userId,
        isGuest: !s.userId,
        isRegistered: !!s.userId,
        isVerified: !!s.isVerified,
        score: s.score,
        details: s.details || {},
        date: ts,
        timestamp: ts
      };
    });
  }

  getUserAllScores(userId) {
    if (!userId || typeof userId !== 'string') return [];
    return this.data.scores
      .filter(s => s.userId === userId)
      .map(s => ({
        gameId: s.gameId,
        score: s.score,
        details: s.details || {},
        date: s.updatedAt || s.createdAt
      }));
  }

  getGlobalStats() {
    let topGame = 'alien-echo';
    if (this.data.scores.length > 0) {
      const counts = Object.create(null);
      let bestCount = 0;
      for (const s of this.data.scores) {
        counts[s.gameId] = (counts[s.gameId] || 0) + 1;
        if (counts[s.gameId] > bestCount) {
          bestCount = counts[s.gameId];
          topGame = s.gameId;
        }
      }
    }
    return {
      totalUsers: this.data.users.length,
      totalScores: this.data.scores.length,
      topGame
    };
  }
}

export const db = new Database();
export default db;
