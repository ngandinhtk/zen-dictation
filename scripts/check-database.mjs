import { performance } from 'node:perf_hooks';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error('Set DATABASE_URL or SUPABASE_DB_URL in .env');

// Match backend SSL behavior. Never print the connection string or server error message.
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  query_timeout: 12_000,
});
pool.on('error', error => {
  console.error(`Idle database connection failed (${error.code || 'unknown'}).`);
  process.exitCode = 1;
});

try {
  const started = performance.now();
  const client = await pool.connect();
  const connectMs = performance.now() - started;
  const samples = [];
  try {
    for (let index = 0; index < 5; index += 1) {
      const queryStarted = performance.now();
      await client.query('SELECT 1');
      samples.push(performance.now() - queryStarted);
    }
  } finally {
    client.release();
  }
  const reacquireStarted = performance.now();
  const reused = await pool.connect();
  const reacquireMs = performance.now() - reacquireStarted;
  reused.release();
  console.table({
    'Initial connection (DNS/TCP/TLS/auth)': { ms: connectMs.toFixed(2) },
    'SELECT 1 round trip, first': { ms: samples[0].toFixed(2) },
    'SELECT 1 round trip, mean of next 4': { ms: (samples.slice(1).reduce((a, b) => a + b, 0) / 4).toFixed(2) },
    'Acquire existing pooled connection': { ms: reacquireMs.toFixed(2) },
  });
  console.log('Read-only check. Run on the API host too; local latency does not measure Render latency.');
} catch (error) {
  console.error(`Database check failed (${error.code || 'unknown'}). Check network access, credentials and SSL settings.`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
