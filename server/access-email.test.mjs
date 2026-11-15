import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
const route = source.slice(source.indexOf("    if (url.pathname === '/api/access-email'"), source.indexOf("    if (url.pathname === '/api/sentences'"));
const emailHelper = source.slice(source.indexOf('const sendWelcomeLicenseEmail'), source.indexOf('const rawBody'));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const makeState = () => ({ submission: null, licenses: [], emails: [], keyCount: 0, deliveryToken: null });

const createRouteHarness = (state, { mailFailures = 0 } = {}) => {
  let queue = Promise.resolve();
  const acquireLock = async () => {
    const previous = queue;
    let unlock;
    queue = new Promise(resolve => { unlock = resolve; });
    await previous;
    return unlock;
  };
  const pool = {
    connect: async () => {
      let unlock;
      return {
        query: async (sql, values = []) => {
          if (sql === 'BEGIN') unlock = await acquireLock();
          else if (sql.startsWith('INSERT INTO access_email_submissions')) {
            const [, email, promoConsent] = values;
            if (!state.submission) {
              state.submission = {
                email,
                promoConsent,
                promoLicenseKey: null,
                promoEmailSentAt: null,
              };
            } else if (promoConsent) {
              state.submission.promoConsent = true;
            }
          } else if (sql.startsWith('SELECT promo_license_key')) {
            return { rows: state.submission ? [{
              promo_license_key: state.submission.promoLicenseKey,
              promo_email_sent_at: state.submission.promoEmailSentAt,
            }] : [] };
          } else if (sql.startsWith('INSERT INTO licenses')) {
            state.licenses.push(values);
          } else if (sql.startsWith('UPDATE access_email_submissions SET promo_license_key')) {
            state.submission.promoLicenseKey = values[0];
          } else if (sql.startsWith('UPDATE access_email_submissions SET promo_email_sent_at')) {
            state.submission.promoEmailSentAt = 'sent';
          } else if (sql === 'COMMIT' || sql === 'ROLLBACK') {
            unlock?.();
          }
          return { rows: [] };
        },
        release: () => {},
      };
    },
  };
  let mailFailuresRemaining = mailFailures;
  const query = async (sql, values = []) => {
    if (sql.startsWith('UPDATE access_email_submissions') && sql.includes('SET promo_email_delivery_token = $2')) {
      if (!state.submission.promoEmailSentAt && !state.deliveryToken) {
        state.deliveryToken = values[1];
        return { rows: [{ promo_license_key: state.submission.promoLicenseKey }] };
      }
      return { rows: [] };
    }
    if (sql.startsWith('UPDATE access_email_submissions') && sql.includes('SET promo_email_sent_at')) {
      if (state.deliveryToken === values[1]) {
        state.submission.promoEmailSentAt = 'sent';
        state.deliveryToken = null;
      }
    } else if (sql.startsWith('UPDATE access_email_submissions') && sql.includes('SET promo_email_delivery_token = NULL')) {
      if (state.deliveryToken === values[1]) state.deliveryToken = null;
    }
    return { rows: [] };
  };
  const handle = new AsyncFunction(
    'req', 'res', 'url', 'send', 'body', 'pool', 'query', 'randomUUID', 'hashLicense',
    'createLicenseKey', 'encryptLicenseKey', 'decryptLicenseKey',
    'sendWelcomeLicenseEmail', 'console', `${route}\nreturn;`,
  );
  return async input => {
    let response;
    const logs = [];
    await handle(
      { method: 'POST' },
      {},
      new URL('http://localhost/api/access-email'),
      (_res, status, payload) => { response = { status, payload }; },
      async () => input,
      pool,
      query,
      () => 'submission-id',
      key => `hash:${key}`,
      () => `ZEN-${++state.keyCount}`,
      key => `encrypted:${key}`,
      key => key.replace(/^encrypted:/, ''),
      async (email, key, language) => {
        state.emails.push({ email, key, language });
        if (mailFailuresRemaining > 0) {
          mailFailuresRemaining -= 1;
          throw new Error('Brevo unavailable');
        }
      },
      { error: (...values) => logs.push(values) },
    );
    return { response, logs };
  };
};

test('access email is normalized and stored without marketing consent by default', async () => {
  const state = makeState();
  const run = createRouteHarness(state);
  const { response } = await run({ email: '  Learner@Example.com ' });

  assert.deepEqual(response, { status: 201, payload: { accepted: true, welcomeEmailSent: false } });
  assert.equal(state.submission.email, 'learner@example.com');
  assert.equal(state.submission.promoConsent, false);
  assert.equal(state.licenses.length, 0);
  assert.equal(state.emails.length, 0);
});

