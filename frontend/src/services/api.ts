import { LoginResponse, RegisterResponse } from '../types/auth';
import { AnalyticsSummary, CoordinatedCluster } from '../types/analytics';
import { FilterState, GraphData } from '../types/graph';

/**
 * In dev, default to same-origin requests so Vite's `/auth` proxy reaches FastAPI (no CORS).
 * Override with VITE_API_BASE_URL (see frontend/.env.example).
 */
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? '' : 'http://localhost:8000')
).replace(/\/$/, '');

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
  return `Cannot reach the OmniGraph API at ${API_BASE_URL || '(same origin)'}. ` +
    'Is the FastAPI backend running on port 8000?';
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

  const data = (await parseJsonResponse(res)) as RegisterResponse & { detail?: string };
  if (!res.ok) {
    throw new Error(data.detail || 'Registration failed');
  }
  return data;
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

  const data = (await parseJsonResponse(res)) as LoginResponse & { detail?: string };
  if (!res.ok) {
    throw new Error(data.detail || 'Invalid email or password');
  }
  return data;
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

  const data = (await parseJsonResponse(response)) as T & { detail?: string };
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
  return data;
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
