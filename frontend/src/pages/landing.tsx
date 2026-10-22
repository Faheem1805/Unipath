import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  GitBranch,
  CalendarDays,
  ChartNoAxesCombined,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { Logo, Button } from '../components/common';
import { ThemeButton } from '../components/layout';
import { useStore } from '../lib/store';
export function Landing() {
  const { enterGuest } = useStore();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav aria-label="Site navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <Link to="/sources">Data transparency</Link>
        </nav>
        <div>
          <ThemeButton />
          <Button variant="ghost" asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">
              Get started <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="landing-eyebrow">
              <span /> LESS GUESSWORK. MORE DIRECTION.
            </span>
            <h1>
              Your degree.
              <br />
              The bigger <span>picture.</span>
              <svg viewBox="0 0 370 20" aria-hidden="true">
                <path d="M4 13Q150-5 365 9" />
              </svg>
            </h1>
            <p>
              Turn a list of requirements into a path you can see. Know where you stand, what comes
              next, and how it all connects.
            </p>
            <div className="hero-actions">
              <Button size="default" asChild>
                <Link to="/register">
                  Find your path <ArrowRight size={18} />
                </Link>
              </Button>
              <Button variant="outline" onClick={enterGuest}>
                Explore the demo <ArrowUpRight size={17} />
              </Button>
            </div>
            <div className="hero-trust">
              <span className="mini-avatars">
                <i>J</i>
                <i>A</i>
                <i>S</i>
              </span>
              <span>
                Built by a student. Designed for your next step.
                <small>Independent. Transparent. Always your plan.</small>
              </span>
            </div>
          </div>
          <div className="hero-visual" aria-label="Illustration of the interactive degree planner">
            <div className="floating-label">
              <span>
                <Check size={14} />
              </span>
              It’s starting to connect.
            </div>
            <div className="preview-window">
              <div className="preview-top">
                <span className="preview-dots">● ● ●</span>
                <span>YOUR DEGREE, AT A GLANCE</span>
                <GitBranch size={14} />
              </div>
              <div className="preview-content">
                <div className="preview-heading">
                  <div>
                    <small>SOFTWARE ENGINEERING</small>
                    <h3>See your next chapter.</h3>
                  </div>
                  <span className="credit-pill">Fictional demo</span>
                </div>
                <div className="mini-map">
                  <div className="mini-column">
                    <div className="mini-node done">
                      <span>
                        CS101 <Check size={13} />
                      </span>
                      <strong>Computing Foundations</strong>
                      <small>3 credits · Completed</small>
                    </div>
                    <div className="mini-node done">
                      <span>
                        MA103 <Check size={13} />
                      </span>
                      <strong>Discrete Mathematics</strong>
                      <small>3 credits · Completed</small>
                    </div>
                  </div>
                  <span className="map-connector">⟶</span>
                  <div className="mini-column">
                    <div className="mini-node current">
                      <span>
                        CS201 <span className="pulsing-dot" />
                      </span>
                      <strong>Object-Oriented Programming</strong>
                      <small>3 credits · In progress</small>
                    </div>
                  </div>
                  <span className="map-connector">⟶</span>
                  <div className="mini-column">
                    <div className="mini-node ready">
                      <span>
                        CS202 <ArrowUpRight size={13} />
                      </span>
                      <strong>Data Structures & Algorithms</strong>
                      <small>3 credits · Up next</small>
                    </div>
                  </div>
                </div>
                <div className="preview-progress">
                  <div>
                    <span className="progress-ring-mini">54%</span>
                    <span>
                      <strong>A little progress. A lot of possibility.</strong>
                      <small>Every completed course opens another door.</small>
                    </span>
                  </div>
                  <ArrowUpRight size={18} />
                </div>
              </div>
            </div>
            <div className="floating-stat">
              <ChartNoAxesCombined size={21} />
              <div>
                <strong>Your next step, clearer.</strong>
                <small>Prerequisites connected in one place</small>
              </div>
            </div>
            <div className="hero-star star-one">✳</div>
            <div className="hero-star star-two">✳</div>
          </div>
        </section>
        <div className="landing-context">
          <span>STARTING WITH</span>
          <strong>Al Ain University</strong>
          <span className="context-line" />
          <span>BSc Software Engineering</span>
          <span className="context-note">
            <ShieldCheck size={16} /> Independent student project · Not affiliated with AAU
          </span>
        </div>
        <section id="features" className="features-section">
          <div className="section-intro">
            <span className="eyebrow">FROM OVERWHELMED TO ON TRACK</span>
            <h2>
              Everything connects.
              <br />
              Now you can see how.
            </h2>
            <p>One calm workspace for the decisions that shape your degree.</p>
          </div>
          <div className="feature-grid">
            {[
              [
                GitBranch,
                '01',
                'A map, not a maze.',
                'Explore your courses, trace prerequisite chains, and see what each completed step unlocks.',
              ],
              [
                CalendarDays,
                '02',
                'A semester with intention.',
                'Build a realistic course plan. Check requirements before you make your next move.',
              ],
              [
                ChartNoAxesCombined,
                '03',
                'Progress you can feel.',
                'Credits, electives, grades and remaining requirements. A clearer view of how far you’ve come.',
              ],
            ].map(([Icon, num, title, copy]) => {
              const I = Icon as typeof GitBranch;
              return (
                <article className="feature-card" key={String(num)}>
                  <div>
                    <span className="feature-icon">
                      <I size={26} />
                    </span>
                    <span className="feature-number">{String(num)}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(copy)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section id="how-it-works" className="steps-section">
          <div>
            <span className="eyebrow">A PATH THAT STARTS WITH YOU</span>
            <h2>
              Bring your progress.
              <br />
              We’ll connect the dots.
            </h2>
            <p>
              You know your journey best. Choose your curriculum and tell us which courses you’ve
              completed. Your workspace takes it from there.
            </p>
            <Button onClick={enterGuest}>
              Take a look inside <ChevronRight size={16} />
            </Button>
          </div>
          <ol>
            {[
              [
                'Choose your degree',
                'University, campus and curriculum. Your starting point, made explicit.',
              ],
              [
                'Add your progress',
                'Enter completed and enrolled courses yourself. No semester-based assumptions.',
              ],
              [
                'Plan what comes next',
                'Explore your map and build a semester that moves you forward.',
              ],
            ].map(([title, copy], i) => (
              <li key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="landing-cta">
          <Sparkles />
          <h2>A clearer path starts here.</h2>
          <p>
            You don’t need to figure out the whole journey today.
            <br />
            Just your next step.
          </p>
          <Button asChild>
            <Link to="/register">
              Create your workspace <ArrowUpRight size={17} />
            </Link>
          </Button>
          <small>Free to explore. Built for learning.</small>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <p>
          An independent student-built planning tool.
          <br />
          Always confirm academic decisions with your university.
        </p>
        <Link to="/sources">
          Sources & limitations <ArrowUpRight size={14} />
        </Link>
        <span>© 2026 UniPath</span>
      </footer>
    </div>
  );
}
