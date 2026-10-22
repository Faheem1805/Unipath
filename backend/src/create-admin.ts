import { PrismaClient } from '../generated/client/index.js';
import { z } from 'zod';
import { hashPassword } from './security.js';
// Credentials arrive on stdin, never command-line arguments or logs.
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const input = z
  .object({
    email: z
      .string()
      .email()
      .transform((s) => s.toLowerCase()),
    name: z.string().min(1).max(80),
    password: z.string().min(16).max(128),
  })
  .strict()
  .parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
const db = new PrismaClient();
try {
  await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: 'ADMIN',
    },
  });
  console.log('Administrator created.');
} finally {
  await db.$disconnect();
}
