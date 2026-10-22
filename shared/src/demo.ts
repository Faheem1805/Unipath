import { curriculumSchema, type Course, type Requirement, type Attempt } from './schema.js';
const pre = (code: string): Requirement => ({ type: 'course', code });
const all = (...items: Requirement[]): Requirement => ({ type: 'all', items });
const rows: [string, string, number, number, string, Requirement | null, string?][] = [
  ['CS101', 'Computing Foundations', 3, 1, 'Foundation', null],
  ['MA101', 'Calculus I', 3, 1, 'Mathematics', null],
  ['EN101', 'Academic English I', 3, 1, 'General education', null],
  ['PH101', 'Physics for Computing', 3, 1, 'Science', null],
  ['GE101', 'Culture and Society', 3, 1, 'General education', null],
  ['CS102', 'Programming I', 3, 2, 'Computing', pre('CS101')],
  ['MA102', 'Calculus II', 3, 2, 'Mathematics', pre('MA101')],
  ['MA103', 'Discrete Mathematics', 3, 2, 'Mathematics', null],
  ['EN102', 'Academic English II', 3, 2, 'General education', pre('EN101')],
  ['PH102', 'Experimental Physics Lab', 1, 2, 'Science', { type: 'corequisite', code: 'PH101' }],
  ['CS201', 'Object-Oriented Programming', 3, 3, 'Computing', pre('CS102')],
  ['SE201', 'Software Engineering Foundations', 3, 3, 'Software engineering', pre('CS101')],
  ['MA201', 'Linear Algebra', 3, 3, 'Mathematics', pre('MA101')],
  ['MA202', 'Probability and Statistics', 3, 3, 'Mathematics', pre('MA101')],
  ['GE201', 'Innovation and Entrepreneurship', 3, 3, 'General education', null],
  ['CS202', 'Data Structures and Algorithms', 3, 4, 'Computing', all(pre('CS201'), pre('MA103'))],
  ['CS203', 'Database Systems', 3, 4, 'Computing', pre('CS201')],
  ['CS204', 'Computer Organization', 3, 4, 'Computing', pre('MA103')],
  ['SE202', 'Requirements Engineering', 3, 4, 'Software engineering', pre('SE201')],
  ['GE202', 'Research Methods', 3, 4, 'General education', pre('EN102')],
  ['CS301', 'Operating Systems', 3, 5, 'Computing', pre('CS204')],
  ['SE301', 'Software Architecture', 3, 5, 'Software engineering', pre('SE202')],
  ['SE302', 'Formal Methods', 3, 5, 'Software engineering', all(pre('SE202'), pre('MA103'))],
  ['CS302', 'Web Engineering', 3, 5, 'Computing', pre('CS203')],
  ['CS303', 'Computer Networks', 3, 5, 'Computing', pre('CS204')],
  ['SE303', 'Software Testing', 3, 6, 'Software engineering', pre('SE301')],
  ['SE304', 'Human-Computer Interaction', 3, 6, 'Software engineering', pre('SE201')],
  ['SE305', 'Software Project Management', 3, 6, 'Software engineering', pre('SE201')],
  ['CS304', 'Artificial Intelligence', 3, 6, 'Computing', all(pre('CS202'), pre('MA202'))],
  ['GE301', 'Professional Ethics', 3, 6, 'General education', { type: 'credits', minimum: 60 }],
  ['SE401', 'Software Evolution', 3, 7, 'Software engineering', pre('SE303')],
  ['CS401', 'Distributed Systems', 3, 7, 'Computing', all(pre('CS301'), pre('CS303'))],
  ['SE402', 'Engineering Practice', 3, 7, 'Software engineering', { type: 'credits', minimum: 75 }],
  [
    'SE403',
    'Capstone Studio I',
    1,
    7,
    'Capstone',
    all(pre('SE301'), { type: 'credits', minimum: 90 }),
  ],
  ['SE404', 'Capstone Studio II', 2, 8, 'Capstone', pre('SE403')],
  ['SE405', 'Software Quality Assurance', 3, 8, 'Software engineering', pre('SE303')],
  ['CS402', 'Systems Security', 3, 8, 'Computing', pre('CS301')],
  ['SE406', 'Engineering Leadership', 3, 8, 'Software engineering', pre('SE305')],
  ['GE401', 'Technical Communication', 3, 8, 'General education', pre('EN102')],
  ['HU101', 'Introduction to Psychology', 3, 2, 'General elective', null, 'humanities'],
  ['HU102', 'Environmental Perspectives', 3, 2, 'General elective', null, 'humanities'],
  ['MG101', 'Leadership and Teamwork', 3, 3, 'General elective', null, 'management'],
  ['MG102', 'Critical Thinking', 3, 3, 'General elective', null, 'management'],
  [
    'EL401',
    'Cloud Application Patterns',
    3,
    7,
    'Major elective',
    { type: 'any', items: [pre('CS302'), pre('CS301')] },
    'major',
  ],
  ['EL402', 'Mobile Development', 3, 7, 'Major elective', pre('CS201'), 'major'],
  ['EL403', 'Data Engineering', 3, 8, 'Major elective', pre('CS203'), 'major'],
  ['EL404', 'Secure Software Design', 3, 8, 'Major elective', pre('SE301'), 'major'],
];
const courses: Course[] = rows.map(
  ([code, title, credits, semester, category, requirement, electiveGroup]) => ({
    code,
    title,
    credits,
    semester,
    category,
    requirement,
    electiveGroup: electiveGroup ?? null,
    description: null,
    sources: [],
  }),
);
export const demoCurriculum = curriculumSchema.parse({
  slug: 'aau-se-demo-2026',
  university: 'Al Ain University',
  program: 'BSc Software Engineering',
  version: 'Fictional demonstration · 2026',
  admissionYear: null,
  campuses: ['Abu Dhabi', 'Al Ain'],
  totalCredits: 124,
  verification: 'FICTIONAL',
  verificationNote:
    'Entirely fictional demonstration curriculum. Course codes, course requirements and sequencing are not official AAU academic requirements. Do not use for registration.',
  verifiedAt: null,
  sources: [],
  groups: [
    { id: 'humanities', title: 'Society & perspectives', credits: 3 },
    { id: 'management', title: 'Management & communication', credits: 3 },
    { id: 'major', title: 'Software engineering electives', credits: 6 },
  ],
  courses,
});
export const demoAttempts: Attempt[] = courses
  .filter((c) => c.semester <= 4 && (!c.electiveGroup || ['HU101', 'MG101'].includes(c.code)))
  .map((c) => ({
    code: c.code,
    term:
      c.semester % 2
        ? `Fall ${2023 + Math.floor(c.semester / 2)}`
        : `Spring ${2023 + Math.floor(c.semester / 2)}`,
    status: 'COMPLETED',
    grade: 'B+',
  }));
demoAttempts.push(
  ...['CS301', 'SE301', 'CS302', 'CS303'].map((code) => ({
    code,
    term: 'Fall 2026',
    status: 'IN_PROGRESS' as const,
    grade: null,
  })),
);
export const gradingSource =
  'https://www.studentaffairs.aau.ac.ae/en/admission/undergraduate/course-grading-system';
