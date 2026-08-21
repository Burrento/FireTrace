import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/bfp-dashboard.css';
import { apiFetch } from '../../api';
import { clearTokens, isLoggedIn } from '../../auth';
import ThemeToggle from '../../components/ThemeToggle';
import ActivityFeed from '../../components/bfp/ActivityFeed';
import DashboardMap from '../../components/bfp/DashboardMap';
import KpiCards from '../../components/bfp/KpiCards';
import ReportsQueue from '../../components/bfp/ReportsQueue';
import SystemHealth from '../../components/bfp/SystemHealth';
import { useDashboardPoll, usePolledResource } from './useDashboardData';

/* The BFP Administrative Portal.

   Civilians who reach this route are sent back to their own dashboard; the
   backend enforces the same rule independently, so this redirect is a courtesy
   rather than the security boundary. */

const REFRESH_MS = 15000;

function LastUpdated({ at }) {
  const [seconds, setSeconds] = useState(0);

  /* The label ages between refreshes, so it ticks on its own timer. Elapsed
     time is measured in the callback rather than during render, keeping the
     render pure. The parent keys this component on the refresh timestamp, so
     a new refresh remounts it and the count restarts at zero. */
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(Math.round((Date.now() - at) / 1000));
    }, 5000);
    return () => clearInterval(timer);
  }, [at]);

  return (
    <span className="bfp-updated">
      <span className="bfp-live-dot" />
      Updated {seconds < 5 ? 'just now' : `${seconds}s ago`}
    </span>
  );
}

function BfpDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const { tick, lastRefresh, refreshNow } = useDashboardPoll(REFRESH_MS);

  const handleAuthError = useCallback(() => {
    setAccessDenied(true);
  }, []);

  // The dashboard is a wide desktop layout; the app shell is a phone-width
  // column by default, so opt this route out of the cap while it is mounted.
  useEffect(() => {
    document.body.dataset.shell = 'bfp';
    return () => {
      delete document.body.dataset.shell;
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }

    apiFetch('/accounts/me')
      .then((profile) => {
        if (profile.user_type !== 'bfp') {
          navigate('/dashboard');
          return;
        }
        setUser(profile);
      })
      .catch(() => {
        clearTokens();
        navigate('/login');
      });
  }, [navigate]);

  useEffect(() => {
    if (accessDenied) navigate('/dashboard');
  }, [accessDenied, navigate]);

  const kpis = usePolledResource('/api/dashboard/kpis/', tick, { onAuthError: handleAuthError });
  const map = usePolledResource('/api/dashboard/map/', tick, { onAuthError: handleAuthError });
  const activity = usePolledResource('/api/dashboard/activity/?limit=25', tick, { onAuthError: handleAuthError });
  const health = usePolledResource('/api/dashboard/health/', tick, { onAuthError: handleAuthError });

  function handleLogout() {
    clearTokens();
    navigate('/login');
  }

  if (!user) {
    return (
      <div className="bfp-boot">
        <div className="spinner" />
        <p>Loading administrative portal…</p>
      </div>
    );
  }

  return (
    <div className="bfp-dashboard">
      <header className="bfp-header">
        <div className="bfp-header-brand">
          <i className="fa-solid fa-fire-flame-curved bfp-brand-icon" />
          <div>
            <div className="bfp-brand-name">
              <span className="bfp-brand-fire">FIRE</span>
              <span className="bfp-brand-trace">TRACE</span>
            </div>
            <p className="bfp-brand-sub">BFP Administrative Portal</p>
          </div>
        </div>

        <div className="bfp-header-actions">
          <LastUpdated key={lastRefresh} at={lastRefresh} />
          <button
            type="button"
            className="bfp-icon-btn"
            onClick={refreshNow}
            title="Refresh now"
            aria-label="Refresh now"
          >
            <i className="fa-solid fa-rotate" />
          </button>
          <ThemeToggle className="bfp-icon-btn" />
          <div className="bfp-user">
            <span className="bfp-user-avatar">
              {(user.username || 'B').charAt(0).toUpperCase()}
            </span>
            <div className="bfp-user-text">
              <span className="bfp-user-name">{user.username}</span>
              <span className="bfp-user-role">BFP Personnel</span>
            </div>
          </div>
          <button type="button" className="bfp-icon-btn" onClick={handleLogout} title="Sign out">
            <i className="fa-solid fa-right-from-bracket" />
          </button>
        </div>
      </header>

      <main className="bfp-main">
        <KpiCards data={kpis.data} loading={kpis.loading} />
        {kpis.error && <p className="bfp-inline-error">{kpis.error}</p>}

        <div className="bfp-grid">
          <div className="bfp-col-main">
            <DashboardMap data={map.data} loading={map.loading} error={map.error} />
            <ReportsQueue tick={tick} onAuthError={handleAuthError} onChanged={refreshNow} />
          </div>

          <aside className="bfp-col-side">
            <SystemHealth data={health.data} loading={health.loading} error={health.error} />
            <ActivityFeed data={activity.data} loading={activity.loading} error={activity.error} />
          </aside>
        </div>
      </main>
    </div>
  );
}

export default BfpDashboard;
