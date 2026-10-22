import { NavLink, Outlet, Link, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  CalendarDays,
  Library,
  Calculator,
  Settings,
  Moon,
  Sun,
  Menu,
  X,
  ArrowUpRight,
  LogOut,
  ShieldCheck,
  BookOpenCheck,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { DemoLabel, Logo, Button, Loading, ErrorBox } from './common';
const links = [
  ['/app', 'Overview', LayoutDashboard],
  ['/app/flowchart', 'Degree map', GitBranch],
  ['/app/planner', 'Semester planner', CalendarDays],
  ['/app/courses', 'Course explorer', Library],
  ['/app/progress', 'Progress & records', BookOpenCheck],
  ['/app/gpa', 'GPA calculator', Calculator],
] as const;
export function ThemeButton() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? 'Use light theme' : 'Use dark theme'}
      onClick={() => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('unipath-theme', dark ? 'light' : 'dark');
        setDark(!dark);
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
export function Layout() {
  const { user, isGuest, student, loading, error, notice, logout } = useStore();
  const [mobile, setMobile] = useState(false);
  const [logoutError, setLogoutError] = useState<unknown>(null);
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="standalone-error">
        <Logo />
        <ErrorBox error={error} />
        <Button onClick={() => location.reload()}>Retry connection</Button>
        <Link to="/">Return home</Link>
      </div>
    );
  if (!isGuest && !user) return <Navigate to="/login" replace />;
  if (!student?.profile) return <Navigate to="/onboarding" replace />;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="mobile-only icon-button"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <span className="nav-label">YOUR WORKSPACE</span>
        <nav aria-label="Main navigation">
          {links.map(([to, label, Icon]) => (
            <NavLink
              end={to === '/app'}
              to={to}
              key={to}
              onClick={() => setMobile(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} />
              <span>{label}</span>
              {to === '/app/flowchart' && <span className="nav-new">CORE</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-icon">
              <GitBranch size={20} />
            </span>
            <h4>
              A little clarity.
              <br />A bigger picture.
            </h4>
            <p>Your degree, one intentional step at a time.</p>
            <Link to="/app/planner">
              Plan your next step <ArrowUpRight size={14} />
            </Link>
          </div>
          <NavLink className="nav-item" to="/app/sources">
            <FileCheck2 size={18} />
            Data & sources
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink className="nav-item" to="/app/admin">
              <ShieldCheck size={18} />
              Administration
            </NavLink>
          )}
          <NavLink className="nav-item" to="/app/settings">
            <Settings size={18} />
            Settings
          </NavLink>
          <button
            className="profile-button"
            onClick={() => {
              logout().catch(setLogoutError);
            }}
            aria-label="Sign out"
          >
            <span className="avatar">{isGuest ? 'JD' : user?.name.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{isGuest ? 'Jamie · demo student' : user?.name}</strong>
              <small>{isGuest ? 'Guest workspace' : 'Personal workspace'}</small>
            </span>
            <LogOut size={16} />
          </button>
          <ErrorBox error={logoutError} />
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-backdrop mobile-only"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="workspace-name">My workspace</span>
            <span className="divider">/</span>
            <span className="muted">{student.profile.curriculum.document.program}</span>
          </div>
          <div className="topbar-right">
            <span className="term-chip">
              <span />
              {student.profile.currentTerm}
            </span>
            <ThemeButton />
            <span className="avatar avatar-sm">
              {isGuest ? 'JD' : user?.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <DemoLabel />
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            UniPath <span>·</span> An independent student project
          </span>
          <span>
            Made for the journey ahead <ArrowUpRight size={12} />
          </span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
    </div>
  );
}
