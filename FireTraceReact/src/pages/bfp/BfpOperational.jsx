import { useState } from 'react';
import BfpShell from './BfpShell';
import { useBfpPage, usePolledResource } from './useDashboardData';

/* Operational Overview, from /api/dashboard/operational/.

   Descriptive only, like everything else in `analytics`: counts of what has
   happened and ratios between them. Nothing here forecasts, scores or ranks a
   barangay by risk.

   Every gauge carries the counts behind its percentage. "100% reviewed" out of
   one report and out of four hundred are different claims, and a ring alone
   cannot tell them apart -- which is what made the demo version of this page
   misleading rather than merely fake. */

const REFRESH_MS = 30000;

function formatDuration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function dayLabel(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

function Gauge({ label, percent, count, total, detail }) {
  const size = 120;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // A null percent means nothing was counted, which is not the same as zero:
  // the ring stays empty and the figure reads "n/a" rather than "0%".
  const dash = percent == null ? 0 : (percent / 100) * circumference;
  const colour = percent == null ? 'var(--civ-border)' : 'var(--ft-red, #e2602f)';

  return (
    <figure className="bfp-gauge">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${percent == null ? 'no data' : `${percent}%`}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--civ-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="bfp-gauge-value"
          fill={percent == null ? 'var(--civ-muted, #888)' : colour}
        >
          {percent == null ? 'n/a' : `${percent}%`}
        </text>
      </svg>
      <figcaption>
        {label}
        <span className="bfp-stat-foot">
          {count} of {total} · {detail}
        </span>
      </figcaption>
    </figure>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((day) => day.reports), 1);

  return (
    <div className="bfp-bars" style={{ height: 180 }}>
      {data.map((day) => (
        <div key={day.date} className="bfp-bar-col">
          <span className="bfp-bar-count">{day.reports}</span>
          <div
            className="bfp-bar"
            style={{ height: `${(day.reports / max) * 100}%` }}
            title={`${day.date}: ${day.reports} report(s), ${day.incidents} incident(s)`}
          />
          <span className="bfp-bar-label">{dayLabel(day.date)}</span>
        </div>
      ))}
    </div>
  );
}

function BfpOperational() {
  const { tick, lastRefresh, refreshNow, live, onAuthError } = useBfpPage(REFRESH_MS);
  const [days, setDays] = useState(7);

  const { data, loading, error } = usePolledResource(
    `/api/dashboard/operational/?days=${days}`,
    tick,
    { onAuthError },
  );

  const daily = data?.daily ?? [];
  const rates = data?.rates ?? [];
  const times = data?.response_times;
  const totals = data?.totals;

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <h1 className="bfp-page-title">Operational Overview</h1>

      {error && <p className="bfp-inline-error">{error}</p>}

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Key rates</h2>
          <div className="bfp-window-switch">
            {(data?.days_choices ?? [7, 30, 90]).map((choice) => (
              <button
                key={choice}
                type="button"
                className={choice === days ? 'bfp-mini-btn is-active' : 'bfp-mini-btn'}
                onClick={() => setDays(choice)}
              >
                {choice}d
              </button>
            ))}
          </div>
        </div>
        <div className="bfp-gauge-row">
          {rates.map((rate) => (
            <Gauge key={rate.key} {...rate} />
          ))}
          {rates.length === 0 && (
            <p className="bfp-panel-muted" style={{ padding: '18px 16px' }}>
              {loading ? 'Loading…' : 'No data for this window.'}
            </p>
          )}
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Reports received</h2>
          <span className="bfp-panel-sub">
            {totals ? `${totals.reports} in the last ${days} days` : '—'}
          </span>
        </div>
        <div style={{ padding: '18px 16px' }}>
          {daily.length > 0 ? (
            <BarChart data={daily} />
          ) : (
            <p className="bfp-panel-muted">{loading ? 'Loading…' : 'No reports in this window.'}</p>
          )}
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Observed response times</h2>
          <span className="bfp-panel-sub">Descriptive, not predictive</span>
        </div>
        <div className="bfp-backup-body">
          <div className="bfp-stat-grid">
            <div className="bfp-stat">
              <div className="bfp-stat-label">Verified to dispatched</div>
              <div className="bfp-stat-value">
                {formatDuration(times?.average_dispatch_seconds)}
              </div>
              <div className="bfp-stat-foot">
                mean of {times?.dispatch_sample ?? 0} incident(s)
              </div>
            </div>
            <div className="bfp-stat">
              <div className="bfp-stat-label">Verified to resolved</div>
              <div className="bfp-stat-value">
                {formatDuration(times?.average_resolution_seconds)}
              </div>
              <div className="bfp-stat-foot">
                mean of {times?.resolution_sample ?? 0} incident(s)
              </div>
            </div>
            <div className="bfp-stat">
              <div className="bfp-stat-label">Incidents created</div>
              <div className="bfp-stat-value">{totals?.incidents ?? '—'}</div>
              <div className="bfp-stat-foot">
                {totals?.incidents_all_time ?? 0} all time
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">By category</h2>
        </div>
        <div className="bfp-table-wrap">
          <table className="bfp-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Reports</th>
              </tr>
            </thead>
            <tbody>
              {(data?.by_type ?? []).map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
              {!data && (
                <tr>
                  <td colSpan={2} className="bfp-table-empty">
                    {loading ? 'Loading…' : 'No data.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Busiest barangays</h2>
          <span className="bfp-panel-sub">Where reports came from, not a risk ranking</span>
        </div>
        <div className="bfp-table-wrap">
          <table className="bfp-table">
            <thead>
              <tr>
                <th>Barangay</th>
                <th>Reports</th>
              </tr>
            </thead>
            <tbody>
              {(data?.by_barangay ?? []).map((row) => (
                <tr key={row.barangay}>
                  <td>{row.barangay}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
              {(data?.by_barangay ?? []).length === 0 && (
                <tr>
                  <td colSpan={2} className="bfp-table-empty">
                    {loading ? 'Loading…' : 'No reports in this window.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpOperational;
