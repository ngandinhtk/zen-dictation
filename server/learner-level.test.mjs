import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/learnerLevelService.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const service = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const withStorage = (storage, callback) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    return callback();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
};

test('learner level preference persists and falls back to the resumed practice difficulty', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  withStorage(storage, () => {
    assert.equal(service.getLearnerLevel('medium'), 'intermediate');
    assert.equal(service.saveLearnerLevel('advanced'), true);
    assert.equal(service.getLearnerLevel('easy'), 'advanced');
    assert.equal(service.LEARNER_LEVEL_DIFFICULTY[service.getLearnerLevel()], 'hard');
  });
});

test('invalid saved profile values use the difficulty fallback', () => {
  const storage = {
    getItem: () => 'expert',
    setItem: () => {},
  };

  withStorage(storage, () => {
    assert.equal(service.getLearnerLevel('medium'), 'intermediate');
  });
});
