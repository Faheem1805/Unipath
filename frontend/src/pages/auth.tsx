import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, GitBranch } from 'lucide-react';
import { Logo, Button, ErrorBox } from '../components/common';
import { api, send } from '../lib/api';
import { useStore } from '../lib/store';
export function Auth({ register = false }: { register?: boolean }) {
  const { user, isGuest, refresh, leaveGuest, enterGuest } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  if (user && !isGuest) return <Navigate to="/app" replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api(
        `/auth/${register ? 'register' : 'login'}`,
        send('POST', {
          email: d.get('email'),
          password: d.get('password'),
          ...(register ? { name: d.get('name') } : {}),
        }),
      );
      leaveGuest();
      await refresh();
      navigate('/app');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-aside">
        <Logo />
        <div>
          <span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</span>
          <h1>
            Your next chapter
            <br />
            starts with a plan.
          </h1>
          <p>
            A workspace that helps you see the connections, celebrate your progress, and make your
            next move.
          </p>
          <div className="auth-illustration">
            <GitBranch size={100} strokeWidth={1} />
            <span>
              One course.
              <br />
              Many possibilities.
            </span>
          </div>
        </div>
        <small>Independent student project · Not affiliated with AAU</small>
      </div>
      <main className="auth-main">
        <Link className="back-link" to="/">
          ← Back to UniPath
        </Link>
        <div className="auth-form">
          <span className="eyebrow">YOUR DEGREE. YOUR DIRECTION.</span>
          <h1>{register ? 'Find your path.' : 'Welcome back.'}</h1>
          <p>
            {register
              ? 'A clearer picture of your degree is one step away.'
              : 'Pick up where your journey left off.'}
          </p>
          <ErrorBox error={error} />
          <form onSubmit={submit}>
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  placeholder="How should we call you?"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <span className="password-input">
                <input
                  name="password"
                  type={visible ? 'text' : 'password'}
                  required
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  placeholder={register ? 'At least 12 characters' : 'Enter your password'}
                />
                <button
                  type="button"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {register && (
              <p className="fine-print">
                Your progress is private. UniPath is an independent planning aid; demo academic data
                is fictional.
              </p>
            )}
            <Button disabled={busy} type="submit">
              {busy ? 'Please wait…' : register ? 'Create my workspace' : 'Log in'}{' '}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have a workspace?' : 'New to UniPath?'}{' '}
            <Link to={register ? '/login' : '/register'}>
              {register ? 'Log in' : 'Create an account'}
            </Link>
          </p>
          <div className="or-line">
            <span>JUST LOOKING AROUND?</span>
          </div>
          <Button variant="outline" onClick={enterGuest}>
            Explore as a guest <ArrowRight size={16} />
          </Button>
        </div>
      </main>
    </div>
  );
}
