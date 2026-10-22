import { z } from 'zod';

export type Requirement =
  | { type: 'course'; code: string }
  | { type: 'corequisite'; code: string }
  | { type: 'credits'; minimum: number }
  | { type: 'approval'; label: string }
  | { type: 'all' | 'any'; items: Requirement[] };
const code = z
  .string()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9_-]+$/);
export const requirementSchema: z.ZodType<Requirement> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal('course'), code }).strict(),
    z.object({ type: z.literal('corequisite'), code }).strict(),
    z.object({ type: z.literal('credits'), minimum: z.number().int().min(1).max(300) }).strict(),
    z.object({ type: z.literal('approval'), label: z.string().min(1).max(120) }).strict(),
    z
      .object({ type: z.enum(['all', 'any']), items: z.array(requirementSchema).min(1).max(20) })
      .strict(),
  ]),
);
export const sourceSchema = z.object({
  url: z.string().url().max(1000).startsWith('https://'),
  note: z.string().max(500),
});
export const courseSchema = z
  .object({
    code,
    title: z.string().min(2).max(160),
    credits: z.number().int().min(1).max(6),
    semester: z.number().int().min(1).max(16),
    category: z.string().min(1).max(60),
    electiveGroup: z.string().max(60).nullable().default(null),
    description: z.string().max(3000).nullable().default(null),
    requirement: requirementSchema.nullable().default(null),
    sources: z.array(sourceSchema).max(10).default([]),
  })
  .strict();
export type Course = z.infer<typeof courseSchema>;
export const groupSchema = z
  .object({ id: code, title: z.string().min(1).max(100), credits: z.number().int().min(1).max(60) })
  .strict();
export function references(rule: Requirement | null, includeCorequisites = true): string[] {
  if (!rule) return [];
  if (rule.type === 'course' || (rule.type === 'corequisite' && includeCorequisites))
    return [rule.code];
  if (rule.type === 'all' || rule.type === 'any')
    return rule.items.flatMap((r) => references(r, includeCorequisites));
  return [];
}
export const curriculumSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/),
    university: z.string().min(2).max(160),
    program: z.string().min(2).max(160),
    version: z.string().min(1).max(120),
    admissionYear: z.number().int().min(2000).max(2100).nullable(),
    campuses: z.array(z.string().min(1).max(60)).min(1).max(10),
    totalCredits: z.number().int().min(1).max(300),
    verification: z.enum(['FICTIONAL', 'VERIFIED', 'UNVERIFIED']),
    verificationNote: z.string().min(10).max(2000),
    verifiedAt: z.string().date().nullable(),
    sources: z.array(sourceSchema).max(15),
    groups: z.array(groupSchema).max(20),
    courses: z.array(courseSchema).min(1).max(300),
  })
  .strict()
  .superRefine((data, ctx) => {
    const error = (message: string) => ctx.addIssue({ code: 'custom', message });
    const codes = new Set(data.courses.map((c) => c.code));
    if (codes.size !== data.courses.length) error('Course codes must be unique.');
    const groups = new Map(data.groups.map((g) => [g.id, g]));
    if (groups.size !== data.groups.length) error('Elective group IDs must be unique.');
    for (const course of data.courses) {
      if (course.electiveGroup && !groups.has(course.electiveGroup))
        error(`Unknown elective group on ${course.code}.`);
      for (const ref of references(course.requirement))
        if (!codes.has(ref) || ref === course.code)
          error(`Invalid prerequisite ${ref} on ${course.code}.`);
    }
    for (const group of data.groups) {
      const pool = data.courses.filter((c) => c.electiveGroup === group.id);
      if (pool.reduce((s, c) => s + c.credits, 0) < group.credits)
        error(`Insufficient elective credits in ${group.id}.`);
      let possible = new Set([0]);
      for (const course of pool)
        possible = new Set([...possible, ...[...possible].map((n) => n + course.credits)]);
      if (!possible.has(group.credits))
        error(`Elective group ${group.id} cannot reach its credit requirement exactly.`);
    }
    const total =
      data.courses.filter((c) => !c.electiveGroup).reduce((n, c) => n + c.credits, 0) +
      data.groups.reduce((n, g) => n + g.credits, 0);
    if (total !== data.totalCredits)
      error(`Requirements add to ${total}, not ${data.totalCredits} credits.`);
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const visit = (id: string): boolean => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      const cycle = references(
        data.courses.find((c) => c.code === id)?.requirement ?? null,
        false,
      ).some(visit);
      visiting.delete(id);
      visited.add(id);
      return cycle;
    };
    if (data.courses.some((c) => visit(c.code))) error('Prerequisite cycles are not allowed.');
    if (
      data.verification === 'VERIFIED' &&
      (!data.verifiedAt || !data.sources.length || data.courses.some((c) => !c.sources.length))
    )
      error('Verified curricula require verification date and sources for every course.');
  });
export type Curriculum = z.infer<typeof curriculumSchema>;
export const grades = { A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, 'D+': 1.5, D: 1, F: 0, FA: 0 };
export const gradeSchema = z.enum([
  'A',
  'B+',
  'B',
  'C+',
  'C',
  'D+',
  'D',
  'F',
  'FA',
  'P',
  'T',
  'W',
  'I',
  'CA',
]);
export const attemptSchema = z
  .object({
    id: z.string().optional(),
    code,
    term: z.string().min(1).max(80),
    status: z.enum(['COMPLETED', 'IN_PROGRESS', 'FAILED']),
    grade: gradeSchema.nullable().default(null),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.status === 'COMPLETED' && a.grade && ['F', 'FA', 'W', 'I', 'CA'].includes(a.grade))
      ctx.addIssue({
        code: 'custom',
        message: 'A non-passing grade cannot earn completed credits.',
      });
    if (a.status === 'IN_PROGRESS' && a.grade)
      ctx.addIssue({ code: 'custom', message: 'In-progress courses cannot have final grades.' });
    if (a.status === 'FAILED' && a.grade && !['F', 'FA', 'W', 'I', 'CA'].includes(a.grade))
      ctx.addIssue({ code: 'custom', message: 'Use completed status for a passing grade.' });
  });
export type Attempt = z.infer<typeof attemptSchema>;
export type StudentProfile = {
  curriculumId: string;
  campus: string;
  currentTerm: string;
  semester: number;
  revision: number;
};
export type CurriculumRecord = {
  id: string;
  published: boolean;
  document: Curriculum;
  revision: number;
};
