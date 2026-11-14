import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/telegramService.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { getTelegramContactUrl, getTelegramMessageUrl } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('uses the configured Telegram contact or the documented default', () => {
  assert.equal(getTelegramContactUrl(undefined), 'https://t.me/giniddinh');
  assert.equal(getTelegramContactUrl('  https://t.me/example_user  '), 'https://t.me/example_user');
});

test('rejects non-Telegram destinations', () => {
  assert.equal(getTelegramContactUrl('https://example.com/contact'), undefined);
  assert.equal(getTelegramContactUrl('javascript:alert(1)'), undefined);
});

test('encodes confirmation text while preserving Telegram URL parameters', () => {
  const url = new URL(getTelegramMessageUrl('https://t.me/example_user?start=donation', 'I sent $5 & need help'));
  assert.equal(url.searchParams.get('start'), 'donation');
  assert.equal(url.searchParams.get('text'), 'I sent $5 & need help');
});
