import { describe, it, expect } from 'vitest';
import {
  evaluate,
  progress,
  gpa,
  futureSequence,
  curriculumSchema,
  demoCurriculum,
  demoAttempts,
  attemptSchema,
  prerequisiteChain,
} from '../../shared/src/index.js';
import { importCurriculum } from '../../backend/src/importer.js';
const ctx = { completed: new Set(['A']), concurrent: new Set(['B']), credits: 59 };
describe('deterministic requirements', () => {
  it('requires completed prerequisites, not current enrollment', () => {
    expect(evaluate({ type: 'course', code: 'B' }, ctx).ok).toBe(false);
    expect(evaluate({ type: 'course', code: 'A' }, ctx).ok).toBe(true);
  });
  it('evaluates nested AND/OR with explanatory failures', () => {
    const rule = {
      type: 'all' as const,
      items: [
        { type: 'course' as const, code: 'A' },
        {
          type: 'any' as const,
          items: [
            { type: 'course' as const, code: 'B' },
            { type: 'credits' as const, minimum: 60 },
          ],
        },
      ],
    };
    expect(evaluate(rule, ctx)).toEqual({
      ok: false,
      reasons: ['One of: Complete B OR Earn 60 degree credits (59 earned)'],
    });
    expect(evaluate(rule, { ...ctx, credits: 60 }).ok).toBe(true);
  });
  it('supports concurrent corequisites and exact credit thresholds', () => {
    expect(evaluate({ type: 'corequisite', code: 'B' }, ctx).ok).toBe(true);
    expect(evaluate({ type: 'credits', minimum: 60 }, ctx).ok).toBe(false);
    expect(evaluate({ type: 'credits', minimum: 59 }, ctx).ok).toBe(true);
  });
  it('never invents approval', () =>
    expect(evaluate({ type: 'approval', label: 'Department permission' }, ctx).ok).toBe(false));
});
describe('degree accounting', () => {
  it('counts completed repeats once and caps elective groups', () => {
    const attempts = [
      ...demoAttempts,
      { code: 'CS101', term: 'Retake', status: 'COMPLETED' as const, grade: 'A' as const },
      { code: 'HU102', term: 'Extra elective', status: 'COMPLETED' as const, grade: 'A' as const },
    ];
    expect(progress(demoCurriculum, attempts).completedCredits).toBe(64);
    expect(progress(demoCurriculum, attempts).remainingCredits).toBe(60);
    expect(progress(demoCurriculum, attempts).inProgressCredits).toBe(12);
  });
  it('does not count failed or enrolled courses as completed', () => {
    const p = progress(demoCurriculum, [
      { code: 'CS101', status: 'FAILED', grade: 'F', term: 'Fall' },
      { code: 'MA101', status: 'IN_PROGRESS', grade: null, term: 'Fall' },
    ]);
    expect(p.completedCredits).toBe(0);
    expect(p.inProgressCredits).toBe(3);
    expect(p.states.CS102.state).toBe('locked');
  });
  it('finishes at exactly 124 even with all alternative electives completed', () => {
    const p = progress(
      demoCurriculum,
      demoCurriculum.courses.map((c) => ({
        code: c.code,
        status: 'COMPLETED',
        term: 'All',
        grade: null,
      })),
    );
    expect(p.completedCredits).toBe(124);
    expect(p.percentage).toBe(100);
    expect(p.remainingCredits).toBe(0);
  });
  it('does not count more in-progress elective credits than still required', () => {
    const p = progress(demoCurriculum, [
      { code: 'HU101', term: 'A', status: 'IN_PROGRESS', grade: null },
      { code: 'HU102', term: 'A', status: 'IN_PROGRESS', grade: null },
    ]);
    expect(p.inProgressCredits).toBe(3);
  });
  it('can construct a legal complete sequence and respects each prior-term prerequisite', () => {
    const sequence = futureSequence(demoCurriculum, []);
    expect(sequence.unresolved).toBe(0);
    let attempts: any[] = [];
    for (const term of sequence.semesters) {
      expect(term.credits).toBeLessThanOrEqual(18);
      const p = progress(demoCurriculum, attempts);
      for (const c of term.courses)
        expect(
          evaluate(c.requirement, {
            completed: new Set(attempts.map((a) => a.code)),
            concurrent: new Set(term.courses.map((c) => c.code)),
            credits: p.completedCredits,
          }).ok,
        ).toBe(true);
      attempts.push(
        ...term.courses.map((c) => ({
          code: c.code,
          status: 'COMPLETED',
          term: 'prior',
          grade: null,
        })),
      );
    }
  });
  it('traces prerequisites without including unrelated courses', () => {
    const chain = prerequisiteChain(
      demoCurriculum.courses.find((c) => c.code === 'CS202')!,
      demoCurriculum,
    );
    expect(chain.has('CS101')).toBe(true);
    expect(chain.has('EN101')).toBe(false);
  });
});
describe('GPA', () => {
  it('weights credits, excludes transfer/pass and includes failed attempts', () => {
    expect(
      gpa([
        { code: 'A', credits: 3, grade: 'A' },
        { code: 'B', credits: 1, grade: 'F' },
        { code: 'T', credits: 6, grade: 'T' },
      ]).semester,
    ).toBe(3);
  });
  it('projects cumulative from actual quality points', () =>
    expect(
      gpa([{ code: 'A', credits: 3, grade: 'A' }], undefined, 'all', { credits: 9, points: 27 })
        .cumulative,
    ).toBe(3.25));
  it('makes repeat assumptions explicit and configurable', () => {
    const rows = [
      { code: 'A', credits: 3, grade: 'A' },
      { code: 'A', credits: 3, grade: 'F' },
    ];
    expect(gpa(rows, undefined, 'all').semester).toBe(2);
    expect(gpa(rows, undefined, 'latest').semester).toBe(0);
    expect(gpa(rows, undefined, 'best').semester).toBe(4);
  });
  it('handles no GPA credits and rejects malformed scales', () => {
    expect(gpa([]).semester).toBeNull();
    expect(() => gpa([], { A: 5 })).toThrow();
    expect(() => gpa([{ code: 'A', credits: -1, grade: 'A' }])).toThrow();
  });
});
describe('academic validation/import', () => {
  it('rejects missing references and cycles', () => {
    const doc = structuredClone(demoCurriculum);
    doc.courses[0].requirement = { type: 'course', code: 'MISSING' };
    expect(curriculumSchema.safeParse(doc).success).toBe(false);
    doc.courses[0].requirement = { type: 'course', code: 'CS102' };
    expect(curriculumSchema.safeParse(doc).success).toBe(false);
  });
  it('rejects totals, duplicate codes and untraceable verified data', () => {
    expect(curriculumSchema.safeParse({ ...demoCurriculum, totalCredits: 120 }).success).toBe(
      false,
    );
    expect(
      curriculumSchema.safeParse({
        ...demoCurriculum,
        courses: [...demoCurriculum.courses, demoCurriculum.courses[0]],
      }).success,
    ).toBe(false);
    expect(
      curriculumSchema.safeParse({ ...demoCurriculum, verification: 'VERIFIED' }).success,
    ).toBe(false);
  });
  it('rejects failing grades marked completed', () => {
    expect(
      attemptSchema.safeParse({ code: 'CS101', term: 'Fall', status: 'COMPLETED', grade: 'F' })
        .success,
    ).toBe(false);
  });
  it('imports full JSON atomically and valid CSV with metadata', () => {
    expect(importCurriculum('json', JSON.stringify(demoCurriculum)).totalCredits).toBe(124);
    const { courses, ...meta } = demoCurriculum;
    const csv = 'code,title,credits,semester,category\nA,Example course,3,1,Foundation';
    expect(
      importCurriculum('csv', csv, { ...meta, totalCredits: 3, groups: [] }).courses[0].code,
    ).toBe('A');
  });
  it('rejects malformed JSON and nested payloads', () => {
    expect(() => importCurriculum('json', '{broken')).toThrow();
    let deep: any = {};
    for (let i = 0; i < 25; i++) deep = { next: deep };
    expect(() => importCurriculum('json', JSON.stringify(deep))).toThrow('nesting');
  });
});
