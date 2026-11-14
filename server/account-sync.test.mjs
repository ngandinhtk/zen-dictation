import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/accountService.ts', import.meta.url), 'utf8');
const withoutApiImport = source.replace("import { apiUrl } from './api';", 'const apiUrl = path => path;');
const { outputText } = ts.transpileModule(withoutApiImport, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { syncAccountSessions } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('does not upload local sessions after account hydration is cancelled', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let resolveResponse;
  let isCurrent = true;
  globalThis.fetch = (url, options) => {
    requests.push({ url, options });
    return new Promise(resolve => { resolveResponse = resolve; });
  };

  try {
    const sync = syncAccountSessions([{
      date: '2026-11-14T05:00:00.000Z',
      difficulty: 'easy',
      wpm: 30,
      accuracy: 90,
    }], () => isCurrent);
    await new Promise(resolve => setImmediate(resolve));
    isCurrent = false;
    resolveResponse({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ sessions: [] }),
    });

    await sync;
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/sessions');
    assert.equal(requests[0].options.method, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
