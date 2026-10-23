import { describe, it, expect } from 'vitest';
import {
  curriculumSchema,
  demoCurriculum,
  evaluate,
  futureSequence,
  progress,
  termContext,
  verificationDateSchema,
  type Requirement,
  type Attempt,
} from '../../shared/src/index.js';
const fixture = (rules: (Requirement | null)[]) => ({
  ...demoCurriculum,
  totalCredits: rules.length * 3,
  groups: [],
  courses: rules.map((requirement, i) => ({
    ...demoCurriculum.courses[0],
    code: String.fromCharCode(65 + i),
    requirement,
  })),
});
describe('audit academic regressions', () => {
  it('projects A then B when A needs concurrent B OR already completed C', () => {
    const doc = fixture([
      {
        type: 'any',
        items: [
          { type: 'corequisite', code: 'B' },
          { type: 'course', code: 'C' },
        ],
      },
      { type: 'course', code: 'A' },
      null,
    ]);
    expect(curriculumSchema.safeParse(doc).success).toBe(true);
    const result = futureSequence(doc, [
      { code: 'C', term: 'Prior', status: 'COMPLETED', grade: null },
    ]);
    expect(result.unresolved).toBe(0);
    expect(result.semesters.map((s) => s.courses.map((c) => c.code))).toEqual([['A'], ['B']]);
  });
  it('tries another feasible OR bundle when the first branch has a strict unmet prerequisite', () => {
    const doc = fixture([
      {
        type: 'any',
        items: [
          { type: 'corequisite', code: 'B' },
          { type: 'corequisite', code: 'C' },
        ],
      },
      { type: 'course', code: 'A' },
      null,
    ]);
    const result = futureSequence(doc, []);
    expect(result.unresolved).toBe(0);
    expect(result.semesters[0].courses.map((c) => c.code).sort()).toEqual(['A', 'C']);
  });
  it('accepts C → A → B while rejecting unavoidable cycles and missing references in any branch', () => {
    const doc = fixture([
      {
        type: 'any',
        items: [
          { type: 'course', code: 'B' },
          { type: 'course', code: 'C' },
        ],
      },
      { type: 'course', code: 'A' },
      null,
    ]);
    expect(curriculumSchema.safeParse(doc).success).toBe(true);
    expect(futureSequence(doc, []).semesters.map((s) => s.courses.map((c) => c.code))).toEqual([
      ['C'],
      ['A'],
      ['B'],
    ]);
    doc.courses[2].requirement = { type: 'course', code: 'B' };
    expect(curriculumSchema.safeParse(doc).success).toBe(false);
    doc.courses[2].requirement = null;
    doc.courses[0].requirement = {
      type: 'any',
      items: [
        { type: 'course', code: 'MISSING' },
        { type: 'course', code: 'C' },
      ],
    };
    expect(curriculumSchema.safeParse(doc).success).toBe(false);
  });
  it('shares exact target-term and selection semantics across map progress and planner evaluation', () => {
    const doc = fixture([{ type: 'corequisite', code: 'B' }, null]);
    const attempts: Attempt[] = [{ code: 'B', status: 'IN_PROGRESS', term: 'Old', grade: null }];
    for (const [term, selected, eligible] of [
      ['Current', [], false],
      ['Old', [], true],
      ['Current', ['B'], true],
    ] as const) {
      expect(
        evaluate(doc.courses[0].requirement, termContext(doc, attempts, term, [...selected])).ok,
      ).toBe(eligible);
      expect(progress(doc, attempts, [...selected], term).states.A.state).toBe(
        eligible ? 'eligible' : 'locked',
      );
    }
    expect(termContext(doc, attempts, 'Old').credits).toBe(0);
  });
  it('rejects future verification using UTC dates and keeps demo fictional', () => {
    expect(verificationDateSchema.safeParse('2999-01-01').success).toBe(false);
    expect(verificationDateSchema.safeParse(new Date().toISOString().slice(0, 10)).success).toBe(
      true,
    );
    expect(demoCurriculum.verification).toBe('FICTIONAL');
    expect(demoCurriculum.verifiedAt).toBeNull();
  });
});
