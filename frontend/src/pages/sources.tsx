import { Link } from 'react-router-dom';
import { ExternalLink, ShieldCheck, AlertCircle, FileCheck2 } from 'lucide-react';
import { gradingSource } from '@unipath/shared';
import { useAcademic } from '../lib/store';
import { Logo, PageTitle } from '../components/common';
const sources = [
  [
    'AAU Software Engineering program',
    'https://engineering.aau.ac.ae/en/programs/bachelor-of-science-in-software-engineering/',
    'Confirms the degree, 124-credit total, both campuses and a public study-plan table. Admission-year applicability is unspecified.',
  ],
  [
    'Linked guidance plan',
    'https://engineering.aau.ac.ae/uploads/editor/source/engineering/guidance_plan/Software_Engineering_Guidance_Plan.pdf',
    'Public sequencing diagram. No curriculum year is identified; it is not silently merged with other versions.',
  ],
  [
    'Linked course descriptions',
    'https://engineering.aau.ac.ae/uploads/editor/source/engineering/course_description/Software_Engineering_Program.pdf',
    'Descriptions for some specialization courses. The application does not invent missing descriptions.',
  ],
  [
    'AAU undergraduate grading system',
    gradingSource,
    'Published numeric scale supports the GPA calculator. Repeated-attempt replacement and FA treatment need registrar confirmation.',
  ],
];
export function Sources({ standalone = false }: { standalone?: boolean }) {
  const { curriculum } = useAcademic();
  const content = (
    <>
      <PageTitle
        eyebrow="CLARITY INCLUDES THE FINE PRINT"
        title="Know what your plan is built on."
        description="Academic decisions deserve traceable data. Here’s what is verified, what is fictional, and what still needs review."
      />
      <div className="sources-overview">
        <section className="panel panel-pad">
          <span className="metric-icon amber">
            <AlertCircle size={22} />
          </span>
          <h2>Current curriculum: {curriculum.verification.toLowerCase()}</h2>
          <p>{curriculum.verificationNote}</p>
          <p>
            Suggested semesters, example course codes, elective groups and prerequisite rules in the
            demo are fictional. Your current semester never determines which courses you have
            completed.
          </p>
        </section>
        <section className="panel panel-pad">
          <span className="metric-icon green">
            <ShieldCheck size={22} />
          </span>
          <h2>Verified public facts</h2>
          <p>
            AAU lists its BSc Software Engineering degree at 124 credits and offers it in Abu Dhabi
            and Al Ain. The public page also lists a minimum graduation GPA of 2.0 and a 12-week
            internship.
          </p>
          <p>
            These facts alone do not establish a curriculum for your admission year. A partial fact
            review is included with the source files.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>The source trail</h2>
            <p>Reviewed October 22, 2026. Public university sources only.</p>
          </div>
          <FileCheck2 size={22} />
        </div>
        {sources.map(([name, url, note]) => (
          <a className="source-card" href={url} key={url} target="_blank" rel="noreferrer">
            <span>
              <strong>{name}</strong>
              <p>{note}</p>
              <small>Official AAU source</small>
            </span>
            <ExternalLink size={18} />
          </a>
        ))}
      </section>
      <section className="panel panel-pad limitations">
        <h2>A plan is a conversation starter.</h2>
        <p>
          UniPath is an independent student-built project and is not affiliated with, endorsed by,
          or an official service of Al Ain University. It does not access private student portals.
        </p>
        <ul>
          <li>
            Confirm your admission-year curriculum and transfer equivalencies with your adviser.
          </li>
          <li>
            Eligibility checks evaluate only recorded academic rules. They do not confirm offerings,
            timetable fit or permission to register.
          </li>
          <li>
            Instructor and timetable information appears only when verified for a specific term.
          </li>
          <li>
            Semester estimates assume successful completion and course availability. They are
            scenarios, not graduation promises.
          </li>
          <li>
            The GPA calculator uses published grade points, with clearly identified assumptions for
            repeated attempts.
          </li>
        </ul>
      </section>
    </>
  );
  return standalone ? (
    <div className="public-sources">
      <header>
        <Logo />
        <Link to="/">Back to home</Link>
      </header>
      {content}
    </div>
  ) : (
    content
  );
}
