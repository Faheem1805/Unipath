import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import {
  Plus,
  Save,
  Copy,
  Upload,
  Download,
  Trash2,
  ShieldCheck,
  FileJson,
  BookOpen,
  Users,
} from 'lucide-react';
import {
  type CurriculumRecord,
  type Curriculum,
  type Course,
  demoCurriculum,
} from '@unipath/shared';
import { useStore } from '../lib/store';
import { api, send, download } from '../lib/api';
import { Button, PageTitle, ErrorBox, Loading, Empty } from '../components/common';
import { Modal } from '../components/ui/dialog';
type AdminRecord = CurriculumRecord & { _count: { profiles: number } };
type Instructor = {
  id: string;
  name: string;
  department: string;
  sourceUrl: string;
  verifiedAt: string;
};
type OfferingInput = {
  curriculumId: string;
  code: string;
  term: string;
  campus: string;
  section: string;
  schedule: string | null;
  sourceUrl: string;
  verifiedAt: string;
  instructorId: string | null;
};
type Offering = OfferingInput & { id: string };
export function Admin() {
  const s = useStore();
  const cache = useQueryClient();
  const [tab, setTab] = useState('curricula');
  const [selected, setSelected] = useState<AdminRecord | null>(null);
  const [text, setText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [courseIndex, setCourseIndex] = useState<number | null>(null);
  const [courseText, setCourseText] = useState('');
  const records = useQuery({
    queryKey: ['admin-curricula'],
    queryFn: () => api<AdminRecord[]>('/admin/curricula'),
    enabled: s.user?.role === 'ADMIN' && !s.isGuest,
  });
  if (s.user?.role !== 'ADMIN' || s.isGuest) return <Navigate to="/app" replace />;
  let document: Curriculum | null = null;
  try {
    document = JSON.parse(text);
  } catch {}
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ['admin-curricula'] });
    await cache.invalidateQueries({ queryKey: ['curricula'] });
  }
  function choose(row: AdminRecord) {
    setSelected(row);
    setText(JSON.stringify(row.document, null, 2));
    setError(null);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function save(publish: boolean) {
    await run(async () => {
      if (!selected) throw new Error('Select a curriculum.');
      const updated = await api<AdminRecord>(
        `/admin/curricula/${selected.id}`,
        send('PUT', {
          document: JSON.parse(text),
          published: publish,
          revision: selected.revision,
        }),
      );
      choose({ ...updated, _count: selected._count });
      s.notify(publish ? 'Curriculum published.' : 'Draft saved.');
    });
  }
  async function clone() {
    if (!selected) return;
    await run(async () => {
      const doc = JSON.parse(text);
      doc.slug = `${doc.slug.slice(0, 35)}-${crypto.randomUUID().slice(0, 8)}`;
      doc.version = `${doc.version} · revision`.slice(0, 120);
      if (doc.verification === 'VERIFIED') {
        doc.verification = 'UNVERIFIED';
        doc.verifiedAt = null;
        doc.verificationNote = 'Cloned academic data requires source review before publication.';
      }
      const created = await api<AdminRecord>(
        '/admin/import',
        send('POST', { format: 'json', content: JSON.stringify(doc), publish: false }),
      );
      choose({ ...created, _count: { profiles: 0 } });
      s.notify('Editable draft created.');
    });
  }
  async function importFile() {
    await run(async () => {
      const row = await api<AdminRecord>(
        '/admin/import',
        send('POST', {
          format,
          content,
          ...(format === 'csv' ? { metadata: JSON.parse(metadata) } : {}),
          publish: false,
        }),
      );
      choose({ ...row, _count: { profiles: 0 } });
      setImportOpen(false);
      s.notify('Validated curriculum imported as a draft.');
    });
  }
  function editCourse(c: Course, index: number) {
    setCourse(c);
    setCourseIndex(index);
    setCourseText(JSON.stringify(c, null, 2));
  }
  return (
    <>
      <PageTitle
        eyebrow="KEEP THE FOUNDATION TRUSTWORTHY"
        title="Academic data, with care."
        description="Review sources, edit drafts, and publish distinct curriculum versions. Student records never change with an academic edit."
        action={
          <Button onClick={() => setImportOpen(true)}>
            <Upload size={16} />
            Import curriculum
          </Button>
        }
      />
      <div className="tab-bar">
        <button className={tab === 'curricula' ? 'active' : ''} onClick={() => setTab('curricula')}>
          <BookOpen size={16} />
          Curriculum versions
        </button>
        <button className={tab === 'directory' ? 'active' : ''} onClick={() => setTab('directory')}>
          <Users size={16} />
          Instructors & offerings
        </button>
      </div>
      <ErrorBox error={error} />
      {tab === 'curricula' ? (
        <div className="admin-grid">
          <section className="panel">
            <div className="panel-heading">
              <h2>Curriculum library</h2>
              <span className="count-badge">{records.data?.length ?? 0}</span>
            </div>
            {records.isPending ? (
              <Loading />
            ) : records.error ? (
              <ErrorBox error={records.error} />
            ) : (
              records.data?.map((row) => (
                <button
                  className={`version-item ${selected?.id === row.id ? 'selected' : ''}`}
                  key={row.id}
                  onClick={() => choose(row)}
                >
                  <strong>{row.document.version}</strong>
                  <span>{row.document.program}</span>
                  <small>
                    {row.published ? 'Published' : 'Draft'} ·{' '}
                    {row.document.verification.toLowerCase()} · {row._count.profiles} students
                  </small>
                </button>
              ))
            )}
            <div className="panel-pad">
              <Button
                variant="outline"
                size="sm"
                onClick={() => download('unipath-example-curriculum.json', demoCurriculum)}
              >
                <Download size={14} />
                Download import example
              </Button>
            </div>
          </section>
          <section className="panel admin-editor">
            {selected ? (
              <>
                <div className="panel-heading">
                  <div>
                    <h2>{selected.document.version}</h2>
                    <p>
                      {selected.published
                        ? 'Published academic content is immutable. Clone to edit.'
                        : 'Edit and validate before publishing.'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled={busy} onClick={clone}>
                    <Copy size={14} />
                    Clone
                  </Button>
                </div>
                <div className="panel-pad">
                  <div className="admin-version-info">
                    <span>{selected.document.verification}</span>
                    <span>Revision {selected.revision}</span>
                    <span>{document?.courses?.length ?? '—'} courses</span>
                  </div>
                  <label>
                    Complete curriculum document
                    <textarea
                      className="code-editor"
                      aria-label="Curriculum JSON editor"
                      rows={16}
                      value={text}
                      readOnly={selected.published || selected._count.profiles > 0}
                      onChange={(e) => setText(e.target.value)}
                      spellCheck={false}
                    />
                  </label>
                  <p className="fine-print">
                    Edit university, major, campuses, admission year, elective groups, source URLs,
                    verification metadata and course requirements here. Imports and saves validate
                    totals, references, cycles and group capacity atomically.
                  </p>
                  <div className="editor-actions">
                    <Button disabled={busy || selected.published} onClick={() => save(false)}>
                      <Save size={15} />
                      Save draft
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || selected.published}
                      onClick={() => save(true)}
                    >
                      <ShieldCheck size={15} />
                      Validate & publish
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => download(`${selected.document.slug}.json`, document)}
                    >
                      Export JSON
                    </Button>
                    {!selected.published && selected._count.profiles === 0 && (
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api(`/admin/curricula/${selected.id}`, send('DELETE'));
                            setSelected(null);
                            s.notify('Unused draft deleted.');
                          })
                        }
                      >
                        <Trash2 size={14} />
                        Delete draft
                      </Button>
                    )}
                  </div>
                  <div className="admin-courses-heading">
                    <h3>Course & prerequisite editor</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selected.published || !document}
                      onClick={() =>
                        editCourse(
                          {
                            code: 'NEW101',
                            title: 'New course',
                            credits: 3,
                            semester: 1,
                            category: 'Foundation',
                            electiveGroup: null,
                            description: null,
                            requirement: null,
                            sources: [],
                          },
                          document!.courses.length,
                        )
                      }
                    >
                      <Plus size={14} />
                      Add course
                    </Button>
                  </div>
                  <div className="admin-course-list">
                    {document?.courses?.map((c, i) => (
                      <button key={`${c.code}-${i}`} onClick={() => editCourse(c, i)}>
                        <span>
                          <strong>{c.code}</strong>
                          {c.title}
                        </span>
                        <small>{c.credits} cr</small>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <Empty title="Choose a curriculum">
                Select a version to inspect its courses and sources, or import a new version.
              </Empty>
            )}
          </section>
        </div>
      ) : (
        <Directory records={records.data ?? []} />
      )}
      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import a curriculum"
        description="Validated imports create a complete, separate draft. Nothing is partially imported."
      >
        <label>
          File format
          <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <option value="json">JSON curriculum document</option>
            <option value="csv">CSV course rows + JSON metadata</option>
          </select>
        </label>
        <label>
          Load a local file
          <input
            type="file"
            accept={format === 'json' ? '.json' : '.csv'}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 400000) {
                  setError(new Error('File must be under 400 KB.'));
                  return;
                }
                setContent(await file.text());
              }
            }}
          />
        </label>
        <label>
          {format === 'json' ? 'Curriculum JSON' : 'CSV content'}
          <textarea
            aria-label="Import content"
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="code-editor"
          />
        </label>
        {format === 'csv' && (
          <label>
            Curriculum metadata JSON (omit courses)
            <textarea
              rows={6}
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              className="code-editor"
            />
          </label>
        )}
        <ErrorBox error={error} />
        <p className="fine-print">
          CSV columns:
          code,title,credits,semester,category,electiveGroup,description,requirement,sources.
          Requirement and sources cells contain escaped JSON. See the import guide.
        </p>
        <Button disabled={busy || !content} onClick={importFile}>
          {busy ? 'Validating…' : 'Validate & import draft'}
        </Button>
      </Modal>
      <Modal
        open={!!course}
        onOpenChange={(o) => {
          if (!o) setCourse(null);
        }}
        title={course?.title ?? 'Course'}
        description="Course fields and prerequisite rules are validated when the curriculum is saved."
      >
        <label>
          Course JSON
          <textarea
            className="code-editor"
            aria-label="Course JSON editor"
            rows={17}
            readOnly={selected?.published}
            value={courseText}
            onChange={(e) => setCourseText(e.target.value)}
            spellCheck={false}
          />
        </label>
        <p className="fine-print">
          Rules use type: course, all, any, corequisite, credits, or approval. Credit and
          prerequisite references must remain consistent across the curriculum.
        </p>
        <ErrorBox error={error} />
        <div className="editor-actions">
          <Button
            disabled={selected?.published}
            onClick={() => {
              try {
                const c = JSON.parse(courseText);
                const doc = JSON.parse(text);
                if (courseIndex === doc.courses.length) doc.courses.push(c);
                else doc.courses[courseIndex!] = c;
                setText(JSON.stringify(doc, null, 2));
                setCourse(null);
              } catch {
                setError(new Error('Course JSON is invalid.'));
              }
            }}
          >
            Apply to draft
          </Button>
          <Button
            variant="destructive"
            disabled={selected?.published}
            onClick={() => {
              const doc = JSON.parse(text);
              doc.courses.splice(courseIndex, 1);
              setText(JSON.stringify(doc, null, 2));
              setCourse(null);
            }}
          >
            Remove from draft
          </Button>
        </div>
      </Modal>
    </>
  );
}
function Directory({ records }: { records: AdminRecord[] }) {
  const cache = useQueryClient();
  const s = useStore();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [editType, setEditType] = useState<'instructors' | 'offerings' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const directory = useQuery({
    queryKey: ['admin-directory'],
    queryFn: () => api<{ instructors: Instructor[]; offerings: Offering[] }>('/admin/directory'),
  });
  function open(type: typeof editType, value?: Instructor | Offering) {
    setEditType(type);
    setEditId(value?.id ?? null);
    const d = value
      ? { ...value }
      : type === 'instructors'
        ? { name: '', department: '', sourceUrl: '', verifiedAt: '2026-10-22' }
        : {
            curriculumId: records[0]?.id ?? '',
            code: records[0]?.document.courses[0]?.code ?? '',
            term: 'Fall 2026',
            campus: 'Abu Dhabi',
            section: '1',
            schedule: null,
            sourceUrl: '',
            verifiedAt: '2026-10-22',
            instructorId: null,
          };
    const clean = { ...d } as Record<string, unknown>;
    delete clean.id;
    delete clean.instructor;
    clean.verifiedAt = String(clean.verifiedAt).slice(0, 10);
    setText(JSON.stringify(clean, null, 2));
  }
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(
        `/admin/${editType}${editId ? `/${editId}` : ''}`,
        send(editId ? 'PUT' : 'POST', JSON.parse(text)),
      );
      await cache.invalidateQueries({ queryKey: ['admin-directory'] });
      await cache.invalidateQueries({ queryKey: ['offerings'] });
      setEditType(null);
      s.notify('Verified directory record saved.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove(type: string, id: string) {
    try {
      await api(`/admin/${type}/${id}`, send('DELETE'));
      await cache.invalidateQueries({ queryKey: ['admin-directory'] });
      await cache.invalidateQueries({ queryKey: ['offerings'] });
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <div className="notice-box">
        <strong>Only add verified information.</strong>
        <p>
          Every instructor and offering requires a source URL and verification date. Offerings are
          scoped to curriculum, campus, term and section; instructor assignments never imply future
          availability.
        </p>
      </div>
      <ErrorBox error={error ?? directory.error} />
      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-heading">
            <h2>Instructors</h2>
            <Button size="sm" onClick={() => open('instructors')}>
              <Plus size={14} />
              Add instructor
            </Button>
          </div>
          {directory.data?.instructors.length ? (
            directory.data.instructors.map((i) => (
              <div className="directory-row" key={i.id}>
                <span>
                  <strong>{i.name}</strong>
                  <small>
                    {i.department} · verified {i.verifiedAt.slice(0, 10)}
                  </small>
                </span>
                <button className="text-button" onClick={() => open('instructors', i)}>
                  Edit
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete instructor ${i.name}`}
                  onClick={() => remove('instructors', i.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <Empty title="No verified instructors">
              Add source-reviewed information when it is available.
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Term offerings</h2>
            <Button size="sm" onClick={() => open('offerings')}>
              <Plus size={14} />
              Add offering
            </Button>
          </div>
          {directory.data?.offerings.length ? (
            directory.data.offerings.map((o) => (
              <div className="directory-row" key={o.id}>
                <span>
                  <strong>
                    {o.code} · Section {o.section}
                  </strong>
                  <small>
                    {o.term} · {o.campus}
                  </small>
                </span>
                <button className="text-button" onClick={() => open('offerings', o)}>
                  Edit
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete offering ${o.code}`}
                  onClick={() => remove('offerings', o.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <Empty title="No confirmed offerings">
              Students see an unavailable state until verified term data is added.
            </Empty>
          )}
        </section>
      </div>
      <section className="panel panel-pad">
        <h3>Reference IDs for offering entry</h3>
        <p className="muted">
          Use an existing curriculum and instructor ID in the validated offering form.
        </p>
        {records.map((r) => (
          <p className="fine-print" key={r.id}>
            {r.document.version}: <code>{r.id}</code>
          </p>
        ))}
        {directory.data?.instructors.map((i) => (
          <p className="fine-print" key={i.id}>
            {i.name}: <code>{i.id}</code>
          </p>
        ))}
      </section>
      <Modal
        open={!!editType}
        onOpenChange={(o) => {
          if (!o) setEditType(null);
        }}
        title={`${editId ? 'Edit' : 'Add'} ${editType === 'instructors' ? 'instructor' : 'term offering'}`}
        description="Enter a source URL and a YYYY-MM-DD verification date. The server validates all fields and references."
      >
        <label>
          Record JSON
          <textarea
            className="code-editor"
            aria-label="Directory record JSON"
            rows={16}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <ErrorBox error={error} />
        <Button disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save verified record'}
        </Button>
      </Modal>
    </>
  );
}
