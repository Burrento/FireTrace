import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import BfpShell from './BfpShell';
import { useBfpPage, usePolledResource } from './useDashboardData';

/* The personnel activity trail, from /api/dashboard/audit/.

   Filtering and paging happen on the server, not in the browser: the audit log
   is the one table here that grows without bound, and a page that filtered a
   client-side copy would have to download the whole history first.

   The feed merges the audit log with the system's own timeline events. A trail
   that showed the ruling on a duplicate but not the flag that prompted it
   would not explain why anyone was asked to rule. */

const REFRESH_MS = 30000;
const PAGE_SIZE = 50;
// The server caps a single request at 200. The CSV takes one request rather
// than paging the whole history into the browser, so a larger archive exports
// its newest slice and says so instead of quietly truncating.
const CSV_LIMIT = 200;

const DAY_CHOICES = [
  { value: 0, label: 'All time' },
  { value: 1, label: 'Last 24 hours' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
];

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toCsv(rows) {
  const header = ['Timestamp', 'Actor', 'Action', 'Summary', 'Reference', 'Source'];
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((row) =>
    [
      new Date(row.created_at).toISOString(),
      row.actor_name,
      row.action_display,
      row.summary,
      row.reference,
      row.source,
    ]
      .map(escape)
      .join(','),
  );
  return [header.map(escape).join(','), ...lines].join('\r\n');
}

function download(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Object URLs live until revoked, so an operator exporting repeatedly would
  // otherwise leak a blob per download for the life of the tab.
  URL.revokeObjectURL(url);
}

function BfpAudit() {
  const { tick, lastRefresh, refreshNow, live, onAuthError } = useBfpPage(REFRESH_MS);

  const [query, setQuery] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [days, setDays] = useState(0);
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState('');

  const debouncedQuery = useDebounced(query);

  const params = useMemo(() => {
    const search = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (debouncedQuery.trim()) search.set('q', debouncedQuery.trim());
    if (actor) search.set('actor', actor);
    if (action) search.set('action', action);
    if (days) search.set('days', String(days));
    return search;
  }, [debouncedQuery, actor, action, days, offset]);

  /* Every filter resets the page as it changes. Done here rather than in an
     effect watching the filters: an effect would run *after* a render that had
     already fetched page 3 of the new result set, so the table would flash the
     wrong slice (or an empty one, if the new set is shorter) before correcting
     itself. */
  function filterSetter(setter) {
    return (value) => {
      setter(value);
      setOffset(0);
    };
  }

  const { data, loading, error } = usePolledResource(
    `/api/dashboard/audit/?${params.toString()}`,
    tick,
    { onAuthError },
  );

  const rows = data?.results ?? [];
  const count = data?.count ?? 0;
  const from = count === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, count);

  async function exportCsv() {
    setExporting(true);
    setExportNote('');
    try {
      const csvParams = new URLSearchParams(params);
      csvParams.set('limit', String(CSV_LIMIT));
      csvParams.set('offset', '0');
      const payload = await apiFetch(`/api/dashboard/audit/?${csvParams.toString()}`);
      const entries = payload.results ?? [];

      download(
        toCsv(entries),
        `firetrace-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      setExportNote(
        payload.count > entries.length
          ? `Exported the newest ${entries.length} of ${payload.count} matching entries.`
          : `Exported ${entries.length} entries.`,
      );
    } catch (err) {
      setExportNote(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <BfpShell live={live} lastRefresh={lastRefresh} refreshNow={refreshNow}>
      <h1 className="bfp-page-title">Audit Logs</h1>

      <section className="bfp-panel">
        <div className="bfp-panel-head">
          <h2 className="bfp-panel-title">Personnel activity</h2>
          <span className="bfp-panel-sub">
            {loading && !data ? 'Loading…' : `${count} ${count === 1 ? 'entry' : 'entries'}`}
          </span>
        </div>

        <div className="bfp-filters">
          <input
            className="bfp-filter-input"
            placeholder="Search action, reference, barangay…"
            value={query}
            onChange={(event) => filterSetter(setQuery)(event.target.value)}
          />
          <select
            className="bfp-filter-select"
            value={actor}
            onChange={(event) => filterSetter(setActor)(event.target.value)}
          >
            <option value="">All actors</option>
            {(data?.actors ?? []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="bfp-filter-select"
            value={action}
            onChange={(event) => filterSetter(setAction)(event.target.value)}
          >
            <option value="">All actions</option>
            {(data?.actions ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="bfp-filter-select"
            value={days}
            onChange={(event) => filterSetter(setDays)(Number(event.target.value))}
          >
            {DAY_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="bfp-btn-csv"
            onClick={exportCsv}
            disabled={exporting || count === 0}
          >
            <i className="fa-solid fa-file-csv" /> {exporting ? 'Exporting…' : 'CSV'}
          </button>
        </div>

        {error && <p className="bfp-inline-error">{error}</p>}
        {exportNote && <p className="bfp-panel-muted">{exportNote}</p>}

        <div className="bfp-table-wrap">
          <table className="bfp-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Summary</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{fmt(row.created_at)}</td>
                  <td>
                    <span
                      className={
                        row.actor_name === 'System' ? 'bfp-activity-actor is-system' : ''
                      }
                    >
                      {row.actor_name}
                    </span>
                  </td>
                  <td>{row.action_display}</td>
                  <td>{row.summary}</td>
                  <td className="bfp-ref">{row.reference || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="bfp-table-empty">
                    {loading ? 'Loading…' : 'No entries match the filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bfp-pager">
          <button
            type="button"
            className="bfp-mini-btn"
            onClick={() => setOffset((value) => Math.max(value - PAGE_SIZE, 0))}
            disabled={offset === 0}
          >
            Previous
          </button>
          <span className="bfp-pager-label">
            {from}–{to} of {count}
          </span>
          <button
            type="button"
            className="bfp-mini-btn"
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
            disabled={to >= count}
          >
            Next
          </button>
        </div>
      </section>
    </BfpShell>
  );
}

export default BfpAudit;
