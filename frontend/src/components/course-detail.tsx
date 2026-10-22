import { useState } from 'react';
import { BookOpen, ArrowRight, GitBranch } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { type Course, ruleText, references } from '@unipath/shared';
import { Modal } from './ui/dialog';
import { Button, Status, ErrorBox } from './common';
import { useAcademic } from '../lib/store';
import { api } from '../lib/api';
export type Offering = {
  id: string;
  code: string;
  term: string;
  section: string;
  schedule: string | null;
  instructor: { name: string } | null;
  sourceUrl: string;
  verifiedAt: string;
};
export function CourseDetail({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const { stats, attempts, saveAttempts, student, isGuest, notify } = useAcademic();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const offerings = useQuery({
    queryKey: [
      'offerings',
      student?.profile?.curriculumId,
      student?.profile?.currentTerm,
      student?.profile?.campus,
    ],
    queryFn: () =>
      api<Offering[]>(
        `/offerings?curriculumId=${student!.profile!.curriculumId}&term=${encodeURIComponent(student!.profile!.currentTerm)}&campus=${encodeURIComponent(student!.profile!.campus)}`,
      ),
    enabled: !!course && !isGuest && !!student?.profile,
  });
  if (!course) return null;
  const state = stats.states[course.code].state;
  const related = offerings.data?.filter((o) => o.code === course.code) ?? [];
  async function mark(status: 'COMPLETED' | 'IN_PROGRESS' | 'CLEAR') {
    setBusy(true);
    setError(null);
    const term = student?.profile?.currentTerm ?? 'Fall 2026';
    let next = attempts.filter(
      (a) => !(a.code === course!.code && (a.term === term || status === 'CLEAR')),
    );
    if (status !== 'CLEAR') next = [...next, { code: course!.code, term, status, grade: null }];
    try {
      await saveAttempts(next);
      notify('Course progress updated.');
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={!!course}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={course.title}
      description={`${course.code} · ${course.category}`}
    >
      <div className="detail-summary">
        <span className="detail-icon">
          <BookOpen />
        </span>
        <div>
          <strong>{course.credits} credit hours</strong>
          <p>
            Suggested semester {course.semester}
            {course.electiveGroup ? ' · Elective option' : ''}
          </p>
        </div>
        <Status state={state} />
      </div>
      <div className="detail-section">
        <h3>
          <GitBranch size={16} /> Prerequisites
        </h3>
        <p>{ruleText(course.requirement)}</p>
        {stats.states[course.code].reasons.length > 0 && (
          <div className="reason-box">
            {stats.states[course.code].reasons.map((r) => (
              <p key={r}>
                <ArrowRight size={13} />
                {r}
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="detail-section">
        <h3>About this course</h3>
        <p>{course.description ?? 'A verified course description is not available.'}</p>
      </div>
      <div className="detail-section">
        <h3>Sections · {student?.profile?.currentTerm}</h3>
        {offerings.error ? (
          <ErrorBox error={offerings.error} />
        ) : related.length ? (
          related.map((o) => (
            <div className="offering" key={o.id}>
              <strong>
                Section {o.section} · {o.instructor?.name ?? 'Instructor unavailable'}
              </strong>
              <p>{o.schedule ?? 'Timetable unavailable'}</p>
              <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                Verified source
              </a>
            </div>
          ))
        ) : (
          <p>
            No verified instructor, section or timetable information is available for this term.
            Eligibility does not confirm availability.
          </p>
        )}
      </div>
      {course.sources.length > 0 && (
        <div className="detail-section">
          <h3>Sources</h3>
          {course.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
              {s.note || 'Course source'}
            </a>
          ))}
        </div>
      )}
      <ErrorBox error={error} />
      <div className="detail-actions">
        <Button disabled={busy} onClick={() => mark('COMPLETED')}>
          Mark completed
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => mark('IN_PROGRESS')}>
          Currently taking
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => mark('CLEAR')}>
          Clear history
        </Button>
      </div>
      <p className="fine-print">
        Marking completed is a self-reported record. Use Progress & records to enter grades or
        retain individual retakes. Clearing removes all attempts for this course.
      </p>
    </Modal>
  );
}
