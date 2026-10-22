import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StoreProvider } from './lib/store';
import { Layout } from './components/layout';
import { Landing } from './pages/landing';
import { Auth } from './pages/auth';
import { DegreeSetup } from './pages/onboarding';
import { Dashboard } from './pages/dashboard';
const Flowchart = React.lazy(() =>
  import('./pages/flowchart').then((m) => ({ default: m.Flowchart })),
);
import { ProgressPage } from './pages/progress';
import { Planner } from './pages/planner';
import { Courses } from './pages/courses';
import { Gpa } from './pages/gpa';
const Admin = React.lazy(() => import('./pages/admin').then((m) => ({ default: m.Admin })));
import { Settings } from './pages/settings';
import { Sources } from './pages/sources';
import './styles.css';
if (localStorage.getItem('unipath-theme') === 'dark')
  document.documentElement.classList.add('dark');
const cache = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 20_000 } },
});
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="standalone-error">
        <h1>Let’s reconnect your path.</h1>
        <p>Something unexpected happened. Your saved records are still in your account.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          Reload workspace
        </button>
        <a href="/">Return home</a>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={cache}>
        <BrowserRouter>
          <StoreProvider>
            <a className="skip-link" href="#main-content">
              Skip to content
            </a>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/register" element={<Auth register />} />
              <Route path="/onboarding" element={<DegreeSetup />} />
              <Route path="/sources" element={<Sources standalone />} />
              <Route path="/app" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route
                  path="flowchart"
                  element={
                    <React.Suspense fallback={<div className="loading">Loading degree map…</div>}>
                      <Flowchart />
                    </React.Suspense>
                  }
                />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="planner" element={<Planner />} />
                <Route path="courses" element={<Courses />} />
                <Route path="gpa" element={<Gpa />} />
                <Route
                  path="admin"
                  element={
                    <React.Suspense
                      fallback={<div className="loading">Loading administration…</div>}
                    >
                      <Admin />
                    </React.Suspense>
                  }
                />
                <Route path="settings" element={<Settings />} />
                <Route path="sources" element={<Sources />} />
              </Route>
              <Route
                path="*"
                element={
                  <main className="standalone-error">
                    <h1>This path doesn’t exist.</h1>
                    <Link to="/">Return to UniPath</Link>
                  </main>
                }
              />
            </Routes>
          </StoreProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
