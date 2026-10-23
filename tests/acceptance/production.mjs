// Executed on stdin inside the Linux runtime image. Uses only synthetic records.
import assert from 'node:assert/strict';
import { PrismaClient } from './backend/generated/client/index.js';
import { createApp } from './backend/dist/app.js';
import { readConfig } from './backend/dist/config.js';
const config = readConfig();
assert.equal(config.NODE_ENV, 'production');
assert.equal(config.TRUST_PROXY_HOPS, 1);
const db = new PrismaClient();
const { app } = createApp(db, config);
const server = app.listen(3001, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const email = 'production-probe@example.test';
try {
  const request = (origin) =>
    fetch('http://127.0.0.1:3001/api/auth/register', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', 'X-UniPath-Client': 'web' },
      body: JSON.stringify({
        email,
        name: 'Synthetic',
        password: 'synthetic-production-probe-password',
      }),
    });
  assert.equal((await request('http://staging.example.test')).status, 403);
  const registered = await request('https://staging.example.test');
  assert.equal(registered.status, 201);
  assert.match(registered.headers.get('set-cookie'), /; Secure/);
  assert.match(registered.headers.get('set-cookie'), /; HttpOnly/);
  assert.equal(
    registered.headers.get('access-control-allow-origin'),
    'https://staging.example.test',
  );
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await fetch('http://127.0.0.1:3001/api/student', { headers: { Cookie: cookie } })).status,
    200,
  );
  console.log(
    'Production runtime config, exact origins and Secure cookie attributes passed; TLS transport is not exercised.',
  );
} finally {
  await db.user.deleteMany({ where: { email } });
  await new Promise((r) => server.close(r));
  await db.$disconnect();
}
