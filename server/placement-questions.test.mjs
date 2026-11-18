import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/PlacementTest/placementQuestions.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const executableSource = outputText.replace(/^import .* from .*;$/m, '');
const { questions, skills } = await import(`data:text/javascript;base64,${Buffer.from(executableSource).toString('base64')}`);

test('placement test has 15 questions with five per skill', () => {
  assert.equal(questions.length, 15);
  for (const skill of skills) {
    assert.equal(questions.filter(question => question.skill === skill).length, 5);
  }
});
