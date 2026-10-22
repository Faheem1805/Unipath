import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Clock3,
  LockKeyhole,
  Circle,
  CircleDot,
  LoaderCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Course, CourseState } from '@unipath/shared';
import { useAcademic } from '../lib/store';
import { Button } from './ui/button';
import type { ReactNode } from 'react';
export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="UniPath home">
      <span className="logo-mark">
        u<span>↗</span>
      </span>
      uni<span>path</span>
      <i />
    </Link>
  );
}
export const stateLabels: Record<CourseState, string> = {
  completed: 'Completed',
  taking: 'In progress',
  eligible: 'Eligible',
  locked: 'Locked',
  unplanned: 'Not planned',
};
export function StateIcon({ state, size = 15 }: { state: CourseState; size?: number }) {
  const Icon = {
    completed: Check,
    taking: Clock3,
    eligible: CircleDot,
    locked: LockKeyhole,
    unplanned: Circle,
  }[state];
  return <Icon size={size} />;
}
export function Status({ state }: { state: CourseState }) {
  return (
    <span className={`status status-${state}`}>
      <StateIcon state={state} />
      {stateLabels[state]}
    </span>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <span>{error instanceof Error ? error.message : String(error)}</span>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      Loading your path…
    </div>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <CircleDot size={28} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function CourseList({
  courses,
  onSelect,
  limit,
}: {
  courses: Course[];
  onSelect?: (course: Course) => void;
  limit?: number;
}) {
  const { stats } = useAcademic();
  return (
    <div className="course-list">
      {courses.slice(0, limit).map((c) => (
        <button key={c.code} className="course-row" onClick={() => onSelect?.(c)}>
          <span className={`course-symbol symbol-${stats.states[c.code].state}`}>
            <StateIcon state={stats.states[c.code].state} size={18} />
          </span>
          <span className="course-main">
            <small>{c.code}</small>
            <strong>{c.title}</strong>
          </span>
          <span className="credit-pill">{c.credits} cr</span>
          <ArrowUpRight size={16} className="muted" />
        </button>
      ))}
    </div>
  );
}
export function DemoLabel() {
  const { curriculum, isGuest } = useAcademic();
  return (
    <div className="data-banner">
      <span className="data-dot" />
      <strong>
        {curriculum.verification === 'FICTIONAL'
          ? 'Fictional demo curriculum'
          : curriculum.verification === 'VERIFIED'
            ? 'Source-reviewed curriculum'
            : 'Unverified curriculum'}
      </strong>
      <span>
        {isGuest
          ? 'Guest changes stay in this browser tab.'
          : 'Independent planning aid. Confirm your requirements with an adviser.'}
      </span>
      <Link to="/app/sources">
        View sources <ArrowUpRight size={12} />
      </Link>
    </div>
  );
}
export { Button };
