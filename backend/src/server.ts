import { PrismaClient } from '../generated/client/index.js';
import { createApp } from './app.js';
import { readConfig } from './config.js';
const config = readConfig();
const db = new PrismaClient({ transactionOptions: { maxWait: 2000, timeout: 6000 } });
const { app, logger } = createApp(db, config);
// Fail before listening when the schema or dependency is unavailable.
try {
  await db.$connect();
  // Probe all generated model columns, including additive release migrations.
  await Promise.all([
    db.user.findFirst(),
    db.session.findFirst(),
    db.curriculum.findFirst(),
    db.profile.findFirst(),
    db.attempt.findFirst(),
    db.plan.findFirst(),
    db.instructor.findFirst(),
    db.offering.findFirst(),
    db.rateBucket.findFirst(),
  ]);
} catch (error) {
  const code =
    error && typeof error === 'object' && 'code' in error && /^P\d{4}$/.test(String(error.code))
      ? String(error.code)
      : 'DATABASE_STARTUP_FAILED';
  logger.fatal({ event: 'startup_failed', code }, 'database/schema check failed');
  await db.$disconnect();
  process.exit(1);
}
const server = app.listen(config.PORT, '0.0.0.0', () =>
  logger.info({ event: 'started', port: config.PORT }, 'API listening'),
);
server.requestTimeout = 10_000;
server.headersTimeout = 5_000;
server.setTimeout(10_000, (socket) => socket.destroy());
const cleanup = setInterval(
  () =>
    Promise.all([
      db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      db.rateBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]).catch(() => logger.warn({ event: 'cleanup_failed' }, 'maintenance retry required')),
  600_000,
);
cleanup.unref();
let closing = false;
function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  clearInterval(cleanup);
  logger.info({ event: 'shutdown', signal }, 'draining requests');
  const timer = setTimeout(() => {
    logger.error({ event: 'shutdown_timeout' }, 'forced shutdown');
    process.exit(1);
  }, 15_000);
  timer.unref();
  server.close(async () => {
    await db.$disconnect();
    clearTimeout(timer);
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
