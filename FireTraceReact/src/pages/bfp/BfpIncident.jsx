import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../../api';
import { CONFIRMED_STATUSES, WORKFLOW_STATUSES, statusClass } from '../../lib/workflowStatus';
import StatusConfirm from '../../components/bfp/StatusConfirm';
import BfpShell from './BfpShell';
import { useBfpPage, usePolledResource } from './useDashboardData';

/* One consolidated incident: the canonical fire, and the reports that
   evidenced it.

   This is where several accounts of one fire become one record the station
   acts on. Three things happen here and nowhere else:

   - The status is set once, on the incident, and every linked report follows
     it. Nothing is copied onto the reports: their own workflow_status is left
     as it was, and the status in force is read from the incident, so there is
     no second copy to fall out of step.
   - A report that turns out to be a different fire is separated, and goes back
     to governing itself at the status it actually had.
   - Nothing is ever merged or deleted. Each report below is the submission as
     it was filed, still readable, still carrying its own duplicate ruling --
     linking reports to one incident is an evidentiary statement, not a claim
     that they duplicate each other. */

const REFRESH_MS = 15000;

function SourceReport({ report, onSeparate, busy }) {
  return (
    <li className="bfp-source-report">
      <div className="bfp-source-main">
        <span className="bfp-ref">{report.reference_number}</span>
        <span className="bfp-source-meta">
          {report.incident_type_display} · {report.barangay} ·{' '}
          {new Date(report.created_at).toLocaleString()}
        </span>
        <span className="bfp-source-meta">
          Reported by {report.reporter_name || 'unknown'}
          {report.has_photo ? ' · photo attached' : ''}
        </span>
        {/* Its own duplicate ruling, which consolidation did not touch. */}
        <span className={statusClass(report.duplicate_status)}>
          {report.duplicate_status_display}
        </span>
      </div>
      <button
        type="button"
        className="bfp-mini-btn"
        disabled={busy}
        title="Detach this report; it keeps its own status and content"
        onClick={() => onSeparate(report)}
      >
        Separate
      </button>
    </li>
  );
}

function BfpIncident() {
  const { id } = useParams();
  const { tick, lastRefresh, refreshNow, live, onAuthError } = useBfpPage(REFRESH_MS);
  const { data, error, loading } = usePolledResource(`/api/incidents/${id}/`, tick, { onAuthError });

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(null);

  const reports = data?.source_reports ?? [];

  async function run(request) {
    setBusy(true);
    setActionError('');
    try {
      await request();
      refreshNow();
    } catch (err) {
      setActionError(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const changeStatus = (workflow_status, reason = '') => run(() =>
    apiFetch(`/api/incidents/${id}/status/`, {
      method: 'POST',
      body: JSON.stringify({ workflow_status, reason }),
    }),
  );

  // Resolved and Rejected are asked about first, here as in the queue.
  const requestStatus = (workflow_status) => {
    if (CONFIRMED_STATUSES.includes(workflow_status)) {
      setPending(workflow_status);
      return;
    }
    changeStatus(workflow_status);
  };

  const separate = (report) => run(() =>
    apiFetch(`/api/reports/${report.id}/link/`, {
      method: 'POST',
      body: JSON.stringify({ incident: null, note: 'Separated from the incident' }),
    }),
  );

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <h1 className="bfp-page-title">
        {data ? data.reference_number : 'Incident'}
      </h1>

      {pending && (
        <StatusConfirm
          label={`${data?.reference_number ?? 'This incident'} and every report in it`}
          nextStatus={pending}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={async (reason) => {
            await changeStatus(pending, reason);
            setPending(null);
          }}
        />
      )}

      {error && <p className="bfp-inline-error">{error}</p>}
      {actionError && <p className="bfp-inline-error">{actionError}</p>}
      {loading && !data && <p className="bfp-panel-sub">Loading incident…</p>}

      {data && (
        <>
          <section className="bfp-panel">
            <div className="bfp-panel-head">
              <div>
                <h2 className="bfp-panel-title">
                  {data.incident_type_display} · {data.barangay}
                </h2>
                <p className="bfp-panel-sub">
                  {data.address || 'No address recorded'} · verified by{' '}
                  {data.verified_by?.username || 'unknown'} on{' '}
                  {data.verified_at ? new Date(data.verified_at).toLocaleString() : '—'}
                </p>
              </div>
              <label className="bfp-iw-status">
                <span>Status</span>
                <select
                  className={`bfp-status-select ${statusClass(data.workflow_status)}`}
                  value={data.workflow_status}
                  disabled={busy}
                  onChange={(e) => requestStatus(e.target.value)}
                >
                  {WORKFLOW_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="bfp-panel-sub">
              Setting the status here sets it for all {reports.length} report
              {reports.length === 1 ? '' : 's'} below. Dispatch and resolution
              times are stamped on first entry, so moving a record back and
              forth does not rewrite them.
            </p>
            {data.verification_note && (
              <p className="bfp-panel-sub">Note: {data.verification_note}</p>
            )}
          </section>

          <section className="bfp-panel">
            <div className="bfp-panel-head">
              <div>
                <h2 className="bfp-panel-title">
                  Source reports ({reports.length})
                </h2>
                <p className="bfp-panel-sub">
                  Every submission behind this incident, kept as it was filed.
                  Separating one returns it to the queue on its own status.
                </p>
              </div>
            </div>
            <ul className="bfp-source-list">
              {reports.map((report) => (
                <SourceReport
                  key={report.id}
                  report={report}
                  busy={busy}
                  onSeparate={separate}
                />
              ))}
            </ul>
          </section>

          <p className="bfp-panel-sub">
            <Link className="bfp-link-btn" to="/bfp/reports">← Back to all reports</Link>
          </p>
        </>
      )}
    </BfpShell>
  );
}

export default BfpIncident;
