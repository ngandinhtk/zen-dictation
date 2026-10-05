import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Exercise the actual route without contacting the configured production database.
const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
const forgotRoute = source.slice(source.indexOf("    if (url.pathname === '/api/auth/forgot-password'"), source.indexOf("    if (url.pathname === '/api/auth/reset-password'"));
const route = source.slice(source.indexOf("    if (url.pathname === '/api/auth/reset-password'"), source.indexOf("    if (url.pathname === '/api/auth/login'"));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const emailHelpers = source.slice(source.indexOf('const getEmailSender'), source.indexOf('const paypalToken'));
const createSendEmail = new AsyncFunction('fetch', 'process', `${emailHelpers}\nreturn sendEmail;`);
const handleForgot = new AsyncFunction('req', 'res', 'url', 'body', 'send', 'query', 'hashSessionToken', 'randomBytes', 'sendEmail', 'process', forgotRoute);
const handle = new AsyncFunction('req', 'res', 'url', 'body', 'send', 'hashPassword', 'pool', 'hashSessionToken', 'clearedAuthCookie', route);
const token = 'a'.repeat(64);
const hashToken = value => createHash('sha256').update(value).digest('hex');
let tokenCounter = 0;

const runForgot = async ({ account = true, emailOk = true, configured = true } = {}) => {
  const statements = [];
  const emails = [];
  const logs = [];
  let response;
  const originalError = console.error;
  console.error = (...values) => logs.push(values);
  try {
    const processMock = { env: configured ? { BREVO_API_KEY: 'test-key', EMAIL_FROM: 'Zen Dictation <reset@example.com>', PUBLIC_APP_URL: 'https://app.example.com' } : {} };
    const sendEmail = await createSendEmail(async (url, options) => {
      emails.push({ url, options });
      return { ok: emailOk, text: async () => 'provider error detail' };
    }, processMock);
    await handleForgot(
      { method: 'POST' },
      {},
      { pathname: '/api/auth/forgot-password' },
      async () => ({ email: ' User@Example.com ' }),
      (_res, status, payload) => { response = { status, payload }; },
      async (sql, values) => {
        statements.push({ sql, values });
        return sql.startsWith('SELECT id FROM users')
          ? { rows: account ? [{ id: 'user-1' }] : [] }
          : { rows: [] };
      },
      hashToken,
      size => Buffer.alloc(size, ++tokenCounter),
      sendEmail,
      processMock,
    );
  } finally {
    console.error = originalError;
  }
  return { statements, emails, logs, response };
};

