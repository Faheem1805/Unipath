import { useState } from 'react';
import { Plus, Trash2, Calculator, ArrowUpRight } from 'lucide-react';
import { gpa, grades, gradeSchema, gradingSource, type GpaRow } from '@unipath/shared';
import { useAcademic } from '../lib/store';
import { Button, PageTitle, ErrorBox } from '../components/common';
export function Gpa() {
  const s = useAcademic();
  const [rows, setRows] = useState<GpaRow[]>([
    { code: 'Course 1', credits: 3, grade: 'A' },
    { code: 'Course 2', credits: 3, grade: 'B+' },
    { code: 'Course 3', credits: 3, grade: 'B' },
  ]);
  const [previousCredits, setPreviousCredits] = useState(0);
  const [previousGpa, setPreviousGpa] = useState(0);
  const [repeat, setRepeat] = useState<'all' | 'latest' | 'best'>('all');
  const [custom, setCustom] = useState(false);
  const [scaleText, setScaleText] = useState(JSON.stringify(grades, null, 2));
  let result: ReturnType<typeof gpa> | null = null,
    error: unknown = null;
  let scale: Record<string, number> = grades;
  try {
    if (custom) {
      const obj = JSON.parse(scaleText);
      if (
        !obj ||
        Array.isArray(obj) ||
        typeof obj !== 'object' ||
        !Object.keys(obj).length ||
        Object.values(obj).some((v) => typeof v !== 'number')
      )
        throw new Error('Enter a JSON object of grade names and numeric points.');
      scale = obj;
    }
    if (!Number.isFinite(previousGpa) || previousGpa < 0 || previousGpa > 4)
      throw new Error('Previous GPA must be between 0 and 4.');
    result = gpa(rows, scale, repeat, {
      credits: previousCredits,
      points: previousCredits * previousGpa,
    });
  } catch (e) {
    error = e;
  }
  function update(i: number, values: Partial<GpaRow>) {
    setRows(rows.map((r, index) => (index === i ? { ...r, ...values } : r)));
  }
  return (
    <>
      <PageTitle
        eyebrow="EXPLORE THE POSSIBILITIES"
        title="A little perspective on your GPA."
        description="Try a semester. Set a goal. See how your next results could shape the bigger picture."
      />
      <div className="gpa-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Semester courses</h2>
              <p>Use the same course code for repeated attempts.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setRows(
                  s.attempts
                    .filter((a) => a.grade)
                    .map((a) => ({
                      code: a.code,
                      credits: s.curriculum.courses.find((c) => c.code === a.code)?.credits ?? 3,
                      grade: a.grade!,
                    })),
                )
              }
            >
              Use recorded grades
            </Button>
          </div>
          <div className="table-scroll">
            <table className="gpa-table">
              <thead>
                <tr>
                  <th>Course code</th>
                  <th>Credits</th>
                  <th>Grade</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        aria-label={`GPA course ${i + 1}`}
                        value={r.code}
                        maxLength={30}
                        onChange={(e) => update(i, { code: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`GPA credits ${i + 1}`}
                        type="number"
                        min={1}
                        max={6}
                        value={r.credits}
                        onChange={(e) => update(i, { credits: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`GPA grade ${i + 1}`}
                        value={r.grade}
                        onChange={(e) => update(i, { grade: e.target.value })}
                      >
                        {[...new Set([...Object.keys(scale), ...gradeSchema.options])].map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Remove GPA course ${i + 1}`}
                        onClick={() => setRows(rows.filter((_, index) => i !== index))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-pad">
            <Button
              variant="outline"
              onClick={() =>
                setRows([...rows, { code: `Course ${rows.length + 1}`, credits: 3, grade: 'A' }])
              }
            >
              <Plus size={16} />
              Add a course
            </Button>
            <p className="fine-print">
              P, T, I, W and CA are excluded from GPA. FA is treated as 0 points for this
              projection; confirm its treatment with the registrar.
            </p>
          </div>
          <div className="gpa-options">
            <h3>Cumulative projection</h3>
            <div className="form-grid">
              <label>
                Previous GPA-bearing credits
                <input
                  aria-label="Previous credits"
                  type="number"
                  min={0}
                  max={300}
                  value={previousCredits}
                  onChange={(e) => setPreviousCredits(Number(e.target.value))}
                />
              </label>
              <label>
                Previous cumulative GPA
                <input
                  aria-label="Previous GPA"
                  type="number"
                  step="0.001"
                  min={0}
                  max={4}
                  value={previousGpa}
                  onChange={(e) => setPreviousGpa(Number(e.target.value))}
                />
              </label>
              <label className="span-two">
                Repeated attempts in this list
                <select value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}>
                  <option value="all">Include all attempts (projection assumption)</option>
                  <option value="latest">Use latest listed attempt</option>
                  <option value="best">Use best listed attempt</option>
                </select>
              </label>
            </div>
            <p className="fine-print">
              AAU’s repeat-replacement policy has not been verified. These options affect the
              entered list only. Aggregated previous credits cannot remove historical retake points.
              For repeat projections, enter all relevant attempts and set previous totals to zero.
            </p>
          </div>
        </section>
        <div>
          <section className="gpa-result">
            <span className="gpa-result-icon">
              <Calculator size={24} />
            </span>
            <span className="eyebrow">YOUR SEMESTER, PROJECTED</span>
            <strong className="gpa-value">
              {result?.semester?.toFixed(2) ?? '—'}
              <small>/ 4.00</small>
            </strong>
            <div className="gpa-result-divider" />
            <div className="gpa-subresult">
              <span>Projected cumulative</span>
              <strong>{result?.cumulative?.toFixed(2) ?? '—'}</strong>
            </div>
            <div className="gpa-subresult">
              <span>GPA-bearing credits entered</span>
              <strong>{result?.credits ?? 0}</strong>
            </div>
            <div className="gpa-subresult">
              <span>Quality points entered</span>
              <strong>{result?.points.toFixed(1) ?? 0}</strong>
            </div>
          </section>
          <ErrorBox error={error} />
          <section className="panel scale-panel">
            <div className="panel-heading">
              <h3>Grading scale</h3>
              <span className="pill-neutral">{custom ? 'CUSTOM' : 'AAU PUBLIC SCALE'}</span>
            </div>
            <div className="grade-scale">
              {Object.entries(scale).map(([grade, points]) => (
                <span key={grade}>
                  <strong>{grade}</strong>
                  <small>{points.toFixed(1)}</small>
                </span>
              ))}
            </div>
            <div className="panel-pad">
              <a className="source-link" href={gradingSource} target="_blank" rel="noreferrer">
                Published AAU undergraduate scale <ArrowUpRight size={14} />
              </a>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={custom}
                  onChange={(e) => setCustom(e.target.checked)}
                />
                Use a custom scale
              </label>
              {custom && (
                <label>
                  Grade points JSON
                  <textarea
                    rows={10}
                    value={scaleText}
                    onChange={(e) => setScaleText(e.target.value)}
                  />
                </label>
              )}
              <p className="fine-print">
                Planning estimate only. Your official transcript determines your GPA.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
