import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../api';

/* One timer drives the whole dashboard so every panel shows data from the same
   moment, rather than each drifting on its own schedule.

   This is the seam where Channels replaces polling later: swap the interval for
   a WebSocket subscription that bumps `tick`, and no panel below has to change.
   The backend already emits the matching events (realtime/notify.py). */
export function useDashboardPoll(intervalMs = 15000) {
  const [tick, setTick] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(() => Date.now());

  const refreshNow = useCallback(() => {
    setTick((value) => value + 1);
    setLastRefresh(Date.now());
  }, []);

  useEffect(() => {
    let timer = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(refreshNow, intervalMs);
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
  }, [intervalMs, refreshNow]);

  return { tick, lastRefresh, refreshNow };
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
