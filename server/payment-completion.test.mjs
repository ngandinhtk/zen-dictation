import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
const start = source.indexOf('const completePayment = async');
const end = source.indexOf('\nconst createLicenseKey', start);
const paymentFunction = source.slice(start, end);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const runConcurrentCompletions = async () => {
  let order = { app_trans_id: 'order-1', status: 'pending', email: 'learner@example.com' };
  let queue = Promise.resolve();
  let keyCount = 0;
  const licenses = [];
  const emails = [];

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
          else if (sql.startsWith('SELECT * FROM payment_orders')) return { rows: order ? [{ ...order }] : [] };
          else if (sql.startsWith('INSERT INTO licenses')) licenses.push(values);
          else if (sql.startsWith('UPDATE payment_orders')) {
            order = { ...order, status: values[0], delivery_key: values[2] };
          } else if (sql === 'COMMIT' || sql === 'ROLLBACK') unlock?.();
          return { rows: [] };
        },
        release: () => {},
      };
    },
  };

  const createLicenseKey = () => `license-${++keyCount}`;
  const sendLicenseEmail = async (email, key) => { emails.push({ email, key }); };
  const createCompletePayment = new AsyncFunction(
    'pool', 'randomUUID', 'hashLicense', 'encryptLicenseKey', 'createLicenseKey', 'sendLicenseEmail', 'console',
    `${paymentFunction}\nreturn completePayment;`,
  );
  const completePayment = await createCompletePayment(
    pool, () => `license-id-${keyCount}`, key => `hash:${key}`, key => `encrypted:${key}`,
    createLicenseKey, sendLicenseEmail, { error: () => {} },
  );

  const results = await Promise.all([
    completePayment('order-1', 'capture-1'),
    completePayment('order-1', 'capture-1'),
  ]);
  return { results, licenses, emails, order };
};

test('concurrent webhook and capture completion create and email one license', async () => {
  const result = await runConcurrentCompletions();

  assert.deepEqual(result.results, [true, true]);
  assert.equal(result.licenses.length, 1);
  assert.equal(result.emails.length, 1);
  assert.equal(result.order.status, 'paid');
  assert.equal(result.order.delivery_key, 'encrypted:license-1');
});
