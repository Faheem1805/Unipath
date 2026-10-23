import { useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { type Course } from '@unipath/shared';
import { useAcademic } from '../lib/store';
import { PageTitle, Status, Empty, stateLabels } from '../components/common';
import { CourseDetail } from '../components/course-detail';
export function Courses() {
  const { curriculum, stats } = useAcademic();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [state, setState] = useState('all');
  const [selected, setSelected] = useState<Course | null>(null);
  const courses = curriculum.courses.filter(
    (c) =>
      `${c.title} ${c.code}`.toLowerCase().includes(search.toLowerCase()) &&
      (category === 'all' || c.category === category) &&
      (state === 'all' || stats.states[c.code].state === state),
  );
  return (
    <>
      <PageTitle
        eyebrow="A WORLD OF POSSIBILITIES"
        title="Find your next curiosity."
        description="Explore courses, understand requirements, and see where each one could take you."
      />
      <div className="explorer-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search course explorer"
            placeholder="Search by course name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <SlidersHorizontal size={17} className="muted" />
        <select
          aria-label="Filter course category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {[...new Set(curriculum.courses.map((c) => c.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Filter eligibility"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="all">All states</option>
          {Object.entries(stateLabels).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <p className="results-label">
        <strong>{courses.length}</strong> courses to explore{' '}
        <span>· {curriculum.totalCredits} degree credits required</span>
      </p>
      <div className="course-grid">
        {courses.map((c) => (
          <button className="explorer-card" key={c.code} onClick={() => setSelected(c)}>
            <div>
              <span className="course-category">{c.category}</span>
              <ArrowUpRight size={17} />
            </div>
            <small>{c.code}</small>
            <h3>{c.title}</h3>
            <p>
              {c.credits} credits <span>·</span> Suggested semester {c.semester}
            </p>
            <footer>
              <Status state={stats.states[c.code].state} />
              {c.electiveGroup && <span className="elective-tag">Elective</span>}
            </footer>
          </button>
        ))}
      </div>
      {!courses.length && (
        <Empty title="No courses found">Try a different search or clear a filter.</Empty>
      )}
      <CourseDetail course={selected} onClose={() => setSelected(null)} />
    </>
  );
}
