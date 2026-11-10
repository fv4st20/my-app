import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { generateQuantumToken, verifyQuantumToken, signQuantumHMAC, verifyQuantumHMAC, CRYPTO_SPECS } from './quantumCrypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'hub_db.json');
const TEMP_FILE = path.join(DATA_DIR, 'hub_db.json.tmp');

const SERVER_SECRET = process.env.SECURITY_SECRET || 'z340_swiss_hub_sec_key_2026_9f8a3d';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory Database Store
class Database {
  constructor() {
    this.data = {
      version: 1,
      users: [],
      scores: [],
      sessions: []
    };
    this.usedNonces = new Set();
    this.saveTimeout = null;
    this.load();

    // Clean expired sessions & nonces every 30 minutes
    setInterval(() => this.cleanup(), 30 * 60 * 1000);
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.data = {
            version: parsed.version || 1,
            users: Array.isArray(parsed.users) ? parsed.users : [],
            scores: Array.isArray(parsed.scores) ? parsed.scores : [],
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
          };
          console.log(`📦 Loaded Database: ${this.data.users.length} users, ${this.data.scores.length} scores`);
        }
      } else {
        this.saveSync();
      }
    } catch (err) {
      console.error('⚠️ Error loading database, initializing fresh state:', err);
    }
  }

  saveSync() {
    try {
      const json = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(TEMP_FILE, json, 'utf-8');
      fs.renameSync(TEMP_FILE, DB_FILE);
    } catch (err) {
      console.error('❌ Failed to save database to disk:', err);
    }
  }

  save() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveSync();
    }, 100);
  }

  cleanup() {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    this.data.sessions = this.data.sessions.filter(s => s.expiresAt > now);
    if (this.usedNonces.size > 10000) {
      this.usedNonces.clear();
    }
    this.save();
  }

  // --- Password Hashing & Verification (scrypt) ---
  hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  verifyPassword(password, salt, hash) {
    try {
      const computed = this.hashPassword(password, salt);
      const bufA = Buffer.from(computed, 'hex');
      const bufB = Buffer.from(hash, 'hex');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  // --- User Operations ---
  findUserByUsername(username) {
    if (!username || typeof username !== 'string') return null;
    const clean = username.trim().toLowerCase();
    return this.data.users.find(u => u.username.toLowerCase() === clean) || null;
  }

  findUserById(id) {
    return this.data.users.find(u => u.id === id) || null;
  }

  createUser(username, password) {
    const cleanUsername = username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      throw new Error('Username must be 3-20 characters and contain only letters, numbers, or underscores.');
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
      throw new Error('Password must be between 6 and 100 characters long.');
    }
    if (this.findUserByUsername(cleanUsername)) {
      throw new Error('Username is already registered. Please choose another or log in.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const id = 'usr_' + crypto.randomBytes(8).toString('hex');

    const avatarColors = ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const user = {
      id,
      username: cleanUsername,
      passwordHash,
      salt,
      avatarColor,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      totalGamesPlayed: 0
    };

    this.data.users.push(user);

    // Auto-claim any previous guest scores achieved with this username
    for (const s of this.data.scores) {
      if (!s.userId && s.username.toLowerCase() === cleanUsername.toLowerCase()) {
        s.userId = user.id;
        s.isGuest = false;
        s.isVerified = true;
      }
    }

    this.save();

    // Return safe user representation
    return {
      id: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt
    };
  }

  authenticate(username, password) {
    const user = this.findUserByUsername(username);
    if (!user) {
      return { success: false, reason: 'Invalid username or password.' };
    }

    const isValid = this.verifyPassword(password, user.salt, user.passwordHash);
    if (!isValid) {
      return { success: false, reason: 'Invalid username or password.' };
    }

    user.lastLogin = Date.now();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const token = generateQuantumToken({ userId: user.id, username: user.username }, 30 * 24 * 60 * 60 * 1000);

    this.data.sessions.push({
      token,
      userId: user.id,
      createdAt: Date.now(),
      expiresAt
    });

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

  getUserFromToken(token) {
    if (!token || typeof token !== 'string') return null;

    // Quantum Token verification
    if (token.startsWith('q1.')) {
      const qv = verifyQuantumToken(token);
      if (!qv.valid || !qv.data?.userId) return null;
      
      // Check if session was revoked / logged out
      const session = this.data.sessions.find(s => s.token === token);
      if (!session) return null;
      if (session.expiresAt < Date.now()) {
        this.data.sessions = this.data.sessions.filter(s => s.token !== token);
        this.save();
        return null;
      }

      const user = this.findUserById(qv.data.userId);
      if (!user) return null;
      return {
        id: user.id,
        username: user.username,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt
      };
    }

    // Legacy token fallback
    const session = this.data.sessions.find(s => s.token === token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      this.data.sessions = this.data.sessions.filter(s => s.token !== token);
      this.save();
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
    if (!token) return;
    this.data.sessions = this.data.sessions.filter(s => s.token !== token);
    this.save();
  }

  // --- Anti-Cheat Game Challenge Generation & Verification ---
  createGameChallenge(gameId) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const startedAt = Date.now();
    const payload = `${gameId}:${startedAt}:${nonce}`;
    // Sign with Post-Quantum 512-bit HMAC
    const sig = signQuantumHMAC(payload);
    return {
      gameId,
      startedAt,
      nonce,
      sig
    };
  }

  verifyGameChallenge(gameId, startedAt, nonce, sig, score) {
    if (!gameId || !startedAt || !nonce || !sig) {
      return { valid: false, reason: 'Missing verification challenge signature.' };
    }

    // Verify signature using Post-Quantum HMAC-SHA-512 with SHA-256 fallback
    const payload = `${gameId}:${startedAt}:${nonce}`;
    let isSigValid = verifyQuantumHMAC(payload, sig);

    if (!isSigValid) {
      // Fallback for in-flight legacy 256-bit signatures
      try {
        const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
        const bufA = Buffer.from(sig, 'hex');
        const bufB = Buffer.from(expectedSig, 'hex');
        if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
          isSigValid = true;
        }
      } catch {}
    }

    if (!isSigValid) {
      return { valid: false, reason: 'Tampered game session signature.' };
    }

    // Check Replay Attack
    if (this.usedNonces.has(nonce)) {
      return { valid: false, reason: 'Duplicate game session challenge (Replay Attack detected).' };
    }
    this.usedNonces.add(nonce);

    // Duration Sanity Check
    const elapsedMs = Date.now() - Number(startedAt);
    if (elapsedMs < 0) {
      return { valid: false, reason: 'Invalid session clock.' };
    }

    // Per-game physics & reality thresholds
    if (gameId === 'alien-echo') {
      // In Alien Echo, each round requires viewing audio/visual sequences and inputting
      // A score of N requires at least N * 800ms
      const minRequiredMs = Math.max(1000, (Number(score) - 1) * 800);
      if (Number(score) > 2 && elapsedMs < minRequiredMs) {
        return { valid: false, reason: `Abnormal completion speed detected (${Math.round(elapsedMs)}ms for score ${score}).` };
      }
    } else if (gameId === 'sonic-soccer') {
      if (Number(score) > 60) {
        return { valid: false, reason: 'Goal count exceeds physical match limit.' };
      }
    } else if (gameId === 'neon-orbit') {
      // Score rate limit check
      const scorePerSec = Number(score) / Math.max(1, elapsedMs / 1000);
      if (scorePerSec > 25000) {
        return { valid: false, reason: 'Score acceleration exceeds game physics limits.' };
      }
    }

    return { valid: true };
  }

  // --- Leaderboard Operations ---
  recordScore({ gameId, score, username, userId = null, details = {}, isVerified = true }) {
    const validGames = ['alien-echo', 'neon-orbit', 'pirate-fishing', 'sonic-soccer', 'shape-wars'];
    if (!validGames.includes(gameId)) {
      throw new Error(`Invalid game ID: ${gameId}`);
    }

    const numScore = Math.floor(Number(score));
    if (!Number.isFinite(numScore) || numScore < 0) {
      throw new Error('Score must be a positive integer.');
    }

    // Absolute physical reality bounds check across all submissions
    if (gameId === 'sonic-soccer' && numScore > 60) {
      throw new Error('Goal count exceeds physical match limit.');
    }
    if (gameId === 'alien-echo' && numScore > 100) {
      throw new Error('Alien Echo round count exceeds human memory limits.');
    }

    let cleanName = (username || 'Anonymous').trim();
    // Sanitize string
    cleanName = cleanName.replace(/<[^>]*>/g, '').slice(0, 24);
    if (!cleanName) cleanName = 'Anonymous';

    const existingIndex = userId
      ? this.data.scores.findIndex(s => s.gameId === gameId && s.userId === userId)
      : this.data.scores.findIndex(s => s.gameId === gameId && !s.userId && s.username.toLowerCase() === cleanName.toLowerCase());

    let entry;
    if (existingIndex !== -1) {
      const existing = this.data.scores[existingIndex];
      // Only update if new score is higher
      if (numScore > existing.score) {
        existing.score = numScore;
        existing.details = details;
        existing.updatedAt = Date.now();
        existing.isVerified = isVerified;
        existing.username = cleanName; // Update display name if changed
        entry = existing;
      } else {
        entry = existing;
      }
    } else {
      entry = {
        id: 'scr_' + crypto.randomBytes(8).toString('hex'),
        gameId,
        userId,
        username: cleanName,
        isGuest: !userId,
        score: numScore,
        details,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isVerified
      };
      this.data.scores.push(entry);
    }

    // Increment user game count if registered
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
    const scores = this.data.scores
      .filter(s => s.gameId === gameId)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scores.map((s, index) => ({
      rank: index + 1,
      id: s.id,
      username: s.username,
      userId: s.userId,
      isGuest: !s.userId,
      isRegistered: !!s.userId,
      isVerified: !!s.isVerified,
      score: s.score,
      details: s.details || {},
      date: s.updatedAt || s.createdAt
    }));
  }

  getUserAllScores(userId) {
    if (!userId) return [];
    return this.data.scores
      .filter(s => s.userId === userId)
      .map(s => ({
        gameId: s.gameId,
        score: s.score,
        details: s.details,
        date: s.updatedAt || s.createdAt
      }));
  }

  getGlobalStats() {
    return {
      totalUsers: this.data.users.length,
      totalScores: this.data.scores.length,
      topGame: 'alien-echo'
    };
  }
}

export const db = new Database();
export default db;

