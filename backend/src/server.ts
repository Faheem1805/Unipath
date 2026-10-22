import { PrismaClient } from '../generated/client/index.js';
import { createApp } from './app.js';
import { readConfig } from './config.js';
const config = readConfig();
const db = new PrismaClient();
const { app, logger } = createApp(db, config);
// Fail before listening when the schema or dependency is unavailable.
await db.$connect();
await db.curriculum.count();
const server = app.listen(config.PORT, '0.0.0.0', () =>
  logger.info({ event: 'started', port: config.PORT }, 'API listening'),
);
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
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
