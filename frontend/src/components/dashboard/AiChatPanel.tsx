import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Bot,
  ChevronDown,
  Copy,
  Crosshair,
  Eraser,
  Flag,
  RotateCcw,
  SearchX,
  Sparkles,
  Square,
  Target,
  X,
} from 'lucide-react';
import { ApiError, fetchAIStatusApi, queryAIApi } from '../../services/api';
import { AIQueryResponse, AIStatus, Confidence, SignalStrength } from '../../types/ai';
import { FilterState } from '../../types/graph';

export interface AiFocus {
  label: string;
  nodeIds: string[];
}

export interface AskRequest {
  id: number;
  question: string;
  focus: AiFocus | null;
}

interface Props {
  filters: FilterState;
  token: string | null;
  hasGraphData: boolean;
  nodesInView: number;
  /** id → readable label (handle / tag / address) for evidence chips. */
  describeNode: (id: string) => string | null;
  isNodeVisible: (id: string) => boolean;
  focus: AiFocus | null;
  onClearFocus: () => void;
  highlightedIds: string[];
  onHighlight: (ids: string[], originId?: string | null) => void;
  onClearHighlight: () => void;
  /** Questions pushed from elsewhere (e.g. "Ask AI" on a cluster row). */
  askRequest?: AskRequest | null;
  storageKey: string;
}

interface Entry {
  id: string;
  question: string;
  focusLabel: string | null;
  filterKey: string;
  answer?: AIQueryResponse;
  error?: { message: string; status: number; retryAfter?: number };
}

const SUGGESTIONS = [
  'Why is this cluster suspicious?',
  'Which account or post appears to be the likely origin?',
  'What coordination signals are visible?',
  'Summarize the dominant narrative.',
  'What evidence is missing or weak?',
];

const FOCUSED_SUGGESTIONS = [
  'Why is this cluster suspicious?',
  'Who seeded this narrative?',
  'Could this be a benign coincidence?',
];

const STRENGTH_COLOR: Record<SignalStrength, string> = {
  strong: 'var(--og-crimson)',
  moderate: 'var(--og-orange)',
  weak: 'var(--og-muted)',
};

const CONFIDENCE: Record<Confidence, { pct: number; color: string; label: string }> = {
  low: { pct: 33, color: 'var(--og-orange)', label: 'Low' },
  medium: { pct: 66, color: 'var(--og-olive)', label: 'Medium' },
  high: { pct: 100, color: 'var(--og-sage)', label: 'High' },
};

const filterKeyOf = (filters: FilterState) =>
  `${filters.dateFrom}|${filters.dateTo}|${filters.platform}|${filters.minSeverity}|${filters.minDensity}`;

