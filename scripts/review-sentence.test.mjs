import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/reviewSentence.ts', import.meta.url), 'utf8');
const javascript = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { findReviewSentence } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('finds a due word in the correct practice pool', () => {
  const match = findReviewSentence('duo', [
    { focus: 'mixed', difficulty: 'easy', sentences: ['The duet starts tonight.'] },
    { focus: 'idioms', difficulty: 'medium', sentences: ['A musical duo arrived early.'] },
  ]);
  assert.deepEqual(match, { focus: 'idioms', difficulty: 'medium', index: 0 });
});

test('does not match a review word that appears only as part of another word', () => {
  const match = findReviewSentence('duo', [
    { focus: 'mixed', difficulty: 'easy', sentences: ['The duology was popular.'] },
  ]);
  assert.equal(match, null);
});
