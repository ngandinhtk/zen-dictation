import { createServer } from 'node:http';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const scrypt = promisify(scryptCallback);
const PORT = Number(process.env.PORT || 3001);
const DATA_FILE = join(process.cwd(), 'server', 'data.json');
const sessions = new Map();

const readData = async () => {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch {
    return { users: [], practiceSessions: [] };
  }
};

const writeData = async data => {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
};

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

const publicUser = user => ({ id: user.id, email: user.email, createdAt: user.createdAt, isPremium: user.isPremium });

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
  const data = await readData();
  return data.users.find(user => user.id === userId) || null;
};

const validateCredentials = ({ email, password }) => {
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address';
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  return null;
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://' + req.headers.host);
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });

    if (url.pathname === '/api/auth/register' && req.method === 'POST') {
      const input = await body(req);
      const error = validateCredentials(input);
      if (error) return send(res, 400, { error });
      const data = await readData();
      const email = input.email.toLowerCase().trim();
      if (data.users.some(user => user.email === email)) return send(res, 409, { error: 'An account with this email already exists' });
      const user = { id: randomUUID(), email, passwordHash: await hashPassword(input.password), isPremium: false, createdAt: new Date().toISOString() };
      data.users.push(user);
      await writeData(data);
      const token = randomBytes(32).toString('hex');
      sessions.set(token, user.id);
      return send(res, 201, { user: publicUser(user), token });
    }

    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const input = await body(req);
      const data = await readData();
      const user = data.users.find(candidate => candidate.email === String(input.email || '').toLowerCase().trim());
      if (!user || !(await verifyPassword(input.password || '', user.passwordHash))) return send(res, 401, { error: 'Email or password is incorrect' });
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
      const data = await readData();
      return send(res, 200, { sessions: data.practiceSessions.filter(session => session.userId === user.id).slice(0, 30) });
    }

    if (url.pathname === '/api/sessions' && req.method === 'POST') {
      const input = await body(req);
      const session = { id: randomUUID(), userId: user.id, date: input.date || new Date().toISOString(), difficulty: input.difficulty, wpm: Number(input.wpm) || 0, accuracy: Number(input.accuracy) || 0 };
      const data = await readData();
      data.practiceSessions = [session, ...data.practiceSessions.filter(item => item.userId !== user.id)].slice(0, 300);
      await writeData(data);
      return send(res, 201, { session });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'Unexpected server error' });
  }
});

server.listen(PORT, () => console.log('Zen Dictation API listening on http://localhost:' + PORT));
