import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from './auth';

// Set VITE_API_BASE_URL in FireTraceReact/.env when the backend is not on
// localhost — your LAN IP for phone testing, or a tunnel URL. Restart Vite
// after changing it; .env is only read at startup.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/* Shared across callers so several parallel 401s trigger one refresh, not one
   refresh each. */
let refreshPromise = null;

function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(null);

  refreshPromise = fetch(`${API_BASE_URL}/accounts/login/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || !data.access) {
        // The refresh token expired or was rejected — the session is over.
        clearTokens();
        return null;
      }
      setAccessToken(data.access);
      return data.access;
    })
    .catch(() => {
      clearTokens();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function send(path, options, token) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

/* skipAuth is for login/register, which must not send a stale token or try to
   refresh when the credentials themselves were wrong. */
export async function apiFetch(path, options = {}, { skipAuth = false } = {}) {
  let res = await send(path, options, skipAuth ? null : getAccessToken());

  // Access tokens last an hour; renew silently and retry once.
  if (!skipAuth && res.status === 401 && getRefreshToken()) {
    const access = await refreshAccessToken();
    if (access) res = await send(path, options, access);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      data.detail || Object.values(data).flat().join(' ') || 'Request failed',
    );
    error.status = res.status;
    throw error;
  }
  return data;
}
