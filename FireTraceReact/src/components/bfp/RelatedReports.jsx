import { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import { statusClass } from '../../lib/workflowStatus';

/* Every other report the system has tied to the same fire, shown on opening a
   row -- before anyone has ruled on anything.

   The question an operator has when a flagged report arrives is not "what does
   this one say" but "how many people are calling about this". Flagging is
   pairwise, so three calls about one fire form a chain rather than a group: the
   third is flagged against the second, the second against the first. Reading
   `duplicate_of` off the row would show one neighbour and hide the rest, which
   is why the group comes from /related/ and is walked server-side.

   Nothing here rules on anything. It is the system's reasoning laid out --
   each report with the distance and time gap that flagged it -- so the operator
   can disagree with any of it. The one action offered is to select the whole
   group for consolidation, which is still a person deciding. */

function Related({ report, distance, apart }) {
  return (
    <li className="bfp-related-item">
      <span className="bfp-ref">{report.reference_number}</span>
      <span className="bfp-related-meta">
        {new Date(report.created_at).toLocaleString()} · {report.barangay} ·{' '}
        {report.incident_type_display}
      </span>
      <span className="bfp-related-meta">
        Reported by {report.reporter_name || 'unknown'}
        {report.has_photo ? ' · photo' : ''}
        {/* Why the system tied it to this fire, not just that it did. */}
        {distance != null && ` · ${Math.round(distance)} m, ${Math.round((apart ?? 0) / 60)} min from its match`}
      </span>
      <span className="bfp-related-badges">
        <span className={statusClass(report.status)}>{report.status_display}</span>
        <span className={statusClass(report.duplicate_status)}>
          {report.duplicate_status_display}
        </span>
        {report.incident_reference && (
          <span className="bfp-related-meta">in {report.incident_reference}</span>
        )}
      </span>
    </li>
  );
}

function RelatedReports({ reportId, onSelectGroup }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  /* No reset on reportId here: only one row is open at a time and the detail
     row is keyed by report, so opening a different one unmounts this and
     mounts a fresh copy. */
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/reports/${reportId}/related/`)
      .then((payload) => !cancelled && setData(payload))
      .catch((err) => !cancelled && setError(err.message || 'Could not load related reports.'));
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (error) return <p className="bfp-inline-error">{error}</p>;
  if (!data) return <p className="bfp-panel-sub">Loading related reports…</p>;

  const { report, related, description } = data;
  // The group is this report plus the others; only loose ones can be
  // consolidated, so anything already in an incident is left out of the offer.
  const selectable = [report, ...related].filter((r) => !r.incident).map((r) => r.id);

  return (
    <div className="bfp-related">
      {description && <p className="bfp-related-description">“{description}”</p>}

      {related.length === 0 ? (
        <p className="bfp-panel-sub">
          No other report has been tied to this one. It is the only account of
          this fire the system has.
        </p>
      ) : (
        <>
          <div className="bfp-related-head">
            <strong>
              {related.length + 1} reports look like the same fire
            </strong>
            {selectable.length > 1 && (
              <button
                type="button"
                className="bfp-mini-btn"
                onClick={() => onSelectGroup(selectable)}
              >
                Select all {selectable.length} for consolidation
              </button>
            )}
          </div>
          <ul className="bfp-related-list">
            <Related
              report={report}
              distance={report.duplicate_distance_m}
              apart={report.duplicate_time_delta_seconds}
            />
            {related.map((r) => (
              <Related
                key={r.id}
                report={r}
                distance={r.duplicate_distance_m}
                apart={r.duplicate_time_delta_seconds}
              />
            ))}
          </ul>
          <p className="bfp-panel-sub">
            Flagged by the system, not ruled on. Keeping them separate, confirming
            a duplicate and consolidating them into one incident are all still
            yours to decide.
          </p>
        </>
      )}
    </div>
  );
}

export default RelatedReports;
