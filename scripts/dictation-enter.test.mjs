import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/DictationArea/DictationArea.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const handleKeyDown =');
const end = source.indexOf('\n\n  return (', start);
assert.ok(start >= 0 && end > start);
const handlerCode = ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2022 });

test('Enter advances even when the answer is not submitted or input is read-only', () => {
  const calls = [];
  let prevented = false;
  const handleKeyDown = new Function('disabled', 'hasSubmitted', 'onNext', `${handlerCode}; return handleKeyDown;`)(
    false,
    false,
    () => calls.push('next'),
  );
  handleKeyDown({
    key: 'Enter',
    nativeEvent: { isComposing: false },
    repeat: false,
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.deepEqual(calls, ['next']);
});

test('Enter does not advance when the practice area is disabled', () => {
  const calls = [];
  const handleKeyDown = new Function('disabled', 'hasSubmitted', 'onNext', `${handlerCode}; return handleKeyDown;`)(
    true,
    false,
    () => calls.push('next'),
  );
  handleKeyDown({ key: 'Enter', nativeEvent: { isComposing: false }, repeat: false, preventDefault() {} });
  assert.deepEqual(calls, []);
});
