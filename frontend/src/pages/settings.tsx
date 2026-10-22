import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Save, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { api, send, download } from '../lib/api';
import { Button, PageTitle, ErrorBox } from '../components/common';
import { DegreeSetup } from './onboarding';
export function Settings() {
  const s = useStore();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await api(
        '/auth/account',
        send('PATCH', {
          name: d.get('name'),
          ...(d.get('newPassword')
            ? { currentPassword: d.get('currentPassword'), newPassword: d.get('newPassword') }
            : {}),
        }),
      );
      await s.refresh();
      s.notify('Account updated.');
      form.reset();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    try {
      download('unipath-records.json', s.isGuest ? s.student : await api('/student/export'));
    } catch (e) {
      setError(e);
    }
  }
  async function remove(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    if (d.get('confirmation') !== 'DELETE') return;
    setBusy(true);
    setError(null);
    try {
      await api('/auth/account', send('DELETE', { password: d.get('password') }));
      await s.refresh();
      navigate('/');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR WORKSPACE, YOUR WAY"
        title="Make yourself at home."
        description="Manage your degree preferences, account and saved records."
      />
      <ErrorBox error={error} />
      <div className="settings-grid">
        <DegreeSetup settings />
        <div>
          <section className="panel panel-pad">
            <h2>Your account</h2>
            {s.isGuest ? (
              <p className="muted">
                Guest mode uses fictional data in this browser tab. Create an account to save your
                own progress across visits.
              </p>
            ) : (
              <form onSubmit={save}>
                <label>
                  Name
                  <input name="name" defaultValue={s.user?.name} maxLength={80} required />
                </label>
                <label>
                  Email
                  <input value={s.user?.email ?? ''} readOnly />
                </label>
                <label>
                  Current password
                  <input
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    maxLength={128}
                  />
                </label>
                <label>
                  New password (optional)
                  <input
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                  />
                </label>
                <p className="fine-print">
                  Changing your password signs out all other sessions. Email changes are not
                  supported.
                </p>
                <Button disabled={busy}>
                  <Save size={15} />
                  Save account
                </Button>
              </form>
            )}
          </section>
          <section className="panel panel-pad">
            <h2>Your data belongs to you.</h2>
            <p className="muted">
              Export your profile, curriculum, attempts and saved semester plans as JSON.
            </p>
            <Button variant="outline" onClick={exportData}>
              <Download size={15} />
              Export my data
            </Button>
          </section>
          {!s.isGuest && (
            <section className="panel panel-pad danger-panel">
              <h2>Delete account</h2>
              <p>
                Deleting your account permanently removes your sessions, attempts, profile and
                plans.
              </p>
              <form onSubmit={remove}>
                <label>
                  Type DELETE to confirm
                  <input name="confirmation" required pattern="DELETE" autoComplete="off" />
                </label>
                <label>
                  Confirm your password
                  <input
                    name="password"
                    type="password"
                    required
                    maxLength={128}
                    autoComplete="current-password"
                  />
                </label>
                <Button variant="destructive" disabled={busy}>
                  <Trash2 size={15} />
                  Permanently delete my account
                </Button>
              </form>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
