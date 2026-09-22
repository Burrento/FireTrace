import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api';
import { statusClass } from '../../lib/workflowStatus';

/* The reports behind one queue row.

   The queue shows one row per fire; this is what is behind it. The question an
   operator has on opening a row is not "what does this one report say" but
   "how many people are calling about this".

   Flagging is pairwise, so three calls about one fire form a chain rather than
   a group -- third flagged against second, second against first. Reading
   `duplicate_of` here would show one neighbour and hide the rest, so the group
   comes from /related/, which walks the chain server-side off the same rule
   the queue groups by.

   Nothing here rules on anything. It lays out the system's reasoning -- each
   report with the distance and time gap that flagged it -- so the operator can
   disagree with any of it. The one action offered is to select the whole group
   for consolidation, which is still a person deciding. */

function Related({ report, distance, apart, onRule, busy }) {
  const isFlagged = report.duplicate_status === 'possible_duplicate';
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
        {report.incident && (
          /* The queue no longer carries an incident column, so this is the way
             through to the incident itself. */
          <Link className="bfp-link-btn" to={`/bfp/incidents/${report.incident}`}>
            {report.incident_reference}
          </Link>
        )}
      </span>
      {/* Ruling on a report, beside the reports the ruling is about -- it was
          in the queue row, where the other accounts of the fire were not
          visible to judge it against. Only a flagged report can be ruled on:
          the API accepts the two manual dispositions and nothing else. */}
      {isFlagged && (
        <span className="bfp-dup-actions">
          <button
            type="button"
            className="bfp-mini-btn"
            disabled={busy}
            onClick={() => onRule(report, 'kept_separate')}
          >
            Keep separate
          </button>
          <button
            type="button"
            className="bfp-mini-btn bfp-mini-btn-danger"
            disabled={busy}
            onClick={() => onRule(report, 'confirmed_duplicate')}
          >
            Confirm duplicate
          </button>
        </span>
      )}
    </li>
  );
}

function RelatedReports({ reportId, onSelectGroup, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  /* No reset on reportId: the modal is mounted only while a row is open and
     is keyed by nothing else, so opening a different row unmounts this and
     mounts a fresh copy. */
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/reports/${reportId}/related/`)
      .then((payload) => !cancelled && setData(payload))
      .catch((err) => !cancelled && setError(err.message || 'Could not load related reports.'));
    return () => {
      cancelled = true;
    };
  }, [reportId, reload]);

  /* A ruling changes what the group looks like, so the modal refetches and the
     queue behind it refreshes. The modal stays open: an operator ruling on one
     report of three is usually about to rule on the next. */
  async function rule(report, duplicate_status) {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/api/reports/${report.id}/duplicate-review/`, {
        method: 'POST',
        body: JSON.stringify({ duplicate_status }),
      });
      setReload((n) => n + 1);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not record that ruling.');
    } finally {
      setBusy(false);
    }
  }

  // Escape closes it, which is what anyone reaches for before hunting the X.
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { report, related, description } = data ?? {};
  // The group is this report plus the others; only loose ones can be
  // consolidated, so anything already in an incident is left out of the offer.
  const selectable = data
    ? [report, ...related].filter((r) => !r.incident).map((r) => r.id)
    : [];

  return (
    // The backdrop closes it; the dialog stops the click so a press inside
    // does not travel up and shut the thing being read.
    <div className="bfp-modal-backdrop" onClick={onClose}>
      <div
        className="bfp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Reports tied to the same fire"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bfp-modal-head">
          <h2 className="bfp-panel-title">
            {data ? data.report.reference_number : 'Report'}
          </h2>
          <button
            type="button"
            className="bfp-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className="bfp-modal-body">
    {error && <p className="bfp-inline-error">{error}</p>}
    {!error && !data && <p className="bfp-panel-sub">Loading reports…</p>}
    {data && (
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
              onRule={rule}
              busy={busy}
            />
            {related.map((r) => (
              <Related
                key={r.id}
                report={r}
                distance={r.duplicate_distance_m}
                apart={r.duplicate_time_delta_seconds}
                onRule={rule}
                busy={busy}
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
    )}
        </div>
      </div>
    </div>
  );
}

export default RelatedReports;
