import { createServer } from 'node:http';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const scrypt = promisify(scryptCallback);
const PORT = Number(process.env.PORT || 3002);
const LEGACY_DATA_FILE = join(process.cwd(), 'server', 'data.json');
const rateLimitBuckets = new Map();
const isProduction = process.env.NODE_ENV === 'production';
const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL must be configured');
const pool = new Pool({ connectionString: DATABASE_URL, ssl: isProduction ? { rejectUnauthorized: false } : undefined });
const query = (text, values = []) => pool.query(text, values);
const hashLicense = value => createHash('sha256').update(value.trim().toUpperCase()).digest('hex');
const licenseEncryptionKey = createHash('sha256').update(process.env.PREMIUM_DATA_KEY || (isProduction ? '' : 'zen-dictation-development-only')).digest();
if (isProduction && !process.env.PREMIUM_DATA_KEY) throw new Error('PREMIUM_DATA_KEY must be configured in production');
await query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, is_premium BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS practice_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TIMESTAMPTZ NOT NULL, difficulty TEXT NOT NULL, wpm INTEGER NOT NULL DEFAULT 0, accuracy INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS practice_sessions_user_date ON practice_sessions(user_id, date DESC);
CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, key_last4 TEXT NOT NULL, activated_by TEXT, activated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS payment_orders (app_trans_id TEXT PRIMARY KEY, device_id TEXT NOT NULL, email TEXT, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', order_url TEXT, zp_trans_id TEXT, delivery_key TEXT, created_at TIMESTAMPTZ NOT NULL, paid_at TIMESTAMPTZ);`);

const migrateLegacyData = async () => {
  try {
    await access(LEGACY_DATA_FILE);
    const count = await query('SELECT COUNT(*)::int AS count FROM users');
    if (count.rows[0].count > 0) return;
    const legacy = JSON.parse(await readFile(LEGACY_DATA_FILE, 'utf8'));
    for (const user of legacy.users || []) await query('INSERT INTO users (id, email, password_hash, is_premium, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING', [user.id, user.email, user.passwordHash, Boolean(user.isPremium), user.createdAt]);
    for (const session of legacy.practiceSessions || []) await query('INSERT INTO practice_sessions (id, user_id, date, difficulty, wpm, accuracy) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING', [session.id, session.userId, session.date, session.difficulty, session.wpm, session.accuracy]);
    console.log('Migrated legacy JSON data to Supabase');
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Legacy data migration failed:', error.message);
  }
};
await migrateLegacyData();

const seedConfiguredLicenses = async () => {
  const configuredKeys = (process.env.PREMIUM_LICENSE_KEYS || '').split(',').map(key => key.trim()).filter(Boolean);
  for (const key of configuredKeys) await query('INSERT INTO licenses (id, key_hash, key_last4) VALUES ($1, $2, $3) ON CONFLICT (key_hash) DO NOTHING', [randomUUID(), hashLicense(key), key.slice(-4).toUpperCase()]);
};
await seedConfiguredLicenses();

const send = (res, status, payload, extraHeaders = {}) => {
  const allowedOrigin = process.env.CLIENT_ORIGIN || (isProduction ? 'null' : 'http://localhost:5173');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    ...extraHeaders,
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
const parseCookies = header => Object.fromEntries((header || '').split(';').map(cookie => {
  const separator = cookie.indexOf('=');
  return separator < 0 ? [cookie.trim(), ''] : [cookie.slice(0, separator).trim(), cookie.slice(separator + 1).trim()];
}));
const cookieSameSite = isProduction ? 'None' : 'Lax';
const authCookie = token => `zen_auth=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=${cookieSameSite}${isProduction ? '; Secure' : ''}`;
const clearedAuthCookie = `zen_auth=; HttpOnly; Path=/; Max-Age=0; SameSite=${cookieSameSite}${isProduction ? '; Secure' : ''}`;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const hashSessionToken = token => createHash('sha256').update(token).digest('hex');
const createSession = async userId => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await query('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hashSessionToken(token), userId, expiresAt]);
  return token;
};
const deleteSession = async token => {
  if (token) await query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashSessionToken(token)]);
};

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
  const token = parseCookies(req.headers.cookie).zen_auth || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const session = (await query('SELECT user_id FROM auth_sessions WHERE token_hash = $1 AND expires_at > $2', [hashSessionToken(token), new Date().toISOString()])).rows[0];
  if (!session) return null;
  return (await query('SELECT id, email, password_hash, is_premium, created_at FROM users WHERE id = $1', [session.user_id])).rows[0] || null;
};

