import { PrismaClient } from '../generated/client/index.js';
// Only the production migration job enables this. Never run with the runtime credential.
if (process.env.GRANT_RUNTIME === 'true') {
  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO unipath_runtime',
    );
    await db.$executeRawUnsafe(
      'REVOKE ALL ON TABLE public._prisma_migrations FROM unipath_runtime',
    );
    await db.$executeRawUnsafe(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO unipath_runtime',
    );
  } finally {
    await db.$disconnect();
  }
}