test('password reset can be requested again and sends a fresh token each time', async () => {
  const first = await runForgot();
  const second = await runForgot();
  assert.equal(first.response.status, 200);
  assert.deepEqual(first.response, second.response);
  assert.equal(first.emails.length, 1);
  assert.equal(second.emails.length, 1);
  assert.equal(first.emails[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(first.emails[0].options.headers['api-key'], 'test-key');
  const emailPayload = JSON.parse(first.emails[0].options.body);
  assert.deepEqual(emailPayload.sender, { name: 'Zen Dictation', email: 'reset@example.com' });
  assert.deepEqual(emailPayload.to, [{ email: 'user@example.com' }]);
  assert.equal(emailPayload.subject, 'Reset your Zen Dictation password');
  assert.notEqual(first.statements.find(({ sql }) => sql.startsWith('INSERT INTO password_reset_tokens')).values[0],
    second.statements.find(({ sql }) => sql.startsWith('INSERT INTO password_reset_tokens')).values[0]);
  assert.match(emailPayload.textContent, /https:\/\/app\.example\.com\/#reset-password=/);
});

test('password reset request does not disclose whether the account exists', async () => {
  const existingAccount = await runForgot({ account: true });
  const unknownAccount = await runForgot({ account: false });
  assert.deepEqual(existingAccount.response, unknownAccount.response);
  assert.equal(existingAccount.emails.length, 1);
  assert.equal(unknownAccount.emails.length, 0);
});

test('failed reset email delivery removes its token and logs the provider failure', async () => {
  const result = await runForgot({ emailOk: false });
  assert.equal(result.response.status, 200);
  assert.ok(result.statements.some(({ sql }) => sql.startsWith('DELETE FROM password_reset_tokens')));
  assert.equal(result.logs.length, 1);
  assert.match(String(result.logs[0][1]), /Brevo email failed/);
});

test('password reset request reports missing email configuration', async () => {
  const result = await runForgot({ configured: false });
  assert.equal(result.response.status, 503);
  assert.equal(result.emails.length, 0);
  assert.equal(result.statements.length, 0);
});

const run = async (input, { expired = false, used = false, failUpdate = false } = {}) => {
  const statements = [];
  let released = false;
  let response;
  const client = {
    query: async (sql, values) => {
      statements.push({ sql, values });
      if (sql.startsWith('SELECT u.id')) return { rows: used ? [] : [{ id: 'user-1' }] };
      if (sql.includes('RETURNING user_id')) return { rows: expired || used ? [] : [{ user_id: 'user-1' }] };
      if (failUpdate && sql.startsWith('UPDATE users')) throw new Error('Database unavailable');
      return { rows: [] };
    },
    release: () => { released = true; },
  };
  let failure;
  try {
    await handle({ method: 'POST' }, {}, { pathname: '/api/auth/reset-password' }, async () => input,
      (_res, status, payload, headers) => { response = { status, payload, headers }; },
      async password => `hashed:${password}`, { connect: async () => client }, hashToken, 'clear-cookie');
  } catch (error) { failure = error; }
  return { statements, released, response, failure };
};

test('successful reset hashes token, changes password, revokes sessions and links atomically', async () => {
  const result = await run({ token, password: 'new-password' });
  assert.equal(result.response.status, 200);
  assert.equal(result.response.headers['Set-Cookie'], 'clear-cookie');
  assert.equal(result.statements[0].sql, 'BEGIN');
  assert.equal(result.statements.at(-1).sql, 'COMMIT');
  assert.equal(result.statements[1].values[0], hashToken(token));
  assert.match(result.statements[1].sql, /FOR UPDATE OF u/);
  assert.ok(result.statements.some(({ sql, values }) => sql.startsWith('UPDATE users') && values[0] === 'hashed:new-password'));
  assert.ok(result.statements.some(({ sql }) => sql === 'DELETE FROM auth_sessions WHERE user_id = $1'));
  assert.ok(result.statements.some(({ sql }) => sql === 'DELETE FROM password_reset_tokens WHERE user_id = $1'));
  assert.equal(result.released, true);
});

for (const [name, options] of [['expired', { expired: true }], ['already used', { used: true }]]) {
  test(`${name} link cannot change password or sessions`, async () => {
    const result = await run({ token, password: 'new-password' }, options);
    assert.equal(result.response.status, 400);
    assert.equal(result.statements.at(-1).sql, 'ROLLBACK');
    assert.ok(!result.statements.some(({ sql }) => sql.startsWith('UPDATE users') || sql.startsWith('DELETE FROM auth_sessions')));
    assert.equal(result.released, true);
  });
}

test('invalid tokens and passwords fail before connecting to the database', async () => {
  for (const input of [{ token: 'bad', password: 'new-password' }, { token, password: 'short' }, { token, password: 'a'.repeat(1025) }, { token, password: {} }]) {
    const result = await run(input);
    assert.equal(result.response.status, 400);
    assert.equal(result.statements.length, 0);
  }
});

test('database failure rolls back token consumption and releases the connection', async () => {
  const result = await run({ token, password: 'new-password' }, { failUpdate: true });
  assert.match(result.failure.message, /Database unavailable/);
  assert.equal(result.statements.at(-1).sql, 'ROLLBACK');
  assert.ok(!result.statements.some(({ sql }) => sql === 'COMMIT'));
  assert.equal(result.released, true);
});
