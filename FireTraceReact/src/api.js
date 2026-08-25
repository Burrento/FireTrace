import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from './auth';

// Set VITE_API_BASE_URL in FireTraceReact/.env when the backend is not on this
// machine — your LAN IP for phone testing, or a tunnel URL. Restart Vite after
// changing it; .env is only read at startup.
//
// The default is 127.0.0.1 rather than localhost on purpose: `runserver
// 0.0.0.0:8000` binds IPv4 only, and Chrome on Windows tries ::1 first, so
// every call to http://localhost:8000 is refused before Django sees it.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

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
  // A FormData body must set its own Content-Type: the browser appends the
  // multipart boundary, and hardcoding application/json here leaves the server
  // parsing a multipart payload as JSON and rejecting the whole request.
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };
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
    const error = new Error(describeError(data));
    error.status = res.status;
    // Kept whole so a form can highlight the offending inputs; the flattened
    // message is only for showing the reporter something readable.
    error.fields = data;
    throw error;
  }
  return data;
}

/* DRF reports field errors as {field: ["message"]}. Flattening those to bare
   messages loses the only part that says *which* field is wrong -- a lone "This
   field may not be blank." on the photo step reads as if the photo were
   required, when it is a description left empty two steps earlier. */
function describeError(data) {
  if (data.detail) return data.detail;
  if (typeof data === 'string') return data;

  const parts = Object.entries(data).map(([field, messages]) => {
    const text = Array.isArray(messages) ? messages.join(' ') : String(messages);
    if (field === 'non_field_errors') return text;
    return `${humanizeField(field)}: ${text}`;
  });

  return parts.join(' ') || 'Request failed';
}

function humanizeField(field) {
  const words = field.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
