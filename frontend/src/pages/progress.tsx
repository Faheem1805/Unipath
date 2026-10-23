import { useEffect, useState } from 'react';
import { Save, Search, Check, BookOpenCheck } from 'lucide-react';
import { type Attempt, type Course, gradeSchema, progress } from '@unipath/shared';
import { useAcademic } from '../lib/store';
import { Button, PageTitle, ErrorBox, Status } from '../components/common';
import { CourseDetail } from '../components/course-detail';
export function ProgressPage() {
  const s = useAcademic();
  const [draft, setDraft] = useState<Attempt[]>(s.attempts);
  const [term, setTerm] = useState(s.student?.profile?.currentTerm ?? 'Fall 2026');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const attemptKey = JSON.stringify(s.attempts);
  useEffect(() => {
    setDraft(s.attempts);
    setDirty(false);
  }, [attemptKey]);
  const stats = progress(s.curriculum, draft, [], s.student?.profile?.currentTerm);
  const courses = s.curriculum.courses.filter((c) =>
    `${c.code} ${c.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  function update(code: string, status: string, grade?: string) {
    const other = draft.filter((a) => !(a.code === code && a.term === term));
    const old = draft.find((a) => a.code === code && a.term === term);
    setDraft(
      status
        ? [
            ...other,
            {
              code,
              term,
              status: status as Attempt['status'],
              grade:
                grade === undefined
                  ? old?.status === status
                    ? old.grade
                    : null
                  : grade
                    ? (grade as Attempt['grade'])
                    : null,
            },
          ]
        : other,
    );
    setDirty(true);
  }
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await s.saveAttempts(draft);
      setDirty(false);
      s.notify('Course records saved. Your map and dashboard are up to date.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="EVERY COURSE TELLS A STORY"
        title="Make your progress yours."
        description="Add courses you’ve completed or are taking. Repeated attempts stay separate; degree credits count once."
        action={
          <Button disabled={!dirty || busy} onClick={save}>
            <Save size={16} />
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />
      <div className="compact-metrics">
        <span>
          <Check size={17} />
          <strong>{stats.completedCredits}</strong> completed credits
        </span>
        <span>
          <BookOpenCheck size={17} />
          <strong>{stats.inProgressCredits}</strong> in progress
        </span>
        <span>
          <strong>{draft.length}</strong> recorded attempts
        </span>
        {dirty && <span className="unsaved-dot">Unsaved changes</span>}
      </div>
      <ErrorBox error={error} />
      <section className="panel">
        <div className="records-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search course records"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your courses…"
            />
          </label>
          <label className="inline-field">
            Recording for
            <input
              aria-label="Academic term for records"
              value={term}
              maxLength={80}
              onChange={(e) => setTerm(e.target.value)}
              list="record-terms"
              required
            />
          </label>
          <datalist id="record-terms">
            {[...new Set(draft.map((a) => a.term))].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="notice-inline">
          Choose an existing term to edit it, or enter a new term to record a retake. Current
          semester never preselects completed courses.
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Credits</th>
                <th>Overall progress</th>
                <th>Status in {term || 'this term'}</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const a = draft.find((a) => a.code === c.code && a.term === term);
                return (
                  <tr key={c.code}>
                    <td>
                      <button className="table-course" onClick={() => setCourse(c)}>
                        <small>
                          {c.code}
                          {c.electiveGroup ? ' · Elective' : ''}
                        </small>
                        <strong>{c.title}</strong>
                      </button>
                    </td>
                    <td>{c.credits}</td>
                    <td>
                      <Status state={stats.states[c.code].state} />
                    </td>
                    <td>
                      <select
                        aria-label={`Status ${c.code}`}
                        value={a?.status ?? ''}
                        disabled={!term.trim()}
                        onChange={(e) => update(c.code, e.target.value)}
                      >
                        <option value="">No attempt</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="IN_PROGRESS">Currently taking</option>
                        <option value="FAILED">Failed / non-credit</option>
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Grade ${c.code}`}
                        disabled={!a || a.status === 'IN_PROGRESS'}
                        value={a?.grade ?? ''}
                        onChange={(e) => update(c.code, a!.status, e.target.value)}
                      >
                        <option value="">Not entered</option>
                        {gradeSchema.options
                          .filter((g) =>
                            a?.status === 'COMPLETED'
                              ? !['F', 'FA', 'W', 'I', 'CA'].includes(g)
                              : ['F', 'FA', 'W', 'I', 'CA'].includes(g),
                          )
                          .map((g) => (
                            <option key={g}>{g}</option>
                          ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!courses.length && <p className="panel-pad muted">No courses match your search.</p>}
        </div>
        <div className="table-footer">
          <span>
            {courses.length} courses · {draft.length} attempts
          </span>
          <Button disabled={!dirty || busy || !term.trim()} onClick={save}>
            <Save size={15} />
            Save course records
          </Button>
        </div>
      </section>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Your attempt history</h2>
            <p>Select a term above to edit or remove an individual record.</p>
          </div>
        </div>
        <div className="attempt-chips">
          {draft.length ? (
            draft.map((a, i) => (
              <button key={`${a.code}-${a.term}-${i}`} onClick={() => setTerm(a.term)}>
                <strong>{a.code}</strong>
                <span>{a.term}</span>
                <small>
                  {a.status.replace('_', ' ').toLowerCase()}
                  {a.grade ? ` · ${a.grade}` : ''}
                </small>
              </button>
            ))
          ) : (
            <p className="muted">A fresh start. Add your first course above.</p>
          )}
        </div>
      </section>
      <CourseDetail course={course} onClose={() => setCourse(null)} />
    </>
  );
}
