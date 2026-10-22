import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { type CurriculumRecord, demoCurriculum } from '@unipath/shared';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { Button, ErrorBox, Loading, Logo } from '../components/common';
export function DegreeSetup({ settings = false }: { settings?: boolean }) {
  const s = useStore();
  const [selected, setSelected] = useState(s.student?.profile?.curriculumId ?? '');
  const [campus, setCampus] = useState(s.student?.profile?.campus ?? 'Abu Dhabi');
  const [semester, setSemester] = useState(s.student?.profile?.semester ?? 1);
  const [term, setTerm] = useState(s.student?.profile?.currentTerm ?? 'Fall 2026');
  const [consent, setConsent] = useState(false);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const navigate = useNavigate();
  const curricula = useQuery({
    queryKey: ['curricula'],
    queryFn: () => api<CurriculumRecord[]>('/curricula'),
    enabled: !s.isGuest,
  });
  const list = s.isGuest ? [{ id: 'demo', document: demoCurriculum }] : (curricula.data ?? []);
  const row = list.find((c) => c.id === selected) ?? list[0];
  if (!s.loading && !s.user && !s.isGuest) return <Navigate to="/login" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!row || !consent) return;
    setBusy(true);
    setError(null);
    try {
      await s.saveProfile({
        curriculumId: row.id,
        campus,
        semester,
        currentTerm: term,
        resetProgress: reset,
      });
      s.notify('Degree preferences saved. Add your courses to make this plan yours.');
      navigate('/app/progress');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const form = (
    <div className="setup-card">
      <span className="eyebrow">YOUR STARTING POINT</span>
      <h1>{settings ? 'Degree preferences' : 'Let’s make this your path.'}</h1>
      <p>
        Start with your degree. You’ll add completed and enrolled courses yourself in the next step.
      </p>
      {curricula.isPending && !s.isGuest ? (
        <Loading />
      ) : (
        <>
          <ErrorBox error={error ?? curricula.error} />
          <form onSubmit={submit}>
            <div className="form-grid">
              <label>
                University
                <select value={row?.document.university ?? ''} onChange={() => {}}>
                  <option>{row?.document.university ?? 'No curricula available'}</option>
                </select>
              </label>
              <label>
                Campus
                <select value={campus} onChange={(e) => setCampus(e.target.value)}>
                  {(row?.document.campuses ?? []).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="span-two">
                Major
                <select value={row?.document.program ?? ''} onChange={() => {}}>
                  <option>{row?.document.program ?? 'No programs available'}</option>
                </select>
              </label>
              <label className="span-two">
                Curriculum / admission year
                <select
                  value={row?.id ?? ''}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    const doc = list.find((c) => c.id === e.target.value)?.document;
                    if (doc && !doc.campuses.includes(campus)) setCampus(doc.campuses[0]);
                  }}
                >
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.document.version}
                      {c.document.admissionYear
                        ? ` · admission ${c.document.admissionYear}`
                        : ' · admission year unverified'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Current semester
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                Current academic term
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  required
                  maxLength={80}
                />
              </label>
            </div>
            <div className="notice-box">
              <strong>
                {row?.document.verification === 'FICTIONAL'
                  ? 'Fictional demonstration data'
                  : 'Check curriculum applicability'}
              </strong>
              <p>{row?.document.verificationNote}</p>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
              />
              I understand the data limitations and will verify my requirements.
            </label>
            {s.student?.profile && row?.id !== s.student.profile.curriculumId && (
              <label className="checkbox-label danger-text">
                <input
                  type="checkbox"
                  checked={reset}
                  onChange={(e) => setReset(e.target.checked)}
                  required
                />
                Reset my course records and plans to change curriculum.
              </label>
            )}
            <Button disabled={busy || !row || !consent} type="submit">
              {busy ? 'Saving…' : 'Continue to my courses'} <ArrowRight size={16} />
            </Button>
          </form>
        </>
      )}
    </div>
  );
  return settings ? (
    form
  ) : (
    <div className="onboarding">
      <header>
        <Logo />
        <Link to="/">Back home</Link>
      </header>
      <div className="setup-steps">
        <span className="active">
          <i>1</i>Choose your degree
        </span>
        <span />
        <span>
          <i>2</i>Add your progress
        </span>
        <span />
        <span>
          <i>
            <Check size={13} />
          </i>
          Find your next step
        </span>
      </div>
      {form}
    </div>
  );
}
