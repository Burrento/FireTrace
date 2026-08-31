import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../../styles/bfp-dashboard.css';
import { apiFetch } from '../../api';
import { clearTokens, isLoggedIn } from '../../auth';
import ThemeToggle from '../../components/ThemeToggle';

/* Chrome shared by every screen in the BFP portal: the access check, the
   header, and the tab bar.

   It lives apart from the pages so that adding a screen cannot accidentally
   ship one without the personnel check. Civilians who reach these routes are
   sent back to their own dashboard; the backend enforces the same rule
   independently through IsBFPPersonnel, so this redirect is a courtesy rather
   than the security boundary. */

function LastUpdated({ at, live }) {
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
      {/* Green pulse only while the socket is actually connected. On the
          fallback timer the dot goes grey and says so, rather than claiming a
          liveness the screen does not have. */}
      <span className={live ? 'bfp-live-dot' : 'bfp-live-dot is-polling'} />
      {live ? 'Live · ' : 'Polling · '}
      updated {seconds < 5 ? 'just now' : `${seconds}s ago`}
    </span>
  );
}

function BfpShell({ live, lastRefresh, refreshNow, children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Close the drawer on Escape while it is open.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // These are wide desktop layouts; the app shell is a phone-width column by
  // default, so opt the portal out of the cap while it is mounted.
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
        <button
          type="button"
          className="bfp-icon-btn bfp-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <i className={menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'} />
        </button>

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

        {menuOpen && <div className="bfp-drawer-backdrop" onClick={closeMenu} />}
        <nav className={menuOpen ? 'bfp-nav is-open' : 'bfp-nav'}>
          <p className="bfp-nav-group">Monitoring</p>
          {/* `end` so /bfp does not stay highlighted on /bfp/reports. */}
          <NavLink to="/bfp" end className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-gauge-high" /> Dashboard
          </NavLink>
          <NavLink to="/bfp/reports" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-list" /> All Reports
          </NavLink>
          <NavLink to="/bfp/BfpIncidentMap" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-map" /> Incident Map
          </NavLink>
          <p className="bfp-nav-group">Analytics</p>
          <NavLink to="/bfp/BfpOperational" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-chart-simple" /> Operational Overview
          </NavLink>
          <NavLink to="/bfp/BfpAnalyticReport" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-list" /> Reports
          </NavLink>
          <p className="bfp-nav-group">Administration</p>
          <NavLink to="/bfp/BfpUsers" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-user" /> Users
          </NavLink>
          <NavLink to="/bfp/BfpReference" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-server" /> Reference Data
          </NavLink>
          <NavLink to="/bfp/BfpSettings" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-gear" /> Settings
          </NavLink>
          <p className="bfp-nav-group">System</p>
          <NavLink to="/bfp/BfpAudit" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-clock" /> Audit Log
          </NavLink>
          <NavLink to="/bfp/BfpBackup" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-cloud-arrow-up" /> Backup and Restore
          </NavLink>
          <NavLink to="/bfp/BfpSystemHealth" className="bfp-nav-link" onClick={closeMenu}>
            <i className="fa-solid fa-shield-halved" /> System Health
          </NavLink>
        </nav>

        <div className="bfp-header-actions">
          <LastUpdated key={lastRefresh} at={lastRefresh} live={live} />
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

      <main className="bfp-main">{children}</main>
    </div>
  );
}

export default BfpShell;
