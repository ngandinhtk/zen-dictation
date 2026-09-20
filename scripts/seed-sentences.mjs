import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const loadTypeScriptModule = (filePath) => {
  const source = readFileSync(filePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (!request.startsWith('.')) return require(request);
    const base = resolve(dirname(filePath), request);
    const candidate = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`].find(path => {
      try { readFileSync(path); return true; } catch { return false; }
    });
    if (!candidate) throw new Error(`Cannot resolve ${request} from ${filePath}`);
    return extname(candidate) === '.ts' || extname(candidate) === '.tsx' ? loadTypeScriptModule(candidate) : require(candidate);
  };
  // The transpiled source is trusted project data, not user input.
  new Function('require', 'exports', 'module', output)(localRequire, module.exports, module);
  return module.exports;
};

const sentenceBank = loadTypeScriptModule(resolve(root, 'src/data/sentenceBank.ts'));
const premiumPacks = loadTypeScriptModule(resolve(root, 'src/data/sentencePacks.ts'));
const packs = [
  { id: 'core', name: 'Core practice', description: 'General listening and dictation practice.', isPremium: false, source: sentenceBank.SENTENCE_BANK },
  { id: 'vocabulary', name: 'Vocabulary practice', description: 'Vocabulary-focused dictation practice.', isPremium: false, source: sentenceBank.VOCABULARY_SENTENCE_BANK },
  ...Object.entries(premiumPacks.PREMIUM_SENTENCE_PACKS).map(([id, source]) => ({ id, name: id === 'ielts' ? 'IELTS practice' : 'Business English', description: `Premium ${id} sentence pack.`, isPremium: true, source: { 'en-US': source } })),
];

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!databaseUrl) throw new Error('DATABASE_URL or SUPABASE_DB_URL must be configured');
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

await pool.query(`create table if not exists public.sentence_packs (id text primary key, name text not null, description text not null default '', is_premium boolean not null default false, is_active boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.sentences (id text primary key, pack_id text not null references public.sentence_packs(id) on delete cascade, text text not null, difficulty text not null check (difficulty in ('easy', 'medium', 'hard')), topic text not null default 'general', source text not null default 'custom', license text, sort_order integer not null default 0, is_active boolean not null default true, created_at timestamptz not null default now());
create index if not exists sentences_pack_difficulty_idx on public.sentences (pack_id, difficulty, sort_order);
alter table public.sentence_packs enable row level security;
alter table public.sentences enable row level security;`);

const client = await pool.connect();
try {
  await client.query('begin');
  for (const pack of packs) {
    await client.query(`insert into public.sentence_packs (id, name, description, is_premium) values ($1, $2, $3, $4) on conflict (id) do update set name = excluded.name, description = excluded.description, is_premium = excluded.is_premium, is_active = true`, [pack.id, pack.name, pack.description, pack.isPremium]);
    const sentences = pack.source['en-US'];
    const rows = [];
    for (const difficulty of ['easy', 'medium', 'hard']) {
      for (const [index, text] of sentences[difficulty].entries()) {
        const item = typeof text === 'string' ? { text, topic: pack.id, source: 'custom', license: null } : text;
        rows.push({ id: `${pack.id}-${difficulty}-${index + 1}`, text: item.text, difficulty, topic: item.topic || pack.id, source: item.source || 'custom', license: item.license || null, sortOrder: index });
      }
    }
    await client.query(`insert into public.sentences (id, pack_id, text, difficulty, topic, source, license, sort_order)
      select id, pack_id, text, difficulty, topic, source, license, sort_order from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::integer[])
        as rows(id, pack_id, text, difficulty, topic, source, license, sort_order)
      on conflict (id) do update set text = excluded.text, difficulty = excluded.difficulty, topic = excluded.topic, source = excluded.source, license = excluded.license, sort_order = excluded.sort_order, is_active = true`, [
      rows.map(row => row.id), rows.map(() => pack.id), rows.map(row => row.text), rows.map(row => row.difficulty), rows.map(row => row.topic), rows.map(row => row.source), rows.map(row => row.license), rows.map(row => row.sortOrder),
    ]);
  }
  await client.query('commit');
  console.log(`Seeded ${packs.length} sentence packs into Supabase.`);
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}
