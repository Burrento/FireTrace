import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api';
import RelatedReports from './RelatedReports';
import { CALAPAN_BARANGAYS } from '../../data/barangays';
import { WORKFLOW_STATUSES, statusClass } from '../../lib/workflowStatus';
import { usePolledResource } from '../../pages/bfp/useDashboardData';

/* The Incoming Reports queue.

   Two independent status columns are shown side by side on purpose: a report's
   place in the workflow and the duplicate question about it are separate
   dimensions, and collapsing them into one badge would misrepresent the data.

   The duplicate column is also where the manual disposition happens. The system
   only ever raises a flag; nothing here merges or deletes a report. */

const DUPLICATE_STATUSES = [
  { value: 'not_flagged', label: 'Not Flagged' },
  { value: 'possible_duplicate', label: 'Possible Duplicate' },
  { value: 'kept_separate', label: 'Kept Separate' },
  { value: 'confirmed_duplicate', label: 'Confirmed Duplicate' },
];

const EMPTY_FILTERS = {
  q: '',
  workflow_status: '',
  duplicate_status: '',
  barangay: '',
  has_photo: '',
};

function formatSubmitted(iso) {
  const date = new Date(iso);
  const elapsedMin = Math.round((Date.now() - date.getTime()) / 60000);

  let relative;
  if (elapsedMin < 1) relative = 'just now';
  else if (elapsedMin < 60) relative = `${elapsedMin}m ago`;
  else if (elapsedMin < 1440) relative = `${Math.floor(elapsedMin / 60)}h ago`;
  else relative = `${Math.floor(elapsedMin / 1440)}d ago`;

  return {
    absolute: date.toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    relative,
  };
}

