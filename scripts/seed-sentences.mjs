import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
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

const difficulties = ['easy', 'medium', 'hard'];
const removeSentencePunctuation = text => text
  .replace(/([\p{L}\p{N}])['’]([\p{L}\p{N}])/gu, '$1$2')
  .replace(/\p{P}+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const toSentenceItem = (value, packId) => typeof value === 'string'
  ? { text: value, topic: packId, source: 'custom', license: null }
  : value;
const preparePack = pack => {
  const rows = [];
  const stats = {};
  for (const difficulty of difficulties) {
    const sentences = pack.source['en-US']?.[difficulty];
    if (!Array.isArray(sentences) || sentences.length === 0) throw new Error(`${pack.id} has no ${difficulty} sentences`);
    const seen = new Set();
    const uniqueSentences = [];
    const rawRows = [];
    let duplicateCount = 0;
    for (const [index, value] of sentences.entries()) {
      const item = toSentenceItem(value, pack.id);
      if (typeof item?.text !== 'string' || !item.text.trim()) throw new Error(`${pack.id}/${difficulty} contains an empty sentence at index ${index}`);
      const text = removeSentencePunctuation(item.text);
      if (!text) throw new Error(`${pack.id}/${difficulty} contains a sentence with no text after punctuation removal at index ${index}`);
      if (/\p{P}/u.test(text)) throw new Error(`${pack.id}/${difficulty} still contains punctuation at index ${index}`);
      const normalizedText = text.toLocaleLowerCase('en-US');
      const row = {
        id: `${pack.id}-${difficulty}-${index + 1}`,
        text,
        difficulty,
        topic: item.topic || pack.id,
        source: item.source || 'custom',
        license: item.license || null,
        sort_order: index,
        pack_id: pack.id,
        pack_name: pack.name,
        is_premium: pack.isPremium,
      };
      rawRows.push(row);
      if (seen.has(normalizedText)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(normalizedText);
      uniqueSentences.push({ row });
      rows.push({ ...row, sortOrder: index });
    }
    const rawPayload = JSON.stringify({ pack: pack.id, sentences: rawRows });
    const uniquePayload = JSON.stringify({ pack: pack.id, sentences: uniqueSentences.map(({ row }) => row) });
    stats[difficulty] = {
      rawCount: sentences.length,
      uniqueCount: uniqueSentences.length,
      duplicateCount,
      rawBytes: Buffer.byteLength(rawPayload),
      uniqueBytes: Buffer.byteLength(uniquePayload),
      gzipBytes: gzipSync(uniquePayload).byteLength,
    };
  }
  return { rows, stats };
};
const preparedPacks = packs.map(pack => ({ ...pack, ...preparePack(pack) }));

const curatedContentErrors = [];
for (const [difficulty, sentences] of Object.entries(sentenceBank.CURATED_LEVEL_SENTENCES)) {
  const [minimumWords, maximumWords] = difficulty === 'easy' ? [7, 12] : difficulty === 'medium' ? [10, 20] : [14, 30];
  if (sentences.length < 20) curatedContentErrors.push(`Curated ${difficulty} content must include at least 20 sentences`);
  const seen = new Set();
  for (const sentence of sentences) {
    const normalized = sentence.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
    if (seen.has(normalized)) curatedContentErrors.push(`Curated ${difficulty} content contains a duplicate: ${sentence}`);
    seen.add(normalized);
    const wordCount = sentence.trim().split(/\s+/).length;
    if (wordCount < minimumWords || wordCount > maximumWords) {
      curatedContentErrors.push(`Curated ${difficulty} sentence has ${wordCount} words; expected ${minimumWords}-${maximumWords}: ${sentence}`);
    }
  }
}
if (curatedContentErrors.length) throw new Error(curatedContentErrors.join('\n'));

for (const pack of preparedPacks) {
  const summary = difficulties.map(difficulty => {
    const { rawCount, uniqueCount, duplicateCount, rawBytes, uniqueBytes, gzipBytes } = pack.stats[difficulty];
    const sentences = pack.rows.filter(row => row.difficulty === difficulty);
    const wordCounts = sentences.map(row => row.text.trim().split(/\s+/).length).sort((a, b) => a - b);
    const medianWords = wordCounts[Math.floor(wordCounts.length / 2)];
    const openingCounts = new Map();
    let previousSubject = '';
    let currentSubjectRun = 0;
    let longestSubjectRun = 0;
    for (const row of sentences) {
      const words = row.text.toLowerCase().match(/\p{L}+/gu) || [];
      const opening = words.slice(0, 4).join(' ');
      if (opening) openingCounts.set(opening, (openingCounts.get(opening) || 0) + 1);
      const subjectOpening = words.slice(0, 2).join(' ');
      currentSubjectRun = subjectOpening === previousSubject ? currentSubjectRun + 1 : 1;
      previousSubject = subjectOpening;
      longestSubjectRun = Math.max(longestSubjectRun, currentSubjectRun);
    }
    const repeatedOpenings = [...openingCounts.entries()]
      .filter(([, count]) => count > 1)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([opening, count]) => `${opening} (${count})`)
      .join(', ') || 'none';
    return `${difficulty} ${uniqueCount}/${rawCount} unique, ${duplicateCount} duplicates, median ${medianWords} words, ${rawBytes} -> ${uniqueBytes} B JSON, ${gzipBytes} B gzip; repeated openings: ${repeatedOpenings}; longest repeated subject run: ${longestSubjectRun}`;
  });
  console.log(`${pack.id}: ${summary.join('; ')}`);
}

if (process.argv.includes('--check')) {
  console.log('Sentence bank checks passed.');
  process.exit(0);
}

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
  for (const pack of preparedPacks) {
    await client.query(`insert into public.sentence_packs (id, name, description, is_premium) values ($1, $2, $3, $4) on conflict (id) do update set name = excluded.name, description = excluded.description, is_premium = excluded.is_premium, is_active = true`, [pack.id, pack.name, pack.description, pack.isPremium]);
    for (const difficulty of difficulties) {
      const activeIds = pack.rows.filter(row => row.difficulty === difficulty).map(row => row.id);
      await client.query(
        'update public.sentences set is_active = false where pack_id = $1 and difficulty = $2 and id like $3 and not (id = any($4::text[]))',
        [pack.id, difficulty, `${pack.id}-${difficulty}-%`, activeIds],
      );
    }
    await client.query(`insert into public.sentences (id, pack_id, text, difficulty, topic, source, license, sort_order)
      select id, pack_id, text, difficulty, topic, source, license, sort_order from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::integer[])
        as rows(id, pack_id, text, difficulty, topic, source, license, sort_order)
      on conflict (id) do update set text = excluded.text, difficulty = excluded.difficulty, topic = excluded.topic, source = excluded.source, license = excluded.license, sort_order = excluded.sort_order, is_active = true`, [
      pack.rows.map(row => row.id), pack.rows.map(() => pack.id), pack.rows.map(row => row.text), pack.rows.map(row => row.difficulty), pack.rows.map(row => row.topic), pack.rows.map(row => row.source), pack.rows.map(row => row.license), pack.rows.map(row => row.sortOrder),
    ]);
  }
  await client.query('commit');
  console.log(`Seeded ${preparedPacks.length} sentence packs into Supabase.`);
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}
