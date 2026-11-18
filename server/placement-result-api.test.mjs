import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
const routeStart = source.indexOf("    if (url.pathname === '/api/placement-results' && req.method === 'POST') {");
const routeEnd = source.indexOf("    if (url.pathname === '/api/learning-state' && req.method === 'GET')", routeStart);
assert.notEqual(routeStart, -1, 'placement-results route should exist');
assert.notEqual(routeEnd, -1, 'placement-results route should end before learning-state');
const route = source.slice(routeStart, routeEnd);
const executeRoute = new Function(
  'req',
  'res',
  'url',
  'send',
  'body',
  'query',
  'user',
  'randomUUID',
  `return (async () => { ${route} })();`,
);
const send = (_res, status, payload) => ({ status, payload });

test('placement result is calculated and stored for the authenticated account', async () => {
  const questionScores = [100, 0, 50, 100, null, 20, 30, 40, 50, 60, 80, 70, 60, 50, 40];
  const calls = [];
  const result = await executeRoute(
    { method: 'POST' },
    {},
    { pathname: '/api/placement-results' },
    send,
    async () => ({ questionScores, userId: 'forged-user-id' }),
    async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [{ id: 'result-1', total_score: 50, listening_score: 50, speaking_score: 40, writing_score: 60, answered_count: 14, question_count: 15 }] };
    },
    { id: 'authenticated-user-id', email: 'learner@example.com' },
    () => 'result-1',
  );

  assert.equal(result.status, 201);
  assert.equal(result.payload.user.email, 'learner@example.com');
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO placement_results/);
  assert.equal(calls[0].values[1], 'authenticated-user-id');
  assert.deepEqual(calls[0].values.slice(2), ['result-1', 'authenticated-user-id', 50, 50, 40, 60, 14].slice(2));
});

test('placement result rejects an incomplete or invalid score list', async () => {
  for (const input of [
    null,
    { questionScores: Array(14).fill(100) },
    { questionScores: [...Array(14).fill(100), 101] },
    { questionScores: [...Array(14).fill(100), -1] },
  ]) {
    let queries = 0;
    const result = await executeRoute(
      { method: 'POST' },
      {},
      { pathname: '/api/placement-results' },
      send,
      async () => input,
      async () => { queries += 1; return { rows: [] }; },
      { id: 'authenticated-user-id', email: 'learner@example.com' },
      () => 'result-1',
    );

    assert.equal(result.status, 400);
    assert.equal(queries, 0);
  }
});
