import React, { useEffect, useState } from 'react';
import { checkHealthApi } from '../../services/api';
import { HealthStatus } from '../../types/analytics';

const MODE_LABEL: Record<HealthStatus['storage_mode'], string> = {
  neo4j: 'Neo4j Aura',
  memory: 'Dev graph',
  neo4j_unavailable: 'DB offline',
};

/** Polls /health and shows datastore + AI readiness. */
export function useHealth(intervalMs = 30000) {
  const [health, setHealth] = useState<HealthStatus | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const load = () => checkHealthApi(controller.signal).then((next) => alive && setHealth(next));
    load();
    const timer = window.setInterval(load, intervalMs);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [intervalMs]);
  return health;
}

export const SystemStatus: React.FC<{ health: HealthStatus | null | undefined; compact?: boolean }> = ({ health, compact }) => {
  if (health === undefined) {
    return <span className="og-badge"><span className="og-dot" style={{ color: 'var(--og-subtle)' }} />Checking</span>;
  }
  if (health === null) {
    return (
      <span className="og-badge-danger" title="The API is unreachable">
        <span className="og-dot og-dot-live" />API offline
      </span>
    );
  }
  const dbTone = health.storage_mode === 'neo4j' ? 'var(--og-mint)' : health.storage_mode === 'memory' ? 'var(--og-amber)' : 'var(--og-danger)';
  return (
    <span className="inline-flex items-center gap-2">
      <span className="og-badge" title={`Storage: ${health.storage_mode}`}>
        <span className="og-dot og-dot-live" style={{ color: dbTone }} />
        {MODE_LABEL[health.storage_mode]}
      </span>
      {!compact && (
        <span
          className={health.ai.configured ? 'og-badge-violet' : 'og-badge'}
          title={health.ai.configured ? `${health.ai.provider} · ${health.ai.model}` : 'Set LLM_API_KEY on the server to enable the AI analyst'}
        >
          <span className="og-dot" style={{ color: health.ai.configured ? 'var(--og-violet)' : 'var(--og-subtle)' }} />
          {health.ai.configured ? 'AI ready' : 'AI not configured'}
        </span>
      )}
    </span>
  );
};
