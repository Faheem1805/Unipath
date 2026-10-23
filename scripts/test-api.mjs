import { spawnSync } from 'node:child_process';
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error(
    'Set TEST_DATABASE_URL explicitly to a disposable PostgreSQL database. Application DATABASE_URL is never a fallback.',
  );
  process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/api'], {
  stdio: 'inherit',
  env: { ...process.env, TEST_DATABASE_URL: url },
});
process.exit(result.status ?? 1);
