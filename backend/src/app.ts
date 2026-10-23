import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createHmac, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PrismaClient, Prisma } from '../generated/client/index.js';
import pino from 'pino';
import { z, ZodError } from 'zod';
import {
  attemptSchema,
  curriculumSchema,
  evaluate,
  termContext,
  verificationDateSchema,
  type Curriculum,
  type Attempt,
} from '@unipath/shared';
import type { Config } from './config.js';
import { hashPassword, verifyPassword, tokenHash, newToken } from './security.js';
import { importCurriculum, guardDepth } from './importer.js';

declare global {
  // Express's supported request augmentation uses its global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      identity?: { id: string; email: string; name: string; role: string };
      requestId: string;
    }
  }
}
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const password = z.string().min(12, 'Use at least 12 characters.').max(128);
const publicUser = (u: { id: string; email: string; name: string; role: string }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
});
const profileInput = z
  .object({
    curriculumId: z.string().uuid(),
    campus: z.string().max(60),
    currentTerm: z.string().trim().min(1).max(80),
    semester: z.number().int().min(1).max(16),
    resetProgress: z.boolean().default(false),
  })
  .strict();
export function createApp(
  db: PrismaClient,
  config: Config,
): { app: express.Express; logger: pino.Logger } {
  const app = express();
  const logger = pino({ level: config.LOG_LEVEL, base: { service: 'unipath-api' } });
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use((req, res, next) => {
    const start = performance.now();
    const supplied = req.get('x-request-id');
    req.requestId = supplied && /^[a-zA-Z0-9_-]{8,64}$/.test(supplied) ? supplied : randomUUID();
    res.set('X-Request-ID', req.requestId);
    res.on('finish', () =>
      logger.info(
        {
          requestId: req.requestId,
          method: req.method,
          route: req.route?.path ?? (req.path.startsWith('/health/') ? req.path : 'unmatched'),
          status: res.statusCode,
          durationMs: Math.round((performance.now() - start) * 10) / 10,
        },
        'request',
      ),
    );
    next();
  });
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || config.origins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-UniPath-Client', 'X-Request-ID'],
    }),
  );
  app.get('/health/live', (_req, res) => res.json({ status: 'alive' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, _res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (!config.origins.includes(req.get('origin') ?? '') ||
        req.get('x-unipath-client') !== 'web' ||
        !req.is('application/json'))
    )
      return next(new HttpError(403, 'Request origin or client verification failed.'));
    next();
  });
  app.use(express.json({ limit: '512kb' }));
  app.use(cookieParser());
  app.use('/api', (req, _res, next) => {
    try {
      if (req.body) guardDepth(req.body);
      next();
    } catch {
      next(new HttpError(400, 'Document nesting is too deep.'));
    }
  });
  const rateLimit =
    (scope: string, limit: number, windowMs: number) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const now = Date.now();
        const window = Math.floor(now / windowMs);
        const key = createHmac('sha256', config.RATE_LIMIT_SECRET)
          .update(`${scope}:${req.ip}:${window}`)
          .digest('hex');
        const expiresAt = new Date((window + 1) * windowMs);
        const rows = await db.$queryRaw<
          { hits: number }[]
        >`INSERT INTO "RateBucket" ("key","hits","expiresAt") VALUES (${key},1,${expiresAt}) ON CONFLICT ("key") DO UPDATE SET "hits"="RateBucket"."hits"+1 RETURNING "hits"`;
        if (rows[0].hits > limit) {
          res.set('Retry-After', String(Math.ceil((expiresAt.getTime() - now) / 1000)));
          return next(new HttpError(429, 'Too many requests. Please try again later.'));
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  app.use('/api', rateLimit('api', config.API_RATE_LIMIT, 60_000));
  const authLimiter = rateLimit('auth-mutation', config.AUTH_RATE_LIMIT, 15 * 60_000);
  app.use('/api/auth', (req, res, next) => {
    if (['POST', 'PATCH', 'DELETE'].includes(req.method) && req.path !== '/logout')
      return authLimiter(req, res, next);
    next();
  });
  app.use('/api', async (req, _res, next) => {
    const token = req.cookies[config.COOKIE_NAME];
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
      const session = await db.session.findUnique({
        where: { id: tokenHash(token) },
        include: { user: true },
      });
      if (session && session.expiresAt > new Date()) req.identity = publicUser(session.user);
    }
    next();
  });
  const required = (req: Request, _res: Response, next: NextFunction) =>
    req.identity ? next() : next(new HttpError(401, 'Please sign in to continue.'));
  const admin = (req: Request, _res: Response, next: NextFunction) =>
    req.identity?.role === 'ADMIN'
      ? next()
      : next(new HttpError(403, 'Administrator access required.'));
  const createSession = async (tx: Prisma.TransactionClient, userId: string) => {
    const token = newToken();
    const expiresAt = new Date(Date.now() + config.SESSION_HOURS * 3600_000);
    await tx.session.create({ data: { id: tokenHash(token), userId, expiresAt } });
    return { token, expiresAt };
  };
  const sessionCookie = (
    res: Response,
    { token, expiresAt }: { token: string; expiresAt: Date },
  ) => {
    res.cookie(config.COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.secureCookie,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  };
  app.get('/api/auth/me', (req, res) => res.json({ user: req.identity ?? null }));
  app.post('/api/auth/register', async (req, res) => {
    const data = z
      .object({ email, password, name: z.string().trim().min(1).max(80) })
      .strict()
      .parse(req.body);
    const passwordHash = await hashPassword(data.password);
    const { user, session } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, name: data.name, passwordHash },
      });
      return { user, session: await createSession(tx, user.id) };
    });
    sessionCookie(res, session);
    logger.info({ event: 'account_registered', requestId: req.requestId }, 'account registered');
    res.status(201).json({ user: publicUser(user) });
  });
  const dummyHashPromise = hashPassword(newToken());
  app.post('/api/auth/login', async (req, res) => {
    const data = z
      .object({ email, password: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    const user = await db.user.findUnique({ where: { email: data.email } });
    const valid = await verifyPassword(
      data.password,
      user?.passwordHash ?? (await dummyHashPromise),
    );
    if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect.');
    const session = await db.$transaction(async (tx) => {
      // All credential changes and session issuance serialize on the same user row.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id} FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current || current.passwordHash !== user.passwordHash)
        throw new HttpError(401, 'Email or password is incorrect.');
      if (req.cookies[config.COOKIE_NAME])
        await tx.session.deleteMany({
          where: { id: tokenHash(String(req.cookies[config.COOKIE_NAME])) },
        });
      return createSession(tx, user.id);
    });
    sessionCookie(res, session);
    res.json({ user: publicUser(user) });
  });
  app.post('/api/auth/logout', async (req, res) => {
    if (req.cookies[config.COOKIE_NAME])
      await db.session.deleteMany({
        where: { id: tokenHash(String(req.cookies[config.COOKIE_NAME])) },
      });
    res.clearCookie(config.COOKIE_NAME, {
      path: '/',
      secure: config.secureCookie,
      sameSite: 'lax',
      httpOnly: true,
    });
    res.status(204).end();
  });
  app.patch('/api/auth/account', required, async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(80),
        currentPassword: z.string().max(128).optional(),
        newPassword: password.optional(),
      })
      .strict()
      .parse(req.body);
    const user = await db.user.findUniqueOrThrow({ where: { id: req.identity!.id } });
    if (
      data.newPassword &&
      (!data.currentPassword || !(await verifyPassword(data.currentPassword, user.passwordHash)))
    )
      throw new HttpError(400, 'Current password is incorrect.');
    const passwordHash = data.newPassword ? await hashPassword(data.newPassword) : undefined;
    const { updated, session } = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id} FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (data.newPassword && current.passwordHash !== user.passwordHash)
        throw new HttpError(409, 'Credentials changed concurrently. Sign in and retry.');
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          name: data.name,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
      if (data.newPassword) await tx.session.deleteMany({ where: { userId: user.id } });
      return { updated: u, session: data.newPassword ? await createSession(tx, user.id) : null };
    });
    if (session) sessionCookie(res, session);
    res.json({ user: publicUser(updated) });
  });
  app.delete('/api/auth/account', required, async (req, res) => {
    const data = z
      .object({ password: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    const user = await db.user.findUniqueOrThrow({ where: { id: req.identity!.id } });
    if (!(await verifyPassword(data.password, user.passwordHash)))
      throw new HttpError(400, 'Password is incorrect.');
    await db.user.delete({ where: { id: user.id } });
    res.clearCookie(config.COOKIE_NAME, { path: '/' });
    res.status(204).end();
  });
  app.get('/api/curricula', async (_req, res) =>
    res.json(
      await db.curriculum.findMany({ where: { published: true }, orderBy: { createdAt: 'asc' } }),
    ),
  );
  app.get('/api/curricula/:id', async (req, res) => {
    const row = await db.curriculum.findUnique({ where: { id: String(req.params.id) } });
    if (!row || (!row.published && req.identity?.role !== 'ADMIN'))
      throw new HttpError(404, 'Curriculum not found.');
    res.json(row);
  });
  app.get('/api/offerings', async (req, res) => {
    const query = z
      .object({
        curriculumId: z.string().uuid(),
        term: z.string().min(1).max(80),
        campus: z.string().min(1).max(60),
      })
      .parse(req.query);
    res.json(await db.offering.findMany({ where: query, include: { instructor: true } }));
  });
  app.use('/api/student', required);
  const studentData = async (userId: string) => {
    const [profile, attempts, plans] = await Promise.all([
      db.profile.findUnique({ where: { userId }, include: { curriculum: true } }),
      db.attempt.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      db.plan.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
    ]);
    return { profile, attempts, plans };
  };
  app.get('/api/student', async (req, res) => res.json(await studentData(req.identity!.id)));
  app.get('/api/student/export', async (req, res) =>
    res.json({
      exportedAt: new Date().toISOString(),
      user: publicUser(req.identity!),
      ...(await studentData(req.identity!.id)),
    }),
  );
  app.put('/api/student/profile', async (req, res) => {
    const data = profileInput.parse(req.body);
    const userId = req.identity!.id;
    const row = await db.curriculum.findUnique({ where: { id: data.curriculumId } });
    if (!row?.published) throw new HttpError(400, 'Select a published curriculum.');
    const document = curriculumSchema.parse(row.document);
    if (!document.campuses.includes(data.campus))
      throw new HttpError(400, 'Campus is not part of this curriculum.');
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
        const old = await tx.profile.findUnique({ where: { userId } });
        if (old && old.curriculumId !== data.curriculumId) {
          if (!data.resetProgress)
            throw new HttpError(
              409,
              'Changing curriculum requires explicitly resetting attempts and plans.',
            );
          await tx.attempt.deleteMany({ where: { userId } });
          await tx.plan.deleteMany({ where: { userId } });
        }
        const { resetProgress, ...values } = data;
        await tx.profile.upsert({
          where: { userId },
          create: { userId, ...values },
          update: { ...values, revision: { increment: 1 } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    res.json(await studentData(userId));
  });
  app.put('/api/student/attempts', async (req, res) => {
    const data = z
      .object({ revision: z.number().int().min(1), attempts: z.array(attemptSchema).max(600) })
      .strict()
      .parse(req.body);
    const userId = req.identity!.id;
    const profile = await db.profile.findUnique({
      where: { userId },
      include: { curriculum: true },
    });
    if (!profile) throw new HttpError(400, 'Finish degree setup first.');
    const curriculum = curriculumSchema.parse(profile.curriculum.document);
    const seen = new Set<string>(),
      taking = new Set<string>();
    for (const a of data.attempts) {
      if (!curriculum.courses.some((c) => c.code === a.code))
        throw new HttpError(400, `Unknown course: ${a.code}`);
      const key = `${a.code}|${a.term}`;
      if (seen.has(key))
        throw new HttpError(400, 'Only one attempt per course and term is allowed.');
      seen.add(key);
      if (a.status === 'IN_PROGRESS') {
        if (taking.has(a.code))
          throw new HttpError(400, 'A course can have only one active enrollment.');
        taking.add(a.code);
      }
    }
    await db.$transaction(async (tx) => {
      const updated = await tx.profile.updateMany({
        where: { userId, revision: data.revision, curriculumId: profile.curriculumId },
        data: { revision: { increment: 1 } },
      });
      if (!updated.count)
        throw new HttpError(409, 'Progress changed in another window. Reload before saving.');
      await tx.attempt.deleteMany({ where: { userId } });
      await tx.attempt.createMany({
        data: data.attempts.map(({ id, ...a }) => ({ ...a, userId })),
      });
    });
    res.json(await studentData(userId));
  });
  app.put('/api/student/plans', async (req, res) => {
    const data = z
      .object({
        term: z.string().trim().min(1).max(80),
        courseCodes: z.array(z.string().max(30)).min(1).max(15),
      })
      .strict()
      .parse(req.body);
    const userId = req.identity!.id;
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
        const profile = await tx.profile.findUnique({
          where: { userId },
          include: { curriculum: true },
        });
        if (!profile) throw new HttpError(400, 'Finish degree setup first.');
        const curriculum = curriculumSchema.parse(profile.curriculum.document);
        const attempts = (await tx.attempt.findMany({ where: { userId } })) as Attempt[];
        const context = termContext(curriculum, attempts, data.term, data.courseCodes);
        const { completed } = context;
        if (new Set(data.courseCodes).size !== data.courseCodes.length)
          throw new HttpError(400, 'Remove duplicate courses.');
        let total = 0;
        for (const code of data.courseCodes) {
          const c = curriculum.courses.find((c) => c.code === code);
          if (!c) throw new HttpError(400, `Unknown course: ${code}`);
          if (completed.has(code))
            throw new HttpError(
              400,
              `${code} is already complete. Plan retakes separately with your adviser.`,
            );
          const result = evaluate(c.requirement, context);
          if (!result.ok) throw new HttpError(400, `${code} is not eligible.`, result.reasons);
          total += c.credits;
        }
        if (total > 24)
          throw new HttpError(
            400,
            'Plans are limited to 24 credits; confirm your actual load limit with an adviser.',
          );
        await tx.plan.upsert({
          where: { userId_term: { userId, term: data.term } },
          create: { userId, curriculumId: profile.curriculumId, ...data },
          update: { curriculumId: profile.curriculumId, courseCodes: data.courseCodes },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    res.json(await studentData(userId));
  });
  app.delete('/api/student/plans/:id', async (req, res) => {
    await db.plan.deleteMany({ where: { id: String(req.params.id), userId: req.identity!.id } });
    res.status(204).end();
  });
  app.use('/api/admin', required, admin);
  app.get('/api/admin/curricula', async (_req, res) =>
    res.json(
      await db.curriculum.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { profiles: true } } },
      }),
    ),
  );
  app.post('/api/admin/import', async (req, res) => {
    const data = z
      .object({
        format: z.enum(['csv', 'json']),
        content: z.string().min(1).max(400000),
        metadata: z.unknown().optional(),
        publish: z.boolean().default(false),
      })
      .strict()
      .parse(req.body);
    let document: Curriculum;
    try {
      document = importCurriculum(data.format, data.content, data.metadata);
    } catch (e) {
      if (e instanceof ZodError) throw e;
      throw new HttpError(400, e instanceof Error ? e.message : 'Invalid import.');
    }
    if (data.publish && document.verification === 'UNVERIFIED')
      throw new HttpError(400, 'Unverified curricula must remain drafts.');
    const row = await db.curriculum.create({
      data: {
        slug: document.slug,
        document: document as unknown as Prisma.InputJsonValue,
        published: data.publish,
        ...(document.verification === 'VERIFIED'
          ? { reviewedBy: req.identity!.id, reviewedAt: new Date() }
          : {}),
      },
    });
    logger.info({ event: 'curriculum_imported', requestId: req.requestId }, 'curriculum imported');
    res.status(201).json(row);
  });
  app.put('/api/admin/curricula/:id', async (req, res) => {
    const data = z
      .object({
        document: curriculumSchema,
        published: z.boolean(),
        revision: z.number().int().positive(),
      })
      .strict()
      .parse(req.body);
    if (data.published && data.document.verification === 'UNVERIFIED')
      throw new HttpError(400, 'Unverified curricula must remain drafts.');
    await db.$transaction(async (tx) => {
      // Lock the version: used or published documents are immutable. Clone to make academic changes.
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "Curriculum" WHERE "id"=${String(req.params.id)} FOR UPDATE`;
      if (!rows.length) throw new HttpError(404, 'Curriculum not found.');
      const old = await tx.curriculum.findUniqueOrThrow({ where: { id: String(req.params.id) } });
      const used = await tx.profile.count({ where: { curriculumId: old.id } });
      if ((old.published || used > 0) && !isDeepStrictEqual(old.document, data.document))
        throw new HttpError(
          409,
          'Published or adopted academic data is immutable. Clone this version to edit it.',
        );
      if (used > 0 && !data.published)
        throw new HttpError(409, 'Cannot unpublish a curriculum used by students.');
      const count = await tx.curriculum.updateMany({
        where: { id: old.id, revision: data.revision },
        data: {
          document: data.document as unknown as Prisma.InputJsonValue,
          published: data.published,
          slug: data.document.slug,
          revision: { increment: 1 },
          // Publication of an unchanged, previously reviewed document preserves attribution.
          ...(!isDeepStrictEqual(old.document, data.document)
            ? {
                reviewedBy: data.document.verification === 'VERIFIED' ? req.identity!.id : null,
                reviewedAt: data.document.verification === 'VERIFIED' ? new Date() : null,
              }
            : {}),
        },
      });
      if (!count.count) throw new HttpError(409, 'This version changed. Reload before saving.');
    });
    res.json(await db.curriculum.findUnique({ where: { id: String(req.params.id) } }));
  });
  app.delete('/api/admin/curricula/:id', async (req, res) => {
    const row = await db.curriculum.findUnique({
      where: { id: String(req.params.id) },
      include: { _count: { select: { profiles: true } } },
    });
    if (!row) throw new HttpError(404, 'Curriculum not found.');
    if (row.published || row._count.profiles)
      throw new HttpError(409, 'Only unused drafts can be deleted.');
    await db.curriculum.delete({ where: { id: row.id } });
    res.status(204).end();
  });
  const instructorInput = z
    .object({
      name: z.string().trim().min(1).max(120),
      department: z.string().trim().min(1).max(120),
      sourceUrl: z.string().url().max(1000).startsWith('https://'),
      verifiedAt: verificationDateSchema,
    })
    .strict();
  app.get('/api/admin/directory', async (_req, res) =>
    res.json({
      instructors: await db.instructor.findMany(),
      offerings: await db.offering.findMany({ include: { instructor: true } }),
    }),
  );
  app.post('/api/admin/instructors', async (req, res) => {
    const d = instructorInput.parse(req.body);
    res.status(201).json(
      await db.instructor.create({
        data: {
          ...d,
          verifiedAt: new Date(d.verifiedAt),
          reviewedBy: req.identity!.id,
          reviewedAt: new Date(),
        },
      }),
    );
  });
  app.put('/api/admin/instructors/:id', async (req, res) => {
    const d = instructorInput.parse(req.body);
    res.json(
      await db.instructor.update({
        where: { id: String(req.params.id) },
        data: {
          ...d,
          verifiedAt: new Date(d.verifiedAt),
          reviewedBy: req.identity!.id,
          reviewedAt: new Date(),
        },
      }),
    );
  });
  app.delete('/api/admin/instructors/:id', async (req, res) => {
    await db.instructor.delete({ where: { id: String(req.params.id) } });
    res.status(204).end();
  });
  const offeringInput = z
    .object({
      curriculumId: z.string().uuid(),
      code: z.string().min(1).max(30),
      term: z.string().trim().min(1).max(80),
      campus: z.string().min(1).max(60),
      section: z.string().min(1).max(30),
      schedule: z.string().max(300).nullable(),
      sourceUrl: z.string().url().max(1000).startsWith('https://'),
      verifiedAt: verificationDateSchema,
      instructorId: z.string().uuid().nullable(),
    })
    .strict();
  const saveOffering = async (req: Request, res: Response) => {
    const d = offeringInput.parse(req.body);
    const row = await db.curriculum.findUnique({ where: { id: d.curriculumId } });
    if (!row) throw new HttpError(400, 'Unknown curriculum.');
    const c = curriculumSchema.parse(row.document);
    if (!c.courses.some((c) => c.code === d.code) || !c.campuses.includes(d.campus))
      throw new HttpError(400, 'Unknown course or campus.');
    if (d.instructorId && !(await db.instructor.findUnique({ where: { id: d.instructorId } })))
      throw new HttpError(400, 'Unknown instructor.');
    const data = {
      ...d,
      verifiedAt: new Date(d.verifiedAt),
      reviewedBy: req.identity!.id,
      reviewedAt: new Date(),
    };
    res
      .status(req.method === 'POST' ? 201 : 200)
      .json(
        req.method === 'POST'
          ? await db.offering.create({ data })
          : await db.offering.update({ where: { id: String(req.params.id) }, data }),
      );
  };
  app.post('/api/admin/offerings', saveOffering);
  app.put('/api/admin/offerings/:id', saveOffering);
  app.delete('/api/admin/offerings/:id', async (req, res) => {
    await db.offering.delete({ where: { id: String(req.params.id) } });
    res.status(204).end();
  });
  app.use((_req, _res, next) => next(new HttpError(404, 'Route not found.')));
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError)
      return res
        .status(err.status)
        .json({ error: err.message, details: err.details, requestId: req.requestId });
    if (err instanceof ZodError)
      return res.status(400).json({
        error: 'Please check the submitted data.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        requestId: req.requestId,
      });
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002')
        return res
          .status(409)
          .json({ error: 'That record already exists.', requestId: req.requestId });
      if (err.code === 'P2025')
        return res.status(404).json({ error: 'Record not found.', requestId: req.requestId });
      if (err.code === 'P2034')
        return res.status(409).json({
          error: 'Data changed concurrently. Reload and retry.',
          requestId: req.requestId,
        });
    }
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      [400, 413].includes(Number(err.status))
    )
      return res.status(Number(err.status)).json({
        error: Number(err.status) === 413 ? 'Request is too large.' : 'Invalid JSON request.',
        requestId: req.requestId,
      });
    logger.error(
      {
        requestId: req.requestId,
        errorType: err instanceof Error ? err.name : 'unknown',
        event: 'request_failed',
        method: req.method,
        route: req.route?.path ?? 'unmatched',
        code:
          err instanceof Prisma.PrismaClientKnownRequestError ||
          err instanceof Prisma.PrismaClientInitializationError
            ? (('code' in err ? err.code : err.errorCode) ?? 'DATABASE_UNAVAILABLE')
            : 'UNEXPECTED_ERROR',
      },
      'request failed',
    );
    res.status(500).json({
      error: 'The request could not be completed. Please try again.',
      requestId: req.requestId,
    });
  });
  return { app, logger };
}
