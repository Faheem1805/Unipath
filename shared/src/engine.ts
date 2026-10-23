import {
  grades,
  references,
  type Requirement,
  type Curriculum,
  type Attempt,
  type Course,
} from './schema.js';

export type Context = {
  completed: Set<string>;
  concurrent: Set<string>;
  credits: number;
  approvals?: Set<string>;
};
export function evaluate(
  rule: Requirement | null,
  ctx: Context,
): { ok: boolean; reasons: string[] } {
  if (!rule) return { ok: true, reasons: [] };
  let ok = false,
    reason = '';
  switch (rule.type) {
    case 'course':
      ok = ctx.completed.has(rule.code);
      reason = `Complete ${rule.code}`;
      break;
    case 'corequisite':
      ok = ctx.completed.has(rule.code) || ctx.concurrent.has(rule.code);
      reason = `Complete or take ${rule.code} in the same term`;
      break;
    case 'credits':
      ok = ctx.credits >= rule.minimum;
      reason = `Earn ${rule.minimum} degree credits (${ctx.credits} earned)`;
      break;
    case 'approval':
      ok = ctx.approvals?.has(rule.label) ?? false;
      reason = `Requires ${rule.label}; confirm with your adviser`;
      break;
    case 'all': {
      const parts = rule.items.map((r) => evaluate(r, ctx));
      return { ok: parts.every((p) => p.ok), reasons: parts.flatMap((p) => p.reasons) };
    }
    case 'any': {
      const parts = rule.items.map((r) => evaluate(r, ctx));
      const any = parts.some((p) => p.ok);
      return {
        ok: any,
        reasons: any ? [] : [`One of: ${parts.map((p) => p.reasons.join(' and ')).join(' OR ')}`],
      };
    }
  }
  return { ok, reasons: ok ? [] : [reason] };
}
export function ruleText(rule: Requirement | null): string {
  if (!rule) return 'No prerequisites';
  if (rule.type === 'course') return rule.code;
  if (rule.type === 'corequisite') return `${rule.code} (may be concurrent)`;
  if (rule.type === 'credits') return `${rule.minimum}+ completed credits`;
  if (rule.type === 'approval') return rule.label;
  return `(${rule.items.map(ruleText).join(rule.type === 'all' ? ' AND ' : ' OR ')})`;
}
function credited(curriculum: Curriculum, codes: Set<string>): number {
  const earned = curriculum.courses.filter((c) => codes.has(c.code));
  return (
    earned.filter((c) => !c.electiveGroup).reduce((s, c) => s + c.credits, 0) +
    curriculum.groups.reduce(
      (s, group) =>
        s +
        Math.min(
          group.credits,
          earned.filter((c) => c.electiveGroup === group.id).reduce((n, c) => n + c.credits, 0),
        ),
      0,
    )
  );
}
export type CourseState = 'completed' | 'taking' | 'eligible' | 'locked' | 'unplanned';
// Term identifiers are exact opaque labels. Enrollment only counts in the target term;
// selected courses never earn completed prerequisite credits.
export function termContext(
  curriculum: Curriculum,
  attempts: Attempt[],
  term?: string,
  selected: string[] = [],
): Context {
  const completed = new Set(attempts.filter((a) => a.status === 'COMPLETED').map((a) => a.code));
  return {
    completed,
    concurrent: new Set([
      ...selected,
      ...attempts.filter((a) => a.status === 'IN_PROGRESS' && a.term === term).map((a) => a.code),
    ]),
    credits: credited(curriculum, completed),
  };
}
export function progress(
  curriculum: Curriculum,
  attempts: Attempt[],
  planned: string[] = [],
  targetTerm?: string,
) {
  const completed = new Set(attempts.filter((a) => a.status === 'COMPLETED').map((a) => a.code));
  const taking = new Set(
    attempts
      .filter(
        (a) =>
          a.status === 'IN_PROGRESS' &&
          (!targetTerm || a.term === targetTerm) &&
          !completed.has(a.code),
      )
      .map((a) => a.code),
  );
  const completedCredits = credited(curriculum, completed);
  const inProgressCredits =
    credited(curriculum, new Set([...completed, ...taking])) - completedCredits;
  const groups = curriculum.groups.map((g) => ({
    ...g,
    completed: Math.min(
      g.credits,
      curriculum.courses
        .filter((c) => c.electiveGroup === g.id && completed.has(c.code))
        .reduce((n, c) => n + c.credits, 0),
    ),
  }));
  const states: Record<string, { state: CourseState; reasons: string[] }> = {};
  for (const c of curriculum.courses) {
    const check = evaluate(c.requirement, termContext(curriculum, attempts, targetTerm, planned));
    const groupMet =
      c.electiveGroup && groups.some((g) => g.id === c.electiveGroup && g.completed >= g.credits);
    const state: CourseState = completed.has(c.code)
      ? 'completed'
      : taking.has(c.code)
        ? 'taking'
        : groupMet
          ? 'unplanned'
          : check.ok
            ? 'eligible'
            : 'locked';
    states[c.code] = { state, reasons: check.reasons };
  }
  const eligible = curriculum.courses.filter((c) => states[c.code].state === 'eligible');
  const blocked = curriculum.courses.filter((c) => states[c.code].state === 'locked');
  const remainingRequired = curriculum.courses.filter(
    (c) => !c.electiveGroup && !completed.has(c.code),
  );
  return {
    completedCredits,
    inProgressCredits,
    remainingCredits: curriculum.totalCredits - completedCredits,
    percentage: Math.round((100 * completedCredits) / curriculum.totalCredits),
    groups,
    states,
    eligible,
    blocked,
    remainingRequired,
    minimumSemesters: Math.ceil(
      Math.max(0, curriculum.totalCredits - completedCredits - inProgressCredits) / 18,
    ),
  };
}
export function prerequisiteChain(course: Course, curriculum: Curriculum): Set<string> {
  const found = new Set<string>();
  const visit = (code: string) => {
    if (found.has(code)) return;
    found.add(code);
    const c = curriculum.courses.find((c) => c.code === code);
    if (c) references(c.requirement).forEach(visit);
  };
  visit(course.code);
  return found;
}
export function downstreamCount(code: string, curriculum: Curriculum): number {
  const found = new Set<string>();
  const visit = (id: string) =>
    curriculum.courses
      .filter((c) => references(c.requirement).includes(id))
      .forEach((c) => {
        if (c.code !== code && !found.has(c.code)) {
          found.add(c.code);
          visit(c.code);
        }
      });
  visit(code);
  return found.size;
}
// A bounded, deterministic heuristic. This is not a registration guarantee or an optimal solver.
export function futureSequence(curriculum: Curriculum, attempts: Attempt[], maxCredits = 18) {
  let simulated = [...attempts];
  const semesters: { courses: Course[]; credits: number }[] = [];
  const risks = curriculum.courses
    .filter((c) => progress(curriculum, attempts).states[c.code].state !== 'completed')
    .map((c) => ({ course: c, unlocks: downstreamCount(c.code, curriculum) }))
    .filter((c) => c.unlocks > 0)
    .sort((a, b) => b.unlocks - a.unlocks)
    .slice(0, 4);
  for (let i = 0; i < 20; i++) {
    const p = progress(curriculum, simulated);
    if (!p.remainingCredits) break;
    const candidates = curriculum.courses
      .filter((c) => !['completed', 'unplanned'].includes(p.states[c.code].state))
      .sort(
        (a, b) =>
          downstreamCount(b.code, curriculum) - downstreamCount(a.code, curriculum) ||
          a.semester - b.semester ||
          a.code.localeCompare(b.code),
      );
    const selected: Course[] = [];
    let credits = 0;
    for (const c of candidates) {
      if (selected.some((x) => x.code === c.code)) continue;
      const completed = new Set(
        simulated.filter((a) => a.status === 'COMPLETED').map((a) => a.code),
      );
      // Branch locally for OR rules; bound work because this is a projection heuristic.
      let budget = 256;
      const expand = (r: Requirement | null, batch: Course[]): Course[][] => {
        if (--budget < 0) return [];
        const ctx = {
          completed,
          concurrent: new Set([...selected, ...batch].map((x) => x.code)),
          credits: p.completedCredits,
        };
        if (evaluate(r, ctx).ok) return [batch];
        if (!r) return [batch];
        if (r.type === 'any') return r.items.flatMap((part) => expand(part, [...batch]));
        if (r.type === 'all')
          return r.items.reduce<Course[][]>(
            (batches, part) => batches.flatMap((b) => expand(part, b)),
            [batch],
          );
        if (r.type !== 'corequisite') return [];
        const partner = candidates.find((x) => x.code === r.code);
        return partner ? expand(partner.requirement, [...batch, partner]) : [];
      };
      for (const bundle of expand(c.requirement, [c])) {
        const concurrent = new Set([...selected, ...bundle].map((x) => x.code));
        const ctx = {
          completed: new Set(simulated.filter((a) => a.status === 'COMPLETED').map((a) => a.code)),
          concurrent,
          credits: p.completedCredits,
        };
        const bundleCredits = bundle.reduce((n, x) => n + x.credits, 0);
        const groupsFit = curriculum.groups.every((g) => {
          const added = [...selected, ...bundle]
            .filter((x) => x.electiveGroup === g.id)
            .reduce((n, x) => n + x.credits, 0);
          return added <= g.credits - (p.groups.find((x) => x.id === g.id)?.completed ?? 0);
        });
        if (
          credits + bundleCredits <= maxCredits &&
          groupsFit &&
          bundle.every((x) => evaluate(x.requirement, ctx).ok)
        ) {
          selected.push(...bundle);
          credits += bundleCredits;
          break;
        }
      }
    }
    if (!selected.length) break;
    semesters.push({ courses: selected, credits });
    simulated = [
      ...simulated,
      ...selected.map((c) => ({
        code: c.code,
        term: `Projection ${i + 1}`,
        status: 'COMPLETED' as const,
        grade: null,
      })),
    ];
  }
  const unresolved = progress(curriculum, simulated).remainingCredits;
  return { semesters, unresolved, risks };
}
export type GpaRow = { code: string; credits: number; grade: string };
export function gpa(
  rows: GpaRow[],
  scale: Record<string, number> = grades,
  repeatPolicy: 'all' | 'latest' | 'best' = 'all',
  previous?: { credits: number; points: number },
) {
  if (Object.values(scale).some((v) => !Number.isFinite(v) || v < 0 || v > 4))
    throw new Error('Grade points must be between 0 and 4.');
  let selected = rows;
  if (rows.some((r) => !Number.isFinite(r.credits) || r.credits <= 0 || r.credits > 6))
    throw new Error('Credits must be between 1 and 6.');
  if (
    previous &&
    (!Number.isFinite(previous.credits) ||
      !Number.isFinite(previous.points) ||
      previous.credits < 0 ||
      previous.points < 0 ||
      previous.points > previous.credits * 4)
  )
    throw new Error('Invalid previous GPA totals.');
  if (repeatPolicy !== 'all') {
    const map = new Map<string, GpaRow>();
    for (const row of rows) {
      if (!(row.grade in scale)) continue;
      const old = map.get(row.code);
      if (!old || repeatPolicy === 'latest' || scale[row.grade] > scale[old.grade])
        map.set(row.code, row);
    }
    selected = [...map.values()];
  }
  const included = selected.filter((r) => r.grade in scale);
  const credits = included.reduce((n, r) => n + r.credits, 0);
  const points = included.reduce((n, r) => n + r.credits * scale[r.grade], 0);
  return {
    credits,
    points,
    semester: credits ? points / credits : null,
    cumulative:
      credits + (previous?.credits ?? 0)
        ? (points + (previous?.points ?? 0)) / (credits + (previous?.credits ?? 0))
        : null,
  };
}
