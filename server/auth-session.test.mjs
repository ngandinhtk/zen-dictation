import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('const getAuthUser ='), source.indexOf('const validateCredentials ='));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const makeHelper = new AsyncFunction('query', 'parseCookies', 'hashSessionToken', `${helper}\nreturn getAuthUser;`);

test('session authentication uses one query and preserves cookie and bearer authentication', async () => {
  const user = { id: 'test-user', is_premium: true };
  for (const headers of [{ cookie: 'zen_auth=secret' }, { authorization: 'Bearer secret' }]) {
    const calls = [];
    const authenticate = await makeHelper(async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [user] };
    }, header => ({ zen_auth: header?.split('=')[1] }), token => createHash('sha256').update(token).digest('hex'));
    assert.equal(await authenticate({ headers }), user);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /JOIN users u ON u.id = s.user_id/);
    assert.match(calls[0].sql, /s.token_hash = \$1 AND s.expires_at > \$2/);
    assert.equal(calls[0].values[0], createHash('sha256').update('secret').digest('hex'));
    assert.ok(Number.isFinite(Date.parse(calls[0].values[1])));
  }
});

test('missing token skips the database; missing or expired session returns null', async () => {
  let calls = 0;
  const authenticate = await makeHelper(async () => { calls += 1; return { rows: [] }; }, () => ({}), token => token);
  assert.equal(await authenticate({ headers: {} }), null);
  assert.equal(calls, 0);
  assert.equal(await authenticate({ headers: { authorization: 'Bearer invalid' } }), null);
  assert.equal(calls, 1);
});
