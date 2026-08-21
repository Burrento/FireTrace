/* Token storage.
   "Remember me" decides which Storage the tokens live in:
     localStorage   -> survives closing the browser (paired with a 30-day
                       refresh token from the backend)
     sessionStorage -> cleared when the tab closes
   Reads check both, so the rest of the app does not care which was used. */

const ACCESS_KEY = 'access';
const REFRESH_KEY = 'refresh';
const REMEMBER_KEY = 'ft-remember';

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    // Private mode or blocked storage.
    return fallback;
  }
}

export function saveTokens(tokens, remember) {
  clearTokens();
  safe(() => {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(ACCESS_KEY, tokens.access);
    store.setItem(REFRESH_KEY, tokens.refresh);
    if (remember) localStorage.setItem(REMEMBER_KEY, '1');
  });
}

export function getAccessToken() {
  return safe(() => localStorage.getItem(ACCESS_KEY) || sessionStorage.getItem(ACCESS_KEY));
}

export function getRefreshToken() {
  return safe(() => localStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(REFRESH_KEY));
}

/* Writes the rotated access token back to whichever store already holds the
   session, so a remembered login stays remembered. */
export function setAccessToken(access) {
  safe(() => {
    const store = localStorage.getItem(REFRESH_KEY) ? localStorage : sessionStorage;
    store.setItem(ACCESS_KEY, access);
  });
}

export function clearTokens() {
  safe(() => {
    [localStorage, sessionStorage].forEach((store) => {
      store.removeItem(ACCESS_KEY);
      store.removeItem(REFRESH_KEY);
    });
    localStorage.removeItem(REMEMBER_KEY);
  });
}

export function isLoggedIn() {
  return Boolean(getRefreshToken());
}

export function wasRemembered() {
  return safe(() => localStorage.getItem(REMEMBER_KEY) === '1', false);
}
