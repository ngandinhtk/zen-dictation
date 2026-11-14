import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/services/practiceNotesService.ts', import.meta.url), 'utf8');
const javascript = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const { getPracticeNotesForSentence, savePracticeNoteForSentence } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('practice notes can be saved without a missed-word attempt and persist by sentence', () => {
  const saved = savePracticeNoteForSentence('  A clear sentence.  ', '  Review this phrase later. ');

  assert.equal(saved.length, 1);
  assert.equal(saved[0].sentence, 'A clear sentence.');
  assert.equal(saved[0].note, 'Review this phrase later.');
  assert.deepEqual(getPracticeNotesForSentence('A clear sentence.'), saved);
});

test('blank notes are not stored', () => {
  assert.deepEqual(savePracticeNoteForSentence('Another sentence.', '  '), []);
});
