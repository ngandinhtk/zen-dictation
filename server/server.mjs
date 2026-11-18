import { createServer } from 'node:http';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import pg from 'pg';
import { fetchYoutubeTranscript, YoutubeTranscriptError } from './youtubeTranscript.mjs';
import { mergeAccountLearningState } from './learningStateMerge.mjs';

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
CREATE TABLE IF NOT EXISTS password_reset_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry ON password_reset_tokens(expires_at);
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS access_email_submissions (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), promo_consent BOOLEAN NOT NULL DEFAULT FALSE, promo_consent_at TIMESTAMPTZ, promo_license_key TEXT, promo_email_sent_at TIMESTAMPTZ, promo_email_delivery_token TEXT, promo_email_delivery_started_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS practice_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TIMESTAMPTZ NOT NULL, difficulty TEXT NOT NULL, wpm INTEGER NOT NULL DEFAULT 0, accuracy INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS practice_sessions_user_date ON practice_sessions(user_id, date DESC);
CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, key_last4 TEXT NOT NULL, activated_by TEXT, activated_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, activated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS payment_orders (app_trans_id TEXT PRIMARY KEY, device_id TEXT NOT NULL, email TEXT, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', order_url TEXT, zp_trans_id TEXT, delivery_key TEXT, created_at TIMESTAMPTZ NOT NULL, paid_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS sentence_packs (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', is_premium BOOLEAN NOT NULL DEFAULT FALSE, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS sentences (id TEXT PRIMARY KEY, pack_id TEXT NOT NULL REFERENCES sentence_packs(id) ON DELETE CASCADE, text TEXT NOT NULL, difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')), topic TEXT NOT NULL DEFAULT 'general', source TEXT NOT NULL DEFAULT 'custom', license TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS sentences_pack_difficulty_idx ON sentences(pack_id, difficulty, sort_order);
CREATE TABLE IF NOT EXISTS learning_state (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, review_words JSONB NOT NULL DEFAULT '[]'::jsonb, points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0), daily_target JSONB, goal_wpm INTEGER NOT NULL DEFAULT 40 CHECK (goal_wpm BETWEEN 10 AND 200), learner_level TEXT CHECK (learner_level IN ('beginner', 'intermediate', 'advanced')), coach_state JSONB NOT NULL DEFAULT '{"attempts":[],"reviews":[]}'::jsonb, practice_notes JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS learning_state_updated_at_idx ON learning_state(updated_at DESC);
CREATE TABLE IF NOT EXISTS placement_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_score SMALLINT NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  listening_score SMALLINT NOT NULL CHECK (listening_score BETWEEN 0 AND 100),
  speaking_score SMALLINT NOT NULL CHECK (speaking_score BETWEEN 0 AND 100),
  writing_score SMALLINT NOT NULL CHECK (writing_score BETWEEN 0 AND 100),
  answered_count SMALLINT NOT NULL CHECK (answered_count BETWEEN 0 AND 15),
  question_count SMALLINT NOT NULL CHECK (question_count = 15),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS placement_results_user_date_idx ON placement_results(user_id, created_at DESC);`);
await query('ALTER TABLE licenses ADD COLUMN IF NOT EXISTS activated_user_id TEXT REFERENCES users(id) ON DELETE SET NULL');
await query('CREATE INDEX IF NOT EXISTS licenses_activated_user_idx ON licenses(activated_user_id) WHERE activated_user_id IS NOT NULL');
await query("ALTER TABLE learning_state ADD COLUMN IF NOT EXISTS learner_level TEXT CHECK (learner_level IN ('beginner', 'intermediate', 'advanced'))");
await query(`ALTER TABLE learning_state ADD COLUMN IF NOT EXISTS coach_state JSONB NOT NULL DEFAULT '{"attempts":[],"reviews":[]}'::jsonb`);
await query("ALTER TABLE learning_state ADD COLUMN IF NOT EXISTS practice_notes JSONB NOT NULL DEFAULT '[]'::jsonb");
await query('ALTER TABLE access_email_submissions ADD COLUMN IF NOT EXISTS promo_consent BOOLEAN NOT NULL DEFAULT FALSE');
await query('ALTER TABLE access_email_submissions ADD COLUMN IF NOT EXISTS promo_consent_at TIMESTAMPTZ');
await query('ALTER TABLE access_email_submissions ADD COLUMN IF NOT EXISTS promo_license_key TEXT');
await query('ALTER TABLE access_email_submissions ADD COLUMN IF NOT EXISTS promo_email_sent_at TIMESTAMPTZ');
await query('ALTER TABLE access_email_submissions ADD COLUMN IF NOT EXISTS promo_email_delivery_token TEXT');
await query('ALTER TABLE access_email_submissions ADD COLUMN IF NOT EXISTS promo_email_delivery_started_at TIMESTAMPTZ');

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

const sentencePackCache = new Map();
const warmSentencePackCache = async () => {
  const rows = (await query(`SELECT s.id, s.text, s.difficulty, s.topic, s.source, s.license, s.sort_order, p.id AS pack_id, p.name AS pack_name, p.is_premium FROM sentences s JOIN sentence_packs p ON p.id = s.pack_id WHERE p.is_active = TRUE AND s.is_active = TRUE ORDER BY s.pack_id, s.difficulty, s.sort_order`)).rows;
  const seenSentences = new Map();
  let duplicateCount = 0;
  rows.forEach(sentence => {
    const key = `${sentence.pack_id}:${sentence.difficulty}`;
    const normalizedText = sentence.text.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
    const seen = seenSentences.get(key) || new Set();
    if (seen.has(normalizedText)) {
      duplicateCount += 1;
      return;
    }
    seen.add(normalizedText);
    seenSentences.set(key, seen);
    const pack = sentencePackCache.get(key) || [];
    pack.push(sentence);
    sentencePackCache.set(key, pack);
  });
  console.log(`Warmed ${rows.length - duplicateCount} unique sentences in memory (${duplicateCount} duplicates skipped)`);
};
await warmSentencePackCache();

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
    'Access-Control-Expose-Headers': 'ETag',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    ...extraHeaders,
  });
  if (status === 204 || status === 304) {
    res.end();
    return;
  }
  const responseBody = JSON.stringify(payload);
  res.end(extraHeaders['Content-Encoding'] === 'gzip' ? gzipSync(responseBody) : responseBody);
};

const body = async (req, maxChars = 100_000) => {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxChars) throw new Error('Payload too large');
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
  return (await query(`SELECT u.id, u.email, u.password_hash, u.is_premium, u.created_at
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > $2`, [hashSessionToken(token), new Date().toISOString()])).rows[0] || null;
};

const validateCredentials = ({ email, password }) => {
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address';
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  return null;
};

const getDeviceLicense = async deviceId => (await query('SELECT key_last4, activated_user_id FROM licenses WHERE activated_by = $1', [deviceId])).rows[0];
const getUserLicense = async userId => (await query('SELECT key_last4 FROM licenses WHERE activated_user_id = $1', [userId])).rows[0];
const claimDeviceLicense = async (userId, deviceId) => {
  if (!userId || !deviceId) return null;
  const license = (await query('SELECT id, key_last4, activated_user_id FROM licenses WHERE activated_by = $1', [deviceId])).rows[0];
  if (!license || (license.activated_user_id && license.activated_user_id !== userId)) return null;
  await query('UPDATE licenses SET activated_user_id = $1, activated_at = $2 WHERE id = $3 AND (activated_user_id IS NULL OR activated_user_id = $1)', [userId, new Date().toISOString(), license.id]);
  await query('UPDATE users SET is_premium = TRUE WHERE id = $1', [userId]);
  return license;
};

const getPayPalConfig = () => ({
  clientId: process.env.PAYPAL_CLIENT_ID || '',
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
  apiUrl: process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
  amount: Number(process.env.PREMIUM_PRICE_USD || 0),
  currency: process.env.PAYPAL_CURRENCY || 'USD',
  returnUrl: process.env.PUBLIC_APP_URL ? process.env.PUBLIC_APP_URL.replace(/\/$/, '') + '#payment-result' : '',
  cancelUrl: process.env.PUBLIC_APP_URL ? process.env.PUBLIC_APP_URL.replace(/\/$/, '') + '#payment' : '',
});
const getEmailSender = () => {
  const value = process.env.EMAIL_FROM.trim();
  const match = value.match(/^(.*?)\s*<([^<>]+)>$/);
  return match
    ? { name: match[1].trim().replace(/^["']|["']$/g, ''), email: match[2].trim() }
    : { email: value };
};
const sendEmail = async (email, subject, textContent) => {
  const result = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ sender: getEmailSender(), to: [{ email }], subject, textContent }),
  });
  if (!result.ok) throw new Error(`Brevo email failed: ${await result.text()}`);
};
const paypalToken = async config => {
  const result = await fetch(`${config.apiUrl}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const payload = await result.json();
  if (!result.ok || !payload.access_token) throw new Error('PayPal authentication failed');
  return payload.access_token;
};
const sendLicenseEmail = async (email, licenseKey) => {
  if (!email) return;
  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) {
    console.warn('License email skipped: BREVO_API_KEY and EMAIL_FROM are not configured');
    return;
  }
  await sendEmail(email, 'Your Zen Dictation Premium license', `Thank you for your purchase!\n\nYour Zen Dictation Premium license key is:\n${licenseKey}\n\nOpen Zen Dictation Premium and enter this key to activate your access.`);
};
const sendWelcomeLicenseEmail = async (email, licenseKey, language) => {
  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) throw new Error('Welcome email is not configured');
  const isVietnamese = language === 'vi';
  const subject = isVietnamese
    ? 'Chào mừng bạn đến với Zentation — mã Premium miễn phí'
    : 'Welcome to Zentation — your free Premium code';
  const textContent = isVietnamese
    ? `Chào mừng bạn đến với Zentation!\n\nCảm ơn bạn đã tham gia. Đây là mã kích hoạt Zen Dictation Premium miễn phí, không hết hạn của bạn:\n\n${licenseKey}\n\nĐể kích hoạt, mở ứng dụng, vào mục Premium và nhập mã trên. Mỗi mã chỉ kích hoạt được một lần cho một thiết bị hoặc tài khoản.\n\nĐây là email chào mừng một lần mà bạn đã đồng ý nhận. Chúng tôi sẽ không gửi email quảng cáo nào khác.`
    : `Welcome to Zentation!\n\nThanks for joining. Here is your free, non-expiring Zen Dictation Premium activation code:\n\n${licenseKey}\n\nTo activate it, open the app, go to Premium, and enter the code. Each code can be activated once for one device or account.\n\nThis is the one-time welcome email you agreed to receive. We will not send other marketing emails.`;
  await sendEmail(email, subject, textContent);
};
const rawBody = async req => {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw new Error('Payload too large'); }
  return raw;
};
const completePayment = async (orderId, captureId) => {
  const client = await pool.connect();
  let email;
  let licenseKey;
  try {
    await client.query('BEGIN');
    const order = (await client.query('SELECT * FROM payment_orders WHERE app_trans_id = $1 FOR UPDATE', [orderId])).rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return false;
    }
    if (order.status === 'paid') {
      await client.query('COMMIT');
      return true;
    }
    licenseKey = createLicenseKey();
    await client.query('INSERT INTO licenses (id, key_hash, key_last4) VALUES ($1, $2, $3)', [randomUUID(), hashLicense(licenseKey), licenseKey.slice(-4)]);
    await client.query('UPDATE payment_orders SET status = $1, zp_trans_id = $2, delivery_key = $3, paid_at = $4 WHERE app_trans_id = $5', ['paid', captureId, encryptLicenseKey(licenseKey), new Date().toISOString(), orderId]);
    email = order.email;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  try { await sendLicenseEmail(email, licenseKey); } catch (error) { console.error('License email delivery failed:', error.message); }
  return true;
};
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
  if (pathname === '/api/health' || pathname === '/api/payments/paypal/webhook') return false;
  const isSensitive = pathname.includes('/auth/') || pathname === '/api/access-email' || pathname === '/api/learning-state' || pathname === '/api/placement-results' || pathname.includes('/premium/activate') || pathname.includes('/payments/paypal/create-order');
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
  query('DELETE FROM password_reset_tokens WHERE expires_at <= $1', [new Date().toISOString()]).catch(error => console.error('Password reset cleanup failed:', error.message));
}, 60 * 60 * 1000).unref();

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://' + req.headers.host);
  try {
    if (isRateLimited(req, url.pathname)) return send(res, 429, { error: 'Too many requests. Please try again shortly.' });
    if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });

    if (url.pathname === '/api/access-email' && req.method === 'POST') {
      let input;
      try {
        input = await body(req);
      } catch (error) {
        if (error instanceof SyntaxError) return send(res, 400, { error: 'Invalid request body' });
        throw error;
      }
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Enter a valid email address' });
      const promoConsent = input.promoConsent === true;
      const language = input.language === 'vi' ? 'vi' : 'en';
      const client = await pool.connect();
      let promoLicenseKey;
      let welcomeEmailSent = false;
      try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO access_email_submissions (id, email, promo_consent, promo_consent_at)
          VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() END)
          ON CONFLICT (email) DO UPDATE SET
            promo_consent = access_email_submissions.promo_consent OR EXCLUDED.promo_consent,
            promo_consent_at = CASE
              WHEN EXCLUDED.promo_consent AND NOT access_email_submissions.promo_consent THEN NOW()
              ELSE access_email_submissions.promo_consent_at
            END`, [randomUUID(), email, promoConsent]);
        if (promoConsent) {
          const submission = (await client.query('SELECT promo_license_key, promo_email_sent_at FROM access_email_submissions WHERE email = $1 FOR UPDATE', [email])).rows[0];
          promoLicenseKey = submission.promo_license_key ? decryptLicenseKey(submission.promo_license_key) : null;
          if (!promoLicenseKey) {
            promoLicenseKey = createLicenseKey();
            await client.query('INSERT INTO licenses (id, key_hash, key_last4) VALUES ($1, $2, $3)', [randomUUID(), hashLicense(promoLicenseKey), promoLicenseKey.slice(-4)]);
            await client.query('UPDATE access_email_submissions SET promo_license_key = $1 WHERE email = $2', [encryptLicenseKey(promoLicenseKey), email]);
          }
          welcomeEmailSent = Boolean(submission.promo_email_sent_at);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      if (promoConsent && !welcomeEmailSent) {
        const deliveryToken = randomUUID();
        const delivery = (await query(`UPDATE access_email_submissions
          SET promo_email_delivery_token = $2, promo_email_delivery_started_at = NOW()
          WHERE email = $1 AND promo_email_sent_at IS NULL
            AND (promo_email_delivery_token IS NULL OR promo_email_delivery_started_at < NOW() - INTERVAL '2 minutes')
          RETURNING promo_license_key`, [email, deliveryToken])).rows[0];
        if (delivery) {
          try {
            await sendWelcomeLicenseEmail(email, decryptLicenseKey(delivery.promo_license_key), language);
            await query(`UPDATE access_email_submissions
              SET promo_email_sent_at = NOW(), promo_email_delivery_token = NULL, promo_email_delivery_started_at = NULL
              WHERE email = $1 AND promo_email_delivery_token = $2`, [email, deliveryToken]);
            welcomeEmailSent = true;
          } catch (error) {
            console.error('Welcome Premium email delivery failed:', error.message);
            try {
              await query(`UPDATE access_email_submissions
                SET promo_email_delivery_token = NULL, promo_email_delivery_started_at = NULL
                WHERE email = $1 AND promo_email_delivery_token = $2`, [email, deliveryToken]);
            } catch (releaseError) {
              console.error('Welcome Premium email retry release failed:', releaseError.message);
            }
            return send(res, 503, { error: 'WELCOME_EMAIL_FAILED' });
          }
        }
      }
      return send(res, 201, { accepted: true, welcomeEmailSent });
    }

    if (url.pathname === '/api/sentences' && req.method === 'GET') {
      const pack = url.searchParams.get('pack') || 'core';
      const difficulty = url.searchParams.get('difficulty');
      const allowedDifficulty = difficulty && ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : null;
      const rows = allowedDifficulty
        ? sentencePackCache.get(`${pack}:${allowedDifficulty}`) || []
        : [...sentencePackCache.entries()]
          .filter(([key]) => key.startsWith(`${pack}:`))
          .flatMap(([, sentences]) => sentences);
      const payload = { pack, sentences: rows };
      const etag = `"${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}"`;
      const cacheHeaders = {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        ETag: `W/${etag}`,
        Vary: 'Origin, Accept-Encoding',
      };
      const requestEtags = (req.headers['if-none-match'] || '').split(',').map(value => value.trim());
      if (requestEtags.includes('*') || requestEtags.includes(etag) || requestEtags.includes(`W/${etag}`)) return send(res, 304, {}, cacheHeaders);
      const acceptsGzip = (req.headers['accept-encoding'] || '').split(',').some(encoding => {
        const [name, ...parameters] = encoding.trim().toLowerCase().split(';');
        return name === 'gzip' && !parameters.some(parameter => /^q=0(?:\.0*)?$/.test(parameter.trim()));
      });
      if (acceptsGzip) cacheHeaders['Content-Encoding'] = 'gzip';
      return send(res, 200, payload, cacheHeaders);
    }

    if (url.pathname === '/api/premium/status' && req.method === 'GET') {
      const deviceId = url.searchParams.get('deviceId') || '';
      const user = await getAuthUser(req);
      if (user?.is_premium) return send(res, 200, { isPremium: true, source: 'payment' });
      const accountLicense = user ? await getUserLicense(user.id) : null;
      if (accountLicense) {
        await query('UPDATE users SET is_premium = TRUE WHERE id = $1', [user.id]);
        return send(res, 200, { isPremium: true, source: 'license', licenseLast4: accountLicense.key_last4 });
      }
      const claimedLicense = user && deviceId.length <= 128 ? await claimDeviceLicense(user.id, deviceId) : null;
      const license = claimedLicense || (deviceId.length <= 128 ? await getDeviceLicense(deviceId) : null);
      return send(res, 200, { isPremium: Boolean(license), source: license ? 'license' : 'none', licenseLast4: license?.key_last4 || null });
    }

    if (url.pathname === '/api/premium/activate' && req.method === 'POST') {
      const input = await body(req);
      const licenseKey = typeof input.licenseKey === 'string' ? input.licenseKey.trim().toUpperCase() : '';
      const deviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : '';
      if (!licenseKey || !deviceId || deviceId.length > 128) return send(res, 400, { error: 'A valid license key is required' });
      const user = await getAuthUser(req);
      const license = (await query('SELECT id, key_last4, activated_by, activated_user_id FROM licenses WHERE key_hash = $1', [hashLicense(licenseKey)])).rows[0];
      if (!license) return send(res, 404, { error: 'This license key is not valid' });
      if (license.activated_user_id && license.activated_user_id !== user?.id) return send(res, 409, { error: 'This license key belongs to another account' });
      if (!license.activated_user_id && license.activated_by && license.activated_by !== deviceId) return send(res, 409, { error: 'This license key is already used on another device' });
      await query('UPDATE licenses SET activated_by = COALESCE(activated_by, $1), activated_user_id = COALESCE(activated_user_id, $2), activated_at = $3 WHERE id = $4', [deviceId, user?.id || null, new Date().toISOString(), license.id]);
      if (user) await query('UPDATE users SET is_premium = TRUE WHERE id = $1', [user.id]);
      return send(res, 200, { isPremium: true, source: 'license', licenseLast4: license.key_last4 });
    }

    if (url.pathname === '/api/payments/paypal/create-order' && req.method === 'POST') {
      const config = getPayPalConfig();
      if (!config.clientId || !config.clientSecret || !config.amount || !config.returnUrl) return send(res, 503, { error: 'PayPal is not configured on the server' });
      const input = await body(req);
      const deviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : '';
      const email = typeof input.email === 'string' ? input.email.trim().slice(0, 254) : '';
      if (!deviceId || deviceId.length > 128) return send(res, 400, { error: 'A valid device is required' });
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Enter a valid email address' });
      const token = await paypalToken(config);
      const result = await fetch(`${config.apiUrl}/v2/checkout/orders`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: deviceId, description: 'Zen Dictation Premium', amount: { currency_code: config.currency, value: config.amount.toFixed(2) } }], application_context: { return_url: config.returnUrl, cancel_url: config.cancelUrl } }) });
      const payload = await result.json();
      const approvalUrl = payload.links?.find(link => link.rel === 'approve')?.href;
      if (!result.ok || !payload.id || !approvalUrl) return send(res, 502, { error: payload.message || 'PayPal could not create the order' });
      await query('INSERT INTO payment_orders (app_trans_id, device_id, email, amount, status, order_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [payload.id, deviceId, email || null, Math.round(config.amount * 100), 'pending', approvalUrl, new Date().toISOString()]);
      return send(res, 201, { orderUrl: approvalUrl, appTransId: payload.id, amount: config.amount });
    }

    if (url.pathname === '/api/payments/paypal/capture-order' && req.method === 'POST') {
      const config = getPayPalConfig();
      if (!config.clientId || !config.clientSecret) return send(res, 503, { error: 'PayPal is not configured on the server' });
      const input = await body(req);
      const orderId = typeof input.orderId === 'string' ? input.orderId.trim() : '';
      const deviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : '';
      if (!orderId || !deviceId || deviceId.length > 128) return send(res, 400, { error: 'A valid PayPal order and device are required' });
      const order = (await query('SELECT app_trans_id, status FROM payment_orders WHERE app_trans_id = $1 AND device_id = $2', [orderId, deviceId])).rows[0];
      if (!order) return send(res, 404, { error: 'Payment order not found' });
      if (order.status !== 'paid') {
        const token = await paypalToken(config);
        const result = await fetch(`${config.apiUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
        const payload = await result.json();
        if (!result.ok && payload.name !== 'UNPROCESSABLE_ENTITY') return send(res, 502, { error: payload.message || 'PayPal could not capture the order' });
        const capture = payload.purchase_units?.[0]?.payments?.captures?.[0];
        if (payload.status === 'COMPLETED' && capture?.status === 'COMPLETED') await completePayment(orderId, capture.id);
        else if (order.status !== 'paid') return send(res, 409, { error: 'PayPal payment is not completed yet' });
      }
      const paidOrder = (await query('SELECT status, delivery_key, amount FROM payment_orders WHERE app_trans_id = $1 AND device_id = $2', [orderId, deviceId])).rows[0];
      return send(res, 200, { status: paidOrder.status, amount: paidOrder.amount, licenseKey: paidOrder.delivery_key ? decryptLicenseKey(paidOrder.delivery_key) : null });
    }

    if (url.pathname === '/api/payments/paypal/webhook' && req.method === 'POST') {
      const config = getPayPalConfig();
      const raw = await rawBody(req);
      const input = JSON.parse(raw || '{}');
      if (!config.webhookId) return send(res, 503, { error: 'PayPal webhook is not configured' });
      const token = await paypalToken(config);
      const verification = await fetch(`${config.apiUrl}/v1/notifications/verify-webhook-signature`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_algo: req.headers['paypal-auth-algo'], cert_url: req.headers['paypal-cert-url'], transmission_id: req.headers['paypal-transmission-id'], transmission_sig: req.headers['paypal-transmission-sig'], transmission_time: req.headers['paypal-transmission-time'], webhook_id: config.webhookId, webhook_event: input }) });
      const verificationPayload = await verification.json();
      if (!verification.ok || verificationPayload.verification_status !== 'SUCCESS') return send(res, 400, { error: 'Invalid PayPal webhook signature' });
      if (input.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const orderId = input.resource?.supplementary_data?.related_ids?.order_id;
        await completePayment(orderId, input.resource?.id || '');
      }
      return send(res, 200, { received: true });
    }

    if (url.pathname === '/api/payments/paypal/status' && req.method === 'GET') {
      const appTransId = url.searchParams.get('appTransId') || '';
      const deviceId = url.searchParams.get('deviceId') || '';
      const order = (await query('SELECT status, delivery_key, amount FROM payment_orders WHERE app_trans_id = $1 AND device_id = $2', [appTransId, deviceId])).rows[0];
      if (!order) return send(res, 404, { error: 'Payment order not found' });
      return send(res, 200, { status: order.status, amount: order.amount, licenseKey: order.delivery_key ? decryptLicenseKey(order.delivery_key) : null });
    }

    if (url.pathname === '/api/youtube/transcript' && req.method === 'POST') {
      const input = await body(req);
      if (typeof input.url !== 'string' || input.url.length > 500) return send(res, 400, { error: 'Please enter a valid YouTube link' });
      try {
        const transcript = await fetchYoutubeTranscript(input.url);
        return send(res, 200, transcript);
      } catch (error) {
        console.error('YouTube transcript error:', error);
        return send(res, error instanceof YoutubeTranscriptError ? error.status : 502, { error: error instanceof Error ? error.message : 'Unable to fetch the YouTube captions', code: error instanceof YoutubeTranscriptError ? error.code : 'YOUTUBE_UNAVAILABLE' });
      }
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

    if (url.pathname === '/api/auth/forgot-password' && req.method === 'POST') {
      const input = await body(req);
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Enter a valid email address' });
      if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) return send(res, 503, { error: 'Password reset email is not configured. Please contact support.' });
      const resetUrl = new URL(process.env.PUBLIC_APP_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173');
      if (!['http:', 'https:'].includes(resetUrl.protocol)) throw new Error('Invalid PUBLIC_APP_URL');
      const account = (await query('SELECT id FROM users WHERE email = $1', [email])).rows[0];
      if (account) {
        const token = randomBytes(32).toString('hex');
        const tokenHash = hashSessionToken(token);
        // Keep prior links valid until they expire; failed delivery must not invalidate them.
        await query('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, account.id, new Date(Date.now() + 30 * 60 * 1000).toISOString()]);
        resetUrl.hash = `reset-password=${token}`;
        try {
          await sendEmail(email, 'Reset your Zen Dictation password', `Open this link to reset your password:\n\n${resetUrl.href}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, ignore this email.`);
        } catch (error) {
          await query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]);
          console.error('Password reset email delivery failed:', error);
        }
      }
      return send(res, 200, { message: 'If an account exists with this email, you will receive a password reset link. Check your inbox and spam folder.' });
    }

    if (url.pathname === '/api/auth/reset-password' && req.method === 'POST') {
      const input = await body(req);
      if (typeof input.token !== 'string' || !/^[a-f0-9]{64}$/.test(input.token)) return send(res, 400, { error: 'This reset link is invalid or has expired. Request a new link.' });
      if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 1024) return send(res, 400, { error: 'Password must be between 8 and 1024 characters' });
      const passwordHash = await hashPassword(input.password);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Lock the account to serialize simultaneous resets through different links.
        const account = (await client.query('SELECT u.id FROM users u JOIN password_reset_tokens t ON t.user_id = u.id WHERE t.token_hash = $1 FOR UPDATE OF u', [hashSessionToken(input.token)])).rows[0];
        const reset = (await client.query('DELETE FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id', [hashSessionToken(input.token)])).rows[0];
        if (!account || !reset) {
          await client.query('ROLLBACK');
          return send(res, 400, { error: 'This reset link is invalid or has expired. Request a new link.' });
        }
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, account.id]);
        await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [account.id]);
        await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [account.id]);
        await client.query('COMMIT');
        return send(res, 200, { message: 'Password updated. Sign in with your new password.' }, { 'Set-Cookie': clearedAuthCookie });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
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

    if (url.pathname === '/api/placement-results' && req.method === 'POST') {
      const input = await body(req);
      if (!input || !Array.isArray(input.questionScores) || input.questionScores.length !== 15
        || input.questionScores.some(score => score !== null && (!Number.isInteger(score) || score < 0 || score > 100))) {
        return send(res, 400, { error: 'A score for each of the 15 questions is required' });
      }
      const questionScores = input.questionScores;
      const average = scores => Math.round(scores.reduce((sum, score) => sum + (score ?? 0), 0) / scores.length);
      const result = (await query(`INSERT INTO placement_results
        (id, user_id, total_score, listening_score, speaking_score, writing_score, answered_count, question_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 15)
        RETURNING id, total_score, listening_score, speaking_score, writing_score, answered_count, question_count, created_at`,
      [
        randomUUID(),
        user.id,
        average(questionScores),
        average(questionScores.slice(0, 5)),
        average(questionScores.slice(5, 10)),
        average(questionScores.slice(10, 15)),
        questionScores.filter(score => score !== null).length,
      ])).rows[0];
      return send(res, 201, { result, user: { email: user.email } });
    }

    if (url.pathname === '/api/learning-state' && req.method === 'GET') {
      const state = (await query('SELECT review_words, points, daily_target, goal_wpm, learner_level, coach_state, practice_notes, updated_at FROM learning_state WHERE user_id = $1', [user.id])).rows[0];
      return send(res, 200, { state: state || null });
    }

    if (url.pathname === '/api/learning-state' && req.method === 'PUT') {
      const input = await body(req, 6_000_000);
      const client = await pool.connect();
      let state;
      let transactionStarted = false;
      try {
        await client.query('BEGIN');
        transactionStarted = true;
        await client.query('INSERT INTO learning_state (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);
        const current = (await client.query('SELECT review_words, points, daily_target, goal_wpm, learner_level, coach_state, practice_notes FROM learning_state WHERE user_id = $1 FOR UPDATE', [user.id])).rows[0];
        const merged = mergeAccountLearningState(current, input);
        state = (await client.query(`INSERT INTO learning_state (user_id, review_words, points, daily_target, goal_wpm, learner_level, coach_state, practice_notes, updated_at)
          VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            review_words = EXCLUDED.review_words,
            points = EXCLUDED.points,
            daily_target = EXCLUDED.daily_target,
            goal_wpm = EXCLUDED.goal_wpm,
            learner_level = EXCLUDED.learner_level,
            coach_state = EXCLUDED.coach_state,
            practice_notes = EXCLUDED.practice_notes,
            updated_at = NOW()
          RETURNING review_words, points, daily_target, goal_wpm, learner_level, coach_state, practice_notes, updated_at`,
        [user.id, JSON.stringify(merged.reviewWords), merged.points, JSON.stringify(merged.dailyTarget), merged.goalWpm, merged.learnerLevel, JSON.stringify(merged.coachState), JSON.stringify(merged.practiceNotes)])).rows[0];
        await client.query('COMMIT');
        transactionStarted = false;
      } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return send(res, 200, { state });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'Unexpected server error' });
  }
});

server.listen(PORT, () => console.log('Zen Dictation API listening on http://localhost:' + PORT));
