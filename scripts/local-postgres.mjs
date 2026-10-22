import EmbeddedPostgres from 'embedded-postgres';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { config } from 'dotenv';
config({ path: '.env' });
const url = new URL(
  process.env.DATABASE_URL ?? 'postgresql://unipath:local-development-only@localhost:5432/unipath',
);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Local helper requires a loopback database hostname.');
const databaseDir = resolve('.local/postgres');
const pg = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 5432),
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const name = url.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Use an alphanumeric local database name.');
const result = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
if (!result.rowCount) await pg.createDatabase(name);
await client.end();
console.log(
  `Local development PostgreSQL is listening on ${url.port || 5432}. Data persists in .local/postgres. Ctrl+C to stop.`,
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60_000);
