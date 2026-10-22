import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
config({ path: '.env' });
const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Set TEST_DATABASE_URL or DATABASE_URL to a running development PostgreSQL instance. Tests use a unique disposable schema.',
  );
  process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/api'], {
  stdio: 'inherit',
  env: { ...process.env, TEST_DATABASE_URL: url },
});
process.exit(result.status ?? 1);