function ReportsQueue({ tick, onAuthError, onChanged, title = 'Incoming Reports' }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  // Report ids ticked for consolidation. Ids rather than rows, so a refresh
  // landing mid-selection does not leave stale copies behind.
  const [selected, setSelected] = useState(() => new Set());
  const [consolidating, setConsolidating] = useState(false);
  // The row whose group is open. One at a time: the panel is tall, and two
  // open at once pushes the rest of the queue off the screen.
  const [openId, setOpenId] = useState(null);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return `/api/reports/queue/${query ? `?${query}` : ''}`;
  }, [filters, page]);

  const { data, error, loading } = usePolledResource(path, tick, { onAuthError });

  const rows = data?.results ?? [];
  // `count` is fires now that the queue groups; `reports_count` is the reports
  // behind them. Saying "reports" for the first would undercount the intake.
  const total = data?.count ?? 0;
  const reportsTotal = data?.reports_count ?? total;
  const hasNext = Boolean(data?.next);
  const hasPrevious = Boolean(data?.previous);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  function toggleRow(id) {
    setOpenId((current) => (current === id ? null : id));
  }

  function toggleSelected(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /* Consolidate the ticked reports into one canonical incident.

     This is the evidentiary act: these submissions describe one fire, and the
     incident is the record the station acts on. It is deliberately not a
     duplicate ruling -- every report keeps its own duplicate_status and is
     still dispositioned separately -- and nothing is merged or deleted, so the
     reports stay readable exactly as they were filed. */
  async function consolidate() {
    setConsolidating(true);
    setActionError('');
    try {
      await apiFetch('/api/incidents/verify/', {
        method: 'POST',
        body: JSON.stringify({ report_ids: [...selected] }),
      });
      setSelected(new Set());
      onChanged?.();
    } catch (err) {
      setActionError(err.message || 'Could not consolidate those reports.');
    } finally {
      setConsolidating(false);
    }
  }

  async function runAction(reportId, request) {
    setBusyId(reportId);
    setActionError('');
    try {
      await request();
      onChanged?.();
    } catch (err) {
      setActionError(err.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  function changeWorkflowStatus(report, workflow_status) {
    return runAction(report.id, () =>
      apiFetch(`/api/reports/${report.id}/status/`, {
        method: 'POST',
        body: JSON.stringify({ workflow_status }),
      }),
    );
  }

  function reviewDuplicate(report, duplicate_status) {
    return runAction(report.id, () =>
      apiFetch(`/api/reports/${report.id}/duplicate-review/`, {
        method: 'POST',
        body: JSON.stringify({ duplicate_status }),
      }),
    );
  }

  const filtersActive = Object.values(filters).some(Boolean);

  return (
    <section className="bfp-panel bfp-queue-panel">
      <header className="bfp-panel-head">
        <div>
          <h2 className="bfp-panel-title">{title}</h2>
          <p className="bfp-panel-sub">
            {total} fire{total === 1 ? '' : 's'}
            {reportsTotal !== total && ` · ${reportsTotal} reports`}
            {filtersActive ? ' matching filters' : ''}
          </p>
        </div>
      </header>

      {selected.size > 0 && (
        <div className="bfp-selection-bar">
          <span>
            {selected.size} report{selected.size === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            className="bfp-mini-btn bfp-mini-btn-primary"
            disabled={consolidating}
            onClick={consolidate}
          >
            {consolidating ? 'Consolidating…' : 'Consolidate into one incident'}
          </button>
          <button type="button" className="bfp-link-btn" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <div className="bfp-filters">
        <input
          type="search"
          className="bfp-filter-input"
          placeholder="Search reference, barangay, address…"
          value={filters.q}
          onChange={(e) => updateFilter('q', e.target.value)}
        />
        <select
          className="bfp-filter-select"
          value={filters.workflow_status}
          onChange={(e) => updateFilter('workflow_status', e.target.value)}
        >
          <option value="">All statuses</option>
          {WORKFLOW_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          className="bfp-filter-select"
          value={filters.duplicate_status}
          onChange={(e) => updateFilter('duplicate_status', e.target.value)}
        >
          <option value="">All duplicate states</option>
          {DUPLICATE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          className="bfp-filter-select"
          value={filters.barangay}
          onChange={(e) => updateFilter('barangay', e.target.value)}
        >
          <option value="">All barangays</option>
          {CALAPAN_BARANGAYS.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          className="bfp-filter-select"
          value={filters.has_photo}
          onChange={(e) => updateFilter('has_photo', e.target.value)}
        >
          <option value="">Photo: any</option>
          <option value="true">With photo</option>
          <option value="false">Without photo</option>
        </select>
        {filtersActive && (
          <button type="button" className="bfp-link-btn" onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      {actionError && <p className="bfp-inline-error">{actionError}</p>}
      {error && <p className="bfp-inline-error">{error}</p>}

      <div className="bfp-table-wrap">
        <table className="bfp-table">
          <thead>
            <tr>
              <th className="bfp-col-center" aria-label="Select" />
              <th>Report</th>
              <th>Submitted</th>
              <th>Barangay</th>
              <th>Category</th>
              <th className="bfp-col-center">Photo</th>
              <th>Status</th>
              <th>Incident</th>
              <th>Duplicate Review</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={9} className="bfp-table-empty">Loading reports…</td></tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="bfp-table-empty">
                  {filtersActive ? 'No reports match these filters.' : 'No reports submitted yet.'}
                </td>
              </tr>
            )}

            {rows.map((report) => {
              const submitted = formatSubmitted(report.created_at);
              const isFlagged = report.duplicate_status === 'possible_duplicate';
              const busy = busyId === report.id;

              const row = (
                <tr key={report.id} className={isFlagged ? 'bfp-row-flagged' : undefined}>
                  <td className="bfp-col-center">
                    {/* A report already in an incident is not loose evidence to
                        consolidate; separate it on the incident page first. */}
                    <input
                      type="checkbox"
                      checked={selected.has(report.id)}
                      disabled={Boolean(report.incident)}
                      onChange={() => toggleSelected(report.id)}
                      aria-label={`Select report ${report.id}`}
                      title={report.incident
                        ? `Already part of ${report.incident_reference}`
                        : 'Select for consolidation'}
                    />
                  </td>
                  <td>
                    {/* The row opens on the reference, not on the whole row:
                        the status dropdown and the duplicate buttons live in
                        the same row and must stay clickable on their own. */}
                    <button
                      type="button"
                      className="bfp-ref bfp-ref-btn"
                      onClick={() => toggleRow(report.id)}
                      aria-expanded={openId === report.id}
                      title="Show every report tied to this fire"
                    >
                      #{report.id}
                      {/* One fire, several callers. The count rides on the row
                          so the queue reads as a list of fires rather than of
                          phone calls. */}
                      {report.group_size > 1 && (
                        <span className="bfp-group-count">{report.group_size} reports</span>
                      )}
                    </button>
                    {report.geocoding_confidence === 'low' && (
                      <span
                        className="bfp-conf-warn"
                        title="Low geocoding confidence — not plotted on the map"
                      >
                        <i className="fa-solid fa-location-crosshairs" /> low
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="bfp-time-abs">{submitted.absolute}</span>
                    <span className="bfp-time-rel">{submitted.relative}</span>
                  </td>
                  <td>{report.barangay}</td>
                  <td>{report.incident_type_display}</td>
                  <td className="bfp-col-center">
                    {report.has_photo ? (
                      <i className="fa-solid fa-image bfp-photo-yes" title="Photo attached" />
                    ) : (
                      <i className="fa-regular fa-image bfp-photo-no" title="No photo" />
                    )}
                  </td>
                  <td>
                    {/* `status` is the one in force: a linked report follows
                        its incident, and the API refuses to move it on its own,
                        so offering the dropdown here would only produce an
                        error the operator cannot act on. */}
                    {report.incident ? (
                      <span
                        className={statusClass(report.status)}
                        title={`Governed by ${report.incident_reference}`}
                      >
                        {report.status_display}
                      </span>
                    ) : (
                      <select
                        className={`bfp-status-select ${statusClass(report.status)}`}
                        value={report.status}
                        disabled={busy}
                        onChange={(e) => changeWorkflowStatus(report, e.target.value)}
                      >
                        {WORKFLOW_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {report.incident ? (
                      <Link className="bfp-link-btn" to={`/bfp/incidents/${report.incident}`}>
                        #{report.incident}
                      </Link>
                    ) : (
                      <span className="bfp-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={statusClass(report.duplicate_status)}>
                      {report.duplicate_status_display}
                    </span>
                    {isFlagged && (
                      <div className="bfp-dup-detail">
                        <span className="bfp-dup-evidence">
                          #{report.duplicate_of} ·{' '}
                          {Math.round(report.duplicate_distance_m)} m ·{' '}
                          {Math.round((report.duplicate_time_delta_seconds ?? 0) / 60)} min apart
                        </span>
                        <div className="bfp-dup-actions">
                          <button
                            type="button"
                            className="bfp-mini-btn"
                            disabled={busy}
                            onClick={() => reviewDuplicate(report, 'kept_separate')}
                          >
                            Keep separate
                          </button>
                          <button
                            type="button"
                            className="bfp-mini-btn bfp-mini-btn-danger"
                            disabled={busy}
                            onClick={() => reviewDuplicate(report, 'confirmed_duplicate')}
                          >
                            Confirm duplicate
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );

              return row;
            })}
          </tbody>
        </table>
      </div>

      {openId !== null && (
        <RelatedReports
          reportId={openId}
          onClose={() => setOpenId(null)}
          onSelectGroup={(ids) => {
            setSelected(new Set(ids));
            setOpenId(null);
          }}
        />
      )}

      {(hasPrevious || hasNext) && (
        <footer className="bfp-pager">
          <button
            type="button"
            className="bfp-mini-btn"
            disabled={!hasPrevious}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="bfp-pager-label">Page {page}</span>
          <button
            type="button"
            className="bfp-mini-btn"
            disabled={!hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </footer>
      )}
    </section>
  );
}

export default ReportsQueue;
