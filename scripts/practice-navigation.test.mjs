import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/practiceState.ts', import.meta.url), 'utf8');
const javascript = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { isNextButtonDisabled } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('disables the Next button once the timed attempt reaches its deadline', () => {
  assert.equal(isNextButtonDisabled(false, false, 10_000, 9_999), false);
  assert.equal(isNextButtonDisabled(false, false, 10_000, 10_000), true);
});

test('disables the Next button after timeout or completed focus session', () => {
  assert.equal(isNextButtonDisabled(true, false, null), true);
  assert.equal(isNextButtonDisabled(false, true, null), true);
});
