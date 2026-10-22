import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '../backend/generated/client/index.js';
config({ path: '.env' });
const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost/missing');
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) &&
  process.env.E2E_ALLOW_REMOTE_DATABASE !== 'true'
)
  throw new Error(
    'Browser fixture setup requires a local development database. Explicitly set E2E_ALLOW_REMOTE_DATABASE=true only for a disposable remote test database.',
  );
const db = new PrismaClient();
const runId = randomBytes(6).toString('hex');
const email = `e2e-admin-${runId}@example.test`;
const password = randomBytes(24).toString('hex');
const salt = randomBytes(16).toString('hex');
const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
let status = 1;
try {
  const curriculum = await db.curriculum.findFirst({ where: { published: true } });
  if (!curriculum) throw new Error('Seed a demonstration curriculum first.');
  await db.user.create({
    data: {
      email,
      name: 'Synthetic browser administrator',
      passwordHash,
      role: 'ADMIN',
      profile: {
        create: {
          curriculumId: curriculum.id,
          campus: curriculum.document.campuses[0],
          currentTerm: 'Fall 2026',
          semester: 1,
        },
      },
    },
  });
  const child = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_RUN_ID: runId,
      E2E_ADMIN_EMAIL: email,
      E2E_ADMIN_PASSWORD: password,
      E2E_CURRICULUM_ID: curriculum.id,
    },
  });
  status = child.status ?? 1;
} finally {
  // Only records uniquely named by this invocation are removed; application records are preserved.
  await db.user.deleteMany({
    where: {
      OR: [{ email }, { email: { startsWith: `e2e-${runId}-`, endsWith: '@example.test' } }],
    },
  });
  await db.offering.deleteMany({
    where: { sourceUrl: `https://example.com/unipath-e2e/${runId}` },
  });
  await db.instructor.deleteMany({
    where: { sourceUrl: `https://example.com/unipath-e2e/${runId}` },
  });
  await db.curriculum.deleteMany({ where: { slug: { startsWith: `e2e-${runId}-` } } });
  await db.$disconnect();
}
process.exit(status);
