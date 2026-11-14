import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/pointsService.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { mergeDailyTarget } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const target = (date, overrides = {}) => ({
  date,
  target: 5,
  progress: 0,
  rewardPoints: 50,
  completed: false,
  rewardClaimed: false,
  ...overrides,
});

test('preserves local progress when cloud daily target belongs to another day', () => {
  const localTarget = target('2026-11-14', { progress: 3 });
  const remoteTarget = target('2026-11-13', { progress: 5, completed: true, rewardClaimed: true });

  assert.deepEqual(mergeDailyTarget(localTarget, remoteTarget), localTarget);
});

test('merges progress and reward state for the same daily target', () => {
  const localTarget = target('2026-11-14', { progress: 2 });
  const remoteTarget = target('2026-11-14', { progress: 4, completed: true, rewardClaimed: true });

  assert.deepEqual(mergeDailyTarget(localTarget, remoteTarget), {
    ...localTarget,
    progress: 4,
    completed: true,
    rewardClaimed: true,
  });
});