const validateCredentials = ({ email, password }) => {
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address';
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  return null;
};

const getDeviceLicense = async deviceId => (await query('SELECT key_last4 FROM licenses WHERE activated_by = $1', [deviceId])).rows[0];
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
const encryptLicenseKey = value => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', licenseEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
};
const decryptLicenseKey = value => {
  if (!value?.startsWith('v1:')) return value;
  const [, ivValue, tagValue, encryptedValue] = value.split(':');
  const decipher = createDecipheriv('aes-256-gcm', licenseEncryptionKey, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
};
const migratePlaintextLicenseKeys = async () => {
  const legacyOrders = (await query("SELECT app_trans_id, delivery_key FROM payment_orders WHERE delivery_key IS NOT NULL AND delivery_key NOT LIKE 'v1:%'")).rows;
  for (const order of legacyOrders) await query('UPDATE payment_orders SET delivery_key = $1 WHERE app_trans_id = $2', [encryptLicenseKey(order.delivery_key), order.app_trans_id]);
};
await migratePlaintextLicenseKeys();
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
setInterval(() => {
  query('DELETE FROM auth_sessions WHERE expires_at <= $1', [new Date().toISOString()]).catch(error => console.error('Session cleanup failed:', error.message));
}, 60 * 60 * 1000).unref();

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://' + req.headers.host);
  try {
    if (isRateLimited(req, url.pathname)) return send(res, 429, { error: 'Too many requests. Please try again shortly.' });
    if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });

    if (url.pathname === '/api/premium/status' && req.method === 'GET') {
      const deviceId = url.searchParams.get('deviceId') || '';
      const user = await getAuthUser(req);
      if (user?.is_premium) return send(res, 200, { isPremium: true, source: 'payment' });
      const license = deviceId.length <= 128 ? await getDeviceLicense(deviceId) : null;
      return send(res, 200, { isPremium: Boolean(license), source: license ? 'license' : 'none', licenseLast4: license?.key_last4 || null });
    }

    if (url.pathname === '/api/premium/activate' && req.method === 'POST') {
      const input = await body(req);
      const licenseKey = typeof input.licenseKey === 'string' ? input.licenseKey.trim().toUpperCase() : '';
      const deviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : '';
      if (!licenseKey || !deviceId || deviceId.length > 128) return send(res, 400, { error: 'A valid license key is required' });
      const license = (await query('SELECT id, key_last4, activated_by FROM licenses WHERE key_hash = $1', [hashLicense(licenseKey)])).rows[0];
      if (!license) return send(res, 404, { error: 'This license key is not valid' });
      if (license.activated_by && license.activated_by !== deviceId) return send(res, 409, { error: 'This license key is already used on another device' });
      await query('UPDATE licenses SET activated_by = $1, activated_at = $2 WHERE id = $3', [deviceId, new Date().toISOString(), license.id]);
      const user = await getAuthUser(req);
      if (user) await query('UPDATE users SET is_premium = TRUE WHERE id = $1', [user.id]);
      return send(res, 200, { isPremium: true, source: user ? 'payment' : 'license', licenseLast4: license.key_last4 });
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
      await query('INSERT INTO payment_orders (app_trans_id, device_id, email, amount, status, order_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [appTransId, deviceId, email || null, config.amount, 'pending', payload.order_url, new Date().toISOString()]);
      return send(res, 201, { orderUrl: payload.order_url, appTransId, amount: config.amount });
    }

    if (url.pathname === '/api/payments/zalopay/callback' && req.method === 'POST') {
      const config = getZaloPayConfig();
      const input = await body(req);
      if (!config.key2 || !sameMac(hmacSha256(config.key2, input.data), input.mac)) return send(res, 200, { return_code: -1, return_message: 'mac not equal' });
      const data = JSON.parse(input.data || '{}');
      const order = (await query('SELECT * FROM payment_orders WHERE app_trans_id = $1', [data.app_trans_id])).rows[0];
      if (!order || Number(data.amount) !== order.amount) return send(res, 200, { return_code: -1, return_message: 'order not found' });
      if (order.status !== 'paid') {
        const licenseKey = createLicenseKey();
        await query('INSERT INTO licenses (id, key_hash, key_last4) VALUES ($1, $2, $3)', [randomUUID(), hashLicense(licenseKey), licenseKey.slice(-4)]);
        await query('UPDATE payment_orders SET status = $1, zp_trans_id = $2, delivery_key = $3, paid_at = $4 WHERE app_trans_id = $5', ['paid', String(data.zp_trans_id || ''), encryptLicenseKey(licenseKey), new Date().toISOString(), order.app_trans_id]);
      }
      return send(res, 200, { return_code: 1, return_message: 'Success' });
    }

    if (url.pathname === '/api/payments/zalopay/status' && req.method === 'GET') {
      const appTransId = url.searchParams.get('appTransId') || '';
      const deviceId = url.searchParams.get('deviceId') || '';
      const order = (await query('SELECT status, delivery_key, amount FROM payment_orders WHERE app_trans_id = $1 AND device_id = $2', [appTransId, deviceId])).rows[0];
      if (!order) return send(res, 404, { error: 'Payment order not found' });
      return send(res, 200, { status: order.status, amount: order.amount, licenseKey: order.delivery_key ? decryptLicenseKey(order.delivery_key) : null });
    }

    if (url.pathname === '/api/auth/register' && req.method === 'POST') {
      const input = await body(req);
      const error = validateCredentials(input);
      if (error) return send(res, 400, { error });
      const email = input.email.toLowerCase().trim();
      if ((await query('SELECT id FROM users WHERE email = $1', [email])).rows[0]) return send(res, 409, { error: 'An account with this email already exists' });
      const user = { id: randomUUID(), email, passwordHash: await hashPassword(input.password), isPremium: false, createdAt: new Date().toISOString() };
      await query('INSERT INTO users (id, email, password_hash, is_premium, created_at) VALUES ($1, $2, $3, $4, $5)', [user.id, user.email, user.passwordHash, false, user.createdAt]);
      const token = await createSession(user.id);
      return send(res, 201, { user: publicUser(user) }, { 'Set-Cookie': authCookie(token) });
    }

    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const input = await body(req);
      const user = (await query('SELECT id, email, password_hash, is_premium, created_at FROM users WHERE email = $1', [String(input.email || '').toLowerCase().trim()])).rows[0];
      if (!user || !(await verifyPassword(input.password || '', user.password_hash))) return send(res, 401, { error: 'Email or password is incorrect' });
      const token = await createSession(user.id);
      return send(res, 200, { user: publicUser(user) }, { 'Set-Cookie': authCookie(token) });
    }

    const user = await getAuthUser(req);
    if (!user) return send(res, 401, { error: 'Please sign in to continue' });

    if (url.pathname === '/api/auth/me' && req.method === 'GET') return send(res, 200, { user: publicUser(user) });
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = parseCookies(req.headers.cookie).zen_auth || req.headers.authorization?.replace('Bearer ', '');
      await deleteSession(token);
      return send(res, 200, { ok: true }, { 'Set-Cookie': clearedAuthCookie });
    }

    if (url.pathname === '/api/sessions' && req.method === 'GET') {
      const rows = (await query('SELECT id, date, difficulty, wpm, accuracy FROM practice_sessions WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [user.id])).rows;
      return send(res, 200, { sessions: rows });
    }

    if (url.pathname === '/api/sessions' && req.method === 'POST') {
      const input = await body(req);
      const session = { id: randomUUID(), userId: user.id, date: input.date || new Date().toISOString(), difficulty: input.difficulty || 'easy', wpm: Number(input.wpm) || 0, accuracy: Number(input.accuracy) || 0 };
      await query('INSERT INTO practice_sessions (id, user_id, date, difficulty, wpm, accuracy) VALUES ($1, $2, $3, $4, $5, $6)', [session.id, session.userId, session.date, session.difficulty, session.wpm, session.accuracy]);
      await query('DELETE FROM practice_sessions WHERE user_id = $1 AND id NOT IN (SELECT id FROM practice_sessions WHERE user_id = $1 ORDER BY date DESC LIMIT 30)', [user.id]);
      return send(res, 201, { session });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'Unexpected server error' });
  }
});

server.listen(PORT, () => console.log('Zen Dictation API listening on http://localhost:' + PORT));
