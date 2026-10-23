import { useMemo, useState } from 'react';
import { CalendarDays, Plus, Check, Trash2, GitBranch, Save, AlertCircle } from 'lucide-react';
import { futureSequence, evaluate, termContext, progress, type Course } from '@unipath/shared';
import { useAcademic } from '../lib/store';
import { Button, PageTitle, ErrorBox, Status, Empty } from '../components/common';
export function Planner() {
  const s = useAcademic();
  const [codes, setCodes] = useState<string[]>([]);
  const [term, setTerm] = useState('Spring 2027');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [showSequence, setShowSequence] = useState(false);
  const sequence = useMemo(
    () => futureSequence(s.curriculum, s.attempts),
    [s.curriculum, s.attempts],
  );
  const context = termContext(s.curriculum, s.attempts, term, codes);
  const stats = progress(s.curriculum, s.attempts, codes, term);
  const check = (c: Course) => evaluate(c.requirement, context);
  const options = s.curriculum.courses.filter(
    (c) => !['completed', 'taking', 'unplanned'].includes(stats.states[c.code].state),
  );
  const chosen = s.curriculum.courses.filter((c) => codes.includes(c.code));
  const credits = chosen.reduce((n, c) => n + c.credits, 0);
  const invalid = chosen.filter((c) => !check(c).ok);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (!chosen.length || invalid.length || credits > 24)
        throw new Error('Choose eligible courses within the 24-credit planning limit.');
      await s.savePlan(term, codes);
      s.notify(`Your ${term} plan is saved.`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await s.deletePlan(id);
      s.notify('Plan deleted.');
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="INTENTION MEETS POSSIBILITY"
        title="Make room for what’s next."
        description="Build a proposed semester from your completed prerequisites. Plans never imply confirmed course availability."
        action={
          <Button variant="outline" onClick={() => setShowSequence(!showSequence)}>
            <GitBranch size={16} />
            {showSequence ? 'Hide' : 'Explore'} future sequence
          </Button>
        }
      />
      <div className="notice-box">
        <strong>Eligible is a starting point.</strong>
        <p>
          Current in-progress courses count as prerequisites only after you record a passing
          completion. Confirm offerings, timetable conflicts, approvals, and permitted course loads
          with your adviser.
        </p>
      </div>
      <ErrorBox error={error} />
      <div className="planner-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Your course options</h2>
              <p>Select courses to see how your semester adds up.</p>
            </div>
            <span className="count-badge">{options.length}</span>
          </div>
          <div className="planner-options">
            {options.map((c) => {
              const selected = codes.includes(c.code),
                result = check(c);
              return (
                <button
                  className={`planner-option ${selected ? 'selected' : ''}`}
                  key={c.code}
                  onClick={() =>
                    setCodes(selected ? codes.filter((x) => x !== c.code) : [...codes, c.code])
                  }
                  aria-pressed={selected}
                >
                  <span className="select-box">
                    {selected ? <Check size={15} /> : <Plus size={15} />}
                  </span>
                  <span>
                    <small>
                      {c.code} · {c.credits} cr{c.electiveGroup ? ' · Elective' : ''}
                    </small>
                    <strong>{c.title}</strong>
                    {!result.ok && <em>{result.reasons.join(' · ')}</em>}
                  </span>
                  <Status state={result.ok ? 'eligible' : 'locked'} />
                </button>
              );
            })}
            {!options.length && (
              <Empty title="Your path is up to date">
                Add records to reveal more course options.
              </Empty>
            )}
          </div>
        </section>
        <div className="plan-column">
          <section className="panel plan-summary">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">YOUR NEXT CHAPTER</span>
                <h2>Proposed semester</h2>
              </div>
              <CalendarDays size={22} />
            </div>
            <div className="panel-pad">
              <label>
                Academic term
                <input
                  value={term}
                  required
                  maxLength={80}
                  onChange={(e) => setTerm(e.target.value)}
                  aria-label="Plan academic term"
                />
              </label>
              <div className="plan-credit-total">
                <strong>{credits}</strong>
                <span>
                  planned credits<small>{chosen.length} selected courses</small>
                </span>
              </div>
              <div className="bar-track">
                <span style={{ width: `${Math.min(100, (credits / 18) * 100)}%` }} />
              </div>
              <p className="fine-print">
                18 credits is a scenario target, not an official AAU limit. Plans accept at most 24
                credits.
              </p>
              {chosen.map((c) => (
                <div className="chosen-course" key={c.code}>
                  <span>
                    <strong>{c.code}</strong>
                    <small>{c.title}</small>
                  </span>
                  <span>{c.credits} cr</span>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${c.code}`}
                    onClick={() => setCodes(codes.filter((x) => x !== c.code))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {invalid.length > 0 && (
                <div className="error-box">
                  <AlertCircle size={17} />
                  {invalid.length} selected courses have unmet requirements.
                </div>
              )}
              {credits > 24 && <ErrorBox error="Reduce the plan to 24 credits or fewer." />}
              <Button
                disabled={
                  busy || !term.trim() || !chosen.length || invalid.length > 0 || credits > 24
                }
                onClick={save}
              >
                <Save size={16} />
                {busy ? 'Saving…' : 'Save semester plan'}
              </Button>
            </div>
          </section>
          <section className="panel saved-plans">
            <div className="panel-heading">
              <h2>Saved plans</h2>
              <span className="count-badge">{s.student?.plans.length ?? 0}</span>
            </div>
            {s.student?.plans.length ? (
              s.student.plans.map((p) => (
                <div className="saved-plan" key={p.id}>
                  <div>
                    <strong>{p.term}</strong>
                    <small>
                      {p.courseCodes.length} courses ·{' '}
                      {p.courseCodes.reduce(
                        (n, code) =>
                          n + (s.curriculum.courses.find((c) => c.code === code)?.credits ?? 0),
                        0,
                      )}{' '}
                      credits
                    </small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setTerm(p.term);
                      setCodes(p.courseCodes);
                    }}
                  >
                    Open
                  </button>
                  <button
                    aria-label={`Delete ${p.term} plan`}
                    className="icon-button"
                    onClick={() => remove(p.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            ) : (
              <p className="panel-pad muted">Your next idea can start here.</p>
            )}
          </section>
        </div>
      </div>
      {showSequence && (
        <section className="panel sequence-panel">
          <div className="panel-heading">
            <div>
              <h2>One possible way forward</h2>
              <p>
                Assumes passing each selected course, up to 18 credits per term, with all courses
                available. This heuristic does not promise an optimal graduation date.
              </p>
            </div>
          </div>
          <div className="sequence-grid">
            {sequence.semesters.map((semester, i) => (
              <article key={i}>
                <span className="eyebrow">FUTURE TERM {i + 1}</span>
                <h3>{semester.credits} credits</h3>
                {semester.courses.map((c) => (
                  <p key={c.code}>
                    <strong>{c.code}</strong> {c.title}
                  </p>
                ))}
              </article>
            ))}
          </div>
          {sequence.unresolved > 0 && (
            <div className="notice-box">
              <strong>{sequence.unresolved} credits remain unresolved.</strong>
              <p>
                Approval rules, credit targets or unavailable prerequisite combinations require
                manual review.
              </p>
            </div>
          )}
          <div className="panel-pad">
            <h3>Keep an eye on these connections</h3>
            <p className="muted">
              Courses with the most downstream dependencies can affect many later options.
            </p>
            <div className="risk-grid">
              {sequence.risks.map((r) => (
                <div key={r.course.code}>
                  <GitBranch size={18} />
                  <span>
                    <strong>
                      {r.course.code} · {r.course.title}
                    </strong>
                    <small>
                      Connects to {r.unlocks} later courses, including alternative paths
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
