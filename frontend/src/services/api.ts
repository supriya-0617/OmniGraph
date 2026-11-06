import { LoginResponse, RegisterResponse } from '../types/auth';
import { AnalyticsSummary, CoordinatedCluster, CoordinationDemoResult, HealthStatus, PublicStats } from '../types/analytics';
import { AIQueryResponse, AIStatus, ConversationTurn } from '../types/ai';
import { FilterState, GraphData } from '../types/graph';

/**
 * Same-origin paths by default: Vite proxies them in development, and production
 * either serves the API on the same origin or sets VITE_API_BASE_URL.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const SESSION_EXPIRED_EVENT = 'omnigraph:session-expired';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function networkErrorMessage(): string {
  if (import.meta.env.DEV && !API_BASE_URL) {
    return 'Cannot reach the OmniGraph API. Start the backend (uvicorn on port 8000) and keep the Vite dev server running.';
  }
  return API_BASE_URL
    ? `Cannot reach the OmniGraph API at ${API_BASE_URL}.`
    : 'Cannot reach the OmniGraph API on this origin.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item) => {
      if (!isRecord(item)) return [];
      const message = item.msg ?? item.message;
      const field = Array.isArray(item.loc) ? item.loc.filter((part) => part !== 'body').join('.') : '';
      return typeof message === 'string' && message.trim() ? [field ? `${field}: ${message}` : message] : [];
    });
    if (messages.length) return messages.join('; ');
  }
  if (isRecord(detail)) {
    const message = detail.msg ?? detail.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
  fallbackError?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(networkErrorMessage(), 0);
  }

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) throw new ApiError('Invalid response from server', response.status);
    }
  }

  if (!response.ok) {
    if (response.status === 401 && options.token) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    const retryAfter = Number(response.headers.get('Retry-After')) || undefined;
    throw new ApiError(
      apiErrorMessage(isRecord(data) ? data.detail : undefined, options.fallbackError ?? `Request failed (${response.status})`),
      response.status,
      retryAfter,
    );
  }
  return data as T;
}

// --------------------------------------------------------------------- auth
export const registerApi = (email: string, password: string) =>
  request<RegisterResponse>('/auth/register', { method: 'POST', body: { email, password }, fallbackError: 'Registration failed' });

export const loginApi = (email: string, password: string) =>
  request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password }, fallbackError: 'Invalid email or password' });

export const fetchMeApi = (token: string, signal?: AbortSignal) =>
  request<{ id: string; email: string; expires_at: number }>('/auth/me', { token, signal });

// --------------------------------------------------------------------- public
export async function checkHealthApi(signal?: AbortSignal): Promise<HealthStatus | null> {
  try {
    return await request<HealthStatus>('/health', { signal });
  } catch {
    return null;
  }
}

export const fetchPublicStatsApi = (signal?: AbortSignal) => request<PublicStats>('/public/stats', { signal });

// --------------------------------------------------------------------- graph + analytics
export function buildFilterQuery(filters: FilterState): string {
  const params = new URLSearchParams({
    platform: filters.platform,
    min_severity: String(filters.minSeverity),
    min_density: String(filters.minDensity),
  });
  if (filters.dateFrom) params.set('from', filters.dateFrom);
  if (filters.dateTo) params.set('to', filters.dateTo);
  return params.toString();
}

export const fetchGraphApi = (filters: FilterState, token: string, signal?: AbortSignal) =>
  request<GraphData>(`/graph?${buildFilterQuery(filters)}`, { token, signal });

export const fetchAnalyticsSummaryApi = (filters: FilterState, token: string, signal?: AbortSignal) =>
  request<AnalyticsSummary>(`/analytics/summary?${buildFilterQuery(filters)}`, { token, signal });

export const fetchClustersApi = (filters: FilterState, token: string, signal?: AbortSignal) =>
  request<CoordinatedCluster[]>(`/analytics/clusters?${buildFilterQuery(filters)}`, { token, signal });

// --------------------------------------------------------------------- GraphRAG
export const fetchAIStatusApi = (token: string, signal?: AbortSignal) =>
  request<AIStatus>('/ai/status', { token, signal });

export interface AIQueryOptions {
  focusNodeIds?: string[];
  history?: ConversationTurn[];
  signal?: AbortSignal;
}

export function queryAIApi(
  filters: FilterState,
  question: string,
  token: string,
  { focusNodeIds = [], history = [], signal }: AIQueryOptions = {},
): Promise<AIQueryResponse> {
  return request<AIQueryResponse>('/ai/query', {
    method: 'POST',
    token,
    signal,
    fallbackError: 'AI analysis failed',
    body: {
      filters: {
        from: filters.dateFrom || null,
        to: filters.dateTo || null,
        platform: filters.platform,
        min_severity: filters.minSeverity,
        min_density: filters.minDensity,
      },
      question,
      focus_node_ids: focusNodeIds.slice(0, 60),
      history: history.slice(-4),
    },
  });
}

// --------------------------------------------------------------------- live demo burst
/** Injects a fresh coordinated burst (10 accounts, one datacenter IP, "[DEMO]" text). */
export const createCoordinationDemoApi = (platform: string, token: string) =>
  request<CoordinationDemoResult>(`/demo/coordination?platform=${encodeURIComponent(platform)}`, {
    method: 'POST',
    token,
    fallbackError: 'Unable to create demo activity',
  });
