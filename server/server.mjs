import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const scrypt = promisify(scryptCallback);
const PORT = Number(process.env.PORT || 3002);
const DB_FILE = join(process.cwd(), 'server', 'zen-dictation.sqlite');
const LEGACY_DATA_FILE = join(process.cwd(), 'server', 'data.json');
const sessions = new Map();
const rateLimitBuckets = new Map();
const isProduction = process.env.NODE_ENV === 'production';
const hashLicense = value => createHash('sha256').update(value.trim().toUpperCase()).digest('hex');
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, is_premium INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS practice_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, difficulty TEXT NOT NULL, wpm INTEGER NOT NULL DEFAULT 0, accuracy INTEGER NOT NULL DEFAULT 0); CREATE INDEX IF NOT EXISTS practice_sessions_user_date ON practice_sessions(user_id, date DESC); CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, key_last4 TEXT NOT NULL, activated_by TEXT, activated_at TEXT); CREATE TABLE IF NOT EXISTS payment_orders (app_trans_id TEXT PRIMARY KEY, device_id TEXT NOT NULL, email TEXT, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT \'pending\', order_url TEXT, zp_trans_id TEXT, delivery_key TEXT, created_at TEXT NOT NULL, paid_at TEXT);');

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
  const allowedOrigin = process.env.CLIENT_ORIGIN || (isProduction ? 'null' : 'http://localhost:5173');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  });
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
const getZaloPayConfig = () => ({
  appId: Number(process.env.ZALOPAY_APP_ID || 0),
  key1: process.env.ZALOPAY_KEY1 || '',
  key2: process.env.ZALOPAY_KEY2 || '',
  createUrl: process.env.ZALOPAY_CREATE_ORDER_URL || 'https://sb-openapi.zalopay.vn/v2/create',
  callbackUrl: process.env.ZALOPAY_CALLBACK_URL || '',
  redirectUrl: process.env.PUBLIC_APP_URL ? process.env.PUBLIC_APP_URL.replace(/\/$/, '') + '#payment-result' : '',
  amount: Number(process.env.PREMIUM_PRICE_VND || 0),
});
const hmacSha256 = (key, value) => createHmac('sha256', key).update(value).digest('hex');
const vietnamDateCode = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(2, 10).replaceAll('-', '');
const createLicenseKey = () => {
  const value = randomBytes(6).toString('hex').toUpperCase();
  return `ZEN-${value.slice(0, 6)}-${value.slice(6)}`;
};
const sameMac = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};
if (isProduction && (!process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGIN.includes('localhost'))) {
  throw new Error('CLIENT_ORIGIN must be set to the real HTTPS frontend URL in production');
}
const getClientIp = req => {
  if (process.env.TRUST_PROXY === 'true') return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  return req.socket.remoteAddress || 'unknown';
};
const isRateLimited = (req, pathname) => {
  if (pathname === '/api/health' || pathname === '/api/payments/zalopay/callback') return false;
  const isSensitive = pathname.includes('/auth/') || pathname.includes('/premium/activate') || pathname.includes('/payments/zalopay/create-order');
  const limit = isSensitive ? 12 : 120;
  const key = `${getClientIp(req)}:${pathname}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    rateLimitBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
};
setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [key, bucket] of rateLimitBuckets) if (bucket.startedAt < cutoff) rateLimitBuckets.delete(key);
}, 120_000).unref();

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://' + req.headers.host);
  try {
    if (isRateLimited(req, url.pathname)) return send(res, 429, { error: 'Too many requests. Please try again shortly.' });
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

    if (url.pathname === '/api/payments/zalopay/create-order' && req.method === 'POST') {
      const config = getZaloPayConfig();
      if (!config.appId || !config.key1 || !config.key2 || !config.callbackUrl || !config.amount) return send(res, 503, { error: 'ZaloPay is not configured on the server' });
      const input = await body(req);
      const deviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : '';
      const email = typeof input.email === 'string' ? input.email.trim().slice(0, 254) : '';
      if (!deviceId || deviceId.length > 128) return send(res, 400, { error: 'A valid device is required' });
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Enter a valid email address' });
      const appTransId = `${vietnamDateCode()}_${randomBytes(4).toString('hex')}`;
      const appUser = `guest-${deviceId.slice(0, 40)}`;
      const appTime = Date.now();
      const item = JSON.stringify([{ itemid: 'zen-premium', itemname: 'Zen Dictation Premium', itemprice: config.amount, itemquantity: 1 }]);
      const embedData = JSON.stringify(config.redirectUrl ? { redirecturl: config.redirectUrl } : {});
      const mac = hmacSha256(config.key1, `${config.appId}|${appTransId}|${appUser}|${config.amount}|${appTime}|${embedData}|${item}`);
      const order = { app_id: config.appId, app_user: appUser, app_trans_id: appTransId, app_time: appTime, amount: config.amount, description: 'Zen Dictation Premium', item, embed_data: embedData, callback_url: config.callbackUrl, expire_duration_seconds: 15, bank_code: '', mac };
      const result = await fetch(config.createUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
      const payload = await result.json();
      if (!result.ok || payload.return_code !== 1 || !payload.order_url) return send(res, 502, { error: payload.return_message || 'ZaloPay could not create the order' });
      db.prepare('INSERT INTO payment_orders (app_trans_id, device_id, email, amount, status, order_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(appTransId, deviceId, email || null, config.amount, 'pending', payload.order_url, new Date().toISOString());
      return send(res, 201, { orderUrl: payload.order_url, appTransId, amount: config.amount });
    }

    if (url.pathname === '/api/payments/zalopay/callback' && req.method === 'POST') {
      const config = getZaloPayConfig();
      const input = await body(req);
      if (!config.key2 || !sameMac(hmacSha256(config.key2, input.data), input.mac)) return send(res, 200, { return_code: -1, return_message: 'mac not equal' });
      const data = JSON.parse(input.data || '{}');
      const order = db.prepare('SELECT * FROM payment_orders WHERE app_trans_id = ?').get(data.app_trans_id);
      if (!order || Number(data.amount) !== order.amount) return send(res, 200, { return_code: -1, return_message: 'order not found' });
      if (order.status !== 'paid') {
        const licenseKey = createLicenseKey();
        db.prepare('INSERT INTO licenses (id, key_hash, key_last4) VALUES (?, ?, ?)').run(randomUUID(), hashLicense(licenseKey), licenseKey.slice(-4));
        db.prepare('UPDATE payment_orders SET status = ?, zp_trans_id = ?, delivery_key = ?, paid_at = ? WHERE app_trans_id = ?').run('paid', String(data.zp_trans_id || ''), licenseKey, new Date().toISOString(), order.app_trans_id);
      }
      return send(res, 200, { return_code: 1, return_message: 'Success' });
    }

    if (url.pathname === '/api/payments/zalopay/status' && req.method === 'GET') {
      const appTransId = url.searchParams.get('appTransId') || '';
      const deviceId = url.searchParams.get('deviceId') || '';
      const order = db.prepare('SELECT status, delivery_key, amount FROM payment_orders WHERE app_trans_id = ? AND device_id = ?').get(appTransId, deviceId);
      if (!order) return send(res, 404, { error: 'Payment order not found' });
      return send(res, 200, { status: order.status, amount: order.amount, licenseKey: order.delivery_key || null });
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
