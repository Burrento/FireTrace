import BfpShell from './BfpShell';
import { useBfpPage, usePolledResource } from './useDashboardData';

/* System Health, from /api/dashboard/health/.

   Everything on this page is something the server actually determined on this
   request. There is deliberately no uptime percentage, error rate or CPU
   meter: a single Django process cannot observe any of those about itself, and
   a plausible-looking number would be indistinguishable from a real one on the
   screen an operator checks when they suspect something is wrong.

   Each row shows how its status was established. `live` means the component
   was exercised just now; `config` means only its configuration was read, so a
   green row is not a claim that the service was reached. */

const REFRESH_MS = 15000;

const STATUS_ICON = {
  operational: 'fa-circle-check',
  degraded: 'fa-triangle-exclamation',
  down: 'fa-circle-xmark',
};

const OVERALL_LABEL = {
  operational: 'All systems operational',
  degraded: 'Degraded performance',
  down: 'Outage',
};

const CHECK_LABEL = {
  live: 'Checked just now',
  config: 'Configuration only',
};

function BfpSystemHealth() {
  const { tick, lastRefresh, refreshNow, live, onAuthError } = useBfpPage(REFRESH_MS);
  const { data, loading, error } = usePolledResource('/api/dashboard/health/', tick, {
    onAuthError,
  });

  const components = data?.components ?? [];
  const counts = data?.record_counts;

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <h1 className="bfp-page-title">System Health</h1>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Status</h2>
          {data?.overall && (
            <span className={`bfp-health-overall is-${data.overall}`}>
              {OVERALL_LABEL[data.overall] ?? data.overall}
            </span>
          )}
        </div>
        <div className="bfp-backup-body">
          <div className="bfp-backup-row" style={{ justifyContent: 'space-between' }}>
            <span className="bfp-stat-foot">
              {data?.checked_at
                ? `Last checked ${new Date(data.checked_at).toLocaleTimeString()}`
                : 'Checking services…'}
            </span>
            <button
              type="button"
              className="bfp-btn-ghost"
              onClick={refreshNow}
              disabled={loading}
            >
              <i className="fa-solid fa-rotate" /> {loading ? 'Checking…' : 'Run checks'}
            </button>
          </div>
          {error && <p className="bfp-inline-error">{error}</p>}
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Services</h2>
          <span className="bfp-panel-sub">{components.length} checked</span>
        </div>
        <ul className="bfp-health-list">
          {components.map((component) => (
            <li className="bfp-health-row" key={component.key}>
              <i
                className={`bfp-health-icon is-${component.status} fa-solid ${
                  STATUS_ICON[component.status] ?? 'fa-circle'
                }`}
              />
              <span className="bfp-health-text">
                <span className="bfp-health-label">{component.label}</span>
                <span className="bfp-health-detail">{component.detail}</span>
              </span>
              <span
                className={`bfp-health-check is-${component.check}`}
                title={CHECK_LABEL[component.check]}
              >
                {component.check}
              </span>
            </li>
          ))}
          {components.length === 0 && (
            <li className="bfp-panel-muted" style={{ padding: '14px 16px' }}>
              {loading ? 'Checking services…' : 'No components reported.'}
            </li>
          )}
        </ul>
        <p className="bfp-panel-foot">
          <strong>live</strong> means the component answered on this request.{' '}
          <strong>config</strong> means only its configuration was read.
        </p>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Realtime</h2>
          <span className="bfp-panel-sub">
            {data?.realtime_transport ? `Server: ${data.realtime_transport}` : '—'}
          </span>
        </div>
        <div className="bfp-backup-body">
          <p className="bfp-backup-note">
            {/* The two can legitimately disagree: the server may be configured
                for websockets while this particular browser has fallen back to
                the timer, which is exactly the situation worth surfacing. */}
            The server is configured for <strong>{data?.realtime_transport ?? 'unknown'}</strong>{' '}
            delivery. This dashboard is currently{' '}
            <strong>{live ? 'connected to the live socket' : 'polling on a timer'}</strong>.
            {data?.realtime_transport === 'websocket' && !live && (
              <> The socket is down, so this screen may be up to a minute stale.</>
            )}
          </p>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Records on file</h2>
        </div>
        <div className="bfp-backup-body">
          <div className="bfp-stat-grid">
            {[
              ['Reports', counts?.reports],
              ['Incidents', counts?.incidents],
              ['Audit entries', counts?.audit_entries],
            ].map(([label, value]) => (
              <div className="bfp-stat" key={label}>
                <div className="bfp-stat-label">{label}</div>
                <div className="bfp-stat-value">{value ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpSystemHealth;
