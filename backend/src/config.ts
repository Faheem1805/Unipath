import { z } from 'zod';
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const raw = z
    .object({
      DATABASE_URL: z.string().startsWith('postgresql://'),
      RATE_LIMIT_SECRET: z.string().min(32),
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      PORT: z.coerce.number().int().min(1).max(65535).default(3001),
      CORS_ORIGINS: z.string().default('http://localhost:5173'),
      COOKIE_NAME: z
        .string()
        .regex(/^[a-zA-Z0-9_]+$/)
        .default('unipath_session'),
      COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
      SESSION_HOURS: z.coerce.number().int().min(1).max(720).default(168),
      TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
      LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
      API_RATE_LIMIT: z.coerce.number().int().positive().default(300),
      AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(12),
    })
    .parse(env);
  const origins = raw.CORS_ORIGINS.split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!origins.length || origins.some((o) => new URL(o).origin !== o))
    throw new Error('CORS_ORIGINS must contain exact origins.');
  if (
    raw.NODE_ENV === 'production' &&
    (raw.COOKIE_SECURE !== 'true' ||
      origins.some((o) => !o.startsWith('https://')) ||
      raw.RATE_LIMIT_SECRET.includes('CHANGE_ME'))
  )
    throw new Error(
      'Production requires secure cookies, HTTPS origins, and a private rate-limit secret.',
    );
  return { ...raw, origins, secureCookie: raw.COOKIE_SECURE === 'true' };
}
export type Config = ReturnType<typeof readConfig>;
