import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Clock3,
  Copy,
  Fingerprint,
  Network,
  ShieldCheck,
  Repeat2,
  Server,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  Waypoints,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandMark, Wordmark } from '../components/common/Brand';
import { SystemStatus, useHealth } from '../components/common/SystemStatus';
import { HeroNetwork } from '../components/landing/HeroNetwork';
import { fetchPublicStatsApi } from '../services/api';
import { PublicStats } from '../types/analytics';
import './landing.css';

const STEPS = [
  {
    n: '01',
    icon: Waypoints,
    title: 'Map',
    body: 'Accounts, posts, hashtags and IP infrastructure become one Neo4j graph you can walk node by node.',
  },
  {
    n: '02',
    icon: SlidersHorizontal,
    title: 'Filter',
    body: 'Slice by date, platform, severity and coordination density. Every panel reads the same filter.',
  },
  {
    n: '03',
    icon: Fingerprint,
    title: 'Measure',
    body: 'Clusters are scored on five explainable factors — never a black-box probability.',
  },
  {
    n: '04',
    icon: Sparkles,
    title: 'Ask',
    body: 'Brief the GraphRAG analyst in plain language. Answers cite node IDs you can light up on the graph.',
  },
];

const SIGNALS = [
  { icon: Server, title: 'Shared infrastructure', body: 'Many accounts behind one datacenter or VPN address.', tone: 'oxide' },
  { icon: Clock3, title: 'Burst timing', body: 'The same narrative from different accounts within minutes.', tone: 'orange' },
  { icon: Copy, title: 'Copy-paste text', body: 'Near-identical wording measured by word-set overlap.', tone: 'steel' },
  { icon: Repeat2, title: 'Amplification', body: 'Retweet fan-out onto a single seeding post.', tone: 'olive' },
  { icon: UserPlus, title: 'Fresh accounts', body: 'New, low-follower profiles concentrated in one cluster — surfaced to the AI analyst as account age and follower counts.', tone: 'brass' },
  { icon: ShieldCheck, title: 'Benign context', body: 'Campus and office NAT addresses share IPs too. Infrastructure type is weighed, so coincidence scores low instead of raising a false alarm.', tone: 'sage' },
];

const RISK_FACTORS = [
  { label: 'Size', weight: 30, color: 'var(--og-olive)' },
  { label: 'Severity', weight: 25, color: 'var(--og-crimson)' },
  { label: 'Tempo', weight: 20, color: 'var(--og-orange)' },
  { label: 'Infrastructure', weight: 15, color: 'var(--og-oxide)' },
  { label: 'Duplication', weight: 10, color: 'var(--og-steel)' },
];

const TICKER = [
  'SHARED IP DETECTED',
  'BURST < 60 MIN',
  'NEAR-DUPLICATE TEXT',
  'RETWEET FAN-OUT',
  'NEW ACCOUNTS < 60 DAYS',
  'EVIDENCE-GROUNDED AI',
  'EXPLAINABLE RISK SCORE',
  'NEO4J GRAPH',
];

const STACK = ['React + Vite', 'Cytoscape.js', 'Recharts', 'FastAPI', 'Neo4j Aura', 'Gemini GraphRAG'];