function loadHistory(key: string): Entry[] {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Entry[]).filter((entry) => entry.answer) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------- answer card
const EvidenceChip: React.FC<{ id: string; label: string | null; visible: boolean; active: boolean; onClick: () => void; origin?: boolean }> = ({
  id, label, visible, active, onClick, origin,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="og-chip"
    title={visible ? `Highlight ${id} in the graph` : `${id} is not in the current graph view`}
    style={{
      ...(active ? { borderColor: 'var(--og-lavender)', color: 'var(--og-lavender)', background: 'rgb(var(--og-lavender-rgb) / 0.1)' } : {}),
      ...(origin ? { borderColor: 'rgb(var(--og-oxide-rgb) / 0.6)' } : {}),
      ...(!visible ? { opacity: 0.55, borderStyle: 'dashed' } : {}),
    }}
  >
    {origin && <Target className="w-3 h-3 text-accent-oxide" aria-hidden="true" />}
    <span>{label ?? id}</span>
    {label && <span className="text-ink/40">{id}</span>}
  </button>
);

const AnswerCard: React.FC<{
  answer: AIQueryResponse;
  describeNode: Props['describeNode'];
  isNodeVisible: Props['isNodeVisible'];
  highlighted: Set<string>;
  onHighlight: Props['onHighlight'];
}> = ({ answer, describeNode, isNodeVisible, highlighted, onHighlight }) => {
  const [copied, setCopied] = useState(false);
  const confidence = CONFIDENCE[answer.confidence] ?? CONFIDENCE.low;
  const allEvidence = useMemo(
    () => Array.from(new Set([
      ...(answer.likely_origin_node_id ? [answer.likely_origin_node_id] : []),
      ...answer.evidence_node_ids,
      ...answer.coordination_flags.flatMap((flag) => flag.evidence_node_ids),
    ])),
    [answer],
  );
  const visibleCount = allEvidence.filter(isNodeVisible).length;

  const copy = async () => {
    const text = [
      answer.summary,
      answer.likely_origin_node_id ? `Likely origin: ${answer.likely_origin_node_id} — ${answer.origin_rationale ?? ''}` : '',
      ...answer.coordination_flags.map((flag) => `• [${flag.strength}] ${flag.signal}: ${flag.details} (${flag.evidence_node_ids.join(', ')})`),
      answer.missing_evidence.length ? `Missing evidence: ${answer.missing_evidence.join('; ')}` : '',
      `Confidence: ${answer.confidence} — ${answer.confidence_note}`,
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="ai-answer">
      <p className="text-[14px] leading-relaxed text-ink">{answer.summary}</p>

      {answer.likely_origin_node_id && (
        <div className="ai-block" style={{ borderColor: 'rgb(var(--og-oxide-rgb) / 0.32)', background: 'rgb(var(--og-oxide-rgb) / 0.05)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="og-stamp" style={{ color: 'var(--og-oxide)' }}>Likely origin</span>
            <EvidenceChip
              id={answer.likely_origin_node_id}
              label={describeNode(answer.likely_origin_node_id)}
              visible={isNodeVisible(answer.likely_origin_node_id)}
              active={highlighted.has(answer.likely_origin_node_id)}
              origin
              onClick={() => onHighlight([answer.likely_origin_node_id as string], answer.likely_origin_node_id)}
            />
          </div>
          {answer.origin_rationale && <p className="mt-2 text-[12px] text-ink/70 leading-relaxed">{answer.origin_rationale}</p>}
        </div>
      )}

      {answer.coordination_flags.length > 0 && (
        <div>
          <p className="og-kicker mb-2" style={{ fontSize: 9.5 }}>Coordination signals</p>
          <ul className="space-y-2">
            {answer.coordination_flags.map((flag, index) => (
              <li key={`${flag.signal}-${index}`} className="ai-block">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <Flag className="w-3.5 h-3.5 shrink-0" style={{ color: STRENGTH_COLOR[flag.strength] }} aria-hidden="true" />
                    {flag.signal}
                  </span>
                  <span className="og-stamp shrink-0" style={{ color: STRENGTH_COLOR[flag.strength], fontSize: 8.5 }}>{flag.strength}</span>
                </div>
                <p className="mt-1.5 text-[12px] text-ink/70 leading-relaxed">{flag.details}</p>
                {flag.evidence_node_ids.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {flag.evidence_node_ids.slice(0, 10).map((id) => (
                      <EvidenceChip key={id} id={id} label={describeNode(id)} visible={isNodeVisible(id)} active={highlighted.has(id)} onClick={() => onHighlight([id])} />
                    ))}
                    {flag.evidence_node_ids.length > 10 && <span className="og-chip cursor-default">+{flag.evidence_node_ids.length - 10}</span>}
                    <button type="button" className="og-chip" onClick={() => onHighlight(flag.evidence_node_ids)} style={{ color: 'var(--og-lavender)' }}>
                      <Crosshair className="w-3 h-3" aria-hidden="true" /> all
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer.missing_evidence.length > 0 && (
        <div>
          <p className="og-kicker mb-2 flex items-center gap-1.5" style={{ fontSize: 9.5 }}>
            <SearchX className="w-3 h-3" aria-hidden="true" /> Missing or weak evidence
          </p>
          <ul className="space-y-1 text-[12px] text-ink/65 list-none">
            {answer.missing_evidence.map((item) => <li key={item} className="pl-3 relative before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-px before:bg-ink/40">{item}</li>)}
          </ul>
        </div>
      )}

      <div className="ai-block">
        <div className="flex items-center gap-3">
          <span className="og-kicker" style={{ fontSize: 9.5 }}>Confidence</span>
          <span className="flex-1 flex gap-[3px]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={confidence.pct} aria-label={`Confidence ${confidence.label}`}>
            {[33, 66, 100].map((step) => (
              <span key={step} className="h-[5px] flex-1 rounded-[1px]" style={{ background: confidence.pct >= step ? confidence.color : 'rgb(var(--og-muted-rgb) / 0.12)' }} />
            ))}
          </span>
          <span className="text-[12px] font-semibold" style={{ color: confidence.color }}>{confidence.label}</span>
        </div>
        <p className="mt-2 text-[12px] text-ink/60 leading-relaxed">{answer.confidence_note}</p>
      </div>

      {answer.discarded_node_ids.length > 0 && (
        <p className="flex items-start gap-2 text-[11px] text-accent-orange/90">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
          The model cited {answer.discarded_node_ids.length} ID{answer.discarded_node_ids.length > 1 ? 's' : ''} not present in the analysed sub-graph ({answer.discarded_node_ids.slice(0, 4).join(', ')}); they were removed from the evidence.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-2">
          {allEvidence.length > 0 && (
            <button type="button" className="og-btn-primary og-btn-ai min-h-[32px] px-3 text-[11.5px]" onClick={() => onHighlight(allEvidence, answer.likely_origin_node_id)}>
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> Highlight evidence ({visibleCount}/{allEvidence.length} in view)
            </button>
          )}
          <button type="button" className="og-btn-ghost min-h-[32px]" onClick={copy}>
            <Copy className="w-3.5 h-3.5" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {answer.context && (
          <span className="og-kicker" style={{ fontSize: 9 }} title={answer.context.truncated ? 'Sub-graph was truncated to the most relevant evidence' : undefined}>
            {answer.context.nodes_analyzed}/{answer.context.nodes_in_filter} nodes · {answer.context.detector_findings} findings
            {answer.context.model ? ` · ${answer.context.model}` : ''}
            {answer.context.latency_ms ? ` · ${(answer.context.latency_ms / 1000).toFixed(1)}s` : ''}
          </span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------- panel
export const AiChatPanel: React.FC<Props> = ({
  filters, token, hasGraphData, nodesInView, describeNode, isNodeVisible, focus, onClearFocus,
  highlightedIds, onHighlight, onClearHighlight, askRequest, storageKey,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [question, setQuestion] = useState('');
  const [entries, setEntries] = useState<Entry[]>(() => loadHistory(storageKey));
  const [pending, setPending] = useState<Entry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastAskId = useRef<number | null>(null);
  const highlighted = useMemo(() => new Set(highlightedIds), [highlightedIds]);
  const filterKey = filterKeyOf(filters);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    fetchAIStatusApi(token, controller.signal).then(setStatus).catch(() => setStatus(null));
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(entries.filter((entry) => entry.answer).slice(-12)));
    } catch {
      /* storage full or disabled */
    }
  }, [entries, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [entries, pending]);

  useEffect(() => {
    if (!pending) return undefined;
    setElapsed(0);
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [pending]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const ask = useCallback(async (text: string, askFocus: AiFocus | null) => {
    const trimmed = text.trim();
    if (trimmed.length < 3 || !token || !hasGraphData || controllerRef.current) return;
    const entry: Entry = { id: `${Date.now()}`, question: trimmed, focusLabel: askFocus?.label ?? null, filterKey };
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(entry);
    setQuestion('');
    setIsOpen(true);
    const history = entries
      .filter((item) => item.answer && item.filterKey === filterKey)
      .slice(-4)
      .map((item) => ({ question: item.question, summary: item.answer!.summary }));
    try {
      const answer = await queryAIApi(filters, trimmed, token, { focusNodeIds: askFocus?.nodeIds ?? [], history, signal: controller.signal });
      setEntries((previous) => [...previous, { ...entry, answer }]);
      const evidence = Array.from(new Set([
        ...(answer.likely_origin_node_id ? [answer.likely_origin_node_id] : []),
        ...answer.evidence_node_ids,
      ]));
      if (evidence.length) onHighlight(evidence, answer.likely_origin_node_id);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const apiError = error instanceof ApiError ? error : null;
      setEntries((previous) => [...previous, {
        ...entry,
        error: { message: error instanceof Error ? error.message : 'AI analysis failed.', status: apiError?.status ?? 0, retryAfter: apiError?.retryAfter },
      }]);
    } finally {
      controllerRef.current = null;
      setPending(null);
    }
  }, [token, hasGraphData, filterKey, entries, filters, onHighlight]);

  useEffect(() => {
    if (askRequest && askRequest.id !== lastAskId.current) {
      lastAskId.current = askRequest.id;
      void ask(askRequest.question, askRequest.focus);
    }
  }, [askRequest, ask]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    void ask(question, focus);
  };

  const cancel = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPending(null);
  };

  const retry = (entry: Entry) => {
    setEntries((previous) => previous.filter((item) => item.id !== entry.id));
    void ask(entry.question, focus);
  };

  const reset = () => {
    cancel();
    setEntries([]);
    onClearHighlight();
  };

  const notConfigured = status && !status.configured;
  const suggestions = focus ? FOCUSED_SUGGESTIONS : SUGGESTIONS;
  const canAsk = Boolean(token && hasGraphData && !pending);

  return (
    <section className="og-card ai-panel flex flex-col h-full overflow-hidden" aria-label="GraphRAG forensic analyst">
      <header className="og-card-header ai-header">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex items-center gap-3 min-w-0 text-left"
          aria-expanded={isOpen}
          aria-controls="ai-investigation-body"
        >
          <span className="ai-avatar" aria-hidden="true"><Bot className="w-4 h-4" strokeWidth={1.75} /></span>
          <span className="min-w-0">
            <span className="og-kicker block" style={{ color: 'var(--og-lavender)', fontSize: 9.5 }}>GraphRAG</span>
            <span className="block text-[14px] font-semibold text-ink truncate">Forensic Analyst</span>
          </span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {status && (
            <span className={status.configured ? 'og-badge-lavender hidden sm:inline-flex' : 'og-badge hidden sm:inline-flex'} title={status.detail ?? `${status.provider} · ${status.model}`}>
              <span className="og-dot" style={{ color: status.configured ? 'var(--og-lavender)' : 'var(--og-subtle)' }} />
              {status.configured ? status.model : 'Not configured'}
            </span>
          )}
          {entries.length > 0 && (
            <button type="button" onClick={reset} className="og-icon-btn" title="New investigation" aria-label="Clear conversation">
              <Eraser className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={() => setIsOpen((open) => !open)} className="og-icon-btn" aria-label={isOpen ? 'Collapse analyst' : 'Expand analyst'}>
            <ChevronDown className="w-4 h-4 transition-transform" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
          </button>
        </div>
      </header>

      {isOpen && (
        <div id="ai-investigation-body" className="flex flex-col flex-1 min-h-0">
          {/* scope bar */}
          <div className="ai-scope">
            <span className="og-kicker" style={{ fontSize: 9 }}>Scope</span>
            <span className="text-[11px] text-ink/70 font-mono">{nodesInView} nodes in filter</span>
            {focus && (
              <span className="og-badge-olive">
                <Target className="w-3 h-3" aria-hidden="true" /> {focus.label}
                <button type="button" onClick={onClearFocus} aria-label="Clear focus" className="hover:text-ink"><X className="w-3 h-3" /></button>
              </span>
            )}
            {highlightedIds.length > 0 && (
              <button type="button" className="og-badge-lavender hover:brightness-125" onClick={onClearHighlight}>
                {highlightedIds.length} highlighted <X className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>

          <div ref={scrollRef} className="ai-thread flex-1 min-h-0 overflow-y-auto" aria-live="polite">
            {!token && <p className="ai-notice">Sign in to brief the forensic analyst.</p>}
            {token && notConfigured && (
              <div className="ai-notice" style={{ borderColor: 'rgb(var(--og-orange-rgb) / 0.35)' }}>
                <p className="flex items-center gap-2 font-semibold text-accent-orange text-[12px]"><AlertTriangle className="w-3.5 h-3.5" /> AI provider not configured</p>
                <p className="mt-1.5 text-[12px] text-ink/65 leading-relaxed">
                  {status?.detail}{' '}
                  {status?.provider === 'vertex'
                    ? <>Run <code className="text-ink">gcloud auth application-default login</code>, set <code className="text-ink">VERTEX_PROJECT_ID</code> in <code className="text-ink">backend/.env</code>, then restart the API.</>
                    : <>Set <code className="text-ink">LLM_API_KEY</code> in <code className="text-ink">backend/.env</code> and restart the API.</>}
                </p>
              </div>
            )}
            {token && !hasGraphData && (
              <p className="ai-notice">The active filters returned no graph evidence. Widen the date range or lower the thresholds before asking.</p>
            )}

            {entries.length === 0 && !pending && token && hasGraphData && (
              <div className="ai-intro">
                <Sparkles className="w-5 h-5 text-accent-lavender" aria-hidden="true" />
                <p className="text-[13px] text-ink/80 leading-relaxed">
                  Ask about the <b className="text-ink">currently filtered graph</b>. Answers cite node IDs you can highlight, grade each signal and say what evidence is missing.
                </p>
              </div>
            )}

            {entries.map((entry, index) => {
              const filtersChanged = index > 0 && entries[index - 1].filterKey !== entry.filterKey;
              return (
                <React.Fragment key={entry.id}>
                  {filtersChanged && <div className="ai-divider"><span>Filters changed</span></div>}
                  <article className="ai-turn">
                    <div className="ai-question">
                      <span className="text-accent-lavender" aria-hidden="true">›</span>
                      <span>{entry.question}</span>
                      {entry.focusLabel && <span className="og-badge-olive ml-auto shrink-0">{entry.focusLabel}</span>}
                    </div>
                    {entry.answer && (
                      <AnswerCard answer={entry.answer} describeNode={describeNode} isNodeVisible={isNodeVisible} highlighted={highlighted} onHighlight={onHighlight} />
                    )}
                    {entry.error && (
                      <div role="alert" className="ai-error">
                        <p className="flex items-start gap-2 text-[12px] text-ink/85">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent-crimson" aria-hidden="true" />
                          <span>
                            {entry.error.message}
                            {entry.error.status === 429 && entry.error.retryAfter ? ` (retry in ~${entry.error.retryAfter}s)` : ''}
                          </span>
                        </p>
                        {entry.error.status !== 422 && (
                          <button type="button" className="og-btn-ghost min-h-[30px] mt-2" onClick={() => retry(entry)} disabled={!canAsk}>
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Retry
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                </React.Fragment>
              );
            })}

            {pending && (
              <article className="ai-turn" aria-busy="true">
                <div className="ai-question">
                  <span className="text-accent-lavender" aria-hidden="true">›</span>
                  <span>{pending.question}</span>
                </div>
                <div className="ai-pending">
                  <span className="ai-orbit" aria-hidden="true"><i /><i /><i /></span>
                  <span className="text-[12px] text-ink/70">Analysing the filtered sub-graph… <span className="og-tabular text-ink/45">{elapsed}s</span></span>
                  <button type="button" className="og-btn-ghost min-h-[28px] ml-auto" onClick={cancel}>
                    <Square className="w-3 h-3" aria-hidden="true" /> Stop
                  </button>
                </div>
                <div className="space-y-2 mt-3" aria-hidden="true">
                  <div className="og-skeleton h-3 w-11/12" />
                  <div className="og-skeleton h-3 w-9/12" />
                  <div className="og-skeleton h-3 w-10/12" />
                </div>
              </article>
            )}
          </div>

          {token && hasGraphData && (
            <div className="ai-composer">
              {entries.length === 0 && !pending && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {suggestions.map((suggestion) => (
                    <button key={suggestion} type="button" className="og-chip" disabled={!canAsk} onClick={() => void ask(suggestion, focus)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={submit} className="ai-input-shell">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  className="ai-input"
                  value={question}
                  onChange={(event) => {
                    setQuestion(event.target.value);
                    event.target.style.height = 'auto';
                    event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={focus ? `Ask about ${focus.label}…` : 'Ask about the filtered evidence…'}
                  maxLength={2000}
                  disabled={!!pending}
                  aria-label="Investigation question"
                />
                <button type="submit" className="ai-send" disabled={!canAsk || question.trim().length < 3} aria-label="Ask the analyst">
                  <ArrowUp className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </form>
              <p className="mt-1.5 og-kicker" style={{ fontSize: 8.5 }}>Enter to send · Shift+Enter for a new line · AI output can be wrong — verify on the graph</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
