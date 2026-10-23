// Disposable Linux acceptance stack. Never reads .env or uses an application database.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { PrismaClient } from '../backend/generated/client/index.js';
import { demoCurriculum } from '../shared/dist/index.js';

const id = randomBytes(5).toString('hex');
const project = `unipath-test-${id}`;
const dir = resolve('.local', project);
mkdirSync(dir, { recursive: true });
const freePort = () =>
  new Promise((done) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => done(port));
    });
  });
const webPort = await freePort(),
  dbPort = await freePort();
const origin = `http://127.0.0.1:${webPort}`;
const env = {
  ...process.env,
  BOOTSTRAP_DB_PASSWORD: randomBytes(32).toString('hex'),
  OWNER_DB_PASSWORD: randomBytes(32).toString('hex'),
  RUNTIME_DB_PASSWORD: randomBytes(32).toString('hex'),
  RATE_LIMIT_SECRET: randomBytes(32).toString('hex'),
  POSTGRES_DB: 'acceptance',
  PRODUCTION_ORIGIN: 'https://staging.example.test',
  WEB_PORT: String(webPort),
  SEED_DEMO: 'false',
};
const override = resolve(dir, 'compose.yml');
writeFileSync(
  override,
  `services:
  database:
    ports: ['127.0.0.1:${dbPort}:5432']
  backend:
    environment:
      NODE_ENV: test
      COOKIE_SECURE: 'false'
      CORS_ORIGINS: '${origin}'
      API_RATE_LIMIT: 5000
      AUTH_RATE_LIMIT: 1000
`,
);
const base = [
  'compose',
  '--env-file',
  '.env.production.example',
  '-p',
  project,
  '-f',
  'docker-compose.production.yml',
  '-f',
  override,
];
const results = [];
let commandIndex = 0;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  // Raw build/command output stays ignored; never echo expanded environment or credentials.
  writeFileSync(
    resolve(dir, `command-${commandIndex++}.log`),
    (result.stdout ?? '') + (result.stderr ?? ''),
  );
  if (result.status !== 0)
    throw new Error(
      `${command} ${args[0]} failed (exit ${result.status}); inspect ignored logs in ${dir}`,
    );
  return result.stdout.trim();
}
const docker = (...args) => run('docker', args);
const compose = (...args) => docker(...base, ...args);
const check = async (name, action) => {
  await action();
  results.push({ name, status: 'PASS' });
  console.log(`PASS ${name}`);
};
const retry = async (fn, timeout = 40000) => {
  const until = Date.now() + timeout;
  let error;
  while (Date.now() < until) {
    try {
      return await fn();
    } catch (e) {
      error = e;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw error;
};
const url = (user, password, database = 'acceptance') =>
  `postgresql://${user}:${password}@127.0.0.1:${dbPort}/${database}?schema=public&connection_limit=5&connect_timeout=3&pool_timeout=2&socket_timeout=5`;
const adminDb = new PrismaClient({
  datasources: { db: { url: url('unipath_bootstrap', env.BOOTSTRAP_DB_PASSWORD) } },
});
const ownerDb = new PrismaClient({
  datasources: { db: { url: url('unipath_migrator', env.OWNER_DB_PASSWORD) } },
});
const runtimeDb = new PrismaClient({
  datasources: { db: { url: url('unipath_runtime', env.RUNTIME_DB_PASSWORD) } },
});
function client() {
  let cookie = '';
  return {
    get cookie() {
      return cookie;
    },
    async request(path, method = 'GET', body) {
      const response = await fetch(origin + path, {
        method,
        headers: {
          Origin: origin,
          'X-UniPath-Client': 'web',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const next = response.headers.get('set-cookie');
      if (next) cookie = next.split(';')[0];
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    },
  };
}
const password = 'synthetic-student-password-only';
const adminPassword = 'synthetic-admin-password-only';
const student = client(),
  admin = client();
let blocker, restoreContainer;
try {
  await check('quiet Compose validation and Linux builds', async () => {
    compose('config', '--quiet');
    compose('build');
  });
  await check('fresh database with SEED_DEMO=false and administrator CLI', async () => {
    compose('up', '-d', '--wait', '--wait-timeout', '180');
    assert.equal(await adminDb.curriculum.count(), 0);
    run(
      'docker',
      [
        ...base,
        'run',
        '--rm',
        '--no-deps',
        '-T',
        'migrate',
        'node',
        'backend/dist/create-admin.js',
      ],
      {
        input: JSON.stringify({
          email: 'bootstrap@example.test',
          name: 'Bootstrap',
          password: adminPassword,
        }),
      },
    );
    assert.equal(
      (
        await admin.request('/api/auth/login', 'POST', {
          email: 'bootstrap@example.test',
          password: adminPassword,
        })
      ).status,
      200,
    );
    assert.equal((await admin.request('/api/student')).body.profile, null);
    run(process.execPath, ['scripts/test-e2e.mjs'], {
      env: {
        ...env,
        TEST_DATABASE_URL: url('unipath_bootstrap', env.BOOTSTRAP_DB_PASSWORD),
        E2E_BASE_URL: origin,
        E2E_BOOTSTRAP_ONLY: 'true',
      },
    });
    assert.equal(await adminDb.curriculum.count(), 0);
    const imported = await admin.request('/api/admin/import', 'POST', {
      format: 'json',
      content: JSON.stringify(demoCurriculum),
    });
    assert.equal(imported.status, 201);
    assert.equal(
      (
        await admin.request(`/api/admin/curricula/${imported.body.id}`, 'PUT', {
          document: demoCurriculum,
          published: true,
          revision: 1,
        })
      ).status,
      200,
    );
  });
  await check('least-privilege role, future migration grants and DDL denials', async () => {
    const [role] =
      await runtimeDb.$queryRaw`SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    assert.ok(Object.values(role).every((v) => v === false));
    for (const sql of [
      'CREATE ROLE forbidden_role',
      'CREATE DATABASE forbidden_database',
      'CREATE TABLE public.forbidden_table (id int)',
      'ALTER TABLE public."User" ADD COLUMN forbidden int',
      'SELECT * FROM public._prisma_migrations',
    ])
      await assert.rejects(runtimeDb.$executeRawUnsafe(sql));
    await ownerDb.$executeRawUnsafe('CREATE TABLE public.future_grant_probe (id int)');
    try {
      await runtimeDb.$executeRawUnsafe('INSERT INTO public.future_grant_probe VALUES (1)');
      assert.equal(
        (await runtimeDb.$queryRawUnsafe('SELECT * FROM public.future_grant_probe')).length,
        1,
      );
    } finally {
      await ownerDb.$executeRawUnsafe('DROP TABLE public.future_grant_probe');
    }
  });
  await check(
    'production runtime rejects HTTP origins and emits Secure cookies under runtime role',
    async () => {
      run(
        'docker',
        [
          ...base,
          'run',
          '--rm',
          '--no-deps',
          '-T',
          '-e',
          'NODE_ENV=production',
          '-e',
          'COOKIE_SECURE=true',
          '-e',
          'CORS_ORIGINS=https://staging.example.test',
          '-e',
          'LOG_LEVEL=silent',
          'backend',
          'node',
          '--input-type=module',
        ],
        { input: readFileSync('tests/acceptance/production.mjs', 'utf8') },
      );
    },
  );
  await check(
    'migration status, schema drift and additive upgrade preserve historical data',
    async () => {
      compose(
        'run',
        '--rm',
        '--no-deps',
        '-T',
        'migrate',
        'node',
        'node_modules/prisma/build/index.js',
        'migrate',
        'status',
        '--schema',
        'database/schema.prisma',
      );
      compose(
        'run',
        '--rm',
        '--no-deps',
        '-T',
        'migrate',
        'node',
        'node_modules/prisma/build/index.js',
        'migrate',
        'diff',
        '--from-schema-datasource',
        'database/schema.prisma',
        '--to-schema-datamodel',
        'database/schema.prisma',
        '--exit-code',
      );
      await adminDb.$executeRawUnsafe('CREATE DATABASE acceptance_upgrade OWNER unipath_migrator');
      const upgrade = new PrismaClient({
        datasources: {
          db: { url: url('unipath_migrator', env.OWNER_DB_PASSWORD, 'acceptance_upgrade') },
        },
      });
      try {
        const apply = async (path) => {
          for (const statement of readFileSync(path, 'utf8')
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean))
            await upgrade.$executeRawUnsafe(statement);
        };
        await apply('database/migrations/202610220001_initial/migration.sql');
        await upgrade.$executeRaw`INSERT INTO "Curriculum" ("id", "slug", "document", "updatedAt") VALUES ('historic', 'historic', ${JSON.stringify(demoCurriculum)}::jsonb, NOW())`;
        await apply('database/migrations/202610220002_review_provenance/migration.sql');
        const old = await upgrade.curriculum.findUniqueOrThrow({ where: { id: 'historic' } });
        assert.deepEqual(old.document, demoCurriculum);
        assert.equal(old.reviewedBy, null);
        assert.equal(old.reviewedAt, null);
      } finally {
        await upgrade.$disconnect();
        await adminDb.$executeRawUnsafe('DROP DATABASE acceptance_upgrade');
      }
    },
  );
  await check('registration, records, plans, isolation, password change and logout', async () => {
    assert.equal(
      (
        await student.request('/api/auth/register', 'POST', {
          email: 'student@example.test',
          name: 'Student',
          password,
        })
      ).status,
      201,
    );
    const [{ id: curriculumId }] = (await student.request('/api/curricula')).body;
    const profile = await student.request('/api/student/profile', 'PUT', {
      curriculumId,
      campus: 'Abu Dhabi',
      currentTerm: 'Current',
      semester: 1,
    });
    assert.equal(profile.status, 200);
    assert.equal(
      (
        await student.request('/api/student/attempts', 'PUT', {
          revision: profile.body.profile.revision,
          attempts: [{ code: 'CS101', term: 'Prior', status: 'COMPLETED', grade: 'A' }],
        })
      ).status,
      200,
    );
    assert.equal(
      (await student.request('/api/student/plans', 'PUT', { term: 'Next', courseCodes: ['CS102'] }))
        .status,
      200,
    );
    const other = client();
    await other.request('/api/auth/register', 'POST', {
      email: 'other@example.test',
      name: 'Other',
      password,
    });
    assert.deepEqual((await other.request('/api/student')).body.attempts, []);
    const old = student.cookie;
    assert.equal(
      (
        await student.request('/api/auth/account', 'PATCH', {
          name: 'Student',
          currentPassword: password,
          newPassword: `${password}-new`,
        })
      ).status,
      200,
    );
    assert.equal((await fetch(origin + '/api/student', { headers: { Cookie: old } })).status, 401);
    assert.equal((await other.request('/api/auth/logout', 'POST', {})).status, 204);
    assert.equal((await other.request('/api/student')).status, 401);
    assert.equal(
      (await other.request('/api/auth/login', 'POST', { email: 'student@example.test', password }))
        .status,
      401,
    );
    assert.equal(
      (
        await student.request('/api/auth/login', 'POST', {
          email: 'student@example.test',
          password: `${password}-new`,
        })
      ).status,
      200,
    );
  });
  await check('PostgreSQL API integration including deterministic login overlap', async () => {
    run(process.execPath, ['scripts/test-api.mjs'], {
      env: { ...env, TEST_DATABASE_URL: url('unipath_bootstrap', env.BOOTSTRAP_DB_PASSWORD) },
    });
  });
  await check(
    'browser desktop/mobile including administrator without onboarding and malformed JSON',
    async () => {
      run(process.execPath, ['scripts/test-e2e.mjs'], {
        env: {
          ...env,
          TEST_DATABASE_URL: url('unipath_bootstrap', env.BOOTSTRAP_DB_PASSWORD),
          E2E_BASE_URL: origin,
        },
      });
    },
  );
  const records = async () => {
    const result = await student.request('/api/student');
    assert.equal(result.status, 200);
    assert.equal(result.body.attempts.length, 1);
    assert.equal(result.body.plans.length, 1);
  };
  await check('saved records and session survive database/API/frontend recreation', async () => {
    await Promise.all([adminDb.$disconnect(), ownerDb.$disconnect(), runtimeDb.$disconnect()]);
    compose(
      'up',
      '-d',
      '--no-deps',
      '--force-recreate',
      '--wait',
      '--wait-timeout',
      '180',
      'database',
      'backend',
      'frontend',
    );
    await retry(records);
  });
  await check(
    'Nginx follows a guaranteed changed backend address without frontend restart',
    async () => {
      const web = compose('ps', '-q', 'frontend');
      const old = compose('ps', '-q', 'backend');
      const networkInfo = JSON.parse(
        docker('inspect', '--format', '{{json .NetworkSettings.Networks}}', old),
      );
      const [network, details] = Object.entries(networkInfo)[0];
      compose('rm', '-s', '-f', 'backend');
      blocker = `${project}-ip-blocker`;
      docker(
        'run',
        '-d',
        '--name',
        blocker,
        '--network',
        network,
        '--ip',
        details.IPAddress,
        '--entrypoint',
        'sleep',
        'postgres:17-alpine',
        '300',
      );
      compose('up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'backend');
      const replacement = compose('ps', '-q', 'backend');
      const replacementInfo = JSON.parse(
        docker('inspect', '--format', '{{json .NetworkSettings.Networks}}', replacement),
      );
      assert.notEqual(replacementInfo[network].IPAddress, details.IPAddress);
      assert.equal(compose('ps', '-q', 'frontend'), web);
      await retry(async () => {
        assert.equal((await fetch(origin + '/health/ready')).status, 200);
        await records();
      });
      docker('rm', '-f', blocker);
      blocker = undefined;
    },
  );
  await check(
    'Linux shutdown drains a controlled active database request, then exits zero',
    async () => {
      let unlock, locked;
      const gate = new Promise((r) => {
        unlock = r;
      });
      const acquired = new Promise((r) => {
        locked = r;
      });
      const lock = ownerDb.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('LOCK TABLE "RateBucket" IN ACCESS EXCLUSIVE MODE');
          locked();
          await gate;
        },
        { timeout: 12000 },
      );
      await acquired;
      const response = student.request('/api/student');
      try {
        await retry(async () => {
          const [r] =
            await adminDb.$queryRaw`SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename='unipath_runtime' AND wait_event_type='Lock'`;
          assert.ok(r.n > 0);
        }, 3000);
        const stopping = spawn('docker', [...base, 'stop', 'backend'], {
          env,
          windowsHide: true,
          stdio: 'ignore',
        });
        const stopped = new Promise((r) => stopping.on('exit', r));
        await retry(async () => {
          assert.match(docker('logs', compose('ps', '-a', '-q', 'backend')), /draining requests/);
        }, 2500);
        unlock();
        await lock;
        assert.equal((await response).status, 200);
        assert.equal(await stopped, 0);
        assert.equal(
          docker(
            'inspect',
            '--format',
            '{{.State.ExitCode}}',
            compose('ps', '-a', '-q', 'backend'),
          ),
          '0',
        );
      } finally {
        unlock();
        await lock;
      }
      compose('start', '--wait', 'backend');
    },
  );
  await check('Linux idle shutdown exits zero within configured container grace', async () => {
    compose('stop', 'backend');
    assert.equal(
      docker('inspect', '--format', '{{.State.ExitCode}}', compose('ps', '-a', '-q', 'backend')),
      '0',
    );
    compose('start', '--wait', 'backend');
  });
  await check('database outage distinguishes liveness/readiness and recovers', async () => {
    compose('stop', 'database');
    assert.equal((await fetch(origin + '/health/live')).status, 200);
    assert.equal((await fetch(origin + '/health/ready')).status, 503);
    assert.equal((await student.request('/api/student')).status, 500);
    compose('start', '--wait', 'database');
    await retry(async () => {
      assert.equal((await fetch(origin + '/health/ready')).status, 200);
      await records();
    }, 60000);
  });
  await check(
    'logical backup restores records, sessions and credentials into a separate disposable database',
    async () => {
      compose(
        'exec',
        '-T',
        'database',
        'sh',
        '-c',
        'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/acceptance.dump && createdb -U "$POSTGRES_USER" acceptance_restore && pg_restore --no-owner --no-privileges -U "$POSTGRES_USER" -d acceptance_restore /tmp/acceptance.dump',
      );
      const restored = new PrismaClient({
        datasources: {
          db: { url: url('unipath_bootstrap', env.BOOTSTRAP_DB_PASSWORD, 'acceptance_restore') },
        },
      });
      try {
        for (const model of ['user', 'attempt', 'plan', 'session', 'curriculum'])
          assert.equal(await restored[model].count(), await adminDb[model].count());
        const { verifyPassword, tokenHash } = await import('../backend/dist/security.js');
        const account = await restored.user.findUniqueOrThrow({
          where: { email: 'student@example.test' },
        });
        assert.equal(await verifyPassword(`${password}-new`, account.passwordHash), true);
        assert.ok(
          await restored.session.findUnique({
            where: { id: tokenHash(student.cookie.split('=')[1]) },
          }),
        );
      } finally {
        await restored.$disconnect();
      }
    },
  );
  await check('logs remain JSON and contain safe diagnostic codes without secrets', async () => {
    const logs = docker('logs', compose('ps', '-q', 'backend'));
    const lines = logs
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(
      lines.some(
        (line) => line.event === 'request_failed' && line.code && line.requestId && line.route,
      ),
    );
    for (const secret of [
      password,
      adminPassword,
      env.BOOTSTRAP_DB_PASSWORD,
      env.OWNER_DB_PASSWORD,
      env.RUNTIME_DB_PASSWORD,
      env.RATE_LIMIT_SECRET,
      student.cookie.split('=')[1],
    ])
      assert.ok(!logs.includes(secret));
  });
} catch (error) {
  results.push({ name: error.message, status: 'FAIL' });
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([adminDb.$disconnect(), ownerDb.$disconnect(), runtimeDb.$disconnect()]);
  writeFileSync(resolve(dir, 'results.json'), JSON.stringify(results, null, 2));
  if (blocker) docker('rm', '-f', blocker);
  if (restoreContainer) docker('rm', '-f', restoreContainer);
  // This unique test project owns its volume; no developer project is ever selected.
  compose('down', '--volumes', '--remove-orphans');
  console.log(`Acceptance evidence: ${dir}`);
}
