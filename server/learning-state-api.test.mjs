import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeAccountLearningState } from './learningStateMerge.mjs';

const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
const routeStart = source.indexOf("    if (url.pathname === '/api/learning-state' && req.method === 'GET') {");
const routeEnd = source.indexOf("    return send(res, 404, { error: 'Not found' });", routeStart);
assert.notEqual(routeStart, -1, 'learning-state route should exist');
assert.notEqual(routeEnd, -1, 'learning-state route should end before the not-found response');
const route = source.slice(routeStart, routeEnd);
const executeRoute = new Function(
  'req',
  'res',
  'url',
  'send',
  'body',
  'query',
  'pool',
  'user',
  'mergeAccountLearningState',
  `return (async () => { ${route} })();`,
);
const send = (_res, status, payload) => ({ status, payload });
const user = { id: 'account-1' };

test('learning-state GET returns the account profile and synced learning data', async () => {
  const expectedState = {
    learner_level: 'intermediate',
    coach_state: { attempts: [], reviews: [] },
    practice_notes: [],
  };
  let selectedSql = '';
  const result = await executeRoute(
    { method: 'GET' },
    {},
    { pathname: '/api/learning-state' },
    send,
    async () => {},
    async sql => {
      selectedSql = sql;
      return { rows: [expectedState] };
    },
    {},
    user,
    mergeAccountLearningState,
  );

  assert.equal(result.status, 200);
  assert.equal(result.payload.state, expectedState);
  assert.match(selectedSql, /learner_level, coach_state, practice_notes/);
});

test('learning-state PUT locks, merges, and commits the expanded account state', async () => {
  const incoming = {
    reviewWords: [{ word: 'example', mistakes: 1 }],
    points: 12,
    dailyTarget: { date: '2026-11-16', target: 5, progress: 1 },
    goalWpm: 45,
    learnerLevel: 'advanced',
    coachState: { attempts: [], reviews: [] },
    practiceNotes: [{ sentence: 'Example.', note: 'Review it.', createdAt: '2026-11-16T10:00:00.000Z' }],
  };
  const statements = [];
  let receivedBodyLimit = 0;
  const row = {
    review_words: incoming.reviewWords,
    points: incoming.points,
    daily_target: incoming.dailyTarget,
    goal_wpm: incoming.goalWpm,
    learner_level: incoming.learnerLevel,
    coach_state: incoming.coachState,
    practice_notes: incoming.practiceNotes,
  };
  const client = {
    async query(sql, values) {
      statements.push({ sql, values });
      if (sql.includes('FOR UPDATE')) return { rows: [{ points: 2, review_words: [], coach_state: { attempts: [], reviews: [] }, practice_notes: [] }] };
      if (sql.includes('RETURNING review_words')) return { rows: [row] };
      return { rows: [] };
    },
    release() {
      statements.push({ sql: 'RELEASE' });
    },
  };
  const result = await executeRoute(
    { method: 'PUT' },
    {},
    { pathname: '/api/learning-state' },
    send,
    async (_req, limit) => {
      receivedBodyLimit = limit;
      return incoming;
    },
    async () => ({ rows: [] }),
    { connect: async () => client },
    user,
    mergeAccountLearningState,
  );

  assert.equal(result.status, 200);
  assert.equal(result.payload.state.learner_level, 'advanced');
  assert.equal(receivedBodyLimit, 6_000_000);
  assert.ok(statements.some(({ sql }) => sql === 'BEGIN'));
  assert.ok(statements.some(({ sql }) => sql.includes('FOR UPDATE')));
  assert.ok(statements.some(({ sql }) => sql === 'COMMIT'));
  assert.equal(statements[statements.length - 1].sql, 'RELEASE');
  const write = statements.find(({ sql }) => sql.includes('RETURNING review_words'));
  assert.deepEqual(JSON.parse(write.values[1]), incoming.reviewWords);
  assert.deepEqual(JSON.parse(write.values[6]), incoming.coachState);
  assert.deepEqual(JSON.parse(write.values[7]), incoming.practiceNotes);
});

test('learning-state PUT rolls back failed writes and releases the connection', async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes('FOR UPDATE')) return { rows: [{}] };
      if (sql.includes('RETURNING review_words')) throw new Error('write failed');
      return { rows: [] };
    },
    release() {
      statements.push('RELEASE');
    },
  };

  await assert.rejects(executeRoute(
    { method: 'PUT' },
    {},
    { pathname: '/api/learning-state' },
    send,
    async () => ({}),
    async () => ({ rows: [] }),
    { connect: async () => client },
    user,
    mergeAccountLearningState,
  ), /write failed/);

  assert.ok(statements.includes('ROLLBACK'));
  assert.equal(statements[statements.length - 1], 'RELEASE');
});
