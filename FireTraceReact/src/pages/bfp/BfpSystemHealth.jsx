import { useMemo, useState } from 'react';
import BfpShell from './BfpShell';

/* System Health — FRONTEND ONLY.

   Every value is generated / hard-coded on the client. "Run checks" just
   re-rolls the demo numbers. Swap DEMO_* and the roll for a call to
   /api/dashboard/health/ when wiring it up. */

const SERVICES = [
  { key: 'api', label: 'API (Django / Daphne)', detail: 'ASGI, responding' },
  { key: 'db', label: 'PostgreSQL', detail: 'firetrace-db · East Asia' },
  { key: 'redis', label: 'Redis channel layer', detail: 'firetrace-redis · pub/sub' },
  { key: 'storage', label: 'Blob storage', detail: 'firetracemedia · uploads' },
  { key: 'ws', label: 'WebSocket /ws/dashboard', detail: 'realtime push' },
];

const STAT_DEFS = [
  { key: 'uptime', label: 'Uptime (30d)', unit: '%', good: (v) => v > 99 },
  { key: 'latency', label: 'Avg response', unit: ' ms', good: (v) => v < 250 },
  { key: 'errorRate', label: 'Error rate (24h)', unit: '%', good: (v) => v < 1 },
  { key: 'connections', label: 'Live socket clients', unit: '', good: () => true },
];

function roll() {
  return {
    statuses: SERVICES.reduce((acc, s) => {
      acc[s.key] = Math.random() < 0.12 ? 'degraded' : 'operational';
      return acc;
    }, {}),
    stats: {
      uptime: (99.5 + Math.random() * 0.49).toFixed(2),
      latency: Math.round(90 + Math.random() * 180),
      errorRate: (Math.random() * 1.4).toFixed(2),
      connections: Math.round(1 + Math.random() * 6),
    },
    resources: {
      cpu: Math.round(15 + Math.random() * 55),
      memory: Math.round(40 + Math.random() * 45),
      disk: Math.round(30 + Math.random() * 40),
    },
    at: new Date(),
  };
}

function meterClass(pct) {
  if (pct >= 90) return 'bfp-meter-fill is-crit';
  if (pct >= 75) return 'bfp-meter-fill is-warn';
  return 'bfp-meter-fill';
}

function BfpSystemHealth() {
  const [snapshot, setSnapshot] = useState(roll);
  const [checking, setChecking] = useState(false);

  const overall = useMemo(() => {
    const values = Object.values(snapshot.statuses);
    if (values.includes('down')) return 'down';
    if (values.includes('degraded')) return 'degraded';
    return 'operational';
  }, [snapshot]);

  function runChecks() {
    setChecking(true);
    setTimeout(() => {
      setSnapshot(roll());
      setChecking(false);
    }, 800);
  }

  const overallLabel = {
    operational: 'All systems operational',
    degraded: 'Degraded performance',
    down: 'Outage',
  }[overall];

  return (
    <BfpShell>
      <h1 className="bfp-page-title">System Health</h1>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Status</h2>
          <span className={`bfp-health-overall is-${overall}`}>{overallLabel}</span>
        </div>
        <div className="bfp-backup-body">
          <div className="bfp-backup-row" style={{ justifyContent: 'space-between' }}>
            <span className="bfp-stat-foot">
              Last checked {snapshot.at.toLocaleTimeString()}
            </span>
            <button
              type="button"
              className="bfp-btn-ghost"
              onClick={runChecks}
              disabled={checking}
            >
              <i className="fa-solid fa-rotate" /> {checking ? 'Checking…' : 'Run checks'}
            </button>
          </div>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Metrics</h2>
          <span className="bfp-panel-sub">Demo data</span>
        </div>
        <div className="bfp-backup-body">
          <div className="bfp-stat-grid">
            {STAT_DEFS.map((d) => {
              const value = snapshot.stats[d.key];
              return (
                <div className="bfp-stat" key={d.key}>
                  <div className="bfp-stat-label">{d.label}</div>
                  <div
                    className="bfp-stat-value"
                    style={{ color: d.good(Number(value)) ? undefined : 'var(--ft-red)' }}
                  >
                    {value}
                    {d.unit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Services</h2>
        </div>
        <ul className="bfp-health-list">
          {SERVICES.map((s) => {
            const status = snapshot.statuses[s.key];
            return (
              <li className="bfp-health-row" key={s.key}>
                <i
                  className={`bfp-health-icon is-${status} fa-solid ${
                    status === 'operational' ? 'fa-circle-check' : 'fa-triangle-exclamation'
                  }`}
                />
                <span className="bfp-health-text">
                  <span className="bfp-health-label">{s.label}</span>
                  <span className="bfp-health-detail">{s.detail}</span>
                </span>
                <span className="bfp-health-check">
                  {status === 'operational' ? 'OK' : 'Degraded'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Container resources</h2>
          <span className="bfp-panel-sub">firetrace-backend</span>
        </div>
        <div className="bfp-backup-body">
          <div className="bfp-stat-grid">
            {[
              ['CPU', snapshot.resources.cpu],
              ['Memory', snapshot.resources.memory],
              ['Disk', snapshot.resources.disk],
            ].map(([label, pct]) => (
              <div className="bfp-stat" key={label}>
                <div className="bfp-stat-label">{label}</div>
                <div className="bfp-stat-value">{pct}%</div>
                <div className="bfp-meter">
                  <div className={meterClass(pct)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpSystemHealth;
