import { LoginResponse, RegisterResponse } from '../types/auth';
import { AnalyticsSummary, CoordinatedCluster } from '../types/analytics';
import { FilterState, GraphData } from '../types/graph';

/**
 * Use same-origin paths by default in every build. Vite proxies these paths in
 * development; production can set VITE_API_BASE_URL for a separately hosted API.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

function networkErrorMessage(): string {
  if (import.meta.env.DEV && !API_BASE_URL) {
    return (
      'Cannot reach the OmniGraph API. Start the backend (uvicorn on port 8000) ' +
      'and ensure the Vite dev server is running so /auth requests can be proxied.'
    );
  }
  return API_BASE_URL
    ? `Cannot reach the OmniGraph API at ${API_BASE_URL}.`
    : 'Cannot reach the OmniGraph API on this origin. Verify the API service or production reverse proxy.';
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(res.ok ? 'Invalid response from server' : `Request failed (${res.status})`);
  }
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
      return typeof message === 'string' && message.trim() ? [message] : [];
    });
    if (messages.length) return messages.join('; ');
  }

  if (isRecord(detail)) {
    const message = detail.msg ?? detail.message;
    if (typeof message === 'string' && message.trim()) return message;
  }

  return fallback;
}

export async function registerApi(email: string, password: string): Promise<RegisterResponse> {
  let res: Response;
  try {
    res = await fetch(apiUrl('/auth/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(networkErrorMessage());
  }

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(apiErrorMessage(isRecord(data) ? data.detail : undefined, 'Registration failed'));
  }
  return data as RegisterResponse;
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(networkErrorMessage());
  }

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(apiErrorMessage(isRecord(data) ? data.detail : undefined, 'Invalid email or password'));
  }
  return data as LoginResponse;
}

export async function checkHealthApi(): Promise<unknown | null> {
  try {
    const res = await fetch(apiUrl('/health'));
    if (!res.ok) return null;
    return await parseJsonResponse(res);
  } catch {
    return null;
  }
}

function buildFilterQuery(filters: FilterState): string {
  const params = new URLSearchParams({
    from: filters.dateFrom,
    to: filters.dateTo,
    platform: filters.platform,
    min_severity: String(filters.minSeverity),
    min_density: String(filters.minDensity),
  });
  return params.toString();
}

async function authenticatedGet<T>(
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error(networkErrorMessage());
  }

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(apiErrorMessage(
      isRecord(data) ? data.detail : undefined,
      `Request failed (${response.status})`,
    ));
  }
  return data as T;
}

export function fetchGraphApi(
  filters: FilterState,
  token: string,
  signal?: AbortSignal,
): Promise<GraphData> {
  return authenticatedGet(`/graph?${buildFilterQuery(filters)}`, token, signal);
}

export function fetchAnalyticsSummaryApi(
  filters: FilterState,
  token: string,
  signal?: AbortSignal,
): Promise<AnalyticsSummary> {
  return authenticatedGet(`/analytics/summary?${buildFilterQuery(filters)}`, token, signal);
}

export function fetchClustersApi(
  filters: FilterState,
  token: string,
  signal?: AbortSignal,
): Promise<CoordinatedCluster[]> {
  return authenticatedGet(`/analytics/clusters?${buildFilterQuery(filters)}`, token, signal);
}
