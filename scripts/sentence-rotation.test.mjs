import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/sentenceRotation.ts', import.meta.url), 'utf8');
const javascript = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { MAX_RECENT_SENTENCES, chooseRandomSentenceIndex, rememberRecentSentence } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('random selection avoids recently used sentences when alternatives exist', () => {
  const sentences = ['First sentence.', 'Second sentence.', 'Third sentence.', 'Fourth sentence.'];
  const index = chooseRandomSentenceIndex(sentences, ['first sentence.', 'third sentence.'], undefined, () => 0);
  assert.equal(sentences[index], 'Second sentence.');
});

test('rotation falls back to another sentence when all alternatives are recent', () => {
  const sentences = ['First sentence.', 'Second sentence.'];
  const index = chooseRandomSentenceIndex(sentences, ['first sentence.', 'second sentence.'], 0, () => 0);
  assert.equal(index, 1);
});

test('sentence history de-duplicates and stays bounded', () => {
  const history = Array.from({ length: MAX_RECENT_SENTENCES }, (_, index) => `sentence ${index}`);
  const next = rememberRecentSentence(history, ' Sentence 10 ');
  assert.equal(next.length, MAX_RECENT_SENTENCES);
  assert.equal(next.at(-1), 'sentence 10');
  assert.equal(next.filter(sentence => sentence === 'sentence 10').length, 1);
});
