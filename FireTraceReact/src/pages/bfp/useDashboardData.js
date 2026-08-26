import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, apiFetch } from '../../api';
import { getAccessToken } from '../../auth';

/* Drives the whole dashboard from one clock so every panel shows data from the
   same moment, rather than each drifting on its own schedule.

   The clock is a WebSocket: `realtime.notify.broadcast_dashboard_event` fires
   on every personnel mutation and on every civilian report, and the server
   relays it here. A push carries no data -- it only means "refetch now" -- so
   the REST endpoints stay the single place that reads and scopes the database.

   The timer is still here as a safety net, but slows to `IDLE_INTERVAL_MS`
   once the socket is live, and drops back to `intervalMs` if it drops. A
   dashboard that misses a push is then at worst a minute stale instead of
   silently frozen. */
const IDLE_INTERVAL_MS = 60000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

// Application-range close codes from DashboardConsumer.
const CLOSE_UNAUTHENTICATED = 4401;
const CLOSE_FORBIDDEN = 4403;

function dashboardSocketUrl() {
  const base = new URL(API_BASE_URL, window.location.origin);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = '/ws/dashboard';
  return base.toString();
}

export function useDashboardPoll(intervalMs = 15000) {
  const [tick, setTick] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(() => Date.now());
  const [live, setLive] = useState(false);

  const refreshNow = useCallback(() => {
    setTick((value) => value + 1);
    setLastRefresh(Date.now());
  }, []);

  /* One socket for the life of the dashboard. Kept open on a hidden tab: it
     costs nothing while idle and means the screen is already current when the
     operator looks back, instead of showing a stale moment until the next
     fetch lands. */
  useEffect(() => {
    let socket = null;
    let reconnectTimer = null;
    let attempts = 0;
    let closed = false;

    function scheduleReconnect() {
      if (closed || reconnectTimer) return;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS);
      attempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    function connect() {
      if (closed) return;

      const token = getAccessToken();
      if (!token) {
        scheduleReconnect();
        return;
      }

      try {
        socket = new WebSocket(dashboardSocketUrl());
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        // Sent as a message rather than a query parameter: a token in the URL
        // lands in server logs, browser history and any proxy between.
        socket.send(JSON.stringify({ type: 'auth', token: getAccessToken() }));
      };

      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === 'ready') {
          attempts = 0;
          setLive(true);
        } else if (message.type === 'event') {
          refreshNow();
        }
      };

      socket.onclose = (event) => {
        setLive(false);
        socket = null;

        // Not BFP personnel: reconnecting would fail identically every time.
        if (event.code === CLOSE_FORBIDDEN) return;

        // The access token expired mid-session. Any authenticated call renews
        // it through api.js's shared refresh, so borrow that and retry.
        if (event.code === CLOSE_UNAUTHENTICATED) {
          apiFetch('/accounts/me').catch(() => {});
        }
        scheduleReconnect();
      };

      socket.onerror = () => socket?.close();
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [refreshNow]);

  useEffect(() => {
    let timer = null;
    const period = live ? IDLE_INTERVAL_MS : intervalMs;

    const start = () => {
      if (timer) return;
      timer = setInterval(refreshNow, period);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
    };

    // A background tab does not need live incident data; resume on return and
    // refresh immediately so the operator never reads a stale screen.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshNow();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, live, refreshNow]);

  return { tick, lastRefresh, refreshNow, live };
}

/* Fetches `path` on mount and on every tick.

   Keeps the previous payload visible while a refresh is in flight, so panels
   never flash empty every 15 seconds. `onAuthError` fires for 401/403 so the
   page can bounce a non-BFP user out. */
export function usePolledResource(path, tick, { onAuthError } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const authErrorRef = useRef(onAuthError);
  useEffect(() => {
    authErrorRef.current = onAuthError;
  });

  useEffect(() => {
    let cancelled = false;

    apiFetch(path)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401 || err.status === 403) {
          authErrorRef.current?.(err);
          return;
        }
        setError(err.message || 'Unable to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  return { data, error, loading };
}