function useReveal() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.15 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const health = useHealth(60000);
  const [stats, setStats] = useState<PublicStats | null | undefined>(undefined);
  useReveal();

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicStatsApi(controller.signal).then(setStats).catch(() => setStats(null));
    return () => controller.abort();
  }, []);

  const openWorkspace = () => navigate(isAuthenticated ? '/dashboard' : '/login');
  const format = (value: number | undefined) => (value === undefined ? '—' : value.toLocaleString());

  return (
    <div className="landing-page">
      <header className="lp-header">
        <a className="lp-brand" href="#top" aria-label="OmniGraph home">
          <BrandMark size={30} />
          <Wordmark />
        </a>
        <nav className="lp-nav" aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#signals">Signals</a>
          <a href="#analyst">AI analyst</a>
        </nav>
        <div className="lp-header-actions">
          <span className="hidden lg:inline-flex"><SystemStatus health={health} compact /></span>
          {!isAuthenticated && <Link to="/login" className="lp-signin">Sign in</Link>}
          <button type="button" className="og-btn-primary" onClick={openWorkspace}>
            <span className="hidden sm:inline">{isAuthenticated ? 'Open workspace' : 'Get access'}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="top">
        {/* ------------------------------------------------------------ hero */}
        <section className="lp-hero og-container" aria-labelledby="hero-title">
          <div className="lp-hero-copy">
            <span className="og-stamp lp-rise" style={{ color: 'var(--og-olive)' }}>
              <span className="og-dot og-dot-live" /> OSINT · Coordination analysis
            </span>
            <h1 id="hero-title" className="og-display lp-hero-title lp-rise" style={{ animationDelay: '80ms' }}>
              Follow the links.
              <span className="og-serif lp-hero-accent">find the pattern.</span>
            </h1>
            <p className="lp-hero-lede lp-rise" style={{ animationDelay: '160ms' }}>
              OmniGraph turns scattered social activity into a graph of accounts, posts, hashtags and infrastructure —
              then scores coordinated behaviour and lets an evidence-grounded AI analyst explain it.
            </p>
            <div className="lp-hero-actions lp-rise" style={{ animationDelay: '240ms' }}>
              <button type="button" className="og-btn-primary lp-cta" onClick={openWorkspace}>
                Open analyst workspace <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <a className="og-btn-ghost lp-cta-ghost" href="#how">
                See how it works <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>

            <dl className="lp-stats lp-rise" style={{ animationDelay: '320ms' }} aria-label="Live index">
              <div>
                <dt className="og-kicker">Accounts indexed</dt>
                <dd className="lp-stat-value">{format(stats?.entities.User)}</dd>
              </div>
              <div>
                <dt className="og-kicker">Posts</dt>
                <dd className="lp-stat-value">{format(stats?.entities.Post)}</dd>
              </div>
              <div>
                <dt className="og-kicker">Active clusters</dt>
                <dd className="lp-stat-value" style={{ color: 'var(--og-crimson)' }}>{format(stats?.coordinated_clusters)}</dd>
              </div>
            </dl>
            <p className="lp-stats-note og-kicker">
              {stats === undefined
                ? 'Connecting to live index…'
                : stats === null
                  ? 'Live index unavailable — start the API to see counts'
                  : `Live from ${stats.storage_mode === 'neo4j' ? 'Neo4j Aura' : 'the development graph'} · simulated dataset`}
            </p>
          </div>

          <figure className="lp-hero-visual og-card og-frame lp-rise" style={{ animationDelay: '200ms' }}>
            <figcaption className="lp-visual-bar">
              <span className="og-kicker"><b>Exhibit 01</b> · network preview</span>
              <span className="og-stamp" style={{ color: 'var(--og-orange)' }}>Illustrative</span>
            </figcaption>
            <div className="lp-visual-canvas">
              <HeroNetwork />
            </div>
            <div className="lp-visual-legend" aria-label="Legend">
              {[
                ['User', 'var(--og-sage)', 'dot'],
                ['Post', 'var(--og-brass)', 'square'],
                ['Hashtag', 'var(--og-lavender)', 'diamond'],
                ['IP', 'var(--og-steel)', 'dot'],
                ['Coordinated', 'var(--og-crimson)', 'dot'],
              ].map(([label, color, shape]) => (
                <span key={label}><i className={`lp-shape lp-shape-${shape}`} style={{ background: color }} />{label}</span>
              ))}
              <span className="lp-visual-hint og-kicker">hover a node</span>
            </div>
          </figure>
        </section>

        {/* ------------------------------------------------------------ ticker */}
        <div className="lp-ticker" aria-hidden="true">
          <div className="lp-ticker-track">
            {[...TICKER, ...TICKER].map((item, index) => (
              <span key={`${item}-${index}`}>{item}<b>✕</b></span>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------------ how */}
        <section id="how" className="lp-section og-container" aria-labelledby="how-title">
          <header className="lp-section-head" data-reveal>
            <span className="og-kicker">01 / How it works</span>
            <h2 id="how-title" className="og-display lp-h2">
              From noise to a <span className="og-serif">defensible</span> finding.
            </h2>
          </header>
          <ol className="lp-steps">
            {STEPS.map(({ n, icon: Icon, title, body }, index) => (
              <li key={n} className="lp-step og-card" data-reveal style={{ transitionDelay: `${index * 80}ms` }}>
                <span className="lp-step-n og-display" aria-hidden="true">{n}</span>
                <Icon className="lp-step-icon" aria-hidden="true" />
                <h3 className="og-display">{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------------ signals */}
        <section id="signals" className="lp-section og-container" aria-labelledby="signals-title">
          <header className="lp-section-head" data-reveal>
            <span className="og-kicker">02 / Signals</span>
            <h2 id="signals-title" className="og-display lp-h2">
              Five signals. <span className="og-serif">One</span> explainable score.
            </h2>
          </header>
          <div className="lp-bento">
            <article className="lp-tile lp-tile-score og-card og-frame" data-reveal>
              <span className="og-stamp" style={{ color: 'var(--og-olive)' }}>Risk score</span>
              <p className="lp-score-formula">
                Σ weight × factor <span>∈ [0, 1]</span>
              </p>
              <div className="lp-score-bar" role="img" aria-label="Risk score weights">
                {RISK_FACTORS.map((factor) => (
                  <span key={factor.label} style={{ flexGrow: factor.weight, background: factor.color }} title={`${factor.label} ${factor.weight}%`} />
                ))}
              </div>
              <ul className="lp-score-legend">
                {RISK_FACTORS.map((factor) => (
                  <li key={factor.label}>
                    <i style={{ background: factor.color }} />
                    <span>{factor.label}</span>
                    <b className="og-tabular">{factor.weight}%</b>
                  </li>
                ))}
              </ul>
              <p className="lp-tile-note">A ranking heuristic, not a probability. Every factor is shown next to every cluster.</p>
            </article>
            {SIGNALS.map(({ icon: Icon, title, body, tone }, index) => (
              <article key={title} className={`lp-tile og-card lp-tone-${tone}`} data-reveal style={{ transitionDelay: `${index * 60}ms` }}>
                <Icon className="lp-tile-icon" aria-hidden="true" />
                <h3 className="og-display">{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ analyst */}
        <section id="analyst" className="lp-section og-container lp-analyst" aria-labelledby="analyst-title">
          <div className="lp-analyst-copy" data-reveal>
            <span className="og-kicker">03 / GraphRAG analyst</span>
            <h2 id="analyst-title" className="og-display lp-h2">
              An AI that <span className="og-serif">shows its work.</span>
            </h2>
            <ul className="lp-checks">
              <li><b>Retrieves</b> a bounded sub-graph from your current filter — never the whole database.</li>
              <li><b>Reasons</b> over structure, timing and text with deterministic detector findings attached.</li>
              <li><b>Cites</b> node IDs that highlight on the graph; unverifiable IDs are stripped and disclosed.</li>
              <li><b>Grades</b> each signal and states what evidence is missing. No answer is ever faked.</li>
            </ul>
            <button type="button" className="og-btn-primary og-btn-ai" onClick={openWorkspace}>
              Brief the analyst <Bot className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="lp-answer og-card og-frame" data-reveal aria-label="Illustrative response format">
            <div className="lp-answer-head">
              <span className="og-kicker" style={{ color: 'var(--og-lavender)' }}>Response format</span>
              <span className="og-stamp" style={{ color: 'var(--og-orange)' }}>Illustrative</span>
            </div>
            <p className="lp-answer-q">› Why is this cluster suspicious?</p>
            <p className="lp-answer-summary">
              Eight accounts on one datacenter IP posted near-identical text under a single hashtag within ~30 minutes,
              then retweeted the earliest post.
            </p>
            <div className="lp-answer-flags">
              {[['Shared datacenter IP', 'strong'], ['31-minute burst', 'strong'], ['Copy-paste wording', 'moderate']].map(([label, strength]) => (
                <span key={label} className={`lp-flag lp-flag-${strength}`}>{label}<em>{strength}</em></span>
              ))}
            </div>
            <div className="lp-answer-meter">
              <span className="og-kicker">Confidence</span>
              <span className="lp-meter"><i style={{ width: '66%' }} /></span>
              <b>Medium</b>
            </div>
            <div className="lp-answer-chips">
              {['net_c01', 'pst_c01_01', 'usr_161', '+9'].map((id) => <span key={id} className="og-chip">{id}</span>)}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ stack */}
        <section className="og-container lp-stack" aria-label="Technology" data-reveal>
          <span className="og-kicker">Built on</span>
          <ul>{STACK.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        {/* ------------------------------------------------------------ cta */}
        <section className="og-container lp-final" aria-labelledby="final-title">
          <div className="lp-final-card" data-reveal>
            <Network className="lp-final-icon" aria-hidden="true" />
            <h2 id="final-title" className="og-display">Start with the network.</h2>
            <p>Open the workspace, isolate a cluster, and ask why it looks coordinated.</p>
            <button type="button" className="lp-final-btn" onClick={openWorkspace}>
              {isAuthenticated ? 'Open workspace' : 'Create analyst access'} <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>

      <footer className="lp-footer og-container">
        <span className="inline-flex items-center gap-2"><BrandMark size={22} /><Wordmark className="text-sm" /></span>
        <span className="og-kicker">Simulated data · course project 24CIE554</span>
        <Link to="/register" className="lp-footer-link">Create analyst account <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></Link>
      </footer>
    </div>
  );
};