test('previous access submissions are not sent a Premium email without new consent', async () => {
  const state = makeState();
  state.submission = {
    email: 'previous@example.com',
    promoConsent: false,
    promoLicenseKey: null,
    promoEmailSentAt: null,
  };
  const run = createRouteHarness(state);
  const { response } = await run({ email: 'previous@example.com' });

  assert.equal(response.status, 201);
  assert.equal(state.submission.promoConsent, false);
  assert.equal(state.licenses.length, 0);
  assert.equal(state.emails.length, 0);
});

test('invalid access emails are rejected without database or email activity', async () => {
  const state = makeState();
  const run = createRouteHarness(state);
  const { response } = await run({ email: 'not-an-email', promoConsent: true });

  assert.equal(response.status, 400);
  assert.equal(state.submission, null);
  assert.equal(state.emails.length, 0);
});

test('welcome code delivery is opt-in, retryable, and idempotent', async () => {
  const state = makeState();
  const run = createRouteHarness(state, { mailFailures: 1 });
  const input = { email: 'Learner@Example.com', promoConsent: true, language: 'vi' };

  const first = await run(input);
  assert.deepEqual(first.response, { status: 503, payload: { error: 'WELCOME_EMAIL_FAILED' } });
  assert.equal(state.submission.promoConsent, true);
  assert.equal(state.submission.promoEmailSentAt, null);
  assert.equal(state.licenses.length, 1);
  assert.equal(first.logs.length, 1);

  const second = await run(input);
  assert.deepEqual(second.response, { status: 201, payload: { accepted: true, welcomeEmailSent: true } });
  assert.equal(state.emails.length, 2);
  assert.equal(state.emails[0].key, state.emails[1].key);
  assert.equal(state.emails[1].language, 'vi');
  assert.equal(state.licenses.length, 1);
  assert.equal(state.submission.promoEmailSentAt, 'sent');

  const third = await run(input);
  assert.equal(third.response.status, 201);
  assert.equal(state.emails.length, 2);
  assert.equal(state.licenses.length, 1);
});

test('concurrent opted-in submissions send only one welcome email', async () => {
  const state = makeState();
  const run = createRouteHarness(state);

  const results = await Promise.all([
    run({ email: 'learner@example.com', promoConsent: true }),
    run({ email: 'learner@example.com', promoConsent: true }),
  ]);

  assert.ok(results.every(({ response }) => response.status === 201));
  assert.equal(state.licenses.length, 1);
  assert.equal(state.emails.length, 1);
});

test('welcome email is localized and identifies the code as non-expiring', async () => {
  const emailPayloads = [];
  const helper = new AsyncFunction('sendEmail', 'process', `${emailHelper}\nreturn sendWelcomeLicenseEmail;`);
  const sendWelcomeLicenseEmail = await helper(
    async (...args) => emailPayloads.push(args),
    { env: { BREVO_API_KEY: 'test-key', EMAIL_FROM: 'welcome@example.com' } },
  );

  await sendWelcomeLicenseEmail('learner@example.com', 'ZEN-ABC123', 'vi');
  await sendWelcomeLicenseEmail('learner@example.com', 'ZEN-ABC123', 'en');

  assert.equal(emailPayloads[0][1], 'Chào mừng bạn đến với Zentation — mã Premium miễn phí');
  assert.match(emailPayloads[0][2], /không hết hạn/);
  assert.match(emailPayloads[0][2], /ZEN-ABC123/);
  assert.equal(emailPayloads[1][1], 'Welcome to Zentation — your free Premium code');
  assert.match(emailPayloads[1][2], /non-expiring/);
  assert.match(emailPayloads[1][2], /ZEN-ABC123/);
});

test('malformed access-email JSON receives a client error', async () => {
  const responses = [];
  const handle = new AsyncFunction(
    'req', 'res', 'url', 'send', 'body', 'pool',
    `${route}\nreturn;`,
  );
  await handle(
    { method: 'POST' },
    {},
    new URL('http://localhost/api/access-email'),
    (_res, status, payload) => responses.push({ status, payload }),
    async () => { throw new SyntaxError('invalid JSON'); },
    { connect: async () => assert.fail('invalid JSON must not write to the database') },
  );

  assert.deepEqual(responses[0], { status: 400, payload: { error: 'Invalid request body' } });
});
