import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient, Prisma } from '../../backend/generated/client/index.js';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../backend/src/app.js';
import { readConfig } from '../../backend/src/config.js';
import { hashPassword } from '../../backend/src/security.js';
import { demoCurriculum } from '../../shared/src/index.js';
const connection = process.env.TEST_DATABASE_URL;
const suite = connection ? describe : describe.skip;
suite('PostgreSQL API integration (isolated disposable schema)', () => {
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  let db: PrismaClient;
  let app: ReturnType<typeof createApp>['app'];
  let replica: ReturnType<typeof createApp>['app'];
  let student: ReturnType<typeof request.agent>;
  let other: ReturnType<typeof request.agent>;
  let admin: ReturnType<typeof request.agent>;
  let curriculumId: string;
  let cookie: string;
  let revision: number;
  const origin = 'http://localhost:5173';
  const mutate = (
    agent: ReturnType<typeof request.agent>,
    method: 'post' | 'put' | 'patch' | 'delete',
    path: string,
    data: unknown,
  ) => agent[method](path).set('Origin', origin).set('X-UniPath-Client', 'web').send(data);
  beforeAll(async () => {
    const url = new URL(connection!);
    url.searchParams.set('schema', schema);
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await db.$executeRawUnsafe(`SET search_path TO "${schema}"`);
    const sql = readdirSync('database/migrations', { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => readFileSync(`database/migrations/${d.name}/migration.sql`, 'utf8'))
      .join('\n');
    // Every statement comes from this repository's checked-in migration, never user input.
    for (const statement of sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await db.$executeRawUnsafe(statement);
    const config = readConfig({
      ...process.env,
      DATABASE_URL: url.toString(),
      RATE_LIMIT_SECRET: 'integration-test-secret-at-least-32-characters',
      NODE_ENV: 'test',
      COOKIE_SECURE: 'false',
      CORS_ORIGINS: origin,
      LOG_LEVEL: 'silent',
      API_RATE_LIMIT: '1000',
      AUTH_RATE_LIMIT: '1000',
    });
    app = createApp(db, config).app;
    replica = createApp(db, config).app;
    student = request.agent(app);
    other = request.agent(app);
    admin = request.agent(app);
    const c = await db.curriculum.create({
      data: {
        slug: demoCurriculum.slug,
        published: true,
        document: demoCurriculum as unknown as Prisma.InputJsonValue,
      },
    });
    curriculumId = c.id;
    await db.user.create({
      data: {
        email: 'admin@test.example',
        name: 'Admin',
        role: 'ADMIN',
        passwordHash: await hashPassword('admin-password-long-enough'),
      },
    });
  });
  afterAll(async () => {
    if (db) {
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.$disconnect();
    }
  });
  it('separates liveness/readiness and includes security/request headers', async () => {
    expect((await request(app).get('/health/live')).status).toBe(200);
    const r = await request(app).get('/health/ready');
    expect(r.status).toBe(200);
    expect(r.headers['x-request-id']).toBeTruthy();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });
  it('blocks cross-origin mutation and unauthenticated private data', async () => {
    expect((await request(app).post('/api/auth/register').send({})).status).toBe(403);
    expect((await request(app).get('/api/student')).status).toBe(401);
  });
  it('registers securely and prevents role injection', async () => {
    const r = await mutate(student, 'post', '/api/auth/register', {
      email: 'student@test.example',
      password: 'a-long-student-password',
      name: 'Test Student',
    });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('STUDENT');
    cookie = r.headers['set-cookie'][0].split(';')[0];
    expect(r.headers['set-cookie'][0]).toContain('HttpOnly');
    const u = await db.user.findUniqueOrThrow({ where: { email: 'student@test.example' } });
    expect(u.passwordHash).not.toContain('a-long-student-password');
    expect(
      (
        await mutate(other, 'post', '/api/auth/register', {
          email: 'hacker@test.example',
          password: 'a-long-student-password',
          name: 'X',
          role: 'ADMIN',
        })
      ).status,
    ).toBe(400);
  });
  it('uses shared database sessions across backend instances', async () => {
    const r = await request(replica).get('/api/auth/me').set('Cookie', cookie);
    expect(r.body.user.email).toBe('student@test.example');
    expect(await db.session.count()).toBe(1);
  });
  it('persists curriculum selection without inferring completed courses', async () => {
    const r = await mutate(student, 'put', '/api/student/profile', {
      curriculumId,
      campus: 'Abu Dhabi',
      currentTerm: 'Fall 2026',
      semester: 5,
    });
    expect(r.status).toBe(200);
    expect(r.body.attempts).toEqual([]);
    revision = r.body.profile.revision;
  });
  it('saves repeated course attempts and rejects stale revisions', async () => {
    const attempts = [
      { code: 'CS101', term: 'Fall 2025', status: 'COMPLETED', grade: 'B' },
      { code: 'CS101', term: 'Fall 2026', status: 'COMPLETED', grade: 'A' },
    ];
    const r = await mutate(student, 'put', '/api/student/attempts', { revision, attempts });
    expect(r.status).toBe(200);
    expect(r.body.attempts.length).toBe(2);
    expect(
      (await mutate(student, 'put', '/api/student/attempts', { revision, attempts: [] })).status,
    ).toBe(409);
    revision = r.body.profile.revision;
  });
  it('rejects invalid academic records without replacing valid data', async () => {
    expect(
      (
        await mutate(student, 'put', '/api/student/attempts', {
          revision,
          attempts: [{ code: 'CS101', term: 'Fall', status: 'COMPLETED', grade: 'F' }],
        })
      ).status,
    ).toBe(400);
    expect((await student.get('/api/student')).body.attempts.length).toBe(2);
  });
  it('checks plan eligibility and persists a valid plan', async () => {
    expect(
      (
        await mutate(student, 'put', '/api/student/plans', {
          term: 'Spring 2027',
          courseCodes: ['CS202'],
        })
      ).status,
    ).toBe(400);
    const r = await mutate(student, 'put', '/api/student/plans', {
      term: 'Spring 2027',
      courseCodes: ['CS102'],
    });
    expect(r.status).toBe(200);
    expect(r.body.plans[0].courseCodes).toEqual(['CS102']);
  });
  it('isolates accounts and forbids student administration', async () => {
    await mutate(other, 'post', '/api/auth/register', {
      email: 'other@test.example',
      password: 'another-long-password',
      name: 'Other Student',
    });
    expect((await other.get('/api/student')).body.attempts).toEqual([]);
    expect((await student.get('/api/admin/curricula')).status).toBe(403);
  });
  it('logs in admin and validates atomic curriculum imports and immutability', async () => {
    expect(
      (
        await mutate(admin, 'post', '/api/auth/login', {
          email: 'admin@test.example',
          password: 'admin-password-long-enough',
        })
      ).status,
    ).toBe(200);
    const bad = { ...demoCurriculum, slug: 'bad', totalCredits: 1 };
    expect(
      (
        await mutate(admin, 'post', '/api/admin/import', {
          format: 'json',
          content: JSON.stringify(bad),
        })
      ).status,
    ).toBe(400);
    expect(await db.curriculum.count()).toBe(1);
    const doc = { ...demoCurriculum, slug: 'new-demo', version: 'Draft v2' };
    const r = await mutate(admin, 'post', '/api/admin/import', {
      format: 'json',
      content: JSON.stringify(doc),
    });
    expect(r.status).toBe(201);
    const changed = { ...demoCurriculum, version: 'Changed' };
    expect(
      (
        await mutate(admin, 'put', `/api/admin/curricula/${curriculumId}`, {
          document: changed,
          published: true,
          revision: 1,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await mutate(admin, 'put', `/api/admin/curricula/${curriculumId}`, {
          document: demoCurriculum,
          published: true,
          revision: 1,
        })
      ).status,
    ).toBe(200);
  });
  it('saves instructors and offerings only with term and provenance', async () => {
    const i = await mutate(admin, 'post', '/api/admin/instructors', {
      name: 'Fictional test instructor',
      department: 'Testing',
      sourceUrl: 'https://example.com/test-only',
      verifiedAt: '2026-10-22',
    });
    expect(i.status).toBe(201);
    const o = await mutate(admin, 'post', '/api/admin/offerings', {
      curriculumId,
      code: 'CS101',
      campus: 'Abu Dhabi',
      term: 'Fall 2026',
      section: '1',
      schedule: null,
      sourceUrl: 'https://example.com/test-only',
      verifiedAt: '2026-10-22',
      instructorId: i.body.id,
    });
    expect(o.status).toBe(201);
    const rows = await student.get(
      `/api/offerings?curriculumId=${curriculumId}&term=Fall%202026&campus=Abu%20Dhabi`,
    );
    expect(rows.body[0].instructor.name).toBe('Fictional test instructor');
    expect(
      (
        await student.get(
          `/api/offerings?curriculumId=${curriculumId}&term=Other&campus=Abu%20Dhabi`,
        )
      ).body,
    ).toEqual([]);
  });
  it('revokes sessions across replicas on logout', async () => {
    expect((await mutate(student, 'post', '/api/auth/logout', {})).status).toBe(204);
    expect((await request(replica).get('/api/student').set('Cookie', cookie)).status).toBe(401);
  });
  it('updates passwords, exports only private account data, and deletes accounts with session revocation', async () => {
    const agent = request.agent(app);
    const registered = await mutate(agent, 'post', '/api/auth/register', {
      email: 'account@test.example',
      password: 'original-account-password',
      name: 'Account',
    });
    const id = registered.body.user.id;
    const oldCookie = registered.headers['set-cookie'][0].split(';')[0];
    const changed = await mutate(agent, 'patch', '/api/auth/account', {
      name: 'Updated account',
      currentPassword: 'original-account-password',
      newPassword: 'replacement-account-password',
    });
    expect(changed.status).toBe(200);
    expect((await request(replica).get('/api/student').set('Cookie', oldCookie)).status).toBe(401);
    const exported = await agent.get('/api/student/export');
    expect(exported.body.user.name).toBe('Updated account');
    expect(exported.body.user.passwordHash).toBeUndefined();
    expect(
      (
        await mutate(agent, 'post', '/api/auth/login', {
          email: 'account@test.example',
          password: 'original-account-password',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await mutate(agent, 'post', '/api/auth/login', {
          email: 'account@test.example',
          password: 'replacement-account-password',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await mutate(agent, 'delete', '/api/auth/account', {
          password: 'replacement-account-password',
        })
      ).status,
    ).toBe(204);
    expect(await db.user.findUnique({ where: { id } })).toBeNull();
    expect(await db.session.count({ where: { userId: id } })).toBe(0);
  });
  it('reports dependency failure through readiness without failing liveness', async () => {
    const unavailable = {
      $queryRaw: async () => {
        throw new Error('Synthetic database outage');
      },
    } as unknown as PrismaClient;
    const cfg = readConfig({
      ...process.env,
      DATABASE_URL: connection,
      RATE_LIMIT_SECRET: 'readiness-test-secret-at-least-32-characters',
      CORS_ORIGINS: origin,
      NODE_ENV: 'test',
      COOKIE_SECURE: 'false',
      LOG_LEVEL: 'silent',
    });
    const failing = createApp(unavailable, cfg).app;
    expect((await request(failing).get('/health/ready')).status).toBe(503);
    expect((await request(failing).get('/health/live')).status).toBe(200);
  });
  it('rejects a deterministically delayed old-password login after password change on another replica', async () => {
    const agent = request.agent(app);
    await mutate(agent, 'post', '/api/auth/register', {
      email: 'race@test.example',
      name: 'Race',
      password: 'old-password-long-enough',
    });
    let release!: () => void;
    let reached!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const captured = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const original = db.user.findUnique.bind(db.user);
    const spy = vi.spyOn(db.user, 'findUnique').mockImplementation(async (...args) => {
      const result = await original(...args);
      if (args[0].where.email === 'race@test.example') {
        reached();
        await barrier;
      }
      return result;
    });
    // Start the request and stop it after it has read the old credential snapshot.
    const delayed = mutate(request.agent(replica), 'post', '/api/auth/login', {
      email: 'race@test.example',
      password: 'old-password-long-enough',
    }).then((r) => r);
    try {
      await captured;
      const changed = await mutate(agent, 'patch', '/api/auth/account', {
        name: 'Race',
        currentPassword: 'old-password-long-enough',
        newPassword: 'new-password-long-enough',
      });
      expect(changed.status).toBe(200);
      release();
      const login = await delayed;
      expect(login.status).toBe(401);
      expect((await agent.get('/api/student')).status).toBe(200);
      const user = await db.user.findUniqueOrThrow({ where: { email: 'race@test.example' } });
      expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    } finally {
      release();
      spy.mockRestore();
      await delayed;
    }
  });
  it('uses target-term enrollment and selected-course context when saving plans', async () => {
    const doc = {
      ...demoCurriculum,
      slug: 'term-context',
      totalCredits: 6,
      groups: [],
      courses: [
        {
          ...demoCurriculum.courses[0],
          code: 'A',
          requirement: { type: 'corequisite', code: 'B' },
        },
        { ...demoCurriculum.courses[0], code: 'B', requirement: null },
      ],
    };
    const imported = await mutate(admin, 'post', '/api/admin/import', {
      format: 'json',
      content: JSON.stringify(doc),
      publish: true,
    });
    expect(imported.status).toBe(201);
    const agent = request.agent(app);
    await mutate(agent, 'post', '/api/auth/register', {
      email: 'term@test.example',
      name: 'Term',
      password: 'term-password-long-enough',
    });
    const profile = await mutate(agent, 'put', '/api/student/profile', {
      curriculumId: imported.body.id,
      campus: 'Abu Dhabi',
      currentTerm: 'Current',
      semester: 1,
    });
    const enrolled = await mutate(agent, 'put', '/api/student/attempts', {
      revision: profile.body.profile.revision,
      attempts: [{ code: 'B', term: 'Old', status: 'IN_PROGRESS', grade: null }],
    });
    expect(enrolled.status).toBe(200);
    expect(
      (await mutate(agent, 'put', '/api/student/plans', { term: 'Current', courseCodes: ['A'] }))
        .status,
    ).toBe(400);
    expect(
      (await mutate(agent, 'put', '/api/student/plans', { term: 'Old', courseCodes: ['A'] }))
        .status,
    ).toBe(200);
    expect(
      (
        await mutate(agent, 'put', '/api/student/plans', {
          term: 'Current',
          courseCodes: ['A', 'B'],
        })
      ).status,
    ).toBe(200);
  });
  it('rejects malformed documents and future verification, and stamps authenticated reviewer identity/time', async () => {
    expect(
      (
        await mutate(admin, 'post', '/api/admin/import', {
          format: 'json',
          content: '{"courses":{}}',
        })
      ).status,
    ).toBe(400);
    const data = {
      name: 'Review',
      department: 'Synthetic',
      sourceUrl: 'https://example.com/synthetic',
      verifiedAt: '2999-01-01',
    };
    expect((await mutate(admin, 'post', '/api/admin/instructors', data)).status).toBe(400);
    const r = await mutate(admin, 'post', '/api/admin/instructors', {
      ...data,
      verifiedAt: new Date().toISOString().slice(0, 10),
    });
    expect(r.status).toBe(201);
    const reviewer = await db.user.findUniqueOrThrow({ where: { email: 'admin@test.example' } });
    expect(r.body.reviewedBy).toBe(reviewer.id);
    expect(Math.abs(Date.now() - Date.parse(r.body.reviewedAt))).toBeLessThan(5000);
    const verified = {
      ...demoCurriculum,
      slug: 'reviewed-curriculum',
      verification: 'VERIFIED',
      verifiedAt: new Date().toISOString().slice(0, 10),
      sources: [{ url: 'https://example.com/synthetic', note: 'Synthetic test only' }],
      courses: demoCurriculum.courses.map((c) => ({
        ...c,
        sources: [{ url: 'https://example.com/synthetic', note: 'Synthetic test only' }],
      })),
    };
    const c = await mutate(admin, 'post', '/api/admin/import', {
      format: 'json',
      content: JSON.stringify(verified),
    });
    expect(c.status).toBe(201);
    expect(c.body.reviewedBy).toBe(reviewer.id);
    expect(c.body.reviewedAt).toBeTruthy();
  });
  it('enforces database-backed auth rate limits without charging session lookups', async () => {
    const cfg = readConfig({
      ...process.env,
      DATABASE_URL: connection,
      RATE_LIMIT_SECRET: 'separate-limiter-test-secret-32-characters',
      CORS_ORIGINS: origin,
      NODE_ENV: 'test',
      COOKIE_SECURE: 'false',
      AUTH_RATE_LIMIT: '1',
      API_RATE_LIMIT: '100',
      LOG_LEVEL: 'silent',
    });
    const limited = createApp(db, cfg).app;
    expect((await request(limited).get('/api/auth/me')).status).toBe(200);
    expect(
      (
        await mutate(request.agent(limited), 'post', '/api/auth/login', {
          email: 'nobody@test.example',
          password: 'invalid-password',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await mutate(request.agent(limited), 'post', '/api/auth/login', {
          email: 'nobody@test.example',
          password: 'invalid-password',
        })
      ).status,
    ).toBe(429);
  });
});
