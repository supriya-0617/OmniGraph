import React, { useEffect, useState } from 'react';
import { checkHealthApi } from '../../services/api';
import { HealthStatus } from '../../types/analytics';

const MODE_LABEL: Record<HealthStatus['storage_mode'], string> = {
  neo4j: 'Neo4j Aura',
  memory: 'Dev graph',
  neo4j_unavailable: 'Neo4j offline',
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
      <span className="og-badge-crimson" title="The API is unreachable">
        <span className="og-dot og-dot-live" />API offline
      </span>
    );
  }
  const dbTone = health.storage_mode === 'neo4j' ? 'var(--og-sage)' : health.storage_mode === 'memory' ? 'var(--og-orange)' : 'var(--og-crimson)';
  return (
    <span className="inline-flex items-center gap-2">
      <span className="og-badge" title={`Storage: ${health.storage_mode}`}>
        <span className="og-dot og-dot-live" style={{ color: dbTone }} />
        {MODE_LABEL[health.storage_mode]}
      </span>
      {!compact && (
        <>
          {health.auth_database?.configured && (
            <span className={health.auth_database.connected ? 'og-badge-olive' : 'og-badge-crimson'} title="MongoDB analyst account store">
              <span className="og-dot" style={{ color: health.auth_database.connected ? 'var(--og-olive)' : 'var(--og-crimson)' }} />
              {health.auth_database.connected ? 'Auth ready' : 'Auth offline'}
            </span>
          )}
          <span
            className={health.ai.configured ? 'og-badge-lavender' : 'og-badge'}
            title={health.ai.configured ? `${health.ai.provider} · ${health.ai.model}` : 'Configure the server LLM provider to enable the AI analyst'}
          >
            <span className="og-dot" style={{ color: health.ai.configured ? 'var(--og-lavender)' : 'var(--og-subtle)' }} />
            {health.ai.configured ? 'AI ready' : 'AI not configured'}
          </span>
        </>
      )}
    </span>
  );
};
