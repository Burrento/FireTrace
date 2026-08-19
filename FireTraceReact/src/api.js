export const API_BASE_URL = 'http://localhost:8000';

const ACCESS_KEY = 'access';
const REFRESH_KEY = 'refresh';

// "Remember me" sessions live in localStorage and survive a browser restart.
// Un-remembered ones live in sessionStorage and end when the tab closes.
function sessionStore() {
  return localStorage.getItem(REFRESH_KEY) ? localStorage : sessionStorage;
}

export function setTokens(tokens, remember) {
  clearTokens();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(ACCESS_KEY, tokens.access);
  store.setItem(REFRESH_KEY, tokens.refresh);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY) ?? sessionStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
}

export function clearTokens() {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(ACCESS_KEY);
    store.removeItem(REFRESH_KEY);
  }
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || Object.values(data).flat().join(' ') || 'Request failed');
  }
  return data;
}

// Shared between concurrent callers so that several requests failing with 401
// at the same moment trigger one refresh, not one each. The dashboard fires two
// requests on mount, so this matters.
let refreshPromise = null;

function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(null);

  const store = sessionStore();
  refreshPromise = fetch(`${API_BASE_URL}/accounts/login/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data?.access) return null;
      store.setItem(ACCESS_KEY, data.access);
      return data.access;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * fetch() with the bearer token attached. On a 401 it refreshes the access
 * token once and retries; if the refresh also fails the session is over, so
 * the tokens are cleared and the 401 is handed back for the caller to
 * redirect on.
 */
export async function authFetch(path, options = {}) {
  const send = (token) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await send(getAccessToken());
  if (res.status !== 401) return res;

  const access = await refreshAccessToken();
  if (!access) {
    clearTokens();
    return res;
  }
  return send(access);
}

/** authFetch + JSON parsing, mirroring apiFetch's error handling. */
export async function authFetchJson(path, options = {}) {
  const res = await authFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || Object.values(data).flat().join(' ') || 'Request failed');
  }
  return data;
}

/** Revokes the refresh token server-side, then drops the local copies. */
export async function logout() {
  const refresh = getRefreshToken();
  if (refresh) {
    try {
      await authFetch('/accounts/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      });
    } catch {
      // Offline or server down: still clear locally so the device is logged out.
    }
  }
  clearTokens();
}
