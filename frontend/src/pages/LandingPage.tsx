import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  Blocks,
  Braces,
  BarChart3,
  CircleDot,
  GitBranch,
  Network,
  ScanSearch,
  ShieldAlert,
  Waypoints,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GraphCanvas } from '../components/dashboard/GraphCanvas';
import { FilterProvider } from '../context/FilterContext';
import './landing.css';

const capabilities = [
  {
    number: '01',
    icon: <Waypoints aria-hidden="true" />,
    title: 'See the relationships',
    description:
      'Connect accounts, posts, hashtags, and shared infrastructure in one network view.',
    tone: 'mint',
  },
  {
    number: '02',
    icon: <ScanSearch aria-hidden="true" />,
    title: 'Filter to the signal',
    description:
      'Narrow activity by time, platform, severity, and interaction density as the investigation changes.',
    tone: 'coral',
  },
  {
    number: '03',
    icon: <BarChart3 aria-hidden="true" />,
    title: 'Compare patterns',
    description:
      'Review post activity, recurring narratives, and suspected coordination alongside the graph.',
    tone: 'gold',
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const openWorkspace = () => {
    navigate(isAuthenticated ? '/dashboard' : '/login');
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="#top" aria-label="OmniGraph home">
          <span className="landing-brand-mark"><Network size={20} strokeWidth={1.8} /></span>
          <span>OMNIGRAPH<span className="landing-brand-period">.</span></span>
        </a>

        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="#workflow">Workflow</a>
          <a href="#roadmap">Roadmap</a>
        </nav>

        <div className="landing-header-actions">
          <Link to="/login" className="landing-login">Sign in</Link>
          <button type="button" className="landing-header-cta" onClick={openWorkspace}>
            <span className="landing-header-cta-label">Open workspace</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><span /> OSINT NETWORK ANALYSIS</div>
            <h1 id="hero-title">Follow the links.<br /><em>Find the pattern.</em></h1>
            <p className="landing-hero-description">
              Explore how accounts, posts, and narratives connect, move, and coordinate.
            </p>
            <div className="landing-hero-actions">
              <button type="button" className="landing-primary-cta" onClick={openWorkspace}>
                Enter the analyst workspace <ArrowRight size={17} aria-hidden="true" />
              </button>
              <a className="landing-text-link" href="#platform">
                Explore the platform <ArrowDownRight size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="landing-hero-note">
              <CircleDot size={14} aria-hidden="true" />
              <span>Built for investigation with simulated, reproducible data.</span>
            </div>
          </div>

          <div className="landing-hero-visual" aria-label="Interactive sample network graph">
            <div className="landing-visual-meta">
              <span><i /> SAMPLE NETWORK</span>
              <span>ACCOUNTS / POSTS / SIGNALS</span>
            </div>
            <FilterProvider>
              <GraphCanvas onSelectNode={() => undefined} />
            </FilterProvider>
            <div className="landing-visual-caption">
              <span><span className="landing-caption-dot" /> Interactive graph preview</span>
              <span>SIMULATED DATASET</span>
            </div>
          </div>

          <div className="landing-side-index" aria-hidden="true">01 — INVESTIGATE</div>
        </section>

        <section className="landing-intro" id="platform" aria-labelledby="platform-title">
          <div className="landing-section-label"><span>THE PLATFORM</span><span>01 / 03</span></div>
          <div className="landing-intro-content">
            <h2 id="platform-title">A network is more than a list of accounts.</h2>
            <div>
              <p>
                Coordinated activity is easier to understand when relationships are visible.
                OmniGraph brings social entities and their connections into a single analyst
                workspace, with the graph at the center of the investigation.
              </p>
              <div className="landing-entity-line" aria-label="Connected entity types">
                <span>USERS</span><b />
                <span>POSTS</span><b />
                <span>HASHTAGS</span><b />
                <span>IP ADDRESSES</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-capabilities" id="workflow" aria-label="Analyst workflow">
          <div className="landing-section-label"><span>ONE CONNECTED WORKFLOW</span><span>02 / 03</span></div>
          <div className="landing-capability-grid">
            {capabilities.map((capability) => (
              <article className={`landing-capability landing-${capability.tone}`} key={capability.number}>
                <div className="landing-capability-top">
                  <span>{capability.number}</span>
                  <span className="landing-capability-icon">{capability.icon}</span>
                </div>
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-roadmap" id="roadmap" aria-labelledby="roadmap-title">
          <div className="landing-roadmap-mark"><Blocks size={23} strokeWidth={1.6} aria-hidden="true" /></div>
          <div className="landing-roadmap-copy">
            <div className="landing-eyebrow">IN DEVELOPMENT</div>
            <h2 id="roadmap-title">Graph context, then AI analysis.</h2>
            <p>
              The current workspace focuses on authentication, graph exploration, and analytics.
              A GraphRAG forensic analyst is planned as a later phase, designed to answer questions
              about the network currently in view.
            </p>
          </div>
          <div className="landing-roadmap-status">
            <span><GitBranch size={15} aria-hidden="true" /> CURRENT BUILD</span>
            <strong>Graph + analytics</strong>
            <span className="landing-roadmap-next"><ShieldAlert size={15} aria-hidden="true" /> NEXT PHASE: GRAPHRAG</span>
          </div>
        </section>

        <section className="landing-bottom-cta" aria-labelledby="bottom-cta-title">
          <Braces size={22} aria-hidden="true" />
          <h2 id="bottom-cta-title">Start with the network.</h2>
          <button type="button" className="landing-primary-cta" onClick={openWorkspace}>
            Open OmniGraph <ArrowRight size={17} aria-hidden="true" />
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <span>OMNIGRAPH<span className="landing-brand-period">.</span></span>
        <span>SIMULATED DATA · INVESTIGATIVE WORKSPACE</span>
        <Link to="/register">Create analyst account <ArrowRight size={13} aria-hidden="true" /></Link>
      </footer>
    </div>
  );
};