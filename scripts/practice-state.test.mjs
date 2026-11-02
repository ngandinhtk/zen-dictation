import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/practiceState.ts', import.meta.url), 'utf8');
const javascript = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { remainingSeconds, resolvePracticeSentence } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('countdown reaches zero at the deadline and stays at zero', () => {
  assert.equal(remainingSeconds(31_000, 1_000), 30);
  assert.equal(remainingSeconds(31_000, 30_999), 1);
  assert.equal(remainingSeconds(31_000, 31_000), 0);
  assert.equal(remainingSeconds(31_000, 45_000), 0);
});

test('countdown catches up after a delayed background-tab callback', () => {
  const deadline = 1_000 + 20 * 60_000;
  assert.equal(remainingSeconds(deadline, 1_000 + 5 * 60_000), 15 * 60);
  assert.equal(remainingSeconds(deadline, deadline + 60_000), 0);
});

test('lesson text takes precedence over the random sentence pool', () => {
  assert.equal(resolvePracticeSentence(['Unrelated.'], 0, { texts: ['First.', 'Second.'], index: 1 }), 'Second.');
});

test('missing lesson or pool entries never fall back to an unrelated sentence', () => {
  assert.equal(resolvePracticeSentence(['Unrelated.'], 0, { texts: [], index: 0 }), '');
  assert.equal(resolvePracticeSentence(['Unrelated.'], 4, null), '');
  assert.equal(resolvePracticeSentence([], 0, null), '');
  assert.equal(resolvePracticeSentence(['First.', 'Second.'], 1, null), 'Second.');
});

// Exercise the actual input handler as well as the clock calculation.
const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const handlerStart = appSource.indexOf('  const handleTypingChange =');
const handlerEnd = appSource.indexOf('\n\n  return (', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
const handlerCode = ts.transpile(appSource.slice(handlerStart, handlerEnd), { target: ts.ScriptTarget.ES2022 });
const makeHandler = (overrides = {}) => {
  const calls = [];
  const context = {
    isTimeUp: false, isFocusMode: false, focusDeadline: null,
    attemptStartedAtRef: { current: Date.now() - 1_000 }, timeLimit: 30,
    currentSentence: 'Example sentence.', remainingSeconds,
    ...Object.fromEntries(['setFocusTimeLeft', 'setTimeLeft', 'setIsTimeUp', 'setHasStartedTyping', 'setStartedAt', 'setLastAttempt', 'setCorrectChars', 'setTypingSpeed'].map(name => [name, value => calls.push([name, value])])),
    ...overrides,
  };
  const handle = new Function('context', `const { ${Object.keys(context).join(', ')} } = context; ${handlerCode}; return handleTypingChange;`)(context);
  return { handle, calls, context };
};

test('deleting the answer preserves the running clock', () => {
  const { handle, calls, context } = makeHandler();
  const originalStart = context.attemptStartedAtRef.current;
  assert.equal(handle(''), true);
  assert.equal(context.attemptStartedAtRef.current, originalStart);
  assert.ok(!calls.some(([name]) => ['setStartedAt', 'setHasStartedTyping', 'setTimeLeft'].includes(name)));
});

test('input after the sentence deadline is rejected before grading', () => {
  const { handle, calls } = makeHandler({ attemptStartedAtRef: { current: Date.now() - 31_000 } });
  assert.equal(handle('Example sentence.'), false);
  assert.ok(calls.some(([name, value]) => name === 'setIsTimeUp' && value === true));
  assert.ok(!calls.some(([name]) => name === 'setCorrectChars'));
});

test('input after the Focus deadline is rejected', () => {
  const { handle, calls } = makeHandler({ isFocusMode: true, focusDeadline: Date.now() - 1 });
  assert.equal(handle('Example sentence.'), false);
  assert.deepEqual(calls, [['setFocusTimeLeft', 0]]);
});
