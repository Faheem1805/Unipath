import { PrismaClient, Prisma } from '../generated/client/index.js';
import { demoCurriculum } from '@unipath/shared';
const db = new PrismaClient();
try {
  if (process.env.SEED_DEMO === 'false') {
    console.log('Demo seeding disabled.');
  } else {
    await db.curriculum.upsert({
      where: { slug: demoCurriculum.slug },
      update: {},
      create: {
        slug: demoCurriculum.slug,
        document: demoCurriculum as unknown as Prisma.InputJsonValue,
        published: true,
      },
    });
    console.log(
      'Fictional demonstration curriculum is available. Existing versions were preserved. No user accounts created.',
    );
  }
} finally {
  await db.$disconnect();
}
