import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const scrypt = promisify(scryptCallback);
const PORT = Number(process.env.PORT || 3001);
const DB_FILE = join(process.cwd(), 'server', 'zen-dictation.sqlite');
const LEGACY_DATA_FILE = join(process.cwd(), 'server', 'data.json');
const sessions = new Map();
const hashLicense = value => createHash('sha256').update(value.trim().toUpperCase()).digest('hex');
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, is_premium INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS practice_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, difficulty TEXT NOT NULL, wpm INTEGER NOT NULL DEFAULT 0, accuracy INTEGER NOT NULL DEFAULT 0); CREATE INDEX IF NOT EXISTS practice_sessions_user_date ON practice_sessions(user_id, date DESC); CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, key_last4 TEXT NOT NULL, activated_by TEXT, activated_at TEXT);');

const migrateLegacyData = async () => {
  try {
    await access(LEGACY_DATA_FILE);
    if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count > 0) return;
    const legacy = JSON.parse(await readFile(LEGACY_DATA_FILE, 'utf8'));
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash, is_premium, created_at) VALUES (?, ?, ?, ?, ?)');
    const insertSession = db.prepare('INSERT OR IGNORE INTO practice_sessions (id, user_id, date, difficulty, wpm, accuracy) VALUES (?, ?, ?, ?, ?, ?)');
    for (const user of legacy.users || []) insertUser.run(user.id, user.email, user.passwordHash, user.isPremium ? 1 : 0, user.createdAt);
    for (const session of legacy.practiceSessions || []) insertSession.run(session.id, session.userId, session.date, session.difficulty, session.wpm, session.accuracy);
    console.log('Migrated legacy JSON data to SQLite');
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Legacy data migration failed:', error.message);
  }
};
await migrateLegacyData();

const seedConfiguredLicenses = () => {
  const configuredKeys = (process.env.PREMIUM_LICENSE_KEYS || '').split(',').map(key => key.trim()).filter(Boolean);
  const insert = db.prepare('INSERT OR IGNORE INTO licenses (id, key_hash, key_last4) VALUES (?, ?, ?)');
  for (const key of configuredKeys) insert.run(randomUUID(), hashLicense(key), key.slice(-4).toUpperCase());
};
seedConfiguredLicenses();

const send = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || 'http://localhost:5173', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' });
  res.end(JSON.stringify(payload));
};

const body = async req => {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('Payload too large');
  }
  return raw ? JSON.parse(raw) : {};
};

const publicUser = user => ({ id: user.id, email: user.email, createdAt: user.created_at, isPremium: Boolean(user.is_premium) });

const hashPassword = async password => {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return salt + ':' + key.toString('hex');
};

const verifyPassword = async (password, storedHash) => {
  const [salt, keyHex] = storedHash.split(':');
  const key = await scrypt(password, salt, 64);
  const storedKey = Buffer.from(keyHex, 'hex');
  return storedKey.length === key.length && timingSafeEqual(storedKey, key);
};

const getAuthUser = async req => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = token && sessions.get(token);
  if (!userId) return null;
  return db.prepare('SELECT id, email, password_hash, is_premium, created_at FROM users WHERE id = ?').get(userId) || null;
};

const validateCredentials = ({ email, password }) => {
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address';
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  return null;
};

const getDeviceLicense = deviceId => db.prepare('SELECT key_last4 FROM licenses WHERE activated_by = ?').get(deviceId);

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://' + req.headers.host);
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });

    if (url.pathname === '/api/premium/status' && req.method === 'GET') {
      const deviceId = url.searchParams.get('deviceId') || '';
      const license = deviceId.length <= 128 ? getDeviceLicense(deviceId) : null;
      return send(res, 200, { isPremium: Boolean(license), source: license ? 'license' : 'none', licenseLast4: license?.key_last4 || null });
    }

    if (url.pathname === '/api/premium/activate' && req.method === 'POST') {
      const input = await body(req);
      const licenseKey = typeof input.licenseKey === 'string' ? input.licenseKey.trim().toUpperCase() : '';
      const deviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : '';
      if (!licenseKey || !deviceId || deviceId.length > 128) return send(res, 400, { error: 'A valid license key is required' });
      const license = db.prepare('SELECT id, key_last4, activated_by FROM licenses WHERE key_hash = ?').get(hashLicense(licenseKey));
      if (!license) return send(res, 404, { error: 'This license key is not valid' });
      if (license.activated_by && license.activated_by !== deviceId) return send(res, 409, { error: 'This license key is already used on another device' });
      db.prepare('UPDATE licenses SET activated_by = ?, activated_at = ? WHERE id = ?').run(deviceId, new Date().toISOString(), license.id);
      return send(res, 200, { isPremium: true, source: 'license', licenseLast4: license.key_last4 });
    }

    if (url.pathname === '/api/auth/register' && req.method === 'POST') {
      const input = await body(req);
      const error = validateCredentials(input);
      if (error) return send(res, 400, { error });
      const email = input.email.toLowerCase().trim();
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return send(res, 409, { error: 'An account with this email already exists' });
      const user = { id: randomUUID(), email, passwordHash: await hashPassword(input.password), isPremium: false, createdAt: new Date().toISOString() };
      db.prepare('INSERT INTO users (id, email, password_hash, is_premium, created_at) VALUES (?, ?, ?, ?, ?)').run(user.id, user.email, user.passwordHash, 0, user.createdAt);
      const token = randomBytes(32).toString('hex');
      sessions.set(token, user.id);
      return send(res, 201, { user: publicUser(user), token });
    }

    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const input = await body(req);
      const user = db.prepare('SELECT id, email, password_hash, is_premium, created_at FROM users WHERE email = ?').get(String(input.email || '').toLowerCase().trim());
      if (!user || !(await verifyPassword(input.password || '', user.password_hash))) return send(res, 401, { error: 'Email or password is incorrect' });
      const token = randomBytes(32).toString('hex');
      sessions.set(token, user.id);
      return send(res, 200, { user: publicUser(user), token });
    }

    const user = await getAuthUser(req);
    if (!user) return send(res, 401, { error: 'Please sign in to continue' });

    if (url.pathname === '/api/auth/me' && req.method === 'GET') return send(res, 200, { user: publicUser(user) });
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      sessions.delete(req.headers.authorization?.replace('Bearer ', ''));
      return send(res, 200, { ok: true });
    }

    if (url.pathname === '/api/sessions' && req.method === 'GET') {
      const rows = db.prepare('SELECT id, date, difficulty, wpm, accuracy FROM practice_sessions WHERE user_id = ? ORDER BY date DESC LIMIT 30').all(user.id);
      return send(res, 200, { sessions: rows });
    }

    if (url.pathname === '/api/sessions' && req.method === 'POST') {
      const input = await body(req);
      const session = { id: randomUUID(), userId: user.id, date: input.date || new Date().toISOString(), difficulty: input.difficulty || 'easy', wpm: Number(input.wpm) || 0, accuracy: Number(input.accuracy) || 0 };
      db.prepare('INSERT INTO practice_sessions (id, user_id, date, difficulty, wpm, accuracy) VALUES (?, ?, ?, ?, ?, ?)').run(session.id, session.userId, session.date, session.difficulty, session.wpm, session.accuracy);
      db.prepare('DELETE FROM practice_sessions WHERE user_id = ? AND id NOT IN (SELECT id FROM practice_sessions WHERE user_id = ? ORDER BY date DESC LIMIT 30)').run(user.id, user.id);
      return send(res, 201, { session });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'Unexpected server error' });
  }
});

server.listen(PORT, () => console.log('Zen Dictation API listening on http://localhost:' + PORT));
