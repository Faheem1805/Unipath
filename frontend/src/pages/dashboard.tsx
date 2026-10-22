import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  BookOpen,
  Layers,
  Sparkles,
  GitBranch,
  CalendarDays,
  Clock3,
  Target,
} from 'lucide-react';
import { futureSequence, type Course } from '@unipath/shared';
import { useAcademic } from '../lib/store';
import { Button, PageTitle, CourseList, Status } from '../components/common';
import { CourseDetail } from '../components/course-detail';
export function Dashboard() {
  const { curriculum, stats, student, isGuest, user, attempts } = useAcademic();
  const [selected, setSelected] = useState<Course | null>(null);
  const sequence = futureSequence(curriculum, attempts);
  const taking = curriculum.courses.filter((c) => stats.states[c.code].state === 'taking');
  const firstName = isGuest ? 'Jamie' : user?.name.split(' ')[0];
  return (
    <>
      <PageTitle
        eyebrow="YOUR PATH, IN PERSPECTIVE"
        title={`A little clearer, ${firstName}.`}
        description="Here’s where you are, and where you can go next."
        action={
          <Button variant="outline" asChild>
            <Link to="/app/flowchart">
              <GitBranch size={16} />
              Open degree map <ArrowUpRight size={16} />
            </Link>
          </Button>
        }
      />
      <section className="overview-grid">
        <div className="progress-hero">
          <div className="progress-hero-copy">
            <span className="light-eyebrow">
              <span /> EVERY STEP COUNTS
            </span>
            <h2>
              Look how far
              <br />
              you’ve come.
            </h2>
            <p>
              {stats.completedCredits} credits behind you.
              <br />A world of possibility ahead.
            </p>
            <Link to="/app/progress">
              View your progress <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="ring-wrap">
            <svg
              viewBox="0 0 180 180"
              role="img"
              aria-label={`${stats.percentage} percent complete`}
            >
              <circle className="ring-track" cx="90" cy="90" r="75" />
              <circle
                className="ring-value"
                cx="90"
                cy="90"
                r="75"
                strokeDasharray={`${stats.percentage * 4.712} 471.2`}
              />
            </svg>
            <div>
              <strong>
                {stats.percentage}
                <span>%</span>
              </strong>
              <small>of your degree</small>
              <span className="ring-chip">
                <Check size={12} /> ON YOUR WAY
              </span>
            </div>
          </div>
          <span className="hero-watermark">✳</span>
        </div>
        <div className="degree-card">
          <div className="card-topline">
            <span className="small-icon">
              <BookOpen size={20} />
            </span>
            <span className="pill-neutral">MY DEGREE</span>
          </div>
          <h3>{curriculum.program}</h3>
          <p>
            {curriculum.university}
            <br />
            {student?.profile?.campus} campus
          </p>
          <div className="degree-card-bottom">
            <span>
              <small>CURRICULUM</small>
              <strong>
                {curriculum.verification === 'FICTIONAL'
                  ? 'Demonstration 2026'
                  : curriculum.version}
              </strong>
            </span>
            <Link to="/app/settings" aria-label="Edit degree preferences">
              <ArrowUpRight size={19} />
            </Link>
          </div>
        </div>
      </section>
      <section className="metric-grid">
        <div className="metric-card">
          <span className="metric-icon green">
            <Check size={18} />
          </span>
          <small>Completed credits</small>
          <div>
            <strong>{stats.completedCredits}</strong>
            <span>/ {curriculum.totalCredits}</span>
          </div>
          <p>Every course is a step forward</p>
        </div>
        <div className="metric-card">
          <span className="metric-icon blue">
            <Clock3 size={18} />
          </span>
          <small>In progress</small>
          <div>
            <strong>{stats.inProgressCredits}</strong>
            <span>credits</span>
          </div>
          <p>{taking.length} courses on your plate</p>
        </div>
        <div className="metric-card">
          <span className="metric-icon amber">
            <Layers size={18} />
          </span>
          <small>Remaining credits</small>
          <div>
            <strong>{stats.remainingCredits}</strong>
            <span>credits</span>
          </div>
          <p>Includes your in-progress courses</p>
        </div>
        <div className="metric-card">
          <span className="metric-icon violet">
            <Target size={18} />
          </span>
          <small>Estimated semesters</small>
          <div>
            <strong>{sequence.unresolved ? '—' : sequence.semesters.length}</strong>
            <span>at up to 18 credits</span>
          </div>
          <p>Scenario only · availability unknown</p>
        </div>
      </section>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">THE NEXT OPEN DOOR</span>
              <h2>Ready when you are.</h2>
              <p>{stats.eligible.length} courses meet your prerequisites.</p>
            </div>
            <span className="count-badge">{stats.eligible.length}</span>
          </div>
          <CourseList courses={stats.eligible} onSelect={setSelected} limit={4} />
          {stats.eligible.length === 0 && (
            <p className="panel-pad muted">Add your completed courses to discover what’s next.</p>
          )}
          <Link className="panel-footer-link" to="/app/planner">
            Build your next semester <ArrowRight size={16} />
          </Link>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ONE STEP AT A TIME</span>
              <h2>In the works.</h2>
              <p>Your current course lineup.</p>
            </div>
            <span className="live-dot" />
          </div>
          <CourseList courses={taking} onSelect={setSelected} limit={4} />
          {taking.length === 0 && (
            <p className="panel-pad muted">No courses marked in progress yet.</p>
          )}
          <Link className="panel-footer-link" to="/app/progress">
            Update course records <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel elective-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ROOM TO EXPLORE</span>
              <h2>Electives, accounted for.</h2>
            </div>
            <Sparkles size={20} className="muted" />
          </div>
          {stats.groups.map((g) => (
            <div className="elective-row" key={g.id}>
              <div>
                <strong>{g.title}</strong>
                <span>
                  {g.completed} / {g.credits} credits
                </span>
              </div>
              <div className="bar-track">
                <span style={{ width: `${(100 * g.completed) / g.credits}%` }} />
              </div>
            </div>
          ))}
        </section>
        <section className="next-step-card">
          <span className="small-icon">
            <CalendarDays size={22} />
          </span>
          <div>
            <small>MAKE YOUR NEXT MOVE</small>
            <h3>
              A good semester
              <br />
              starts with a little planning.
            </h3>
            <p>
              {stats.remainingRequired.length} required courses remain. {stats.blocked.length}{' '}
              courses are still locked by requirements.
            </p>
            <Button asChild>
              <Link to="/app/planner">
                Explore your options <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
        </section>
      </div>
      <CourseDetail course={selected} onClose={() => setSelected(null)} />
    </>
  );
}
